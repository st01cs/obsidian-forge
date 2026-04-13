# Phase 1: Foundation - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Plugin installed, enabled, and basic chat interaction functional. Deliverables:
- Obsidian community plugin scaffold (manifest.json, main.ts, build config)
- VaultAdapter for reading/writing notes via Obsidian API
- ToolRegistry replacing pi SDK defaults with Obsidian-native tools
- Sidebar conversation panel (ItemView)
- Plugin settings tab (PluginSettingTab)
- Platform detection (mobile/desktop)
- Vault structure creation on first enable

</domain>

<decisions>
## Implementation Decisions

### D-01: Plugin Code Organization
- **Decision:** Modular folder structure (src/ subdirectories)
- **Rationale:** Phase 1 has 16 requirements — single file would become unmanageable
- **Structure:** `src/main.ts`, `src/VaultAdapter.ts`, `src/ToolRegistry.ts`, `src/ChatPanel.ts`, `src/SettingsTab.ts`, `src/mobile.ts`

### D-02: Chat Panel Implementation
- **Decision:** Custom ItemView implementation (NOT pi-web-ui)
- **Rationale:** pi-web-ui uses Tailwind CSS v4 which conflicts with Obsidian's CSS system; PRD specifies "custom chat UI" requirement; streaming and tool call visualization are core UX differentiators
- **ChatPanel.ts** renders: message list (Markdown, code highlight), input area, command shortcuts, streaming response display, tool call progress

### D-03: pi SDK Package Set
- **Decision:** `pi-coding-agent` + `pi-ai` (NO pi-web-ui for UI)
- **Rationale:** pi-web-ui is UI-only; we build our own panel; pi-ai handles model abstraction; pi-coding-agent provides agent loop
- **Packages:** `@mariozechner/pi-coding-agent@^0.66.1`, `@mariozechner/pi-ai@^0.66.1`
- **Bundling:** esbuild with `platform: "node"`, external: `electron`

### D-04: esbuild Configuration
- **Decision:** Standard Obsidian plugin esbuild config
- **Format:** `cjs` (CommonJS for Obsidian compatibility)
- **External:** `electron` (already available in Obsidian runtime)
- **Target:** `es2020` (Obsidian 1.12+ ships with Node 16)
- **Bundle:** Single `main.js` output, tree-shake unused code

### D-05: TypeScript Configuration
- **Decision:** Strict mode enabled
- **Target:** `ES2020`
- **Module:** `CommonJS`
- **Strict:** `true` (no implicit any, strict null checks)
- **Obsidian types:** `@types/obsidian` from npm

### D-06: Settings Storage
- **Decision:** Obsidian's `plugin.saveData()` / `plugin.loadData()` for settings object
- **API Key storage:** Stored in settings object (NOT separate secret storage); API key input field uses `<input type="password">`
- **Encryption:** NOT encrypted at rest (Obsidian's data.json is already in vault); user controls vault access
- **Providers:** Settings tab stores: `{ provider: "openai"|"anthropic"|"google", apiKey: string, model: string }`

### D-07: Platform Detection
- **Decision:** `Platform.isMobile` from Obsidian API at module load time
- **Mobile detection drives:** Whether `child_process` tools are registered; whether Git operations are available
- **Bash/Git tools:** NOT registered on mobile (removed from ToolRegistry on mobile)
- **Silent degradation:** No error shown; tools simply absent from agent's tool list

### D-08: Vault Structure Creation
- **Decision:** On `onload()`, check if `forge/` directory exists; if not, create all zones and FORGE.md
- **Zones created:**
  - `forge/` (plugin zone — operation manual, commands, agents, sessions backup)
  - `work/` (work notes, projects)
  - `org/` (people, teams)
  - `performance/` (brag docs, reviews)
  - `cognitive/` (memory, decisions, patterns)
  - `reference/` (architecture docs, tech refs)
  - `draft/` (temporary analysis)
- **FORGE.md:** Default operation manual with zone descriptions, frontmatter schema, command list

### D-09: Slash Command Registration
- **Decision:** Commands defined as strings in `src/commands.ts`, registered via `plugin.addCommand()`
- **For Phase 1:** No actual command implementations — just command palette registration and slash prefix parsing in ChatPanel
- **Command palette:** Each command appears in Ctrl/Cmd+P with description
- **Slash parsing:** ChatPanel input detects `/` prefix, filters command list

### D-10: ToolRegistry Architecture
- **Decision:** `ToolRegistry` class with `register(name, handler)` and `unregister(name)` methods
- **Default tools removed:** bash, read, write, edit (pi SDK defaults)
- **Obsidian tools registered:**
  - `vault_read` → `vault.cachedRead()` + `metadataCache.getFileCache()`
  - `vault_write` → `vault.create()` / `vault.modify()`
  - `vault_edit` → `vault.process()`
  - `vault_search` → `vault.getFiles()` + content match
  - `metadata_query` → `metadataCache.getFileCache()` frontmatter scan
  - `get_backlinks` → `metadataCache.resolvedLinks`
  - `list_files` → `vault.getFiles()`
  - `vault_rename` → `vault.rename()`
  - `http_request` → `requestUrl()`
  - `bash` → `child_process.spawn()` (Desktop-only)
  - `git_log` → `child_process.exec()` (Desktop-only)

### Claude's Discretion

- **Bundler choice:** esbuild (standard for Obsidian plugins)
- **manifest.json fields:** `id`, `name`, `version`, `minAppVersion`, `author`, `description`, `api` — standard community plugin format
- **ItemView view type:** `"obsidian-forge-chat"` registered in `plugin.registerView()`
- **Settings tab section:** Appears under "Obsidian Forge" in plugin settings

</decisions>

<canonical_refs>
## Canonical References

Downstream agents MUST read these before planning or implementing.

### Project Requirements
- `.planning/REQUIREMENTS.md` — All Phase 1 requirements (INST-01, INST-02, INST-03, CORE-01, CORE-02, CORE-03, CORE-04, VAULT-01, VAULT-02, TOOL-01, TOOL-02, TOOL-03, MOBI-01, MOBI-02, OPS-01, OPS-02)
- `.planning/ROADMAP.md` §Phase 1 — Phase goal, success criteria
- `.planning/PROJECT.md` — Core value, constraints (no CLI/filesystem duality, token budget)

### Research (Phase 1 relevant)
- `.planning/research/STACK.md` — esbuild config, pi SDK packages, TypeScript setup
- `.planning/research/ARCHITECTURE.md` — Plugin structure, VaultAdapter, ToolRegistry patterns
- `.planning/research/PITFALLS.md` — Tool re-registration order, token budget, mobile guard

### External References
- `obsidianmd/obsidian-sample-plugin` — Official plugin scaffold pattern
- `@types/obsidian` npm package — TypeScript definitions for Obsidian API
- `@mariozechner/pi-coding-agent` npm — pi SDK API

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

No existing code — greenfield project. Follow obsidian-sample-plugin structure.

### Established Patterns

- **Plugin lifecycle:** `onload()` → initialize → `onunload()` → cleanup
- **Vault operations:** Always async, always through Vault API
- **Settings persistence:** `plugin.saveData(data)` / `plugin.loadData()` JSON round-trip
- **View registration:** `plugin.registerView(type, factory)` + `plugin.addIcon()`
- **Command registration:** `plugin.addCommand({ id, name, callback })`
- **Mobile detection:** `Platform.isMobile` boolean from Obsidian API

### Integration Points

- **Entry point:** `main.ts` exports `default` class extending `Plugin`
- **Workspace:** `app.workspace.getLeaf(false)` for creating sidebar leaves
- **Metadata cache:** `app.metadataCache.getFileCache(file)` for frontmatter/links
- **Vault:** `app.vault.create()`, `app.vault.modify()`, `app.vault.process()`

</code_context>

<specifics>
## Specific Ideas

No prior phase specifics. Phase 1 is the foundation.

### PRD-Derived Specifics

- Chat panel must be draggable to any sidebar position
- Streaming response display: token-by-token rendering
- Tool call visualization: show which file being read, which search running
- API key field in settings must mask input (`type="password"`)

</specifics>

<deferred>
## Deferred Ideas

### From Discussion

None — Phase 1 gray areas fully resolved.

### Ideas for Future Phases

- Semantic search (vector embeddings) — Phase 3+ decision
- Sub-agent isolation patterns — Phase 3 decision
- External integration (Slack/GitHub API details) — Phase 3 decision
- Knowledge graph visualization — Phase 4+ decision

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-13*
