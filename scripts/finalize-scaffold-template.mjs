import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const COMMENTED_TEMPLATE_PATTERN = /^\/\*\r?\n([\s\S]*?)\r?\n\*\/\r?\n?$/;
const PLACEHOLDER_PATTERN        = /__[A-Z_]+__/g;
const KNOWN_NAME_WORDS           = new Set([
  'account', 'activity', 'admin', 'api', 'authentication', 'cache', 'checkout',
  'config', 'connection', 'dashboard', 'debug', 'detail', 'edit', 'forgot',
  'history', 'home', 'inbox', 'list', 'log', 'login', 'message', 'notification',
  'onboarding', 'order', 'password', 'payment', 'performance', 'preferences',
  'product', 'profile', 'redirector', 'register', 'reset', 'search', 'secure',
  'settings', 'signup', 'storage', 'support', 'theme', 'user', 'validation',
  'welcome',
]);
const scriptPath    = fileURLToPath(import.meta.url);
const toolRoot      = resolve(dirname(scriptPath), '..');
const templatesRoot = resolve(toolRoot, 'templates');

export const SCAFFOLD_DEFINITIONS = {
  screen     : { root: 'src/screens', suffix: '.screen.tsx', template: 'screen.template.tsx' },
  layout     : { root: 'src/layouts', suffix: '.layout.tsx', template: 'layout.template.tsx' },
  widget     : { root: 'src/components/widgets', suffix: '.widget.tsx', template: 'widget.template.tsx' },
  apiEndpoint: { root: 'src/apis/endpoint', suffix: '.api.ts', template: 'api-endpoint.template.ts' },
  apiModel   : { root: 'src/apis/models', suffix: '.model.ts', template: 'api-model.template.ts' },
  service    : { root: 'src/core/services', suffix: '.service.ts', template: 'service.template.ts' },
  storage    : { root: 'src/core/storages', suffix: '.storage.ts', template: 'storage.template.ts' },
  utility    : { root: 'src/core/utilities', suffix: '.utility.ts', template: 'utility.template.ts' },
  state      : { root: 'src/core/states', suffix: '.state.ts', template: 'state.template.ts' },
  manager    : { root: 'src/core/managers', suffix: '.manager.ts', template: 'manager.template.ts' },
  constant   : { root: 'src/core/constants', suffix: '.constant.ts', template: 'constant.template.ts' },
  enum       : { root: 'src/core/enums', suffix: '.enum.ts', template: 'enum.template.ts' },
};

function isInside(parent, target) {
  const pathFromParent = relative(parent, target);
  return (
    pathFromParent !== '' &&
    pathFromParent !== '..' &&
    !pathFromParent.startsWith(`..${sep}`) &&
    !isAbsolute(pathFromParent)
  );
}

function segmentKnownWords(value) {
  if (KNOWN_NAME_WORDS.has(value)) return [value];

  const memo = new Map();

  function visit(start) {
    if (start === value.length) return [];
    if (memo.has(start)) return memo.get(start);

    let best = null;

    for (let end = start + 1; end <= value.length; end += 1) {
      const word = value.slice(start, end);
      if (!KNOWN_NAME_WORDS.has(word)) continue;

      const remainder = visit(end);
      if (!remainder) continue;

      const candidate = [word, ...remainder];
      if (!best || candidate.length < best.length) best = candidate;
    }

    memo.set(start, best);
    return best;
  }

  return visit(0) ?? [value];
}

function splitName(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .flatMap((word) => segmentKnownWords(word.toLowerCase()));
}

function primaryPath(projectRoot, kind, name) {
  if (kind === 'apiEndpoint') return resolve(projectRoot, `src/apis/endpoint/${name}/get/ping.${name}.api.ts`);
  const definition = SCAFFOLD_DEFINITIONS[kind];
  return resolve(projectRoot, definition.root, `${name}${definition.suffix}`);
}

function companions(kind, name) {
  if (kind === 'screen') {
    return [
      ['screen-controller.template.ts', `src/core/controllers/screens/${name}.screen.controller.ts`],
      ['constant.template.ts', `src/core/constants/screens/${name}.screen.constant.ts`],
      ['enum.template.ts', `src/core/enums/screens/${name}.screen.enum.ts`],
    ];
  }
  if (kind === 'layout') {
    return [
      ['layout-controller.template.ts', `src/core/controllers/layouts/${name}.layout.controller.ts`],
      ['constant.template.ts', `src/core/constants/layouts/${name}.layout.constant.ts`],
      ['enum.template.ts', `src/core/enums/layouts/${name}.layout.enum.ts`],
    ];
  }
  if (kind === 'apiModel') {
    return [
      ['api-endpoint.template.ts', `src/apis/endpoint/${name}/get/ping.${name}.api.ts`],
    ];
  }
  return [];
}

function unwrap(source, sourcePath) {
  const match = source.match(COMMENTED_TEMPLATE_PATTERN);
  if (!match) throw new Error(`Template is missing its outer comment wrapper: ${sourcePath}`);
  return match[1];
}

function render(source, sourcePath, replacements, lineEnding) {
  let output = unwrap(source, sourcePath);
  for (const [placeholder, value] of Object.entries(replacements)) {
    output = output.replaceAll(placeholder, value);
  }
  const unresolved = output.match(PLACEHOLDER_PATTERN);
  if (unresolved) throw new Error(`Unresolved placeholder ${unresolved[0]} in ${sourcePath}`);
  return `${output}${lineEnding}`;
}

function flagValue(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;

  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`A value is required for ${flag}.`);
  return value;
}

function parseArguments(args) {
  if (!args.some((argument) => argument.startsWith('--'))) {
    const [kind, target, name, projectRoot] = args;
    return { kind, name, projectRoot, target };
  }

  const supportedFlags = new Set(['--kind', '--name', '--project-root', '--target']);
  for (let index = 0; index < args.length; index += 2) {
    if (!supportedFlags.has(args[index])) throw new Error(`Unknown argument: ${args[index] ?? ''}`);
  }

  return {
    kind       : flagValue(args, '--kind'),
    name       : flagValue(args, '--name'),
    projectRoot: flagValue(args, '--project-root'),
    target     : flagValue(args, '--target'),
  };
}

export function finalizeScaffold({ kind, name: rawName, projectRoot: projectRootArgument, target: targetArgument }) {
  const definition  = SCAFFOLD_DEFINITIONS[kind];
  const projectRoot = resolve(projectRootArgument ?? toolRoot);

  if (!definition) throw new Error(`Unknown scaffold kind: ${kind ?? ''}`);
  if (!rawName) throw new Error('A scaffold name is required.');
  if (existsSync(projectRoot) && !statSync(projectRoot).isDirectory()) {
    throw new Error(`Project root is not a directory: ${projectRoot}`);
  }

  const words      = splitName(rawName);
  const kebabName  = words.join('-');
  const pascalName = words.map((word) => `${word[0].toUpperCase()}${word.slice(1)}`).join('');
  const title      = words.map((word) => `${word[0].toUpperCase()}${word.slice(1)}`).join(' ');

  if (!kebabName || !pascalName) throw new Error(`Unable to normalize scaffold name: ${rawName}`);

  const finalizedPath = primaryPath(projectRoot, kind, kebabName);
  const targetPath    = targetArgument ? resolve(projectRoot, targetArgument) : finalizedPath;
  const allowedRoot   = resolve(projectRoot, definition.root);
  const hasStagedTarget = Boolean(targetArgument);
  const targetExists  = existsSync(targetPath);
  const primaryTemplatePath = resolve(templatesRoot, definition.template);
  const companionFiles = companions(kind, kebabName).map(([template, path]) => ({
    path        : resolve(projectRoot, path),
    templatePath: resolve(templatesRoot, template),
  }));

  if (!isInside(allowedRoot, targetPath) || !targetPath.endsWith(definition.suffix)) {
    throw new Error(`Refusing to finalize an invalid ${kind} path: ${targetPath}`);
  }
  for (const output of [finalizedPath, ...companionFiles.map((file) => file.path)]) {
    if (!isInside(projectRoot, output)) throw new Error(`Scaffold output escapes the project root: ${output}`);
    const isStagedOutput = hasStagedTarget && targetExists && output === targetPath;
    if (existsSync(output) && !isStagedOutput) {
      throw new Error(`Scaffold output already exists: ${output}`);
    }
  }

  const replacements = {
    __KEBAB_NAME__: kebabName,
    __NAME__      : pascalName,
    __TITLE__     : title,
  };
  const primarySourcePath = targetExists ? targetPath : primaryTemplatePath;
  const primarySource     = readFileSync(primarySourcePath, 'utf8');
  const lineEnding        = primarySource.includes('\r\n') ? '\r\n' : '\n';
  const renderedPrimary   = render(primarySource, primarySourcePath, replacements, lineEnding);
  const renderedCompanions = companionFiles.map((file) => ({
    ...file,
    content: render(readFileSync(file.templatePath, 'utf8'), file.templatePath, replacements, lineEnding),
  }));

  if (targetExists) {
    writeFileSync(targetPath, renderedPrimary, 'utf8');
    if (finalizedPath !== targetPath) {
      mkdirSync(dirname(finalizedPath), { recursive: true });
      renameSync(targetPath, finalizedPath);
    }
  } else {
    mkdirSync(dirname(finalizedPath), { recursive: true });
    writeFileSync(finalizedPath, renderedPrimary, { encoding: 'utf8', flag: 'wx' });
  }
  for (const file of renderedCompanions) {
    mkdirSync(dirname(file.path), { recursive: true });
    writeFileSync(file.path, file.content, { encoding: 'utf8', flag: 'wx' });
  }

  return {
    companions: companionFiles.map((file) => file.path),
    path      : finalizedPath,
    projectRoot,
  };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const result  = finalizeScaffold(options);
  process.stdout.write(`Scaffold finalized: ${relative(result.projectRoot, result.path)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) main();
