const { createReadStream, existsSync, statSync } = require("node:fs");
const { createServer } = require("node:http");
const { extname, resolve, sep } = require("node:path");
const { app, BrowserWindow, shell } = require("electron");

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

const webRoot = resolve(process.resourcesPath, "web");
let assetServer;
let appOrigin;

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

  window.once("ready-to-show", () => window.show());
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

  void window.loadURL(appOrigin);
}

app.whenReady().then(async () => {
  await startAssetServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => assetServer?.close());

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
