# Graph Report - react_native_scripts  (2026-08-19)

## Corpus Check
- 34 files · ~17,495 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 223 nodes · 231 edges · 34 communities (33 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `611b890f`
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
- package.json
- Change Summary -- 2026-08-16 23:42:30 UTC to 2026-08-18 02:12:33 UTC
- Change Summary -- 2026-08-18 03:49:12 UTC to 2026-08-19 08:26:16 UTC
- Tier 1 — Free and local
- run-platform.mjs
- Change Summary -- 2026-08-18 02:13:05 UTC to 2026-08-18 03:48:43 UTC

## God Nodes (most connected - your core abstractions)
1. `Tier 1 — Free and local` - 13 edges
2. `build` - 9 edges
3. `finalizeScaffold()` - 7 edges
4. `removeGeneratedPath()` - 5 edges
5. `runTrayAction()` - 5 edges
6. `nsis` - 5 edges
7. `Tier 3 — Needs infrastructure, and mostly belongs elsewhere` - 5 edges
8. `showMainWindow()` - 4 edges
9. `buildTrayTemplate()` - 4 edges
10. `createTray()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Memory Maintenance Guide` --conceptually_related_to--> `Serena Project Configuration`  [INFERRED]
  .serena/memories/memory_maintenance.md → .serena/project.yml

## Import Cycles
- None detected.

## Communities (34 total, 1 thin omitted)

### Community 0 - "finalize-scaffold-template.mjs"
Cohesion: 0.15
Nodes (21): BOOLEAN_FLAGS, booleanValue(), booleanWord(), companions(), FALSE_WORDS, finalizeScaffold(), isInside(), KNOWN_NAME_WORDS (+13 more)

### Community 1 - "Change Summary -- 2026-08-16 23:40:02 UTC to 2026-08-16 23:40:32 UTC"
Cohesion: 0.40
Nodes (4): Change Summary -- 2026-08-16 23:40:02 UTC to 2026-08-16 23:40:32 UTC, Key Changes, Overview, Risks / Follow-ups

### Community 2 - "Serena Project Configuration"
Cohesion: 0.67
Nodes (3): React Native Scripts Project, Memory Maintenance Guide, Serena Project Configuration

### Community 3 - "build-platform.mjs"
Cohesion: 0.06
Nodes (39): appConfigPath, artifactSlug, BOOLEAN_FLAGS, booleanValue(), booleanWord(), buildNumber, buildRoot, cleanEmptyTemporaryDirectories() (+31 more)

### Community 4 - "build"
Cohesion: 0.11
Nodes (17): main.cjs, build, appId, asar, directories, extraResources, files, nsis (+9 more)

### Community 20 - "Change Summary -- 2026-08-16 23:41:57 UTC to 2026-08-16 23:42:17 UTC"
Cohesion: 0.40
Nodes (4): Change Summary -- 2026-08-16 23:41:57 UTC to 2026-08-16 23:42:17 UTC, Key Changes, Overview, Risks / Follow-ups

### Community 26 - "main.cjs"
Cohesion: 0.12
Nodes (22): {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  shell,
  Tray,
}, buildTrayTemplate(), { createReadStream, existsSync, readFileSync, statSync }, { createServer }, createTray(), createWindow(), DEFAULT_TRAY_MENU, desktopConfig (+14 more)

### Community 28 - "package.json"
Cohesion: 0.17
Nodes (11): electron, electron-builder, author, description, devDependencies, electron, electron-builder, main (+3 more)

### Community 29 - "Change Summary -- 2026-08-16 23:42:30 UTC to 2026-08-18 02:12:33 UTC"
Cohesion: 0.40
Nodes (4): Change Summary -- 2026-08-16 23:42:30 UTC to 2026-08-18 02:12:33 UTC, Key Changes, Overview, Risks / Follow-ups

### Community 30 - "Change Summary -- 2026-08-18 03:49:12 UTC to 2026-08-19 08:26:16 UTC"
Cohesion: 0.40
Nodes (4): Change Summary -- 2026-08-18 03:49:12 UTC to 2026-08-19 08:26:16 UTC, Key Changes, Overview, Risks / Follow-ups

### Community 31 - "Tier 1 — Free and local"
Cohesion: 0.07
Nodes (27): 10. Add a self-signed test identity for local verification, 11. Add a hardening regression check, 12. Ignore certificate and secret material, 13. Obtain a publicly trusted code-signing identity, 14. Scaffold a signed-release workflow into generated projects, 15. Auto-updates, 16. Download page and API, 17. SBOM and build provenance (+19 more)

### Community 32 - "run-platform.mjs"
Cohesion: 0.10
Nodes (21): BOOLEAN_FLAGS, booleanValue(), booleanWord(), expoCli(), FALSE_WORDS, HOST_MODES, INTERRUPT_EXIT_CODES, packageConfigPath (+13 more)

### Community 34 - "Change Summary -- 2026-08-18 02:13:05 UTC to 2026-08-18 03:48:43 UTC"
Cohesion: 0.40
Nodes (4): Change Summary -- 2026-08-18 02:13:05 UTC to 2026-08-18 03:48:43 UTC, Key Changes, Overview, Risks / Follow-ups

## Knowledge Gaps
- **116 isolated node(s):** `PLATFORM_ALIASES`, `UNIMPLEMENTED`, `VALUE_FLAGS`, `BOOLEAN_FLAGS`, `TRUE_WORDS` (+111 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `build` connect `build` to `package.json`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `PLATFORM_ALIASES`, `UNIMPLEMENTED`, `VALUE_FLAGS` to the rest of the system?**
  _116 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `finalize-scaffold-template.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.1471861471861472 - nodes in this community are weakly interconnected._
- **Should `build-platform.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._
- **Should `build` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `main.cjs` be split into smaller, more focused modules?**
  _Cohesion score 0.12318840579710146 - nodes in this community are weakly interconnected._
- **Should `Tier 1 — Free and local` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._