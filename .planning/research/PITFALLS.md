# Pitfalls Research

**Domain:** Obsidian Community Plugin with Embedded AI Agent (pi SDK)
**Researched:** 2026-04-13
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: Vault API / Filesystem Duality

**What goes wrong:**
The agent reads/writes via Vault API but users also edit via filesystem (Git sync, external editors). Changes made outside Obsidian do not trigger plugin lifecycle hooks, causing stale caches, duplicate notes, or overwritten content.

**Why it happens:**
Obsidian's plugin API (`app.vault`, `app.metadataCache`) caches vault state internally. File changes made via external tools (Git hooks, mobile apps, VS Code) bypass the plugin's event listeners (`create`, `modify`, `delete`). The `metadataCache` becomes stale without triggering `vm-{{}}`.

**How to avoid:**
- Use `app.vault.onModify` / `app.vault.onCreate` / `app.vault.onDelete` for internal state only
- Do NOT rely solely on cache for content freshness
- Implement a debounced file-system poll fallback for external changes (Obsidian does not expose filesystem watchers to plugins)
- Store a `lastModified` timestamp per note and re-read content when agent accesses it

**Warning signs:**
- Agent references outdated note content
- Duplicate notes created because plugin missed a filesystem create event
- "Note not found" errors after Git operations
- Frontmatter changes made externally not reflected in agent context

**Phase to address:** Phase 2 (Vault API Integration) -- must design external-change detection from the start

---

### Pitfall 2: Token Budget Overflow at Session Startup

**What goes wrong:**
Agent loads session context (North Star, active projects, recent changes, task list) on every startup. With a large vault, this exceeds the LLM context window or burns tokens unnecessarily, causing slow initialization and expensive per-session costs.

**Why it happens:**
Developers naively load all note content via `app.vault.getFiles()` and dump it into the system prompt. The Obsidian metadataCache API returns all file metadata eagerly but `getFileByPath` reads content synchronously. With 1000+ notes, startup is unusable.

**How to avoid:**
- **MetadataCache first, content on-demand**: Use `app.metadataCache.getFileCache()` for all metadata at startup (O(n) fast)
- Load note content only when agent explicitly references a note (lazy loading)
- Implement a token budget calculator: track `systemPromptTokens + contextTokens` and truncate/prune if approaching limit
- Store a compressed session summary (not full note content) as the startup context
- Use the "cognitive memory system" (R-11) as the single source of truth for what to inject

**Warning signs:**
- Session startup takes > 5 seconds on medium vaults
- API key usage spikes after each vault open
- Agent produces "context window exceeded" errors on long vaults
- Status bar shows token counts growing unbounded

**Phase to address:** Phase 1 (MVP Shell) -- token budget must be a first-class constraint in session initialization design

---

### Pitfall 3: pi SDK Tool Re-registration Contamination

**What goes wrong:**
pi SDK ships with default tools (bash, read, write, edit file) that operate on the filesystem. When embedded in Obsidian's Electron renderer, these tools either (a) do nothing because child_process is unavailable, or (b) operate on the wrong filesystem (plugin data folder vs vault), causing the agent to corrupt or miss vault files.

**Why it happens:**
pi SDK's default toolset assumes a CLI environment with filesystem access. The Obsidian plugin runs in a sandboxed renderer process without `child_process`. The tools must be replaced with Vault API equivalents before the agent loop starts, but this replacement is easy to forget or apply incorrectly.

**How to avoid:**
- On plugin init, immediately replace all pi SDK tools with Obsidian-native equivalents before the first agent invocation
- Register tools in this order: (1) `obsidian_read_note`, (2) `obsidian_write_note`, (3) `obsidian_search`, (4) `obsidian_list_notes`, then custom tools
- Validate tool registration by running a smoke test: invoke the agent with "read the note at path X" and verify it uses the Vault API tool
- Never let the agent see the raw pi SDK default tools

**Warning signs:**
- Agent attempts bash commands in conversation panel
- File operations land in `.obsidian/plugins/obsidian-forge/` instead of vault root
- "Permission denied" errors in agent responses
- Agent asks user to "create a file at path X" instead of doing it

**Phase to address:** Phase 1 (MVP Shell) -- tool replacement must happen before any agent interaction

---

### Pitfall 4: Write Validation Blocking Agent Flow

**What goes wrong:**
Agent creates notes that are malformed (missing frontmatter, no wikilinks, broken paths). Over time, the vault fills with notes the agent cannot read back, creating a corrupted knowledge base that undermines the entire value proposition.

**Why it happens:**
pi SDK's write tool returns success as soon as the file is written. There is no built-in validation step. The Obsidian Forge plugin needs to validate writes (R-07: frontmatter completeness, wikilink presence) but if validation is synchronous and blocking, it stalls the agent loop and creates a poor user experience.

**How to avoid:**
- Implement write validation as a post-processing step that runs asynchronously after the agent proposes a write
- Use a validation queue: agent writes go to a pending queue, validator processes them, and the agent is notified of failures in the next turn
- Define validation rules explicitly: `{ requiredFrontmatter: ['tags'], requiredLinks: 1 }` per zone
- If validation fails, emit a user-facing notice and roll back the note content, do not let the agent continue unaware

**Warning signs:**
- Notes appear in vault with empty or malformed frontmatter
- Agent "loses" notes it created (cannot read them back)
- Wikilinks in agent-created notes are unresolved (shown as `[[broken]]`)
- User reports agent creates "ghost notes" that are invisible in Obsidian

**Phase to address:** Phase 2 (Core Agent Loop) -- validation must be designed into the write pipeline

---

### Pitfall 5: Mobile Feature Parity Illusion

**What goes wrong:**
Plugin works perfectly on desktop but crashes, silently degrades, or corrupts data on mobile. Obsidian mobile lacks `child_process`, some Workspace APIs, and file system access. Features like Git operations, shell access, and external process spawning simply do not exist.

**Why it happens:**
Obsidian mobile is a different runtime with a reduced API surface. Plugins running in both contexts often use `app.isMobile` guards but forget that event listeners, workspace splits, and vault operations behave differently. Mobile users experience silent failures or data inconsistency across devices.

**How to avoid:**
- Implement a feature flag system at plugin init: `const PLATFORM_FEATURES = { git: !app.isMobile, shell: !app.isMobile, externalProcess: false }`
- Never attempt `child_process` on mobile -- guard all such calls with platform checks
- On mobile, do not register slash commands that require desktop-only features
- For R-15 (mobile fallback), document exactly what is removed: Git operations, PTY terminals, external CLI tools
- Test on both platforms in every development cycle, not just desktop

**Warning signs:**
- Plugin crashes on mobile when opening the command palette
- Notes created on mobile are unreadable by agent on desktop (encoding or path issues)
- Mobile status bar shows different token counts than desktop
- "Bash not available" errors appear in mobile conversations

**Phase to address:** Phase 1 (MVP Shell) -- platform detection and graceful degradation must be built into the initial scaffold

---

### Pitfall 6: Embedding API Addition Prematurely

**What goes wrong:**
Semantic search via an embedding API is added in v1 because it "seems necessary," adding complexity (external API, embedding pipeline, vector store), bundle size, and token overhead before the core agent loop is validated.

**Why it happens:**
Developers assume users want semantic/vector search. But Obsidian's `metadataCache` already provides metadata search, tags, links, and frontmatter -- all without an embedding API. The embedding pipeline is a significant complexity addition that can delay shipping a working v1.

**How to avoid:**
- Defer semantic search to v1.x or v2 (per project decision: "semantic search optional (v1)")
- Use `app.metadataCache.getFileCache()` + full-text search via Obsidian's built-in search for v1
- When embedding is needed, add it as a feature flag with a clear migration path: metadataCache -> embedding API swap is a refactor, not a rewrite
- The only exception: if user research explicitly demands semantic search, validate before adding

**Warning signs:**
- Bundle size exceeds 5MB limit due to embedding dependencies
- API key requirements expand to include an embedding model provider
- First-time setup requires configuring a second API key
- User asks "why do I need an embedding API for this?"

**Phase to address:** Phase 1 (MVP Shell) -- explicitly exclude embedding from scope until validated

---

### Pitfall 7: Sub-agent Context Leak

**What goes wrong:**
Spawned sub-agents (R-09: slack scan, PR analysis) consume tokens from the parent session context or inherit the parent's memory state unintentionally, causing context bloat and confused agent behavior.

**Why it happens:**
pi SDK sub-agents share the same session state by default. Each sub-agent adds its own context window to the parent. With multiple concurrent sub-agents, token usage compounds rapidly. Additionally, sub-agents may write to the vault and trigger the main agent's event listeners, creating feedback loops.

**How to avoid:**
- Design sub-agents as isolated contexts: each sub-agent gets its own lightweight system prompt without parent session memory
- Use a sub-agent result callback pattern: sub-agent completes, extracts a summary, and the main agent incorporates that summary -- never raw sub-agent output
- Implement a sub-agent token budget separate from the main session budget
- Add a global flag `agent.isSubAgent` to prevent recursive sub-agent spawning

**Warning signs:**
- Token usage doubles or triples when a sub-agent is active
- Sub-agent writes cause the main agent to "re-read" notes it just created
- Status bar token count is inconsistent between main and sub-agent sessions
- Sub-agents occasionally pick up the wrong vault context (e.g., slack scan results bleeding into a /standup)

**Phase to address:** Phase 3 (Sub-agents) -- sub-agents must be designed with isolation as a core requirement

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Load all note content at startup | Simple to implement | Kills performance, burns tokens on large vaults | Never |
| Skip platform detection (assume desktop) | Faster initial dev | Breaks mobile, requires rewrite | MVP only, must be removed before release |
| Use pi SDK default tools as-is | Works out of box | Agent operates on wrong filesystem | Never in production |
| Validate writes synchronously | Easy to implement | Blocks agent loop, poor UX | MVP only, async queue must be added before v1 |
| Skip `manifest.json` version compatibility | Avoids boring config | Plugin fails on older Obsidian versions, rejected from community store | Never |
| Hard-code API provider (e.g., OpenAI only) | Simpler integration | Locked into one model, users with Anthropic keys cannot use plugin | MVP only |
| Store session state in a single JSON file | Fast to implement | No versioning, corrupts on crash, unreadable by users | Never -- use Obsidian-native storage |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| pi SDK | Not replacing default bash/read/write tools | Replace ALL default tools before first agent invocation; validate with smoke test |
| Obsidian Vault API | Using `getFileByPath` for all reads at startup | Use `metadataCache.getFileCache()` for metadata, lazy-load content |
| Obsidian Workspace | Assuming `workspace.getActiveLeaf()` works on mobile | Guard with `app.isMobile`; mobile has restricted workspace |
| child_process | Calling `require('child_process')` on mobile | Check `!app.isMobile` before any child_process call; feature-flag |
| Git operations | Running Git in vault root without checking cwd | Always use absolute paths; vault root is `app.vault.adapter.getBasePath()` |
| API key storage | Storing in `localStorage` or plain JSON | Use Obsidian's `PluginSecret` API (1.5+) or advise users to use a secrets manager |
| External URLs (R-14) | Not handling CORS for `requestUrl()` | Use Obsidian's built-in `requestUrl` which handles CORS; do not use raw fetch |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Eager note content loading | Startup > 5s on 500+ notes | Lazy load via `metadataCache`, token-budget at startup | Vaults with > 200 notes |
| Unbounded metadataCache iteration | Memory grows with vault size | Limit cache iteration to relevant subtrees; use `getFileCache(path)` not `getFiles()` | Vaults with > 1000 notes |
| Sub-agent token accumulation | Token budget doubles with each sub-agent | Sub-agents get isolated, lightweight contexts; main session never inherits raw sub-agent state | When > 2 concurrent sub-agents are used |
| Real-time event listener spam | High CPU when vault has many rapid changes | Debounce event handlers; use a 100ms debounce on `onModify` | During Git sync or external editor batch edits |
| Large vault full-text search | Search blocks UI thread | Run search asynchronously; use a web worker or `requestUrl` fallback | Vaults with > 5000 notes |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing LLM API key in plain JSON or localStorage | Users with file system access can steal API keys | Use Obsidian `PluginSecret` API (1.5+); if unavailable, require user to set environment variable |
| Allowing pi SDK to make network calls to unverified endpoints | Prompt injection via malicious note content | Validate all tool inputs; do not pass raw note content as shell commands |
| Running agent output as shell commands | Agent could execute destructive commands | Never pass agent output to `child_process.exec`; validate all writes go through Vault API |
| Exposing `requestUrl()` without input validation | SSRF from vault notes | Sanitize all URLs; do not allow agent to specify arbitrary URLs |
| Not validating file paths in Vault API calls | Path traversal attacks via malicious wikilinks | Always resolve paths against vault root; use `app.vault.getAvailablePath()` for new notes |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent mobile degradation | User opens plugin on mobile, sees empty panel, does not know why | Show a clear notice: "Some features require desktop. Mobile is read-only." |
| No token usage visibility | User does not know how much context is loaded, gets surprised by API costs | Status bar must always show current session token count (R-13) |
| Agent creates notes without user confirmation | Unexpected notes appear in vault | Require user confirmation for first note creation per session; offer a "trust mode" toggle |
| No undo for agent actions | User cannot revert an agent's mass edit | Keep a 10-item operation history; expose `/undo` command |
| Conversation panel clears on vault switch | User loses context when switching vaults | Persist conversation per vault; restore on vault switch |
| Slash commands not discovered | User does not know what commands exist | On first use, show a brief onboarding overlay listing available `/commands` |

---

## "Looks Done But Isn't" Checklist

- [ ] **Tool Registration:** Default pi SDK tools are replaced -- verify agent cannot run `bash` or direct filesystem operations
- [ ] **Token Budget:** Session startup context is measured in tokens -- verify with a 500-note vault that startup is < 3 seconds
- [ ] **Mobile Guard:** All `child_process` and shell operations are gated with `!app.isMobile` -- verify plugin loads on iPad without errors
- [ ] **Write Validation:** Agent-created notes have valid frontmatter and at least one wikilink -- verify by running agent for 10 note creations
- [ ] **Platform Consistency:** Notes created on desktop are readable on mobile -- verify with a cross-device test
- [ ] **Sub-agent Isolation:** Sub-agents do not inherit parent session context -- verify token count does not double when sub-agent is active
- [ ] **API Key Storage:** LLM API key is not stored in plain text -- verify `localStorage` and plugin data directory do not contain the raw key

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Token budget overflow at startup | MEDIUM | Reduce startup context to metadataCache-only; purge session history; add lazy loading for note content |
| Mobile crash | LOW | Disable mobile features behind `app.isMobile` guard; push hotfix; no vault migration needed |
| Corrupted vault state from agent writes | HIGH | Implement operation log; replay valid writes; worst case: restore from Git backup |
| Sub-agent context leak | MEDIUM | Add `agent.isSubAgent` flag; refactor sub-agent to use message-passing instead of shared state |
| Wrong tool registration | MEDIUM | Add smoke test to plugin init; if wrong tools detected, re-register and warn user |
| API key exposure | CRITICAL | Rotate key immediately; do not store in plugin data; use PluginSecret API going forward |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Vault API / Filesystem Duality | Phase 2 | External file changes detected within 5s; notes created via Git appear in agent context |
| Token Budget Overflow | Phase 1 | Startup < 3s on 500-note vault; status bar shows token count from init |
| pi SDK Tool Contamination | Phase 1 | Agent smoke test: "read note X" uses Vault API not bash; no bash commands ever appear |
| Write Validation Blocking | Phase 2 | 10 agent note creations: all have valid frontmatter and wikilinks; no silent failures |
| Mobile Feature Parity | Phase 1 | Plugin loads on mobile without errors; desktop-only features show clear notices |
| Embedding API Premature | Phase 1 | Bundle < 5MB; no embedding API key required at setup |
| Sub-agent Context Leak | Phase 3 | Token count isolation verified; sub-agent result is summary only, not raw context |

---

## Sources

- Obsidian API Changelog (v1.0 - v1.7.2) -- deprecations and breaking changes
- obsidianmd/obsidian-sample-plugin GitHub issues -- plugin template bugs and compatibility
- letta-ai/letta-obsidian (66 stars) -- Obsidian AI agent architecture, known limitations
- cyanheads/obsidian-mcp-server -- MCP tool registration patterns, vault caching
- edonyzpc/personal-assistant -- Obsidian AI integration limitations
- klemensgc/modular-context-obsidian-plugin -- Desktop-only PTY terminal patterns (macOS only)
- Obsidian Sample Plugin versions.json -- minAppVersion compatibility patterns
- Obsidian API type definitions (obsidian.d.ts) -- deprecated API warnings

---

*Pitfalls research for: Obsidian Community Plugin with Embedded AI Agent (pi SDK)*
*Researched: 2026-04-13*
