# Project Research Summary

**Project:** Obsidian Forge
**Domain:** Obsidian Community Plugin with Embedded AI Agent Runtime
**Researched:** 2026-04-13
**Confidence:** MEDIUM

## Executive Summary

Obsidian Forge is an Obsidian community plugin that embeds an AI agent (via the pi SDK) directly inside the user's vault, providing persistent memory across sessions, automatic knowledge routing, and PARA-based note organization. The plugin runs in Obsidian's Electron renderer process, replacing pi SDK's default CLI tools (bash, read, write) with Obsidian-native Vault API equivalents. The critical technical constraint is that all vault operations must flow through `app.vault`, never the filesystem, and token budget must be managed aggressively at startup using metadataCache-first loading to avoid context overflow. The core differentiation is cognitive memory that survives restarts and an agent that auto-classifies content into PARA zones. Development should proceed in three phases: MVP Shell (plugin scaffold + tool registry), Core Agent Loop (session context + knowledge routing), and Advanced Features (sub-agents + external integrations).

## Key Findings

### Recommended Stack

TypeScript 5.x with esbuild 0.21.x as the official Obsidian toolchain. The pi SDK packages (pi-coding-agent, pi-ai, pi-web-ui) at version 0.66.1 provide the agent runtime, model abstraction, and chat UI. Node.js 20.x is required (minimum 20.6.0). Obsidian API 1.12.3. All pi packages must be version-locked together.

**Core technologies:**
- **TypeScript 5.x** -- Required by Obsidian API types, provides type safety for agent integration
- **esbuild 0.21.x** -- Official Obsidian toolchain, fast builds, tree-shaking for <5MB bundle constraint
- **@mariozechner/pi-coding-agent@0.66.1** -- Agent runtime with tool system; must replace default tools with Obsidian equivalents
- **@mariozechner/pi-ai@0.66.1** -- Unified LLM API with streaming and cross-provider handoffs
- **@mariozechner/pi-web-ui@0.66.1** -- Pre-built ChatPanel with artifacts and session management
- **@sinclair/typebox** -- JSON schema types for tool parameter definitions

### Expected Features

**Must have (table stakes):**
- Sidebar Chat Panel -- Core interaction surface; streaming responses, conversation history
- Note Read/Write via Vault API -- All agent tools operate on notes through app.vault, never filesystem
- LLM Provider Config -- Settings tab for API key and model selection
- Slash Commands -- /standup, /free-dump, /review for quick invocation
- Session Context Injection -- Agent loads North Star, active projects, recent changes on startup
- PARA Knowledge Structure -- 7-zone agent-managed structure (Work, Org, Performance, Cognitive, Reference, Draft, Forge)
- Frontmatter Validation -- Enforce wikilink presence and frontmatter completeness on note creation

**Should have (competitive differentiators):**
- Persistent Memory Across Sessions -- Agent remembers context between conversations without manual re-setting
- Automatic Knowledge Routing -- Agent classifies and routes content to correct notes/zone
- Performance Review Evidence Capture -- Aggregates work evidence from Slack/GitHub
- Sub-Agent Spawning -- Heavy tasks (PR analysis, Slack scan) in isolated contexts
- Status Bar Indicator -- Model name, token usage, session state visibility

**Defer (v2+):**
- Semantic Search (Embeddings) -- MetadataCache fallback sufficient for v1; sqlite-vec or local embeddings later
- Knowledge Graph Visualization -- Graph view of note connections
- Confidence-Based Knowledge Lifecycle -- Auto-decay, surface relevant knowledge
- Self-Evolving Taxonomy -- Auto-reorganize folder structure

### Architecture Approach

The plugin extends `obsidian.Plugin` with a layered architecture: Plugin Core coordinates subsystems. Session Manager maintains agent session across restarts. Tool Registry replaces pi SDK defaults with Obsidian-native vault operations. Vault Adapter wraps `app.vault`, `app.metadataCache`, `app.workspace` for consistent error handling and path validation. Conversation Panel (sidebar), Settings Tab, and Status Bar provide UI. Build order is strict: VaultAdapter first, then Plugin Core, then Tool Registry, then Session Manager, then UI, then Integrations. This enables isolated testing at each layer.

**Major components:**
1. **Plugin Core** -- Lifecycle management (onload/onunload), coordinates all subsystems, registers events/commands
2. **Session Manager** -- Maintains pi session, loads/saves cognitive memory from vault notes, tracks token budget
3. **Tool Registry** -- Central re-registration of pi tools to Obsidian-native equivalents; the critical bridge
4. **Vault Adapter** -- Wraps all vault operations; single point for path validation and error handling
5. **Conversation Panel** -- Sidebar chat UI with streaming token rendering
6. **Sub-Agent Supervisor** -- Spawns/terminates isolated agent contexts for heavy tasks

### Critical Pitfalls

1. **Vault API / Filesystem Duality** -- Agent uses Vault API but users edit via filesystem (Git sync, external editors). Changes bypass plugin event listeners, causing stale caches. Mitigation: debounced file-system poll fallback, store lastModified timestamps per note, re-read content when agent accesses it.

2. **Token Budget Overflow at Startup** -- Loading all note content at startup exceeds LLM context and burns tokens. Mitigation: metadataCache first (O(n) fast), content on-demand, token budget calculator, compressed session summary as startup context.

3. **pi SDK Tool Re-registration Contamination** -- Default pi tools (bash, read, write) operate on filesystem, not vault. Mitigation: Replace ALL pi default tools with Obsidian-native equivalents before first agent invocation; run smoke test to validate.

4. **Write Validation Blocking Agent Flow** -- Agent creates malformed notes (missing frontmatter, no wikilinks). Mitigation: async validation queue, post-processing step after agent proposes write, validation rules per zone.

5. **Mobile Feature Parity Illusion** -- Plugin crashes or silently fails on mobile (no child_process, restricted workspace). Mitigation: Feature flag system at init, platform detection, silent degradation with user notice.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: MVP Shell
**Rationale:** All subsequent components depend on a working plugin scaffold, VaultAdapter, and Tool Registry. This phase addresses 4 of the 7 critical pitfalls before any agent interaction begins.

**Delivers:** Obsidian plugin project scaffold, VaultAdapter, Tool Registry with Obsidian-native tools (read/write/edit/search), Session Manager skeleton, platform detection (desktop/mobile), esbuild configuration, manifest.json.

**Implements:** Vault Adapter Pattern, Tool Registry with Re-registration Pattern, Graceful Mobile Degradation Pattern.

**Avoids:** pi SDK tool contamination (Pitfall 3), token overflow from premature loading (Pitfall 2 root cause), mobile crashes (Pitfall 5), embedding API bloat (Pitfall 6).

### Phase 2: Core Agent Loop
**Rationale:** With tool registry and vault adapter working, we can now wire up the pi agent session, session context injection, knowledge routing, and slash commands. This phase also addresses write validation and external change detection.

**Delivers:** pi SDK session wired to tool registry, startup context injection (metadataCache-first, content on-demand), slash commands (/standup, /free-dump, /review), frontmatter validation pipeline, PARA zone creation/maintenance, external file change detection.

**Implements:** Session-Backed Cognitive Memory Pattern, Context Injector with Token Budget Pattern, Write Validation Queue.

**Avoids:** Token budget overflow (Pitfall 2 full), write validation failures (Pitfall 4), vault/filesystem duality (Pitfall 1 partial).

### Phase 3: Advanced Features
**Rationale:** Sub-agents and external integrations require the core agent loop to be stable. Isolated sub-agent contexts must be designed from the start; retrofitting isolation is expensive.

**Delivers:** Sub-Agent spawning with isolation, Slack/GitHub evidence capture via requestUrl(), event-driven workflows (vault event hooks), Status Bar indicator.

**Implements:** Sub-Agent Isolation Pattern.

**Avoids:** Sub-agent context leak (Pitfall 7).

### Phase Ordering Rationale

1. **VaultAdapter first** -- All subsequent components depend on vault operations. No agent, no tool, no UI can work without it.
2. **Tool Registry second** -- Agent cannot operate without tools. Tool registration must happen before first agent invocation.
3. **Plugin Core third** -- Establishes entry point and orchestrates VaultAdapter and Tool Registry.
4. **Session Manager fourth** -- Depends on tools and vault adapter; wires pi session to Obsidian context.
5. **UI Components fifth** -- Depend on plugin core and session; can be built/tested in isolation.
6. **Integrations last** -- Depend on full agent and tool infrastructure.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (MVP Shell):** Mobile graceful degradation -- specific Obsidian mobile API limitations not fully documented; may need direct testing on iPad
- **Phase 3 (Advanced Features):** Sub-agent design -- pi SDK sub-agent isolation patterns not well documented; needs SDK source review

Phases with standard patterns (skip research-phase):
- **Phase 1 (MVP Shell):** VaultAdapter, Tool Registry -- well-documented Obsidian API patterns
- **Phase 2 (Core Agent Loop):** Session context injection, slash commands -- established Obsidian plugin patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Obsidian sample plugin, official pi SDK docs; all sources verified |
| Features | MEDIUM | Feature set inferred from competitor analysis and domain knowledge; MVP scope reasonable but needs user validation |
| Architecture | MEDIUM | Architectural patterns well-supported by Obsidian plugin ecosystem; specific component boundaries are recommendations, not enforced |
| Pitfalls | MEDIUM | Pitfalls identified from community issues and documented anti-patterns; some (mobile degradation, sub-agent isolation) need validation during implementation |

**Overall confidence:** MEDIUM

### Gaps to Address

- **pi SDK tool re-registration API** -- STACK.md shows the pattern but exact API for `defineTool()` and tool parameter schema needs validation against pi SDK 0.66.1 source
- **Sub-agent isolation mechanism** -- ARCHITECTURE.md shows the pattern but pi SDK's sub-agent API and whether sessions can be truly isolated is unverified
- **Write validation schema per PARA zone** -- FEATURES.md mentions per-zone validation rules but exact schema is unimplemented; needs design during Phase 2
- **External change detection fallback** -- Obsidian does not expose filesystem watchers to plugins; debounced polling approach is inference, not documented API

## Sources

### Primary (HIGH confidence)
- [obsidianmd/obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin) -- Official plugin template, esbuild config, TypeScript setup
- [badlogic/pi-mono (pi-coding-agent docs/sdk.md)](https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/docs/sdk.md) -- SDK embedding, tool registration, session management
- [badlogic/pi-mono (pi-ai README)](https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/ai/README.md) -- Unified LLM API, streaming, model discovery
- [badlogic/pi-mono (pi-web-ui README)](https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/web-ui/README.md) -- ChatPanel embedding, UI components
- [obsidianmd/obsidian-api@1.12.3](https://github.com/obsidianmd/obsidian-api) -- API type definitions

### Secondary (MEDIUM confidence)
- [ZanderRuss/obsidian-claude](https://github.com/ZanderRuss/obsidian-claude) -- 31 commands, 27 agents, PARA, competitor feature reference
- [AdrianV/obsidian-pkm-plugin](https://github.com/AdrianV101/obsidian-pkm-plugin) -- 20 MCP tools, PARA scaffolding, 3 agents
- [cyanheads/obsidian-mcp-server](https://github.com/cyanheads/obsidian-mcp-server) -- MCP protocol integration, vault caching patterns
- [obsidianmd/obsidian-releases (community-plugins.json)](https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json) -- Plugin distribution format

### Tertiary (LOW confidence)
- [letta-ai/letta-obsidian](https://github.com/letta-ai/letta-obsidian) -- Obsidian AI agent architecture; limited documentation
- [loryoncloud/Memory-Like-A-Tree](https://github.com/loryoncloud/Memory-Like-A-Tree) -- Confidence-based knowledge lifecycle concept; implementation unimplemented

---
*Research completed: 2026-04-13*
*Ready for roadmap: yes*
