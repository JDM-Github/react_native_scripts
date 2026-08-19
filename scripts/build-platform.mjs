import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const PLATFORM_ALIASES = new Map([
  ["win", "windows"],
  ["window", "windows"],
  ["windows", "windows"],
  ["web", "web"],
  ["android", "android"],
  ["ios", "ios"],
  ["macos", "macos"],
  ["mac", "macos"],
  ["linux", "linux"],
]);
// Where each platform publishes, which is also the folder name the manifest
// and the TUI menu use. `windows` builds into `build/window` because that is
// the key the scaffold config has always called it.
const PLATFORM_FOLDERS = new Map([
  ["android", "android"],
  ["ios", "ios"],
  ["linux", "linux"],
  ["macos", "macos"],
  ["web", "web"],
  ["windows", "window"],
]);
const UNIMPLEMENTED = new Map([
  ["ios", "iOS"],
  ["linux", "Linux"],
  ["macos", "macOS"],
]);
const VALUE_FLAGS = new Map([
  ["--platform", "platform"],
  ["--project-root", "projectRoot"],
  ["--bin-icon", "binIcon"],
  ["--bin-tooltip", "binTooltip"],
  ["--bin-menu", "binMenu"],
]);
// `--bin` packages the Windows shell as a tray application: closing the window
// hides it to the notification area instead of quitting. Every other --bin-*
// flag only means something when it is on, and none of them apply to any
// platform but Windows.
const BOOLEAN_FLAGS = new Map([
  ["--bin", "bin"],
  ["--bin-close-to-tray", "binCloseToTray"],
  ["--bin-start-minimized", "binStartMinimized"],
  ["--bin-single-instance", "binSingleInstance"],
]);
const TRUE_WORDS = new Set(["1", "on", "true", "yes"]);
const FALSE_WORDS = new Set(["0", "false", "no", "off"]);
// Kept in step with the allowlist in scripts/electron/main.cjs: an action the
// shell would ignore at runtime is rejected here instead, while there is still
// a build to fail.
const TRAY_ACTIONS = new Set(["show", "hide", "toggle", "reload", "open-url", "quit"]);
const TRAY_ICON_EXTENSIONS = new Set([".ico", ".jpeg", ".jpg", ".png"]);

const scriptPath = fileURLToPath(import.meta.url);
// The repository this script was cloned into, which is not the project being
// built: the TUI runs every declared command from the script store, so nothing
// here may be resolved against `process.cwd()`.
const toolRoot = resolve(dirname(scriptPath), "..");
const electronProjectRoot = resolve(toolRoot, "scripts/electron");
// `scripts/electron/package.json` points `directories.output` and
// `extraResources.from` at `../../.build-temp`, so the Windows scratch space
// has to be the tool's own. Staging stays in the project because publishing it
// is a rename, and a rename across volumes fails.
const toolTemporaryRoot = resolve(toolRoot, ".build-temp");

function booleanWord(value) {
  return value === undefined ? undefined : String(value).trim().toLowerCase();
}

function booleanValue(flag, value) {
  const word = booleanWord(value);
  if (TRUE_WORDS.has(word)) return true;
  if (FALSE_WORDS.has(word)) return false;
  throw new Error(`Expected true or false for ${flag}, received: ${value}`);
}

function parseArguments(args) {
  const options = {};
  const positional = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const equals = argument.startsWith("--") ? argument.indexOf("=") : -1;
    const flag = equals === -1 ? argument : argument.slice(0, equals);
    const inline = equals === -1 ? undefined : argument.slice(equals + 1);
    const negation = flag.startsWith("--no-") ? `--${flag.slice(5)}` : "";

    if (VALUE_FLAGS.has(flag)) {
      const value = inline ?? args[index + 1];

      // The TUI expands every declared argument, so an optional field the form
      // left blank arrives as an empty string. Treat that as "not supplied"
      // rather than an error, or a blank tooltip would abort the whole build.
      if (value === "" || (inline === undefined && value === undefined)) {
        if (inline === undefined && value !== undefined) index += 1;
        continue;
      }

      if (inline === undefined && value.startsWith("--")) {
        throw new Error(`A value is required for ${flag}.`);
      }

      options[VALUE_FLAGS.get(flag)] = value;
      if (inline === undefined) index += 1;
      continue;
    }

    if (BOOLEAN_FLAGS.has(negation)) {
      options[BOOLEAN_FLAGS.get(negation)] =
        inline === undefined ? false : !booleanValue(flag, inline);
      continue;
    }

    if (BOOLEAN_FLAGS.has(flag)) {
      // A bare `--bin` means yes and an explicit `--bin false` means no, so a
      // caller filling the value in from a form never has to decide whether to
      // emit the flag at all.
      const spelled = inline ?? args[index + 1];
      const word = booleanWord(spelled);
      const written =
        word !== undefined && (TRUE_WORDS.has(word) || FALSE_WORDS.has(word));

      // A blank value is a form field nobody filled in, not a bare flag: it has
      // to fall back to the declared default rather than reading as yes.
      if (spelled === "") {
        if (inline === undefined) index += 1;
        continue;
      }

      if (inline !== undefined && !written) {
        throw new Error(`Expected true or false for ${flag}, received: ${inline}`);
      }

      options[BOOLEAN_FLAGS.get(flag)] = written ? booleanValue(flag, spelled) : true;
      if (inline === undefined && written) index += 1;
      continue;
    }

    if (argument.startsWith("--")) {
      throw new Error(
        `Unknown argument: ${argument}\n` +
          `Supported flags: ${[...VALUE_FLAGS.keys(), ...BOOLEAN_FLAGS.keys()].join(", ")}`,
      );
    }

    positional.push(argument);
  }

  // `node scripts/build-platform.mjs android` still works from inside a
  // project, which is how this script is used outside the TUI.
  return { ...options, platform: options.platform ?? positional[0] ?? "web" };
}

// `Label:action`, `Label:open-url:https://…`, or `-` for a separator, joined by
// `|`. Labels are split from the left so an https URL keeps its own colon.
function parseTrayMenu(spec) {
  if (spec === undefined) {
    return undefined;
  }

  const items = [];

  for (const raw of String(spec).split("|")) {
    const entry = raw.trim();

    if (entry === "") {
      continue;
    }

    if (entry === "-" || entry === "--") {
      items.push({ type: "separator" });
      continue;
    }

    const labelEnd = entry.indexOf(":");

    if (labelEnd === -1) {
      throw new Error(
        `A tray menu item needs "Label:action", received: ${entry}\n` +
          `Actions: ${[...TRAY_ACTIONS].join(", ")}`,
      );
    }

    const label = entry.slice(0, labelEnd).trim();
    const remainder = entry.slice(labelEnd + 1).trim();
    const actionEnd = remainder.indexOf(":");
    const action = (actionEnd === -1 ? remainder : remainder.slice(0, actionEnd)).trim();
    const url = actionEnd === -1 ? undefined : remainder.slice(actionEnd + 1).trim();

    if (label === "") {
      throw new Error(`A tray menu item needs a label, received: ${entry}`);
    }

    if (!TRAY_ACTIONS.has(action)) {
      throw new Error(
        `Unknown tray action "${action}" in "${entry}".\n` +
          `Actions: ${[...TRAY_ACTIONS].join(", ")}`,
      );
    }

    if (action === "open-url") {
      if (!url) {
        throw new Error(`"${label}" needs a URL: ${label}:open-url:https://example.com`);
      }

      let parsedUrl;

      try {
        parsedUrl = new URL(url);
      } catch {
        throw new Error(`"${label}" has an unparseable URL: ${url}`);
      }

      if (parsedUrl.protocol !== "https:") {
        throw new Error(`"${label}" must use an https URL, received: ${url}`);
      }
    }

    items.push(url === undefined ? { action, label } : { action, label, url });
  }

  return items;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function isInside(parent, target) {
  const pathFromParent = relative(parent, target);
  return (
    pathFromParent !== "" &&
    pathFromParent !== ".." &&
    !pathFromParent.startsWith(`..${sep}`) &&
    !isAbsolute(pathFromParent)
  );
}

function removeGeneratedPath(target) {
  const resolvedTarget = resolve(target);

  if (
    !isInside(workspaceRoot, resolvedTarget) &&
    !isInside(toolRoot, resolvedTarget)
  ) {
    throw new Error(
      `Refusing to remove a path outside the project and the tool: ${resolvedTarget}`,
    );
  }

  rmSync(resolvedTarget, { force: true, recursive: true });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    stdio: "inherit",
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const error = new Error(
      `Command failed with exit code ${result.status ?? "unknown"}: ${command}`,
    );
    error.exitCode = result.status ?? 1;
    throw error;
  }
}

function findFiles(root, extensions, recursive = true) {
  if (!existsSync(root)) {
    return [];
  }

  const files = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = resolve(root, entry.name);

    if (entry.isDirectory() && recursive) {
      files.push(...findFiles(entryPath, extensions, recursive));
    } else if (
      entry.isFile() &&
      extensions.some((extension) => entry.name.endsWith(extension))
    ) {
      files.push(entryPath);
    }
  }

  return files;
}

function resolveCli(specifier, roots, missing) {
  for (const root of roots) {
    try {
      return createRequire(resolve(root, "package.json")).resolve(specifier);
    } catch {
      // Not installed under this root; try the next one.
    }
  }

  throw new Error(missing);
}

function createStagingDirectory(platformFolder) {
  const stagingDirectory = resolve(
    temporaryRoot,
    "staging",
    platformFolder,
    versionTag,
  );
  removeGeneratedPath(stagingDirectory);
  mkdirSync(stagingDirectory, { recursive: true });
  return stagingDirectory;
}

function publishDirectory(stagingDirectory, platformFolder) {
  const targetDirectory = resolve(buildRoot, platformFolder, versionTag);
  mkdirSync(dirname(targetDirectory), { recursive: true });
  removeGeneratedPath(targetDirectory);
  renameSync(stagingDirectory, targetDirectory);
  return targetDirectory;
}

function cleanEmptyTemporaryDirectories() {
  const candidates = [
    ...[...PLATFORM_FOLDERS.values()].map((folder) =>
      resolve(temporaryRoot, "staging", folder),
    ),
    resolve(temporaryRoot, "staging"),
    temporaryRoot,
    toolTemporaryRoot,
  ];

  for (const candidate of candidates) {
    try {
      rmdirSync(candidate);
    } catch {
      // The directory is non-empty or does not exist.
    }
  }
}

function cleanLegacyRootOutputs() {
  removeGeneratedPath(resolve(workspaceRoot, "dist"));
  removeGeneratedPath(resolve(workspaceRoot, "release"));
}

function moveArtifacts(files, stagingDirectory, createName) {
  const extensionCounts = files.reduce((counts, file) => {
    const extension = extname(file).toLowerCase();
    counts.set(extension, (counts.get(extension) ?? 0) + 1);
    return counts;
  }, new Map());

  for (const file of files) {
    const extension = extname(file).toLowerCase();
    const hasDuplicates = (extensionCounts.get(extension) ?? 0) > 1;
    const sourceName = basename(file, extension)
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const targetName = createName(extension, hasDuplicates ? sourceName : "");
    const targetPath = resolve(stagingDirectory, targetName);
    copyFileSync(file, targetPath);
    rmSync(file, { force: true });
  }
}

let options;

try {
  options = parseArguments(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const requestedPlatform = String(options.platform).toLowerCase();
const platform = PLATFORM_ALIASES.get(requestedPlatform);

if (!platform) {
  console.error(
    `Unknown platform "${requestedPlatform}". Use web, android, window, ios, macos, or linux.`,
  );
  process.exit(1);
}

if (UNIMPLEMENTED.has(platform)) {
  console.error(`${UNIMPLEMENTED.get(platform)} builds are not implemented yet.`);
  process.exit(1);
}

if (platform === "windows" && process.platform !== "win32") {
  console.error("Windows installer builds are only implemented on Windows.");
  process.exit(1);
}

const workspaceRoot = resolve(options.projectRoot ?? process.cwd());

if (!existsSync(workspaceRoot) || !statSync(workspaceRoot).isDirectory()) {
  console.error(`The project root is not a directory: ${workspaceRoot}`);
  process.exit(1);
}

const packageConfigPath = resolve(workspaceRoot, "package.json");

if (!existsSync(packageConfigPath)) {
  console.error(
    `No package.json in ${workspaceRoot}.\n` +
      "Point --project-root at the React Native project to build.",
  );
  process.exit(1);
}

const buildRoot = resolve(workspaceRoot, "build");
const temporaryRoot = resolve(workspaceRoot, ".build-temp");
const appConfigPath = resolve(workspaceRoot, "app.json");
const appConfig = existsSync(appConfigPath) ? readJson(appConfigPath) : {};
const packageConfig = readJson(packageConfigPath);
const expoConfig = appConfig.expo ?? {};
const version = String(expoConfig.version ?? packageConfig.version ?? "0.0.0");
const buildNumber = String(expoConfig.android?.versionCode ?? 1);
const versionTag = `${version}+${buildNumber}`;
const artifactSlug = String(expoConfig.slug ?? packageConfig.name ?? "app")
  .replace(/[^a-zA-Z0-9._-]+/g, "-")
  .replace(/^-+|-+$/g, "");
const artifactBaseName = `${artifactSlug}-${versionTag}`;
const productName = String(expoConfig.name ?? packageConfig.name ?? "app");
const bin = options.bin === true;
let trayMenu;
let binIconPath;

if (bin && platform !== "windows") {
  console.warn(
    `Ignoring --bin: tray packaging only applies to the Windows build, not ${platform}.`,
  );
}

if (bin && platform === "windows") {
  // Everything here fails before a single file is written. A tray build whose
  // icon turns out to be missing after packaging would leave the app with an
  // invisible notification-area entry and no way to reopen the window.
  if (!options.binIcon) {
    console.error(
      "--bin needs --bin-icon: a tray application without an icon has no\n" +
        "clickable notification-area entry. Point it at a .png or .ico inside the project.",
    );
    process.exit(1);
  }

  binIconPath = resolve(workspaceRoot, options.binIcon);

  if (!isInside(workspaceRoot, binIconPath)) {
    console.error(`The tray icon must live inside the project: ${options.binIcon}`);
    process.exit(1);
  }

  if (!existsSync(binIconPath) || !statSync(binIconPath).isFile()) {
    console.error(`The tray icon is not a file: ${binIconPath}`);
    process.exit(1);
  }

  if (!TRAY_ICON_EXTENSIONS.has(extname(binIconPath).toLowerCase())) {
    console.error(
      `A tray icon must be one of ${[...TRAY_ICON_EXTENSIONS].join(", ")}, received: ` +
        `${extname(binIconPath) || "no extension"}`,
    );
    process.exit(1);
  }

  try {
    trayMenu = parseTrayMenu(options.binMenu);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

// `extraResources` in scripts/electron/package.json names this directory, so it
// has to exist for every Windows build whether or not the tray is wanted —
// electron-builder aborts on a missing source.
function writeDesktopConfig(directory) {
  mkdirSync(directory, { recursive: true });

  if (!bin) {
    writeDesktopJson(directory, { enabled: false });
    return;
  }

  const iconName = `tray${extname(binIconPath).toLowerCase()}`;
  copyFileSync(binIconPath, resolve(directory, iconName));

  const tray = {
    closeToTray: options.binCloseToTray !== false,
    enabled: true,
    icon: iconName,
    singleInstance: options.binSingleInstance !== false,
    startMinimized: options.binStartMinimized === true,
    tooltip: options.binTooltip ?? productName,
  };

  if (trayMenu && trayMenu.length > 0) {
    tray.menu = trayMenu;
  }

  writeDesktopJson(directory, tray);
}

function writeDesktopJson(directory, tray) {
  writeFileSync(
    resolve(directory, "desktop.json"),
    `${JSON.stringify({ tray }, null, 2)}\n`,
  );
}

try {
  cleanLegacyRootOutputs();

  if (platform === "android") {
    const androidDirectory = resolve(workspaceRoot, "android");

    if (!existsSync(androidDirectory)) {
      throw new Error(
        "No android/ directory in this project. Run `npx expo prebuild --platform android` first.",
      );
    }

    const gradleTasks = [":app:assembleRelease", ":app:bundleRelease"];

    if (process.platform === "win32") {
      run(
        process.env.ComSpec ?? "cmd.exe",
        ["/d", "/c", resolve(androidDirectory, "gradlew.bat"), ...gradleTasks],
        { cwd: androidDirectory },
      );
    } else {
      run("./gradlew", gradleTasks, { cwd: androidDirectory });
    }

    const artifactFiles = [
      ...findFiles(resolve(androidDirectory, "app/build/outputs/apk/release"), [
        ".apk",
      ]),
      ...findFiles(
        resolve(androidDirectory, "app/build/outputs/bundle/release"),
        [".aab"],
      ),
    ];

    if (!artifactFiles.some((file) => file.endsWith(".apk"))) {
      throw new Error("The Android build completed without producing a release APK.");
    }

    if (!artifactFiles.some((file) => file.endsWith(".aab"))) {
      throw new Error("The Android build completed without producing a release AAB.");
    }

    const stagingDirectory = createStagingDirectory("android");
    moveArtifacts(artifactFiles, stagingDirectory, (extension, sourceName) =>
      sourceName
        ? `${artifactBaseName}-${sourceName}${extension}`
        : `${artifactBaseName}${extension}`,
    );
    const targetDirectory = publishDirectory(stagingDirectory, "android");
    console.log(`Android artifacts created in: ${relative(workspaceRoot, targetDirectory)}`);
  } else if (platform === "windows") {
    // All three of these are read out of `scripts/electron/package.json` as
    // paths relative to that folder, so they have to stay under the tool root.
    const windowsWebDirectory = resolve(toolTemporaryRoot, "windows-web");
    const windowsInstallerDirectory = resolve(toolTemporaryRoot, "windows-installer");
    const windowsDesktopDirectory = resolve(toolTemporaryRoot, "windows-desktop");
    removeGeneratedPath(windowsWebDirectory);
    removeGeneratedPath(windowsInstallerDirectory);
    removeGeneratedPath(windowsDesktopDirectory);

    writeDesktopConfig(windowsDesktopDirectory);

    if (bin) {
      console.log(
        `Packaging as a tray application (icon ${relative(workspaceRoot, binIconPath)}).`,
      );
    }

    console.log("Exporting Expo Web assets for the Windows desktop installer.");
    run(process.execPath, [
      expoCli(),
      "export",
      "--platform",
      "web",
      "--output-dir",
      windowsWebDirectory,
    ]);

    console.log("Packaging the Windows x64 NSIS installer.");
    run(
      process.execPath,
      [
        electronBuilderCli(),
        "--projectDir",
        electronProjectRoot,
        "--win",
        "nsis",
        "--x64",
        "--publish",
        "never",
      ],
      { cwd: electronProjectRoot },
    );

    const installerFiles = findFiles(
      windowsInstallerDirectory,
      [".exe", ".exe.blockmap"],
      false,
    );

    if (!installerFiles.some((file) => file.endsWith(".exe"))) {
      throw new Error("The Windows build completed without producing an installer.");
    }

    const stagingDirectory = createStagingDirectory("window");
    for (const file of installerFiles) {
      const suffix = file.endsWith(".exe.blockmap")
        ? "-setup.exe.blockmap"
        : "-setup.exe";
      copyFileSync(file, resolve(stagingDirectory, `${artifactBaseName}${suffix}`));
    }
    const targetDirectory = publishDirectory(stagingDirectory, "window");
    console.log(`Windows installer created in: ${relative(workspaceRoot, targetDirectory)}`);
  } else {
    const stagingDirectory = createStagingDirectory("web");
    run(process.execPath, [
      expoCli(),
      "export",
      "--platform",
      "web",
      "--output-dir",
      stagingDirectory,
    ]);
    const targetDirectory = publishDirectory(stagingDirectory, "web");
    console.log(`Web build created in: ${relative(workspaceRoot, targetDirectory)}`);
  }

  cleanLegacyRootOutputs();
} catch (error) {
  console.error(`Build failed: ${error.message}`);
  process.exitCode = error.exitCode ?? 1;
} finally {
  removeGeneratedPath(
    resolve(temporaryRoot, "staging", PLATFORM_FOLDERS.get(platform)),
  );

  if (platform === "windows") {
    removeGeneratedPath(resolve(toolTemporaryRoot, "windows-web"));
    removeGeneratedPath(resolve(toolTemporaryRoot, "windows-installer"));
    removeGeneratedPath(resolve(toolTemporaryRoot, "windows-desktop"));
  }
  cleanEmptyTemporaryDirectories();
}

// The project's own Expo builds the project; the tool's copy is only a
// fallback for a workspace that has not installed yet.
function expoCli() {
  return resolveCli(
    "expo/bin/cli",
    [workspaceRoot, toolRoot],
    `Expo is not installed in ${workspaceRoot}. Run \`npm install\` there first.`,
  );
}

// electron-builder is the tool's dependency, not the project's.
function electronBuilderCli() {
  return resolveCli(
    "electron-builder/out/cli/cli.js",
    [electronProjectRoot, toolRoot, workspaceRoot],
    "electron-builder is not installed. Run `npm install --prefix scripts/electron` " +
      `in ${toolRoot} and try again.`,
  );
}
