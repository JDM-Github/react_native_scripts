import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const PLATFORM_ALIASES = new Map([
  ["android", "android"],
  ["ios", "ios"],
  ["linux", "linux"],
  ["mac", "macos"],
  ["macos", "macos"],
  ["web", "web"],
  ["win", "windows"],
  ["window", "windows"],
  ["windows", "windows"],
]);

const UNIMPLEMENTED = new Map([
  [
    "ios",
    "iOS runs are not implemented yet. `expo run:ios` needs macOS with Xcode " +
      "and a configured signing identity.",
  ],
  ["macos", "macOS runs are not implemented yet."],
  ["linux", "Linux runs are not implemented yet."],
  [
    "windows",
    "Windows runs are not implemented yet. The Electron shell only serves a " +
      "packaged Expo Web export out of its own resources, so there is no " +
      "dev-server path into it.\n" +
      "Use --platform web while developing, and build-platform.mjs " +
      "--platform window to produce the desktop installer.",
  ],
]);

const HOST_MODES = new Set(["lan", "localhost", "tunnel"]);
const MINIMUM_PORT = 1024;
const MAXIMUM_PORT = 65535;
const INTERRUPT_EXIT_CODES = new Set([130, 3221225786]);
const VALUE_FLAGS = new Map([
  ["--platform", "platform"],
  ["--project-root", "projectRoot"],
  ["--port", "port"],
  ["--host", "host"],
]);
const BOOLEAN_FLAGS = new Map([["--dev", "dev"]]);
const TRUE_WORDS = new Set(["1", "on", "true", "yes"]);
const FALSE_WORDS = new Set(["0", "false", "no", "off"]);

const scriptPath = fileURLToPath(import.meta.url);
const toolRoot = resolve(dirname(scriptPath), "..");

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
  // `dev` defaults to true, matching the manifest's own default: an
  // unqualified run is a development run.
  const options = { dev: true };

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
      // rather than an error, or a blank port would abort the whole run.
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
      // A bare `--dev` means yes and an explicit `--dev false` means no, so a
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

    // `node scripts/run-platform.mjs android` still works from inside a
    // project, which is how this script is used outside the TUI.
    if (options.platform === undefined) options.platform = argument;
  }

  return { ...options, platform: options.platform ?? "web" };
}

function parsePort(value) {
  if (value === undefined) return undefined;

  const port = Number(value);

  if (!Number.isInteger(port) || port < MINIMUM_PORT || port > MAXIMUM_PORT) {
    throw new Error(
      `The port must be a whole number between ${MINIMUM_PORT} and ${MAXIMUM_PORT}, received: ${value}`,
    );
  }

  return port;
}

function parseHost(value) {
  if (value === undefined) return undefined;

  const host = String(value).trim().toLowerCase();

  if (!HOST_MODES.has(host)) {
    throw new Error(
      `Unknown host mode "${value}". Expo accepts ${[...HOST_MODES].join(", ")} — ` +
        "it is a connection mode, not a hostname.",
    );
  }

  return host;
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

// The project's own Expo runs the project; the tool's copy is only a fallback
// for a workspace that has not installed yet.
function expoCli() {
  return resolveCli(
    "expo/bin/cli",
    [workspaceRoot, toolRoot],
    `Expo is not installed in ${workspaceRoot}. Run \`npm install\` there first.`,
  );
}

function run(command, args) {
  // The dev server holds the terminal until it is stopped, so this inherits
  // stdio and blocks. cwd is explicit because the tool's own directory is the
  // cwd this script was started in.
  const result = spawnSync(command, args, { cwd: workspaceRoot, stdio: "inherit" });

  if (result.error) {
    throw result.error;
  }

  if (result.signal || INTERRUPT_EXIT_CODES.has(result.status)) {
    return true;
  }

  if (result.status !== 0) {
    const error = new Error(
      `Command failed with exit code ${result.status ?? "unknown"}: ${command}`,
    );
    error.exitCode = result.status ?? 1;
    throw error;
  }

  return false;
}

function startArguments() {
  const args = ["start", "--web"];

  if (port !== undefined) args.push("--port", String(port));
  if (host !== undefined) args.push("--host", host);

  if (!dev) {
    // This is the production *run*: `--no-dev` is what leaves `__DEV__` false
    // in the served bundle and `--minify` matches how it ships. Nothing is
    // exported — use build-platform.mjs for an artifact.
    args.push("--no-dev", "--minify");
  }

  return args;
}

function runNativeArguments(nativePlatform) {
  const args = [nativePlatform === "android" ? "run:android" : "run:ios"];

  if (!dev) {
    // `--no-dev` and `--minify` belong to `expo start`; a native run has no
    // such flags. Its production bundle comes from the release build type
    // instead, which is what leaves `__DEV__` false in the embedded bundle.
    args.push(
      ...(nativePlatform === "android"
        ? ["--variant", "release"]
        : ["--configuration", "Release"]),
    );
  }

  if (port !== undefined) args.push("--port", String(port));

  return args;
}

let options;
let port;
let host;

try {
  options = parseArguments(process.argv.slice(2));
  port = parsePort(options.port);
  host = parseHost(options.host);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const dev = options.dev;
const requestedPlatform = String(options.platform).toLowerCase();
const platform = PLATFORM_ALIASES.get(requestedPlatform);

if (!platform) {
  console.error(
    `Unknown platform "${requestedPlatform}". Use web, android, window, ios, macos, or linux.`,
  );
  process.exit(1);
}

if (UNIMPLEMENTED.has(platform)) {
  console.error(UNIMPLEMENTED.get(platform));
  process.exit(1);
}

if (platform === "ios" && process.platform !== "darwin") {
  console.error("iOS runs are only possible on macOS.");
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
      "Point --project-root at the React Native project to run.",
  );
  process.exit(1);
}

if (platform !== "web" && host !== undefined) {
  // `--host` is an `expo start` flag. `expo run:android` and `expo run:ios`
  // do not accept it, so passing it through would abort the run.
  console.warn(
    `Ignoring --host ${host}: it only applies to the web dev server, not ${platform}.`,
  );
}

if (platform === "web" && port !== undefined) {
  console.warn(
    `Expo does not apply --port to the web dev server; it will pick its own port (8081 by default) rather than ${port}.`,
  );
}

if (host === "tunnel" && port !== undefined) {
  console.warn("Expo does not apply --port to a tunnel connection.");
}

const mode = dev ? "development" : `production (__DEV__ false)`;

try {
  if (platform === "web") {
    console.log(`Starting the Expo web dev server in ${mode} mode.`);
    const interrupted = run(process.execPath, [expoCli(), ...startArguments()]);
    if (interrupted) console.log("\nWeb dev server stopped.");
  } else {
    console.log(`Building and running the ${platform} app in ${mode} mode.`);
    const interrupted = run(process.execPath, [
      expoCli(),
      ...runNativeArguments(platform),
    ]);
    if (interrupted) console.log(`\n${platform} run stopped.`);
  }
} catch (error) {
  console.error(`Run failed: ${error.message}`);
  process.exitCode = error.exitCode ?? 1;
}
