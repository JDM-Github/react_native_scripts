# Templates

This folder contains source templates used by the scaffold entries in
`ikaika.script.json`. Keep the templates here so generated files follow the same
structure and naming rules as the rest of the project.

## Naming

Every scaffold expects one `name` argument:

- `name`: the lowercase screen name. Kebab-case is preferred, such as
  `user-profile`.

The finalizer derives kebab-case filenames, PascalCase exports, and readable
titles from this value. Both `user-profile` and the recognized concatenated form
`userprofile` become `user-profile` and `UserProfile`. Concatenated lowercase
names can only be split when their words are recognized; use explicit kebab-case
for unusual or ambiguous names.

## Scaffold catalog

| Scaffold key | Primary output | Additional output |
| --- | --- | --- |
| `screen` | `src/screens/<name>.screen.tsx` | Screen controller, screen constant, screen enum |
| `layout` | `src/layouts/<name>.layout.tsx` | Layout controller, layout constant, layout enum |
| `widget` | `src/components/widgets/<name>.widget.tsx` | — |
| `apiEndpoint` | `src/apis/endpoint/<name>/get/ping.<name>.api.ts` | Default GET ping implementation |
| `apiModel` | `src/apis/models/<name>.model.ts` | Default GET ping endpoint |
| `service` | `src/core/services/<name>.service.ts` | — |
| `storage` | `src/core/storages/<name>.storage.ts` | Preferences-backed string value |
| `utility` | `src/core/utilities/<name>.utility.ts` | — |
| `state` | `src/core/states/<name>.state.ts` | Notifier-backed value |
| `manager` | `src/core/managers/<name>.manager.ts` | Notifier-backed lifecycle |
| `constant` | `src/core/constants/<name>.constant.ts` | — |
| `enum` | `src/core/enums/<name>.enum.ts` | Frozen object plus union type |

Screen and layout companion files are created alongside the primary file. A
companion that already exists is kept rather than regenerated; a primary output
that already exists stops finalization unless `--overwrite` is passed. See the
flags described at the end of this file.

## Generated structure

The templates follow the existing layer conventions:

- typed props and named function components for rendered files;
- React Native primitives for markup;
- Tailwind v4 utilities through NativeWind `className` values;
- frozen objects and union types instead of TypeScript enums;
- `Notifier` for observable controllers, states, and managers;
- exact-file `@/` imports and layer-specific filename suffixes;
- no `StyleSheet`, inline `style`, default export, or business logic.

After generating a screen, add its controller or callback props only when the
screen needs them, then wire the screen through the owning layout or navigator.
Run `npm run typecheck`, `npm run lint`, and the relevant tests before committing.

The template is wrapped in one block comment so editors, TypeScript, and ESLint
can parse the unresolved placeholders without reporting syntax errors. After a
file is created, `command-after-success` runs
`scripts/finalize-scaffold-template.mjs` to remove the outer wrapper, replace
the placeholders, normalize the destination, and create any companion files.
Generated source remains under `src/`, where normal validation applies.

A companion file that is already on disk is kept, not treated as a failure, so
scaffolding an API model whose GET ping endpoint already exists still produces
the model. Two flags change that: `--overwrite` (alias `--force`) rewrites files
that are already there, including the primary one, and `--skip-companions`
creates only the file that was asked for. Both accept a bare flag, an explicit
`true`/`false`, or a `--no-` prefix, so a caller filling the value in from a
form can always pass the flag.
