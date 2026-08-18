# Graph Report - react_native_scripts  (2026-08-18)

## Corpus Check
- 25 files · ~5,249 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 50 nodes · 37 edges · 26 communities (25 shown, 1 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b8a57161`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- finalize-scaffold-template.mjs
- Change Summary -- 2026-08-16 23:40:02 UTC to 2026-08-16 23:40:32 UTC
- Serena Project Configuration
- main
- segmentKnownWords
- Templates Documentation
- Change Summary -- 2026-08-16 23:41:57 UTC to 2026-08-16 23:42:17 UTC

## God Nodes (most connected - your core abstractions)
1. `finalizeScaffold()` - 7 edges
2. `Change Summary -- 2026-08-16 23:40:02 UTC to 2026-08-16 23:40:32 UTC` - 4 edges
3. `Change Summary -- 2026-08-16 23:41:57 UTC to 2026-08-16 23:42:17 UTC` - 4 edges
4. `segmentKnownWords()` - 3 edges
5. `splitName()` - 3 edges
6. `render()` - 3 edges
7. `parseArguments()` - 3 edges
8. `main()` - 3 edges
9. `KNOWN_NAME_WORDS` - 2 edges
10. `isInside()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `Memory Maintenance Guide` --conceptually_related_to--> `Serena Project Configuration`  [INFERRED]
  .serena/memories/memory_maintenance.md → .serena/project.yml

## Import Cycles
- None detected.

## Communities (26 total, 1 thin omitted)

### Community 0 - "finalize-scaffold-template.mjs"
Cohesion: 0.27
Nodes (10): companions(), finalizeScaffold(), isInside(), primaryPath(), render(), SCAFFOLD_DEFINITIONS, scriptPath, templatesRoot (+2 more)

### Community 1 - "Change Summary -- 2026-08-16 23:40:02 UTC to 2026-08-16 23:40:32 UTC"
Cohesion: 0.40
Nodes (4): Change Summary -- 2026-08-16 23:40:02 UTC to 2026-08-16 23:40:32 UTC, Key Changes, Overview, Risks / Follow-ups

### Community 2 - "Serena Project Configuration"
Cohesion: 0.67
Nodes (3): React Native Scripts Project, Memory Maintenance Guide, Serena Project Configuration

### Community 3 - "main"
Cohesion: 0.67
Nodes (3): flagValue(), main(), parseArguments()

### Community 4 - "segmentKnownWords"
Cohesion: 0.67
Nodes (3): KNOWN_NAME_WORDS, segmentKnownWords(), splitName()

### Community 20 - "Change Summary -- 2026-08-16 23:41:57 UTC to 2026-08-16 23:42:17 UTC"
Cohesion: 0.40
Nodes (4): Change Summary -- 2026-08-16 23:41:57 UTC to 2026-08-16 23:42:17 UTC, Key Changes, Overview, Risks / Follow-ups

## Knowledge Gaps
- **13 isolated node(s):** `scriptPath`, `toolRoot`, `templatesRoot`, `SCAFFOLD_DEFINITIONS`, `Overview` (+8 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `finalizeScaffold()` connect `finalize-scaffold-template.mjs` to `main`, `segmentKnownWords`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `scriptPath`, `toolRoot`, `templatesRoot` to the rest of the system?**
  _13 weakly-connected nodes found - possible documentation gaps or missing edges._