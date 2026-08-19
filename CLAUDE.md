# CLAUDE.md

## What this repository is

A scaffold *tool*, not an application. It holds the templates and the finalizer
that the IKAIKA TUI (`ikaika_tui`, a separate repo) runs to generate React
Native source files **into some other project**. Nothing here is imported at
runtime and nothing here is built: no test runner, no linter, no type-checker,
and the only `package.json` is the Electron shell's.

Every file this repo writes lands under a caller-supplied `--project-root`.
That root is somebody's real codebase — treat a stray write as data loss.

## Layout

| Path | What it is |
| --- | --- |
| `ikaika.script.json` | The manifest the TUI reads: one entry per scaffold kind — form arguments, staging path, template, messages, and the command to run afterwards. |
| `scripts/finalize-scaffold-template.mjs` | The finalizer behind every `config.scaffold` action: name normalization, path safety, rendering, companions, writes. |
| `scripts/build-platform.mjs` | The builder behind every `config.build` action. |
| `scripts/electron/` | The Electron shell the Windows installer wraps around an Expo Web export. Its own npm project. |
| `templates/` | Source templates, one per generated file shape. `templates/README.md` holds the scaffold catalog and the conventions generated code must follow. |
| `changes/` | Generated session summaries. Do not hand-edit. |
| `.serena/memories/` | Agent notes. Keep them honest when a convention moves. |
| `graphify-out/` | Knowledge graph. Refresh with `graphify update .` after code edits. |

## How one scaffold actually runs

1. The TUI reads the kind's entry from `ikaika.script.json` and renders `args`
   as a form.
2. It refuses up front if the staging path (`path` + `filename`) already
   exists — unless the action declares a boolean argument named exactly
   `overwrite` and the form answered yes. That check is the TUI's; the name of
   the argument is the whole interface to it.
3. It copies `template` to the staging path verbatim, still wrapped.
4. It runs each `command-after-success` with `${...}` references expanded and
   cwd set to **this** repo — which is why `scripts/...` is relative while
   `${root}` is absolute.
5. For a scaffold that command is the finalizer, which unwraps, renders, moves
   the staged file to its normalized destination, and writes companions.
6. On a non-zero exit the TUI deletes the staged file. A late failure therefore
   throws away the file the user asked for, so fail before writing anything or
   do not fail at all.

An action needs a template *or* a command, not both: a `config.build` entry
declares no template, so nothing is staged and step 6 cannot bite. It may still
declare `args` — `build.window` does, for its tray options. Giving such an action
a `path` with no `filename` is still worth doing — it stages nothing but gives
the menu card "Runs in <path>" instead of a blank line.

Command tokens are split before references are expanded, so each `${...}`
arrives as its own argv item — a boolean argument reaches the script as
`--overwrite` `true`. There is no shell: `cd x && y` is not a command, it is a
program called `cd`.

**A blank form field arrives as an empty string, not as an absent flag.** Every
declared argument is expanded, so an unanswered optional field reaches the script
as `--bin-tooltip` `""`. Both platform scripts treat that as "not supplied" and
fall back to the declared default, for value flags *and* booleans — a blank
`--bin` must not read as yes. `finalize-scaffold-template.mjs` does **not** have
that guard: a blank `--overwrite` still parses as true, because a bare flag means
yes and the empty word is not recognized as either. Worth fixing before a form
ever leaves `overwrite` unanswered.

`after-clone-command` at the top of the manifest is **not read by the TUI**
today. It records the install the Windows build needs; run it by hand.

## The template convention

Every template is one file wrapped in a single block comment, so editors,
TypeScript, and ESLint can parse it while the placeholders are still
unresolved:

```
/*
export const __NAME__Mode = { ... } as const;
*/
```

`unwrap` demands exactly that shape: `/*` alone on the first line, `*/` alone
on the last. Placeholders are `__NAME__` (PascalCase), `__KEBAB_NAME__`, and
`__TITLE__`; any `__UPPER_SNAKE__` surviving a render is a hard error.

A template is an input. Never synthesize one from a finalized file, and never
re-finalize a finalized file — it has no wrapper left, so `unwrap` fails.

## Finalizer invariants

- Templates resolve from this repo (`templatesRoot`); outputs resolve from
  `--project-root`. Never mix the two.
- Every output must stay inside the project root, and the primary output inside
  its kind's `root`.
- Names normalize to kebab-case filenames and PascalCase/title placeholders.
  `KNOWN_NAME_WORDS` is what lets `userprofile` split into `user-profile`; an
  unlisted word stays one blob, which is why the manifest asks for kebab-case.
- **Collisions:** a companion that already exists is *kept*, not fatal. The
  primary output refuses to be replaced unless `--overwrite` (alias `--force`)
  is passed. `--skip-companions` creates only the file that was asked for.
  This is deliberate: scaffolding an `apiModel` whose ping endpoint already
  exists must still produce the model. Do not restore a blanket
  "already exists" abort — it fails the run *after* staging, which loses the
  primary file too.
- Boolean flags accept a bare flag, an explicit `true`/`false`, `--flag=false`,
  or a `--no-` prefix, so a caller filling values in from a form can always
  emit the flag.
- Destination directories are created recursively immediately before each
  write or move.
- Line endings come from the staged file or template, not from the platform.
  Leave them alone.

## Builds

`config.build` has one action per platform, each running:

```
node scripts/build-platform.mjs --platform <platform> --project-root ${root}
```

The project root has to be a flag for the same reason the finalizer needs one:
commands run with cwd set to **this** repo, so the script may not read
`process.cwd()` for the project, and every subprocess it spawns gets an
explicit `cwd`.

- Artifacts publish to `<project>/build/<folder>/<version>+<versionCode>`,
  where `<folder>` is the manifest key — `windows` publishes to `build/window`.
- Staging is `<project>/.build-temp`, because publishing it is a `renameSync`
  and a rename across volumes fails.
- Windows is the exception. `scripts/electron/package.json` names
  `../../.build-temp/windows-web`, `../../.build-temp/windows-installer`, and
  `../../.build-temp/windows-desktop` relative to itself, so those three live
  under **this** repo and the finished installer is copied, not renamed, into
  the project. Move one of those paths and you have to move the others.
- `expo` resolves from the project first, so an app is built by its own Expo
  version; `electron-builder` resolves from `scripts/electron`. Neither is
  vendored, and `npm install --prefix scripts/electron` is what makes a Windows
  build possible at all.
- `ios`, `macos`, and `linux` are declared but exit 1 with "not implemented
  yet". They are in the manifest so the menu is honest about what exists.
- Before and after every build the script deletes `<project>/dist` and
  `<project>/release` — stale Expo export defaults. It is the one place this
  repo removes something it did not create.

### The Windows tray build (`--bin`)

`--bin` packages the shell as a tray application: closing the window hides it to
the notification area instead of quitting. It is Windows-only, and every other
`--bin-*` flag is inert without it.

- The settings do **not** live in `main.cjs`, which is generic and shared by
  every project. `build-platform.mjs` writes `.build-temp/windows-desktop/`
  containing `desktop.json` plus a copy of the icon, and `extraResources` copies
  that directory to `resources/desktop` in the installed app. `main.cjs` reads it
  at startup and falls back to plain windowed behaviour whenever it is missing or
  unreadable — which is what keeps a hand-run `electron-builder` working.
- That directory is written for **every** Windows build, tray or not, because
  `extraResources` names it and electron-builder aborts on a missing source. With
  `--bin` off it holds `{"tray":{"enabled":false}}`.
- `--bin` requires `--bin-icon`, validated before anything is written: inside the
  project, an existing file, and one of `.png .ico .jpg .jpeg`. A tray app whose
  icon fails to load has no clickable notification-area entry, so this fails the
  build rather than shipping something unreachable.
- `--bin-menu` is `Label:action` items joined by `|`, `-` for a separator, and
  `Label:open-url:https://…` for a link. Split from the left so an https URL
  keeps its colon. Actions are validated at build time against the same
  allowlist `main.cjs` enforces at runtime — keep the two `TRAY_ACTIONS` sets in
  step. `open-url` is https-only in both places.
- `main.cjs` always appends a Quit item if the configured menu lacks one, and
  refuses to intercept `close` unless a tray actually exists. Both guards exist
  so a misconfigured tray cannot strand the app with no way to reopen or exit it.
- A tray build takes the single-instance lock by default, because a second launch
  would otherwise add a second icon to the notification area.

## Adding a scaffold kind

Touch all of these or it half-works:

1. `templates/<kind>.template.ts(x)` — wrapped, placeholders only.
2. `SCAFFOLD_DEFINITIONS` in the finalizer: `root`, `suffix`, `template`.
3. `primaryPath` / `companions`, if the destination is not
   `<root>/<name><suffix>` or the kind generates extra files.
4. `ikaika.script.json`: `args`, `path`, `template`, `filename`, the full
   `message-*` set, and `command-after-success`.
5. The catalog table in `templates/README.md`.

Manifest gotchas: the TUI shows the **first argument carrying a `description`**
as the menu card's detail line, so keep `name` described whenever you add
arguments beneath it. The top-level `rules` block whitelists which keys each
argument type may use, and a key missing from it is dropped in silence.

Two `rules.global` keys are about presentation rather than validation, and every
argument in the manifest now carries the first one:

- **`name`** is the human label the form shows for the argument. `flag` stays the
  machine name used by `${...}` references and the CLI flag.
- **`hide`** controls conditional visibility: `true` always hides, `false` always
  shows, and a **string names another argument that reveals this one** — the tray
  options all carry `"hide": "bin"`, so they appear only once the tray checkbox
  is ticked. Note the inversion: the value names the argument that *shows* the
  field, not a condition under which it hides. `hide` is presentation only —
  a hidden argument is still expanded into the command, blank.

The format itself is documented in `IKAIKA.SCRIPT.md`, which now lives with the
TUI rather than in this repo.

## Verifying a change

There is nothing to run but the thing itself.

```
node scripts/finalize-scaffold-template.mjs --kind apiModel --name test \
  --project-root <disposable-dir> --target src/apis/models/test.model.ts
```

`--target` resolves against `--project-root`. Exercise both entry paths: with a
staged target (what the TUI does) and with none at all (renders straight from
the template). Exercise collisions in both directions — companion already
present, primary already present — because that is where this script has broken
before. Then confirm `templates/` is untouched.

A build cannot be smoke-tested without a real Expo project, but its guards
can: point `--project-root` at a directory with no `package.json`, at an
unimplemented platform, and at an unknown one, and check each exits 1 with a
sentence rather than a stack trace. Confirm afterwards that `.build-temp` is
gone from both roots.

Afterwards run `graphify update .`, and update `templates/README.md` and
`.serena/memories/` whenever a documented convention actually moved.
