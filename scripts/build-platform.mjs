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
]);

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

function parseArguments(args) {
  const options = {};
  const positional = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const equals = argument.startsWith("--") ? argument.indexOf("=") : -1;
    const flag = equals === -1 ? argument : argument.slice(0, equals);
    const inline = equals === -1 ? undefined : argument.slice(equals + 1);

    if (VALUE_FLAGS.has(flag)) {
      const value = inline ?? args[index + 1];
      if (!value || (inline === undefined && value.startsWith("--"))) {
        throw new Error(`A value is required for ${flag}.`);
      }
      options[VALUE_FLAGS.get(flag)] = value;
      if (inline === undefined) index += 1;
      continue;
    }

    if (argument.startsWith("--")) {
      throw new Error(
        `Unknown argument: ${argument}\n` +
          `Supported flags: ${[...VALUE_FLAGS.keys()].join(", ")}`,
      );
    }

    positional.push(argument);
  }

  // `node scripts/build-platform.mjs android` still works from inside a
  // project, which is how this script is used outside the TUI.
  return { platform: options.platform ?? positional[0] ?? "web", projectRoot: options.projectRoot };
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
    // Both of these are read out of `scripts/electron/package.json` as paths
    // relative to that folder, so they have to stay under the tool root.
    const windowsWebDirectory = resolve(toolTemporaryRoot, "windows-web");
    const windowsInstallerDirectory = resolve(toolTemporaryRoot, "windows-installer");
    removeGeneratedPath(windowsWebDirectory);
    removeGeneratedPath(windowsInstallerDirectory);

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
