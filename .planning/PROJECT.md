# Obsidian Forge

## What This Is

Obsidian Forge is an **Obsidian community plugin** that embeds an AI agent (via pi SDK) directly into Obsidian's Electron process. It provides persistent memory across sessions, automated knowledge routing, and performance evidence capture — all within Obsidian's native interface, with no CLI or external tools required.

Users install from the Obsidian community plugin market, configure an LLM API key, and interact via a sidebar conversation panel. The agent operates through Obsidian's Vault API, maintaining context across sessions through a cognitive memory system.

## Core Value

**Give your Obsidian a brain.** Knowledge flows between sessions, connects across notes, and compounds over quarters — without ever leaving Obsidian.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **R-01**: User can install Obsidian Forge from community plugin market and enable it without terminal/CLI
- [ ] **R-02**: User can configure LLM API provider and key via plugin settings tab
- [ ] **R-03**: User can open a conversation panel in the sidebar and exchange messages with the agent
- [ ] **R-04**: Agent loads session context on startup (North Star, active projects, recent changes, task list)
- [ ] **R-05**: Agent automatically classifies inbound messages and routes content to correct notes
- [ ] **R-06**: Agent reads/writes notes via Obsidian Vault API (not CLI or filesystem)
- [ ] **R-07**: Agent validates frontmatter completeness and wikilink presence on note creation
- [ ] **R-08**: User can invoke commands via slash prefix or command palette (/standup, /free-dump, /review, etc.)
- [ ] **R-09**: Sub-agents can be spawned in isolated contexts for heavy tasks (slack scan, PR analysis, evidence aggregation)
- [ ] **R-10**: Agent creates and maintains knowledge base structure (zones: work, org, performance, cognitive, reference, draft, forge)
- [ ] **R-11**: Session state persists across conversations via cognitive memory system and session backups
- [ ] **R-12**: Agent provides performance review preparation (evidence aggregation, review brief generation)
- [ ] **R-13**: Plugin exposes status bar indicator (model, token usage, session state)
- [ ] **R-14**: External integrations (Slack, GitHub) via requestUrl() for evidence capture
- [ ] **R-15**: Mobile falls back gracefully (no bash/Git, silent feature removal)

### Out of Scope

- **Project management** (task allocation, scheduling, dependencies) — Not a PM tool
- **Multi-user collaboration** (real-time multi-person editing) — Personal knowledge base only
- **Code hosting** (source code storage) — Reference docs ok, not source repos
- **Automation engine** (background autonomous tasks) — All operations user-triggered
- **LLM provision** (model hosting) — Uses user's own API key via pi-ai
- **Standalone app** (outside Obsidian) — Plugin-only, no independent CLI or web UI
- **Obsidian Core beyond 1.12** — Desktop-only core features

## Context

**Technical environment:**
- Obsidian Desktop 1.12+ (Electron renderer process)
- pi SDK (`@mariozechner/pi-coding-agent`) embedded via esbuild
- TypeScript for all plugin code
- Vault API access via Obsidian's plugin API (`app.vault`, `app.metadataCache`, `workspace`)
- Desktop-only: `child_process` for Git operations
- Mobile fallback: silent degradation for platform-incompatible features

**What this replaces:**
- Manual context setting at session start (agent loads it automatically)
- External AI CLI tools that operate on vault via filesystem (agent uses Vault API)
- Scattered performance evidence (agent auto-captures and aggregates)

**Known complexity areas:**
- pi SDK integration and tool re-registration (default bash/read/write/edit → Obsidian-native)
- Session context injection (must not exceed token budget)
- Write validation without blocking agent flow
- Mobile/Desktop feature parity with graceful degradation

## Constraints

- **Platform**: Obsidian Desktop 1.12+ (plugin API required)
- **Runtime**: Electron renderer process (same-process as Obsidian)
- **LLM**: User-supplied API key (OpenAI / Anthropic / Google via pi-ai)
- **Bundle size**: < 5MB (tree-shaking required)
- **Token budget**: Session startup context must be lightweight (metadataCache first, content on-demand)
- **No CLI/filesystem duality**: All vault operations via Vault API only

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| pi SDK for agent runtime | Open-source, embeddable, model-agnostic | — Pending |
| Vault API over filesystem | Eliminates CLI/filesystem duality, ensures consistency | — Pending |
| Desktop-first with mobile fallback | Obsidian mobile lacks some APIs; degrade gracefully | — Pending |
| Semantic search optional (v1) | Embedding API adds complexity; fallback to metadataCache | — Pending |
|操作手册 in vault as note | User-editable, version-controlled, familiar workflow | — Pending |

---

*Last updated: 2026-04-13 after initialization*
