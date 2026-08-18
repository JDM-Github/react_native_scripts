# CLAUDE.md

## What this repository is

A scaffold *tool*, not an application. It holds the templates and the finalizer
that the IKAIKA TUI (`ikaika_tui`, a separate repo) runs to generate React
Native source files **into some other project**. Nothing here is imported at
runtime and nothing here is built: there is no `package.json`, no test runner,
no linter, no type-checker.

Every file this repo writes lands under a caller-supplied `--project-root`.
That root is somebody's real codebase — treat a stray write as data loss.

## Layout

| Path | What it is |
| --- | --- |
| `ikaika.script.json` | The manifest the TUI reads: one entry per scaffold kind — form arguments, staging path, template, messages, and the command to run afterwards. |
| `scripts/finalize-scaffold-template.mjs` | The finalizer: name normalization, path safety, rendering, companions, writes. The only executable code in the repo. |
| `templates/` | Source templates, one per generated file shape. `templates/README.md` holds the scaffold catalog and the conventions generated code must follow. |
| `changes/` | Generated session summaries. Do not hand-edit. |
| `.serena/memories/` | Agent notes. Keep them honest when a convention moves. |
| `graphify-out/` | Knowledge graph. Refresh with `graphify update .` after code edits. |

## How one scaffold actually runs

1. The TUI reads the kind's entry from `ikaika.script.json` and renders `args`
   as a form.
2. It refuses up front if the staging path (`path` + `filename`) already
   exists. That check belongs to the TUI; no flag in this repo overrides it.
3. It copies `template` to the staging path verbatim, still wrapped.
4. It runs each `command-after-success` with `${...}` references expanded, cwd
   set to **this** repo — which is why `scripts/...` is relative while
   `${root}` is absolute.
5. `finalize-scaffold-template.mjs` unwraps, renders, moves the staged file to
   its normalized destination, and writes companions.
6. On a non-zero exit the TUI deletes the staged file. A late failure therefore
   throws away the file the user asked for, so fail before writing anything or
   do not fail at all.

Command tokens are split before references are expanded, so each `${...}`
arrives as its own argv item — a boolean argument reaches the script as
`--overwrite` `true`.

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

Afterwards run `graphify update .`, and update `templates/README.md` and
`.serena/memories/` whenever a documented convention actually moved.
