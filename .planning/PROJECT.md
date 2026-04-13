# Obsidian Forge

## What This Is

Obsidian Forge is an **Obsidian community plugin** that embeds a persistent AI agent (pi SDK) directly inside Obsidian's Electron process. The agent operates through Obsidian's native Vault API—reading, writing, and linking notes—while users interact via a sidebar chat panel. The core promise: AI memory that survives across sessions, zero terminal required, installed from the community plugin market.

## Core Value

**Obsidian gets a brain.** Knowledge flows between sessions, connections surface automatically, and the AI remembers your goals, decisions, and context without repetition.

## Requirements

### Active

- [ ] **CORE-01**: Community plugin scaffold — manifest, main.ts entry, build config (esbuild)
- [ ] **CORE-02**: Plugin UI shell — sidebar ItemView, ribbon icon, command palette registration, settings tab
- [ ] **CORE-03**: pi SDK integration — createAgentSession(), SessionManager, AuthStorage (settings-backed), ModelRegistry
- [ ] **CORE-04**: Obsidian-native tool system — replace pi defaults with vault.cachedRead, vault.create/modify/process, vault.rename; register knowledge tools (search, metadata_query, backlinks, orphans, list_files, git_log, http_request)
- [ ] **CORE-05**: Session lifecycle — startup context injection (North Star, active projects, git log, tasks), message classification/routing, write validation (frontmatter + wikilinks), session-close checklist
- [ ] **CORE-06**: Command system — dual registration (Obsidian commands + forge/commands/ markdown files), slash-prefix invocation in chat, natural-language intent matching
- [ ] **CORE-07**: Knowledge base structure — auto-create vault分区 (forge/, work/, org/, perf/,认知区/, ref/, drafts/), FORGE.md操作手册, index notes
- [ ] **CORE-08**: Memory system —认知区笔记 (decisions, patterns, pitfalls), North Star document, memory index; cross-session recall via metadataCache
- [ ] **CORE-09**: Performance tracking — Brag Doc (quarterly), capability framework, evidence linking, review brief generation
- [ ] **CORE-10**: Layered search — metadataCache queries, resolvedLinks graph traversal, full-text fallback, optional semantic search (embedding API)
- [ ] **CORE-11**: External integrations — Slack Web API (事件捕获, Slack scan), GitHub REST/GraphQL (PR scan), Git history (child_process, Desktop-only)
- [ ] **CORE-12**: Version management — vault-manifest.json, plugin upgrade (code only, never user content), migration system
- [ ] **CORE-13**: Sub-agent system — createAgentSession() isolation, forge/agents/ definition files, concurrent调度 with requestIdleCallback
- [ ] **CORE-14**: UI polish — streaming LLM responses, tool-call visualization, status bar (model, tokens, state), draggable panel
- [ ] **CORE-15**: Platform compatibility — Desktop full-featured, Mobile graceful degradation (no child_process/bash/git)

### Out of Scope

- **Project management / task scheduling** — Not a PM tool; tasks are notes, not tickets
- **Multi-user collaboration** — Personal knowledge base, single-user design
- **Source code storage** — Code lives in repos; Obsidian holds code knowledge as reference docs
- **Background automation** — All AI actions triggered by user intent; no autonomous agents running idle
- **LLM provider** — No model API of its own; users bring their own API key via pi-ai
- **Standalone CLI / web app** — Obsidian-only plugin; no life outside the Electron process

## Context

**Technical environment:**
- Obsidian Desktop 1.12+ (Electron, renderer process)
- TypeScript + Obsidian API (app.vault, metadataCache, workspace, plugin)
- esbuild for bundling into main.js
- pi SDK (`@mariozechner/pi-coding-agent`) in SDK mode — agent loop decoupled from TUI
- pi-ai for unified LLM API (OpenAI / Anthropic / Google)
- No Node.js CLI tools; all via Obsidian API or child_process (Desktop-only)

**PRD is comprehensive:** 15 section PRD covers product vision, target users (software engineers / tech leads), design principles (graph-first, atomic notes, conversational routing), full requirements (agent runtime, knowledge structure, graph/links, session lifecycle, commands, performance tracking, memory, search, external integrations, version management), non-functional requirements (token efficiency, extensibility, install UX, performance, reliability, privacy, platform compatibility), success metrics, and scope boundaries.

**No existing code.** This is a greenfield plugin project.

## Constraints

- **Tech stack**: TypeScript + Obsidian Plugin API + pi SDK — no framework alternatives considered
- **Distribution**: Obsidian community plugin market only — no side-loading docs or external hosting
- **Platform**: Desktop-first (Electron), Mobile support via graceful degradation
- **API keys**: Stored in Obsidian's data.json (plugin config), never in vault notes
- **Zero data loss**: All note operations use vault.rename (move, never delete); archival over deletion
- **Vault isolation**: Plugin code lives in `.obsidian/plugins/obsidian-forge/`; user content in vault root

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| pi SDK over custom agent loop | Agent loop already solved; embed not reinvent | — Pending |
| Vault API over CLI / filesystem | Eliminates CLI/filesystem二元性; always vault-aware | — Pending |
| Semantic search optional (not core) | Vector index adds complexity; metadataCache sufficient for most | — Pending |
| Coarse granularity | PRD is comprehensive; better to deliver E2E slices than many thin phases | — Pending |
| No background automation | User intent must trigger all actions; avoids creepy silent behavior | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-13 after initialization*
