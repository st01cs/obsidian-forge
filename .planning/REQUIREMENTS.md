# Requirements: Obsidian Forge

**Defined:** 2026-04-13
**Core Value:** Give your Obsidian a brain — knowledge flows between sessions, connects across notes, and compounds over quarters

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Installation & Setup

- [ ] **INST-01**: User can install Obsidian Forge from community plugin market and enable it without terminal/CLI
- [ ] **INST-02**: User can configure LLM API provider (OpenAI/Anthropic/Google) and API key via plugin settings tab
- [ ] **INST-03**: Plugin creates vault structure on first enable (forge/ directory with zones, FORGE.md handbook, default commands)

### Core Interaction

- [ ] **CORE-01**: User can open a conversation panel in the sidebar and exchange messages with the agent
- [ ] **CORE-02**: Agent responses stream in real-time to the conversation panel
- [ ] **CORE-03**: User can invoke commands via slash prefix (e.g., /standup, /free-dump, /review)
- [ ] **CORE-04**: Core commands registered to Obsidian command palette (Ctrl/Cmd+P) and keyboard shortcuts
- [x] **CORE-05**: Plugin exposes status bar indicator showing model, session state, and token usage

### Session & Context

- [x] **SESS-01**: On session startup, agent loads context: North Star summary, active projects (metadataCache query), recent Git commits (Desktop), task list
- [x] **SESS-02**: Session state persists via cognitive memory system (notes in forge/cognitive/) and session backups
- [x] **SESS-03**: On session close, agent presents session summary and checklist (index updates, orphan check,成果 discovery)

### Knowledge Routing

- [x] **ROUTE-01**: Agent automatically classifies inbound messages by type (decision, event,成果, 1:1, architecture, person, project update)
- [x] **ROUTE-02**: Classified content is routed to correct notes/zones with appropriate frontmatter
- [x] **ROUTE-03**: PARA zones maintained: work/, org/, performance/, cognitive/, reference/, draft/, forge/
- [x] **ROUTE-04**: All notes include required frontmatter (date, description ~150 chars, tags); notes over 300 chars include wikilinks

### Vault Operations

- [ ] **VAULT-01**: Agent reads notes via vault.cachedRead() with metadataCache for frontmatter/links
- [ ] **VAULT-02**: Agent creates notes via vault.create(), modifies via vault.modify(), atomic edits via vault.process()
- [x] **VAULT-03**: Write validation (async, non-blocking) checks frontmatter completeness and wikilink presence
- [x] **VAULT-04**: vault_rename updates all referencing wikilinks automatically

### Tool System

- [ ] **TOOL-01**: Default pi SDK tools (bash/read/write/edit) replaced with Obsidian-native equivalents
- [ ] **TOOL-02**: Additional tools registered: vault_search, metadata_query, get_backlinks, get_orphans, vault_rename, list_files, git_log, http_request
- [ ] **TOOL-03**: Shell command execution (child_process) available Desktop-only; mobile silently excludes these tools

### Commands

- [x] **CMND-01**: /standup — Morning standup: load context, review yesterday, show tasks, suggest priorities
- [x] **CMND-02**: /free-dump — Capture non-structured text, auto-classify and route
- [x] **CMND-03**: /review — Full session review: validate notes, update indexes,发现 missed成果
- [x] **CMND-04**: /weekly — Cross-session weekly summary, pattern discovery,成果 report
- [x] **CMND-05**: /1on1 — Structure meeting notes into standard 1:1 format
- [x] **CMND-06**: /incident — Capture incident from Slack, reconstruct timeline, create event doc
- [x] **CMND-07**: /brag — Record成果 with evidence links to Brag Doc
- [x] **CMND-08**: /report — Generate performance review brief from evidence chain
- [x] **CMND-09**: /audit — Check knowledge base: orphans, broken links, frontmatter gaps, stale content
- [ ] **CMND-10**: User can add custom commands as .md files in forge/commands/

### Sub-Agents

- [x] **SUBG-01**: Heavy tasks spawn isolated sub-agent sessions via createAgentSession()
- [x] **SUBG-02**: Sub-agents defined as .md files in forge/agents/ with frontmatter (name, tools, model, maxTurns)
- [x] **SUBG-03**: Long-running sub-agents use requestIdleCallback to avoid blocking UI

### External Integrations

- [ ] **EXT-01**: Slack integration via requestUrl() — read messages, search, get user profiles
- [ ] **EXT-02**: GitHub integration via requestUrl() — read PRs, comments, code changes
- [ ] **EXT-03**: Git history via child_process (Desktop-only) — read commits, diffs

### Mobile & Platform

- [x] **MOBI-01**: On mobile, bash/Git tools removed from tool list (silent, no error shown)
- [x] **MOBI-02**: Core chat, vault read/write, metadata query, LLM calls fully functional on mobile
- [ ] **MOBI-03**: External integrations (Slack/GitHub) work on mobile via requestUrl()

### 操作手册

- [ ] **OPS-01**: FORGE.md created on first enable; user can edit in Obsidian
- [ ] **OPS-02**: Agent loads FORGE.md on startup as system-level instructions
- [x] **OPS-03**: Commands and sub-agents documented in FORGE.md with usage examples

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Performance Review

- **PREV-01**: Self-evaluation document generation from evidence chain
- **PREV-02**: Peer review brief generation
- **PREV-03**: Manager review brief generation

### Knowledge Graph

- **KG-01**: Semantic search via embedding API (text-embedding-3-small) with vector index
- **KG-02**: Incremental vector updates on note modify via vault.on('modify')
- **KG-03**: Knowledge graph visualization in Obsidian

### Team Features

- **TEAM-01**: Share cognitive memory notes with team
- **TEAM-02**: Team-wide knowledge routing rules

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Project management (tasks, scheduling, dependencies) | Personal knowledge base, not a PM tool |
| Multi-user real-time collaboration | Personal vault, single user context |
| Source code storage/hosting | Reference docs ok, not code repos |
| Background autonomous automation | All operations user-triggered |
| Model hosting/provision | User provides own API key |
| Standalone app outside Obsidian | Plugin-only, no independent CLI |
| Obsidian Core older than 1.12 | Plugin API requires 1.12+ |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INST-01 | Phase 1 | Pending |
| INST-02 | Phase 1 | Pending |
| INST-03 | Phase 1 | Pending |
| CORE-01 | Phase 1 | Pending |
| CORE-02 | Phase 1 | Pending |
| CORE-03 | Phase 1 | Pending |
| CORE-04 | Phase 1 | Pending |
| CORE-05 | Phase 4 | Complete |
| SESS-01 | Phase 2 | Complete |
| SESS-02 | Phase 2 | Complete |
| SESS-03 | Phase 2 | Complete |
| ROUTE-01 | Phase 2 | Complete |
| ROUTE-02 | Phase 2 | Complete |
| ROUTE-03 | Phase 2 | Complete |
| ROUTE-04 | Phase 2 | Complete |
| VAULT-01 | Phase 1 | Pending |
| VAULT-02 | Phase 1 | Pending |
| VAULT-03 | Phase 2 | Complete |
| VAULT-04 | Phase 2 | Complete |
| TOOL-01 | Phase 1 | Pending |
| TOOL-02 | Phase 1 | Pending |
| TOOL-03 | Phase 1 | Pending |
| CMND-01 | Phase 2 | Complete |
| CMND-02 | Phase 2 | Complete |
| CMND-03 | Phase 2 | Complete |
| CMND-04 | Phase 3 | Complete |
| CMND-05 | Phase 3 | Complete |
| CMND-06 | Phase 3 | Complete |
| CMND-07 | Phase 3 | Complete |
| CMND-08 | Phase 3 | Complete |
| CMND-09 | Phase 3 | Complete |
| CMND-10 | Phase 2 | Pending |
| SUBG-01 | Phase 3 | Complete |
| SUBG-02 | Phase 3 | Complete |
| SUBG-03 | Phase 3 | Complete |
| EXT-01 | Phase 3 | Pending |
| EXT-02 | Phase 3 | Pending |
| EXT-03 | Phase 3 | Pending |
| MOBI-01 | Phase 4 | Complete |
| MOBI-02 | Phase 4 | Complete |
| MOBI-03 | Phase 3 | Pending |
| OPS-01 | Phase 1 | Pending |
| OPS-02 | Phase 1 | Pending |
| OPS-03 | Phase 2 | Complete |

**Coverage:**
- v1 requirements: 42 total
- Mapped to phases: 42
- Unmapped: 0

---
*Requirements defined: 2026-04-13*
*Roadmap created: 2026-04-13*
