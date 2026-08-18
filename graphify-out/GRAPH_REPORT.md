# Graph Report - react_native_scripts  (2026-08-18)

## Corpus Check
- 30 files · ~9,745 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 145 nodes · 143 edges · 30 communities (29 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8951decb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- finalize-scaffold-template.mjs
- Change Summary -- 2026-08-16 23:40:02 UTC to 2026-08-16 23:40:32 UTC
- Serena Project Configuration
- build-platform.mjs
- build
- Templates Documentation
- Change Summary -- 2026-08-16 23:41:57 UTC to 2026-08-16 23:42:17 UTC
- main.cjs
- CLAUDE.md
- package.json
- Change Summary -- 2026-08-16 23:42:30 UTC to 2026-08-18 02:12:33 UTC

## God Nodes (most connected - your core abstractions)
1. `build` - 9 edges
2. `parseArguments()` - 7 edges
3. `finalizeScaffold()` - 7 edges
4. `removeGeneratedPath()` - 5 edges
5. `nsis` - 5 edges
6. `booleanValue()` - 5 edges
7. `Change Summary -- 2026-08-16 23:40:02 UTC to 2026-08-16 23:40:32 UTC` - 4 edges
8. `Change Summary -- 2026-08-16 23:41:57 UTC to 2026-08-16 23:42:17 UTC` - 4 edges
9. `Change Summary -- 2026-08-16 23:42:30 UTC to 2026-08-18 02:12:33 UTC` - 4 edges
10. `resolveCli()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Memory Maintenance Guide` --conceptually_related_to--> `Serena Project Configuration`  [INFERRED]
  .serena/memories/memory_maintenance.md → .serena/project.yml

## Import Cycles
- None detected.

## Communities (30 total, 1 thin omitted)

### Community 0 - "finalize-scaffold-template.mjs"
Cohesion: 0.17
Nodes (21): BOOLEAN_FLAGS, booleanValue(), booleanWord(), companions(), FALSE_WORDS, finalizeScaffold(), isInside(), KNOWN_NAME_WORDS (+13 more)

### Community 1 - "Change Summary -- 2026-08-16 23:40:02 UTC to 2026-08-16 23:40:32 UTC"
Cohesion: 0.40
Nodes (4): Change Summary -- 2026-08-16 23:40:02 UTC to 2026-08-16 23:40:32 UTC, Key Changes, Overview, Risks / Follow-ups

### Community 2 - "Serena Project Configuration"
Cohesion: 0.67
Nodes (3): React Native Scripts Project, Memory Maintenance Guide, Serena Project Configuration

### Community 3 - "build-platform.mjs"
Cohesion: 0.07
Nodes (28): appConfigPath, artifactSlug, buildNumber, buildRoot, cleanEmptyTemporaryDirectories(), cleanLegacyRootOutputs(), createStagingDirectory(), electronBuilderCli() (+20 more)

### Community 4 - "build"
Cohesion: 0.11
Nodes (17): main.cjs, build, appId, asar, directories, extraResources, files, nsis (+9 more)

### Community 20 - "Change Summary -- 2026-08-16 23:41:57 UTC to 2026-08-16 23:42:17 UTC"
Cohesion: 0.40
Nodes (4): Change Summary -- 2026-08-16 23:41:57 UTC to 2026-08-16 23:42:17 UTC, Key Changes, Overview, Risks / Follow-ups

### Community 26 - "main.cjs"
Cohesion: 0.22
Nodes (10): { app, BrowserWindow, shell }, { createReadStream, existsSync, statSync }, { createServer }, createWindow(), { extname, resolve, sep }, MIME_TYPES, openExternalUrl(), resolveAssetPath() (+2 more)

### Community 27 - "CLAUDE.md"
Cohesion: 0.20
Nodes (8): Adding a scaffold kind, Builds, Finalizer invariants, How one scaffold actually runs, Layout, The template convention, Verifying a change, What this repository is

### Community 28 - "package.json"
Cohesion: 0.17
Nodes (11): electron, electron-builder, author, description, devDependencies, electron, electron-builder, main (+3 more)

### Community 29 - "Change Summary -- 2026-08-16 23:42:30 UTC to 2026-08-18 02:12:33 UTC"
Cohesion: 0.40
Nodes (4): Change Summary -- 2026-08-16 23:42:30 UTC to 2026-08-18 02:12:33 UTC, Key Changes, Overview, Risks / Follow-ups

## Knowledge Gaps
- **69 isolated node(s):** `PLATFORM_ALIASES`, `UNIMPLEMENTED`, `VALUE_FLAGS`, `scriptPath`, `toolRoot` (+64 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `build` connect `build` to `package.json`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `PLATFORM_ALIASES`, `UNIMPLEMENTED`, `VALUE_FLAGS` to the rest of the system?**
  _69 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `build-platform.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07130124777183601 - nodes in this community are weakly interconnected._
- **Should `build` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._