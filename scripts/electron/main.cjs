const { createReadStream, existsSync, readFileSync, statSync } = require("node:fs");
const { createServer } = require("node:http");
const { extname, resolve, sep } = require("node:path");
const {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  shell,
  Tray,
} = require("electron");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

// What a tray menu entry is allowed to do. The config file is written by
// build-platform.mjs at package time, but it is still read off disk at runtime,
// so the action names are an allowlist rather than anything eval-like.
const TRAY_ACTIONS = new Set(["show", "hide", "toggle", "reload", "open-url", "quit"]);
const DEFAULT_TRAY_MENU = [
  { action: "show", label: "Show" },
  { action: "hide", label: "Hide" },
  { type: "separator" },
  { action: "quit", label: "Quit" },
];

const webRoot = resolve(process.resourcesPath, "web");
// Written by build-platform.mjs into `.build-temp/windows-desktop` and copied
// in by `extraResources`. Absent when electron-builder is run by hand, which
// is why every read below falls back to "no tray".
const desktopRoot = resolve(process.resourcesPath, "desktop");
const desktopConfigPath = resolve(desktopRoot, "desktop.json");

let assetServer;
let appOrigin;
let mainWindow;
let tray;
// `close` is intercepted to hide the window instead, so the only way out is a
// deliberate quit. Without this flag the tray would trap the app open.
let isQuitting = false;

function readDesktopConfig() {
  if (!existsSync(desktopConfigPath)) {
    return { tray: { enabled: false } };
  }

  try {
    const parsed = JSON.parse(readFileSync(desktopConfigPath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : { tray: { enabled: false } };
  } catch (error) {
    console.error(`Ignoring an unreadable desktop config: ${error.message}`);
    return { tray: { enabled: false } };
  }
}

const desktopConfig = readDesktopConfig();
const trayConfig =
  desktopConfig.tray && typeof desktopConfig.tray === "object" ? desktopConfig.tray : {};
const trayEnabled = trayConfig.enabled === true;
// Closing to the tray is the point of the feature, but it stays configurable
// because a tray icon without it is still a useful shortcut.
const closeToTray = trayEnabled && trayConfig.closeToTray !== false;
const startMinimized = trayEnabled && trayConfig.startMinimized === true;
const singleInstance = trayEnabled && trayConfig.singleInstance !== false;

function resolveAssetPath(requestUrl) {
  const pathname = decodeURIComponent(
    new URL(requestUrl, "http://127.0.0.1").pathname,
  );
  const relativePath = pathname === "/" ? "index.html" : `.${pathname}`;
  const candidate = resolve(webRoot, relativePath);
  const isInsideWebRoot =
    candidate === webRoot || candidate.startsWith(`${webRoot}${sep}`);

  if (!isInsideWebRoot) {
    return null;
  }

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }

  return resolve(webRoot, "index.html");
}

function startAssetServer() {
  return new Promise((resolveServer, rejectServer) => {
    assetServer = createServer((request, response) => {
      const filePath = resolveAssetPath(request.url ?? "/");

      if (!filePath) {
        response.writeHead(403).end("Forbidden");
        return;
      }

      response.writeHead(200, {
        "Cache-Control": "no-cache",
        "Content-Type":
          MIME_TYPES[extname(filePath).toLowerCase()] ??
          "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      createReadStream(filePath).pipe(response);
    });

    assetServer.once("error", rejectServer);
    assetServer.listen(0, "127.0.0.1", () => {
      const address = assetServer.address();
      appOrigin = `http://127.0.0.1:${address.port}`;
      resolveServer();
    });
  });
}

function openExternalUrl(targetUrl) {
  const parsedUrl = new URL(targetUrl);

  if (parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:") {
    void shell.openExternal(parsedUrl.href);
  }
}

function resolveTrayIconPath() {
  if (typeof trayConfig.icon !== "string" || trayConfig.icon === "") {
    return null;
  }

  // The icon is named relative to the packaged desktop directory, so a config
  // that walks out of it with `..` is rejected rather than followed.
  const candidate = resolve(desktopRoot, trayConfig.icon);

  if (candidate !== desktopRoot && !candidate.startsWith(`${desktopRoot}${sep}`)) {
    console.error(`Ignoring a tray icon outside the packaged resources: ${trayConfig.icon}`);
    return null;
  }

  if (!existsSync(candidate) || !statSync(candidate).isFile()) {
    console.error(`The configured tray icon is missing: ${trayConfig.icon}`);
    return null;
  }

  return candidate;
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function hideMainWindow() {
  mainWindow?.hide();
}

function quitApplication() {
  isQuitting = true;
  app.quit();
}

function runTrayAction(item) {
  switch (item.action) {
    case "show":
      showMainWindow();
      return;
    case "hide":
      hideMainWindow();
      return;
    case "toggle":
      if (mainWindow?.isVisible()) hideMainWindow();
      else showMainWindow();
      return;
    case "reload":
      mainWindow?.webContents.reload();
      return;
    case "open-url":
      // Only this path is new surface, so it is https-only rather than
      // inheriting the window handler's tolerance of http.
      try {
        const parsedUrl = new URL(item.url);
        if (parsedUrl.protocol === "https:") {
          void shell.openExternal(parsedUrl.href);
        } else {
          console.error(`Refusing a non-https tray URL: ${item.url}`);
        }
      } catch {
        console.error(`Ignoring an unparseable tray URL: ${item.url}`);
      }
      return;
    case "quit":
      quitApplication();
      return;
    default:
      return;
  }
}

function buildTrayTemplate() {
  const configured = Array.isArray(trayConfig.menu) ? trayConfig.menu : [];
  const source = configured.length > 0 ? configured : DEFAULT_TRAY_MENU;
  const template = [];

  for (const item of source) {
    if (!item || typeof item !== "object") {
      continue;
    }

    if (item.type === "separator") {
      template.push({ type: "separator" });
      continue;
    }

    if (typeof item.label !== "string" || item.label === "") {
      continue;
    }

    if (!TRAY_ACTIONS.has(item.action)) {
      console.error(`Ignoring tray item "${item.label}": unknown action ${item.action}`);
      continue;
    }

    template.push({ click: () => runTrayAction(item), label: item.label });
  }

  // A tray with no way out would strand the app in the notification area.
  if (!template.some((item) => item.label === "Quit")) {
    template.push({ type: "separator" }, { click: quitApplication, label: "Quit" });
  }

  return template;
}

function createTray() {
  const iconPath = resolveTrayIconPath();

  if (!iconPath) {
    console.error("Tray mode is enabled but no usable icon was packaged; running without a tray.");
    return;
  }

  const icon = nativeImage.createFromPath(iconPath);

  if (icon.isEmpty()) {
    console.error(`The tray icon could not be decoded: ${trayConfig.icon}`);
    return;
  }

  tray = new Tray(icon);
  tray.setToolTip(
    typeof trayConfig.tooltip === "string" && trayConfig.tooltip !== ""
      ? trayConfig.tooltip
      : app.getName(),
  );
  tray.setContextMenu(Menu.buildFromTemplate(buildTrayTemplate()));
  tray.on("double-click", showMainWindow);
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: "#FFFFFF",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow = window;

  window.once("ready-to-show", () => {
    // A tray build may be asked to start out of the way, in which case the
    // window is created but never shown until the tray asks for it.
    if (!startMinimized) {
      window.show();
    }
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(appOrigin)) {
      event.preventDefault();
      openExternalUrl(url);
    }
  });
  window.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );

  if (closeToTray) {
    window.on("close", (event) => {
      if (isQuitting) {
        return;
      }

      // The tray is what makes hiding recoverable, so this only ever runs when
      // `createTray` actually produced one.
      if (tray) {
        event.preventDefault();
        window.hide();
      }
    });
  }

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = undefined;
    }
  });

  void window.loadURL(appOrigin);
}

// A second launch of a tray app should surface the running copy instead of
// adding another icon to the notification area.
if (singleInstance && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  if (singleInstance) {
    app.on("second-instance", showMainWindow);
  }

  app.whenReady().then(async () => {
    await startAssetServer();

    if (trayEnabled) {
      createTray();
    }

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("before-quit", () => {
    isQuitting = true;
    assetServer?.close();
  });

  app.on("window-all-closed", () => {
    // With a tray the window is hidden rather than closed, so this only fires
    // on a real close — but a tray build still has to stay resident.
    if (tray) {
      return;
    }

    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
