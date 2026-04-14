# Roadmap: Obsidian Forge

## Overview

Obsidian Forge embeds an AI agent (pi SDK) into Obsidian as a community plugin, giving the vault persistent memory, automatic knowledge routing, and PARA-based organization. The journey moves from plugin foundation through a working agent loop, then advanced workflows and integrations, finishing with polish and mobile parity.

## Phases

- [ ] **Phase 1: Foundation** - Plugin scaffold, vault adapter, tool registry, conversation panel, settings, mobile foundation
- [ ] **Phase 2: Agent Loop** - Session context, knowledge routing, core commands, write validation
- [ ] **Phase 3: Advanced** - Complex commands, sub-agents, external integrations
- [ ] **Phase 4: Polish** - Status bar indicator, mobile parity

## Phase Details

### Phase 1: Foundation
**Goal**: Plugin installed, enabled, and basic chat interaction functional
**Depends on**: Nothing (first phase)
**Requirements**: INST-01, INST-02, INST-03, CORE-01, CORE-02, CORE-03, CORE-04, VAULT-01, VAULT-02, TOOL-01, TOOL-02, TOOL-03, MOBI-01, MOBI-02, OPS-01, OPS-02
**Success Criteria** (what must be TRUE):
  1. User can install Obsidian Forge from community plugin market and enable it without terminal/CLI
  2. User can configure LLM API provider and key via plugin settings tab, and changes persist across restarts
  3. Plugin creates vault structure on first enable (forge/ directory with zones, FORGE.md handbook, default commands)
  4. User can open a conversation panel in the sidebar and exchange messages with the agent
  5. Agent responses stream in real-time to the conversation panel
  6. User can invoke commands via slash prefix (e.g., /standup, /free-dump, /review)
  7. Core commands appear in Obsidian command palette (Ctrl/Cmd+P) and respond to keyboard shortcuts
  8. Platform detection runs at startup; bash/Git tools removed on mobile (no error shown)
  9. Core chat, vault read/write, metadata query, and LLM calls work on mobile
  10. FORGE.md created on first enable and editable in Obsidian
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Plugin scaffold (manifest.json, package.json, tsconfig.json, esbuild.config.mjs) + VaultAdapter
- [ ] 01-02-PLAN.md — Mobile platform detection (mobile.ts) + ToolRegistry with 11 Obsidian-native tools
- [ ] 01-03-PLAN.md — ChatPanel ItemView, SettingsTab, main.ts with vault structure creation

**UI hint**: yes

### Phase 2: Agent Loop
**Goal**: Agent manages knowledge across sessions with routing and basic commands
**Depends on**: Phase 1
**Requirements**: SESS-01, SESS-02, SESS-03, ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04, VAULT-03, VAULT-04, CMND-01, CMND-02, CMND-03, CMND-10, OPS-03
**Success Criteria** (what must be TRUE):
  1. On session startup, agent loads context: North Star summary, active projects (metadataCache), recent Git commits, task list
  2. Session state persists via cognitive memory system (notes in forge/cognitive/) and survives plugin restart
  3. On session close, agent presents session summary and checklist (index updates, orphan check,成果 discovery)
  4. Agent automatically classifies inbound messages by type (decision, event,成果, 1:1, architecture, person, project update)
  5. Classified content routes to correct notes/zones with appropriate frontmatter
  6. PARA zones (work/, org/, performance/, cognitive/, reference/, draft/, forge/) are maintained by the agent
  7. All notes include required frontmatter (date, description ~150 chars, tags); notes over 300 chars include wikilinks
  8. Write validation (async, non-blocking) checks frontmatter completeness and wikilink presence
  9. vault_rename updates all referencing wikilinks automatically
  10. /standup command loads context, reviews yesterday, shows tasks, suggests priorities
  11. /free-dump command captures non-structured text, auto-classifies, and routes
  12. /review command validates notes, updates indexes,发现 missed成果
  13. User can add custom commands as .md files in forge/commands/
**Plans**: TBD

### Phase 3: Advanced
**Goal**: Agent supports complex workflows, sub-agents, and external evidence capture
**Depends on**: Phase 2
**Requirements**: CMND-04, CMND-05, CMND-06, CMND-07, CMND-08, CMND-09, SUBG-01, SUBG-02, SUBG-03, EXT-01, EXT-02, EXT-03, MOBI-03
**Success Criteria** (what must be TRUE):
  1. /weekly command produces cross-session weekly summary with pattern discovery and成果 report
  2. /1on1 command structures meeting notes into standard 1:1 format
  3. /incident command captures incident from Slack, reconstructs timeline, creates event doc
  4. /brag command records成果 with evidence links to Brag Doc
  5. /report command generates performance review brief from evidence chain
  6. /audit command checks knowledge base: orphans, broken links, frontmatter gaps, stale content
  7. Heavy tasks spawn isolated sub-agent sessions via createAgentSession()
  8. Sub-agents defined as .md files in forge/agents/ with frontmatter (name, tools, model, maxTurns)
  9. Long-running sub-agents use requestIdleCallback to avoid blocking UI
  10. Slack integration reads messages, searches, and gets user profiles via requestUrl()
  11. GitHub integration reads PRs, comments, and code changes via requestUrl()
  12. Git history reads commits and diffs via child_process (Desktop-only)
  13. External integrations (Slack/GitHub) work on mobile via requestUrl()
**Plans**: TBD

### Phase 4: Polish
**Goal**: UI polish and mobile parity
**Depends on**: Phase 3
**Requirements**: CORE-05, MOBI-01, MOBI-02
**Success Criteria** (what must be TRUE):
  1. Status bar displays model name, session state, and token usage in real-time
  2. On mobile, bash/Git tools silently excluded from tool list with no error shown
  3. Core chat, vault read/write, metadata query, and LLM calls remain fully functional on mobile
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/3 | Planning complete | - |
| 2. Agent Loop | 0/N | Not started | - |
| 3. Advanced | 0/N | Not started | - |
| 4. Polish | 0/N | Not started | - |

## Coverage

**Requirements mapped:** 42/42
**Orphaned requirements:** 0
