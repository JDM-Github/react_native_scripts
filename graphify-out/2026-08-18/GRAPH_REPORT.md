# Graph Report - react_native_scripts  (2026-08-18)

## Corpus Check
- 32 files · ~13,863 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 193 nodes · 189 edges · 35 communities (34 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `771c5c94`
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
- Electron Secure Build and Official Release Implementation Guide
- Priority 0: Configure Electron Securely
- Definition of Done
- Priority 1: Checksums, Manifest, Provenance, and SBOM
- Change Summary -- 2026-08-18 02:13:05 UTC to 2026-08-18 03:48:43 UTC

## God Nodes (most connected - your core abstractions)
1. `Electron Secure Build and Official Release Implementation Guide` - 17 edges
2. `build` - 9 edges
3. `Priority 0: Configure Electron Securely` - 8 edges
4. `parseArguments()` - 7 edges
5. `finalizeScaffold()` - 7 edges
6. `Definition of Done` - 6 edges
7. `removeGeneratedPath()` - 5 edges
8. `nsis` - 5 edges
9. `booleanValue()` - 5 edges
10. `Priority 1: Checksums, Manifest, Provenance, and SBOM` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Memory Maintenance Guide` --conceptually_related_to--> `Serena Project Configuration`  [INFERRED]
  .serena/memories/memory_maintenance.md → .serena/project.yml

## Import Cycles
- None detected.

## Communities (35 total, 1 thin omitted)

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

### Community 30 - "Electron Secure Build and Official Release Implementation Guide"
Cohesion: 0.08
Nodes (23): Authentication and API, Critical Security Fact, Dependency installation, Download website, Electron Secure Build and Official Release Implementation Guide, Key Compromise and Incident Response, Mandatory signature verification, Objective (+15 more)

### Community 31 - "Priority 0: Configure Electron Securely"
Cohesion: 0.25
Nodes (8): ASAR is not a security boundary, BrowserWindow baseline, Content Security Policy, Electron fuses, Local content and protocols, Navigation, windows, permissions, and external URLs, Priority 0: Configure Electron Securely, Renderer and preload isolation

### Community 32 - "Definition of Done"
Cohesion: 0.33
Nodes (6): Build integrity, Definition of Done, Electron runtime, Official identity, Operations, Updates and web

### Community 33 - "Priority 1: Checksums, Manifest, Provenance, and SBOM"
Cohesion: 0.40
Nodes (5): Build provenance, Priority 1: Checksums, Manifest, Provenance, and SBOM, Release manifest, SHA-256 checksums, Software Bill of Materials

### Community 34 - "Change Summary -- 2026-08-18 02:13:05 UTC to 2026-08-18 03:48:43 UTC"
Cohesion: 0.40
Nodes (4): Change Summary -- 2026-08-18 02:13:05 UTC to 2026-08-18 03:48:43 UTC, Key Changes, Overview, Risks / Follow-ups

## Knowledge Gaps
- **106 isolated node(s):** `PLATFORM_ALIASES`, `UNIMPLEMENTED`, `VALUE_FLAGS`, `scriptPath`, `toolRoot` (+101 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Electron Secure Build and Official Release Implementation Guide` connect `Electron Secure Build and Official Release Implementation Guide` to `Definition of Done`, `Priority 1: Checksums, Manifest, Provenance, and SBOM`, `Priority 0: Configure Electron Securely`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `build` connect `build` to `package.json`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `Priority 0: Configure Electron Securely` connect `Priority 0: Configure Electron Securely` to `Electron Secure Build and Official Release Implementation Guide`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `PLATFORM_ALIASES`, `UNIMPLEMENTED`, `VALUE_FLAGS` to the rest of the system?**
  _106 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `build-platform.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07130124777183601 - nodes in this community are weakly interconnected._
- **Should `build` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `Electron Secure Build and Official Release Implementation Guide` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._