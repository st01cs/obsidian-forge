# Phase 2: Agent Loop - Research

**Researched:** 2026-04-14
**Domain:** pi SDK integration for Obsidian plugin agent runtime
**Confidence:** MEDIUM-HIGH

## Summary

Phase 2 replaces the pi-stub with real `@mariozechner/pi-coding-agent@0.67.1` and `@mariozechner/pi-ai@0.67.1`, integrating them into the Obsidian plugin lifecycle. The agent session runs in the Electron renderer process, receives Obsidian-native tools via `customTools`, loads FORGE.md + NORTHSTAR.md at startup via `DefaultResourceLoader.systemPromptOverride`, and persists cognitive memory through vault notes (not pi's built-in session storage). Classification and routing happen inline within agent reasoning, guided by FORGE.md prompts. Commands like `/standup` are implemented as registered slash commands via the Extension API. Validation is non-blocking async, triggered post-agent-response.

**Primary recommendation:** Use `createAgentSession()` with `customTools` pointing to the existing `ToolRegistry` tools, inject startup context via `DefaultResourceLoader.systemPromptOverride`, and store cognitive memory as markdown in `forge/cognitive/sessions/`.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- D-01: Session startup context from NORTHSTAR.md + folder-based project detection (work/ + project:true frontmatter)
- D-02: Cognitive memory as session journal (forge/cognitive/sessions/YYYY-MM-DD.md per day)
- D-03: Fresh start with memory context (agent reads cognitive notes at startup, no full conversation history restore)
- D-04: LLM-driven classification with FORGE.md prompt guidance
- D-05: Agent decides autonomously, writes directly to zone (no user confirmation for routing)
- D-06: Minimal frontmatter (date, description ~150 chars, tags), validation async non-blocking
- D-07: Agent handles vault_rename wikilink updates (not automatic in VaultAdapter.renameNote)
- D-08: /standup command context-loaded morning standup
- D-09: /free-dump capture -> classify -> route in one step
- D-10: /review command session review validating notes and indexes
- D-11: Custom commands via forge/commands/*.md (deferred - format TBD)

### Claude's Discretion

- Custom command file format (CMND-10): Frontmatter-based or free-form markdown? See D-11 deferred
- Write validation details (VAULT-03): Triggers, error surfacing mechanism
- vault_rename wikilink update implementation (VAULT-04): Agent-managed approach

### Deferred Ideas (OUT OF SCOPE)

- Custom command format investigation deferred to researcher/planner
- Write validation details deferred to researcher/planner
- vault_rename wikilink update mechanism deferred to researcher/planner

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SESS-01 | Session startup: North Star, active projects (metadataCache), Git commits (Desktop), task list | DefaultResourceLoader.systemPromptOverride injects FORGE.md + pre-built context string from metadataCache queries |
| SESS-02 | Session state persists via forge/cognitive/ notes | Session notes are markdown files in vault, read/written via VaultAdapter at startup and on close |
| SESS-03 | Session close: summary + checklist | Extension session_shutdown handler writes session summary to forge/cognitive/sessions/YYYY-MM-DD.md |
| ROUTE-01 | Agent classifies by type (decision, event,成果, 1:1, architecture, person, project update) | LLM-driven, FORGE.md contains classification criteria as prompt guidance; classification happens inline with reasoning |
| ROUTE-02 | Classified content routes to correct zones with frontmatter | Agent calls vault_write tool directly after classification; zone mapping encoded in FORGE.md |
| ROUTE-03 | PARA zones maintained | Zone structure already created in Phase 1; agent creates/updates notes in correct zones |
| ROUTE-04 | Required frontmatter (date, description, tags) + wikilinks over 300 chars | Non-blocking async validation after agent response via vault_edit tool call |
| VAULT-03 | Write validation async non-blocking | Post-agent-response hook in ChatPanel; validation result shown via toast/UI notification |
| VAULT-04 | vault_rename updates wikilinks | Agent uses get_backlinks + vault_edit tools after rename completes |
| CMND-01 | /standup command | pi.registerCommand() Extension API with handler that builds context and calls session.prompt() |
| CMND-02 | /free-dump command | Command handler that routes captured text through classify->route flow |
| CMND-03 | /review command | Command handler that runs get_orphans, metadata_query scans, updates indexes |
| CMND-10 | Custom commands via forge/commands/ | Deferred - see D-11 |
| OPS-03 | Commands and sub-agents documented in FORGE.md | Agent updates FORGE.md when new commands/agents are registered |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @mariozechner/pi-coding-agent | **0.67.1** | Agent runtime with tool system, session management, Extension API | Core agent runtime; provides createAgentSession, defineTool, ExtensionAPI |
| @mariozechner/pi-ai | **0.67.1** | Unified LLM API, model registry, streaming | Auto model discovery, streaming events, cross-provider handoffs |
| @sinclair/typebox | latest | JSON schema types | Required for tool parameter definitions in defineTool |

**Version note:** npm shows 0.67.1 is current for both pi packages. STACK.md and CLAUDE.md reference 0.66.1 — these should be updated before Phase 2 implementation begins. [VERIFIED: npm registry 2026-04-14]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @mariozechner/pi-agent-core | 0.67.1 | Transport abstraction | Only if custom session transport needed beyond pi-coding-agent defaults |

### Installation

```bash
npm install @mariozechner/pi-coding-agent@0.67.1 @mariozechner/pi-ai@0.67.1 @sinclair/typebox
```

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions)

```
src/
├── main.ts                    # Plugin entry, onload/onunload (existing)
├── VaultAdapter.ts            # Vault operations (existing)
├── ToolRegistry.ts            # Tool definitions (existing)
├── ChatPanel.ts               # Chat UI (existing)
├── pi-stub.ts                 # REPLACED in Phase 2 with real pi SDK
│
├── session/
│   ├── session-manager.ts     # NEW: Session lifecycle, cognitive memory loading
│   ├── cognitive-memory.ts     # NEW: Persistent context across sessions
│   └── context-injector.ts    # NEW: Startup context builder (metadataCache-first)
│
├── agent/
│   ├── agent-bridge.ts        # NEW: Interfaces pi SDK with Obsidian components
│   └── session-startup.ts     # NEW: Session initialization with tools + context
│
├── commands/
│   ├── standup.ts              # NEW: /standup command implementation
│   ├── free-dump.ts           # NEW: /free-dump command implementation
│   ├── review.ts              # NEW: /review command implementation
│   └── custom-commands.ts      # NEW: CMND-10 custom command loader
│
└── validation/
    └── write-validator.ts     # NEW: VAULT-03 async write validation
```

### Pattern 1: Agent Session Creation

**What:** Replace pi-stub with real `createAgentSession()` in main.ts onload flow
**When:** Phase 2 initialization - runs after ToolRegistry is set up
**Example:**

```typescript
// Source: pi-coding-agent docs/sdk.md + adaptations for Obsidian
import { createAgentSession, DefaultResourceLoader, SessionManager } from "@mariozechner/pi-coding-agent";
import { AuthStorage, ModelRegistry, getModel } from "@mariozechner/pi-ai";

async function createForgeSession(
  vaultAdapter: VaultAdapter,
  toolRegistry: ToolRegistry,
  forgeMdContent: string,
  northStarContent: string,
  settings: ObsidianForgeSettings
) {
  // 1. Auth and model setup
  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);

  // 2. Build startup context from metadataCache (lightweight)
  const startupContext = buildStartupContext(vaultAdapter); // SESS-01

  // 3. Configure resource loader with system prompt override
  const loader = new DefaultResourceLoader({
    cwd: getVaultRoot(), // Obsidian vault path
    agentDir: "~/.pi/agent",
    systemPromptOverride: () => buildSystemPrompt(forgeMdContent, northStarContent, startupContext),
  });
  await loader.reload();

  // 4. Create session with Obsidian tools via customTools
  const { session } = await createAgentSession({
    cwd: getVaultRoot(),
    agentDir: "~/.pi/agent",
    model: getModel(settings.provider as any, settings.model),
    authStorage,
    modelRegistry,
    customTools: toolRegistry.getTools(), // Obsidian-native tools
    resourceLoader: loader,
    sessionManager: SessionManager.inMemory(), // NOT persisted - we use vault-backed cognitive memory
    settingsManager: SettingsManager.inMemory(),
  });

  return session;
}
```

**Key insight:** `SessionManager.inMemory()` is used because cognitive memory is stored as vault notes (D-02, D-03). The pi session itself does not persist across restarts - a fresh session is created each time, and it reads cognitive notes at startup for continuity.

### Pattern 2: System Prompt Injection via DefaultResourceLoader

**What:** Inject FORGE.md + NORTHSTAR.md + startup context as system prompt
**When:** Session creation, always
**Example:**

```typescript
// Source: pi-coding-agent docs/sdk.md - DefaultResourceLoader section
function buildSystemPrompt(
  forgeMd: string,
  northStarMd: string,
  startupContext: string
): string {
  return `You are Obsidian Forge, an AI agent embedded in Obsidian.

## Your Operation Manual (FORGE.md)
${forgeMd}

## North Star (user-authored guiding document)
${northStarMd}

## Current Session Context
${startupContext}

## Key Rules
- All vault operations MUST use tools (vault_read, vault_write, vault_edit)
- NEVER use default bash/read/write/edit tools
- Route knowledge to correct PARA zones
- Required frontmatter on all notes: date, description (~150 chars), tags
- Notes over 300 chars MUST include at least one wikilink
- After vault_rename, update wikilinks in all referencing files using get_backlinks + vault_edit
`;
}
```

### Pattern 3: Session Startup Context (metadataCache-first)

**What:** Build startup context from metadataCache (lightweight) before loading full content
**When:** Every session start
**Example:**

```typescript
// Source: Architecture.md Pattern 6 (Context Injector with Token Budget)
async function buildStartupContext(vaultAdapter: VaultAdapter): Promise<string> {
  const allFiles = vaultAdapter.listFiles('md');
  const forgeDir = 'forge/';
  const workDir = 'work/';

  // 1. Find active projects from metadataCache (fast, no content loading)
  const activeProjects = allFiles.filter(f => {
    const cache = app.metadataCache.getFileCache(f);
    return cache?.frontmatter?.project === true || f.path.startsWith(workDir);
  });

  // 2. Extract tasks from work/ zone (date-referenced checkboxes)
  const tasks = await extractTasksFromWorkZone(vaultAdapter, workDir);

  // 3. Get recent session note for continuity
  const today = new Date().toISOString().split('T')[0];
  const yesterday = getYesterdayDate();
  const yesterdaySession = tryReadNote(`forge/cognitive/sessions/${yesterday}.md`);

  // 4. Git commits on Desktop (IS_MOBILE checked before registering git_log tool)
  const gitCommits = !IS_MOBILE ? await getGitLog() : '(Git unavailable on mobile)';

  return formatContext({
    activeProjects: activeProjects.map(f => f.path),
    tasks,
    yesterdaySession,
    gitCommits,
  });
}
```

### Pattern 4: Cognitive Memory (Session Journal)

**What:** One markdown note per day in forge/cognitive/sessions/, append-only within the day
**When:** Session close (write), Session start (read)
**Example:**

```typescript
// Source: 02-CONTEXT.md D-02 + adaptations
interface SessionNote {
  date: string;        // YYYY-MM-DD
  type: 'session';
  summary: string;
  decisions: string[];
  events: string[];
  wins: string[];
  projects_touched: string[];
}

async function appendSessionEntry(
  vaultAdapter: VaultAdapter,
  entry: Omit<SessionNote, 'date' | 'type'>
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const path = `forge/cognitive/sessions/${today}.md`;

  const newEntry = formatSessionEntry(entry);
  if (vaultAdapter.exists(path)) {
    await vaultAdapter.editNote(path, content => content + '\n' + newEntry);
  } else {
    const frontmatter = `---\ndate: ${today}\ntype: session\n---\n\n${newEntry}`;
    await vaultAdapter.writeNote(path, frontmatter);
  }
}

async function loadRecentSessions(
  vaultAdapter: VaultAdapter,
  days = 7
): Promise<SessionNote[]> {
  const sessions: SessionNote[] = [];
  for (let i = 1; i <= days; i++) {
    const date = getDateDaysAgo(i);
    const path = `forge/cognitive/sessions/${date}.md`;
    if (vaultAdapter.exists(path)) {
      const content = await vaultAdapter.readNote(path);
      sessions.push(parseSessionNote(content));
    }
  }
  return sessions;
}
```

### Pattern 5: Extension-Based Slash Commands

**What:** Register /standup, /free-dump, /review via pi Extension API
**When:** Phase 2 command implementations
**Example:**

```typescript
// Source: pi-coding-agent docs/extensions.md - Custom Commands section
// In an Extension or during session setup:
session.subscribe((event) => {
  // Extension commands via pi Extension API
  pi.registerCommand("standup", {
    description: "Morning standup - load context, review yesterday, show tasks",
    handler: async (args, ctx) => {
      // Build standup context
      const northStar = await vaultAdapter.readNote('forge/NORTHSTAR.md');
      const yesterday = await loadSessionNote(getYesterdayDate());
      const tasks = await extractWorkTasks();
      const projects = await detectActiveProjects();

      // Inject as user message to agent
      ctx.ui.notify("Preparing standup...", "info");
      await session.prompt(buildStandupPrompt(northStar, yesterday, tasks, projects));
    },
  });

  pi.registerCommand("free-dump", {
    description: "Capture non-structured text, auto-classify and route",
    handler: async (args, ctx) => {
      ctx.ui.notify("Ready for free dump...", "info");
      // Agent handles classification and routing inline
    },
  });

  pi.registerCommand("review", {
    description: "Session review - validate notes, update indexes, discover wins",
    handler: async (args, ctx) => {
      ctx.ui.notify("Running review...", "info");
      await session.prompt("Run /review workflow: check orphans, frontmatter completeness, missed wins");
    },
  });
});
```

### Pattern 6: Non-Blocking Write Validation

**What:** Validation runs after agent response completes, doesn't block streaming
**When:** After every vault_write tool call in the agent loop
**Example:**

```typescript
// Source: 02-CONTEXT.md D-06 (VAULT-03)
// In ChatPanel stream handler or as a post-agent hook:
async function onToolExecutionEnd(toolResult: ToolResult, ctx: ExtensionContext) {
  if (toolResult.toolName === 'vault_write') {
    const { path } = toolResult.details;

    // Non-blocking validation - fire and forget
    setTimeout(async () => {
      const validation = await validateNoteFrontmatter(vaultAdapter, path);
      if (!validation.valid) {
        // Show toast notification
        ctx.ui.notify(`Note ${path} needs attention: ${validation.issues.join(', ')}`, "warning");
      }
    }, 0);
  }
}

async function validateNoteFrontmatter(
  vaultAdapter: VaultAdapter,
  path: string
): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];
  const metadata = vaultAdapter.getMetadata(path);
  const content = await vaultAdapter.readNote(path);

  // Required fields
  if (!metadata?.frontmatter?.date) issues.push('Missing: date');
  if (!metadata?.frontmatter?.description) issues.push('Missing: description');
  if (!metadata?.frontmatter?.tags) issues.push('Missing: tags');

  // Wikilink check for long notes
  if (content.length > 300 && !content.includes('[[')) {
    issues.push('Notes over 300 chars should include wikilinks');
  }

  return { valid: issues.length === 0, issues };
}
```

### Pattern 7: vault_rename Wikilink Update (Agent-Managed)

**What:** After vault_rename tool completes, agent scans backlinks and updates wikilinks
**When:** When agent calls vault_rename tool
**Example:**

```typescript
// Source: 02-CONTEXT.md D-07 (VAULT-04)
// This is AGENT-MANAGED, not automatic in VaultAdapter.renameNote()
// The agent's reasoning loop handles this after rename completes:

async function handleVaultRename(session: AgentSession, oldPath: string, newPath: string) {
  // 1. Agent calls vault_rename tool (already registered in ToolRegistry)
  // 2. After rename completes, agent uses reasoning to call:

  // Step A: Get all files linking to old path
  const backlinks = await session.tools.get_backlinks({ path: oldPath });

  // Step B: For each referencing file, update wikilinks
  for (const refFile of backlinks) {
    await session.tools.vault_edit({
      path: refFile,
      fn: `(content) => content.replace(/\\[\\[${escapeRegex(oldPath)}\\]\\]/g, '[[${newPath}]]')`
    });
  }

  // Step C: Session summary notes the rename for continuity
}
```

### Anti-Patterns to Avoid

- **Blocking onload with agent init:** Use deferred initialization or `setTimeout(0)` after onload returns. Obsidian's plugin loader waits for onload to complete.
- **Loading full vault content at startup:** Use metadataCache first for fast project detection, load content on-demand.
- **Restoring full pi session state:** D-03 says fresh start - don't try to restore conversation history. Read cognitive notes instead.
- **Automatic wikilink updates in VaultAdapter:** D-07 says agent manages wikilink updates - don't add automatic behavior to renameNote().

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent loop / session management | Custom turn loop, message handling | createAgentSession() from pi-coding-agent | Complex orchestration, tool calling, streaming already handled |
| Model abstraction | Direct SDK calls per provider | pi-ai getModel() + ModelRegistry | Cross-provider handoffs, streaming unified |
| Slash command registration | Custom command parsing in ChatPanel | pi.registerCommand() Extension API | Handles argument parsing, completions, lifecycle |
| System prompt management | String concatenation on every prompt | DefaultResourceLoader with systemPromptOverride | Caching, hot reload via /reload |

## Common Pitfalls

### Pitfall 1: ESM/CJS Compatibility Gap

**What goes wrong:** pi packages are ESM-only but Obsidian plugins load as CommonJS. Direct import causes `require()` failures at runtime.
**Why it happens:** Phase 1 created a stub (`pi-stub.ts`) to compile against CJS types, but the real pi packages use ESM exports.
**How to avoid:** Phase 2 must use dynamic `import()` or a CJS-compatible bundler configuration. esbuild with `format: 'cjs'` cannot consume ESM-only packages directly. Consider:
  - Use `esm.sh` or `esm-shims` for CJS interop
  - Bundle with `format: 'esm'` and use dynamic import in the plugin
  - Use a wrapper module that uses dynamic import and re-exports
**Warning signs:** `Cannot find module '@mariozechner/pi-coding-agent'`, `require() of ES Module fails`

### Pitfall 2: SessionManager vs Vault-Backed Memory

**What goes wrong:** Confusion about what persists where. pi's SessionManager stores sessions in `~/.pi/agent/sessions/` but D-02/D-03 say cognitive memory is vault-backed.
**Why it happens:** Two different persistence mechanisms serve two different purposes:
  - pi SessionManager: Full conversation history (we DON'T restore this per D-03)
  - forge/cognitive/sessions/: Structured memory notes (we DO read these per D-03)
**How to avoid:** Use `SessionManager.inMemory()` for the pi session (fresh each start). Cognitive memory is read from vault notes at startup and written at session close.

### Pitfall 3: Blocking Agent Response with Validation

**What goes wrong:** Write validation runs synchronously, blocking the agent's streaming response.
**Why it happens:** Validation called inline in tool execution path.
**How to avoid:** Fire validation in `setTimeout(0)` or as a post-agent hook. Never await validation before completing the agent response.

### Pitfall 4: Token Budget Overflow at Startup

**What goes wrong:** FORGE.md + NORTHSTAR.md + all cognitive notes + metadata dumps exceeds context window on large vaults.
**Why it happens:** Not respecting the token budget constraint from PROJECT.md.
**How to avoid:** metadataCache-first loading (no content), content-on-demand. Cognitive notes: only load last 7 days, summarize older ones. Limit NORTHSTAR.md size.

## Code Examples

### Obsidian Tool Definition (already in ToolRegistry, Phase 1)

```typescript
// Source: src/ToolRegistry.ts (existing, working pattern)
// This is the pattern Phase 2 uses - no changes needed
const vaultReadTool = defineTool({
  name: 'vault_read',
  description: 'Read the content of an Obsidian note',
  parameters: Type.Object({
    path: Type.String({ description: 'Path of the note' })
  }),
  async execute(_toolCallId, { path }) {
    const content = await vaultAdapter.readNote(path);
    return { content: [{ type: 'text', text: content }] };
  }
});
```

### Session Event Subscription (streaming to ChatPanel)

```typescript
// Source: pi-coding-agent docs/sdk.md - Message Handling section
// Adapted for ChatPanel streaming:
session.subscribe((event) => {
  switch (event.type) {
    case 'message_update':
      if (event.assistantMessageEvent.type === 'text_delta') {
        chatPanel.appendToken(event.assistantMessageEvent.delta);
      }
      break;
    case 'tool_execution_start':
      chatPanel.showToolExecuting(event.toolName);
      break;
    case 'tool_execution_end':
      chatPanel.hideToolExecuting();
      break;
    case 'agent_end':
      // Session close: write cognitive memory
      await appendSessionEntry(vaultAdapter, buildSessionSummary(event.messages));
      break;
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pi-stub.ts (type-only) | Real pi-coding-agent + pi-ai | Phase 2 | Full agent loop, tool execution, streaming |
| SessionManager.create() (file-backed) | SessionManager.inMemory() + vault cognitive notes | Phase 2 | Fresh start per D-03, cognitive memory via vault |
| No command implementations | Extension API slash commands | Phase 2 | /standup, /free-dump, /review functional |
| No write validation | Post-response async validation | Phase 2 | ROUTE-04 frontmatter enforcement |

**Deprecated/outdated:**
- `pi-stub.ts`: Replaced entirely by real pi SDK integration

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | pi-coding-agent 0.67.1 is API-compatible with 0.66.1 patterns documented | Standard Stack | Minor - API may have changed; verify before implementation |
| A2 | DefaultResourceLoader is available in pi-coding-agent package | Pattern 2 | Medium - must verify package exports; if not, use alternative system prompt injection |
| A3 | SessionManager.inMemory() creates fully ephemeral sessions | Pattern 4 | Low - confirmed by docs |
| A4 | ESM import can be made to work in CJS Obsidian plugin context | Pitfall 1 | High - this is the critical blocking issue for Phase 2; must resolve before implementation |

## Open Questions

1. **ESM/CJS Interoperability**
   - What we know: pi packages are ESM-only; Obsidian plugins load as CJS; our esbuild config produces CJS
   - What's unclear: The exact mechanism to make ESM packages work in CJS context
   - Recommendation: Investigate `esm.sh` shims, dynamic import wrappers, or esbuild ESM output + dynamic import pattern before Phase 2 implementation begins. This is the critical path item.

2. **Custom Command File Format (CMND-10)**
   - What we know: Files stored in forge/commands/; need name, description, implementation
   - What's unclear: Frontmatter-based format vs free-form markdown; how the agent loads/discovers commands
   - Recommendation: Use frontmatter-based format aligned with pi Extension API patterns. Command implementations are loaded at plugin startup or session start.

3. **pi Package Version Mismatch**
   - What we know: npm shows 0.67.1; CLAUDE.md and STACK.md say 0.66.1
   - What's unclear: Whether 0.67.1 has breaking API changes
   - Recommendation: Update CLAUDE.md and STACK.md to 0.67.1; verify API compatibility before Phase 2

4. **Write Validation Surfacing**
   - What we know: Non-blocking async; runs post-agent-response
   - What's unclear: Toast notification vs inline marker vs other UI mechanism
   - Recommendation: Use Obsidian's `new Notice()` for non-blocking toast notifications

5. **Session Close Flow**
   - What we know: Session summary + checklist on close (SESS-03)
   - What's unclear: What triggers session close - plugin unload? User idle? Explicit command?
   - Recommendation: Trigger on `plugin.onunload()` AND as a command (`/close` or automatic on idle timeout)

## Environment Availability

> Step 2.6: SKIPPED (no external dependencies identified beyond npm packages already in project)

**Phase 2 dependencies are all npm packages already declared or to be added:**
- @mariozechner/pi-coding-agent@0.67.1 (new)
- @mariozechner/pi-ai@0.67.1 (new)
- @sinclair/typebox (already in project per STACK.md)

No external tools, services, or CLIs required beyond the Obsidian plugin runtime.

## Security Domain

> Required when security_enforcement is enabled (absent = enabled). Omit only if explicitly false in config.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A - user provides own API key |
| V3 Session Management | no | N/A - personal vault, no multi-user |
| V4 Access Control | no | N/A - single user plugin |
| V5 Input Validation | yes | Tool parameter validation via Typebox schemas; vault paths validated via VaultAdapter |
| V6 Cryptography | no | N/A - no crypto operations |

### Known Threat Patterns for pi SDK + Obsidian Plugin

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tool injection via malicious note content | Tampering | Tools execute only on Vault API calls; no direct shell access |
| Path traversal via vault_rename/vault_edit | Information Disclosure | VaultAdapter.normalizePath() + path boundary checks |
| Prompt injection via FORGE.md | Information Disclosure | FORGE.md is user-controlled; agent treats as guidance, not direct execution |
| Malicious custom command files | Tampering | Custom commands loaded from forge/commands/ - user controls vault |

## Sources

### Primary (HIGH confidence)
- badlogic/pi-mono (pi-coding-agent docs/sdk.md) — createAgentSession, SessionManager, DefaultResourceLoader, tool registration, message handling — fetched 2026-04-14
- badlogic/pi-mono (extensions.md) — Extension API, pi.registerCommand, pi.registerTool, events system — fetched 2026-04-14
- badlogic/pi-mono (pi-ai README) — getModel, stream, ModelRegistry, AuthStorage — fetched 2026-04-14

### Secondary (MEDIUM confidence)
- npm registry — pi-coding-agent@0.67.1, pi-ai@0.67.1 version verification — 2026-04-14

### Tertiary (LOW confidence)
- STACK.md (Phase 1) — pi package versions 0.66.1 — needs update to 0.67.1

## Metadata

**Confidence breakdown:**
- Standard Stack: MEDIUM — pi SDK API patterns verified; npm version shows 0.67.1 but docs reference 0.66.1
- Architecture: MEDIUM-HIGH — patterns well-documented; ESM/CJS interoperability is the key risk
- Pitfalls: MEDIUM — ESM/CJS is the critical unknown; other pitfalls well-understood

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (30 days for stable domain; pi SDK versioning may change)
