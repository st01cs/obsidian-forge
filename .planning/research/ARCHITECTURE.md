# Architecture Research

**Domain:** Obsidian Plugin with Embedded AI Agent
**Researched:** 2026-04-13
**Confidence:** MEDIUM

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Obsidian Shell                          │
│  (Electron renderer - same process as Obsidian core)         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐     │
│  │              Obsidian Forge Plugin                   │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │     │
│  │  │ Settings │  │ Conversation│ │ StatusBar      │   │     │
│  │  │ Tab      │  │ Panel      │  │ Indicator      │   │     │
│  │  └────┬─────┘  └─────┬──────┘  └───────┬────────┘   │     │
│  │       │              │                │              │     │
│  │  ┌────┴──────────────┴─────────────────┴──────────┐  │     │
│  │  │              Plugin Core                        │  │     │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │  │     │
│  │  │  │ Session     │  │ Tool        │  │ Vault   │ │  │     │
│  │  │  │ Manager     │  │ Registry    │  │ Adapter │ │  │     │
│  │  │  └──────┬──────┘  └──────┬──────┘  └────┬────┘ │  │     │
│  │  │         │                │              │      │  │     │
│  │  │  ┌──────┴────────────────┴──────────────┴────┐│  │     │
│  │  │  │              pi SDK Agent                   ││  │     │
│  │  │  │  (Embedded AI runtime with re-registered   ││  │     │
│  │  │  │   bash/read/write/edit → Obsidian-native)   ││  │     │
│  │  │  └─────────────────────────────────────────────┘│  │     │
│  │  └─────────────────────────────────────────────────┘  │     │
│  └─────────────────────────────────────────────────────┘     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ app.vault    │  │ app.workspace│  │ app.meta-    │       │
│  │ (files,ops)  │  │ (panes,views)│  │ dataCache    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Plugin Core** | Lifecycle management (`onload`/`onunload`), coordinates all subsystems | Extends `obsidian.Plugin`, registers events/commands |
| **Session Manager** | Maintains agent session across plugin restarts, loads/saves cognitive memory | Class managing `pi.Session` instance, vault-backed state |
| **Tool Registry** | Replaces pi SDK default tools with Obsidian-native implementations | Map of tool name to `obsidianToolFunction` |
| **Vault Adapter** | Wraps `app.vault`, `app.metadataCache`, `app.workspace` for agent consumption | Service class with typed methods |
| **Conversation Panel** | Sidebar UI for chat interaction, renders streaming tokens | `WorkspaceLeaf` with custom HTML view |
| **Settings Tab** | API key configuration, provider selection | `PluginSettingTab` with `ObsidianSettings` class |
| **Status Bar Indicator** | Shows model, token usage, session state | `StatusBarComponent` |
| **Sub-Agent Supervisor** | Spawns/terminates isolated agent contexts for heavy tasks | Manages multiple `pi.Session` instances |

## Recommended Project Structure

```
src/
├── main.ts                    # Plugin entry, onload/onunload, registers all components
├── plugin-core.ts             # Main plugin class, coordinates subsystems
│
├── session/
│   ├── session-manager.ts     # Session lifecycle, cognitive memory loading
│   ├── cognitive-memory.ts    # Persistent context across sessions (vault-backed)
│   └── session-state.ts       # Token budget tracking, session metadata
│
├── tools/
│   ├── tool-registry.ts       # Central tool registration, maps pi tools → obsidian
│   ├── vault-tools.ts         # Obsidian-native vault operations (read/write/create/delete)
│   ├── search-tools.ts        # Vault search, metadataCache queries
│   ├── frontmatter-tools.ts   # Frontmatter get/set/validate operations
│   └── command-tools.ts       # Slash commands (/standup, /review, etc.)
│
├── agent/
│   ├── agent-bridge.ts        # Interfaces pi SDK with Obsidian components
│   ├── sub-agent-supervisor.ts # Manages spawning/termination of sub-agents
│   └── context-injector.ts    # Injects session context without exceeding token budget
│
├── ui/
│   ├── conversation-panel.ts  # Sidebar chat view (extends WorkspaceLeaf)
│   ├── settings-tab.ts        # Plugin settings UI (extends PluginSettingTab)
│   ├── status-bar.ts          # Status bar indicator
│   └── components/
│       ├── message-renderer.ts # Renders agent/user messages
│       └── typing-indicator.ts # Streaming token animation
│
├── vault/
│   ├── vault-adapter.ts       # Wraps app.vault operations
│   ├── metadata-resolver.ts   # app.metadataCache queries, on-demand content
│   ├── path-validator.ts      # Validates paths against vault root
│   └── cognitive-zone.ts      # Manages knowledge base structure (zones)
│
├── integrations/
│   ├── api-client.ts          # requestUrl() wrapper for Slack/GitHub
│   └── external-fetcher.ts    # Evidence capture from external services
│
├── utils/
│   ├── logger.ts              # Structured logging with sensitive data redaction
│   ├── error-handler.ts       # McpError types, centralized error handling
│   └── platform-detection.ts  # Desktop/mobile feature detection
│
├── types/
│   └── obsidian-api.ts        # Type augmentations for obsidian.d.ts
│
└── styles/
    └── conversation.css        # Sidebar panel styling
```

### Structure Rationale

- **`session/`**: Session lifecycle is separate from plugin lifecycle. The plugin persists; sessions may be created/terminated. Isolating this enables sub-agent management without complexity.
- **`tools/`**: Tool registration is the critical bridge between pi SDK defaults and Obsidian-native operations. Keeping this isolated makes it easy to swap/extend tools.
- **`agent/`**: The agent bridge layer insulates the rest of the plugin from pi SDK specifics. If the SDK changes, only this layer needs updates.
- **`vault/`**: All vault operations flow through a single adapter, enabling consistent path validation, error handling, and future mockability for testing.
- **`ui/`**: UI components are isolated from business logic, enabling panel/settings/status-bar to evolve independently.
- **`integrations/`**: External API calls are network-bound and failure-prone. Isolating them makes retry/logging more manageable.

## Architectural Patterns

### Pattern 1: Plugin Lifecycle Component

**What:** The main plugin class extends `obsidian.Plugin` and uses `onload()`/`onunload()` for initialization.
**When:** Always. This is the mandatory entry point for Obsidian plugins.
**Trade-offs:** Simple, but `onload` must not block (async operations must be handled carefully).

**Example:**
```typescript
export default class ObsidianForge extends Plugin {
  private sessionManager: SessionManager;
  private toolRegistry: ToolRegistry;

  async onload() {
    await this.loadSettings();
    this.toolRegistry = new ToolRegistry(this.app);
    this.sessionManager = new SessionManager(this.app, this.toolRegistry);

    this.addSettingTab(new SettingsTab(this.app, this));
    this.addCommand({ id: 'chat', name: 'Open conversation', callback: () => this.openPanel() });

    this.registerEvent(this.app.vault.on('modify', this.onVaultModify.bind(this)));
    await this.sessionManager.loadContext();
  }

  onunload() {
    this.sessionManager?.persistState();
  }
}
```

### Pattern 2: Vault-Adapter-Wrapped Operations

**What:** All vault operations go through a typed adapter class that wraps `app.vault`, `app.metadataCache`, and `app.workspace`.
**When:** All vault interactions. Never call `app.vault` directly from tool implementations.
**Trade-offs:** Adds an abstraction layer, but enables consistent error handling, path validation, and testability.

**Example:**
```typescript
class VaultAdapter {
  constructor(private app: App) {}

  async readNote(path: string): Promise<string> {
    const normalized = normalizePath(path);
    const file = this.app.vault.getAbstractFileByPath(normalized);
    if (!(file instanceof TFile)) throw new Error('Not a file');
    return await this.app.vault.read(file);
  }

  async writeNote(path: string, content: string): Promise<void> {
    const normalized = normalizePath(path);
    const file = this.app.vault.getAbstractFileByPath(normalized);
    if (file instanceof TFile) {
      await this.app.vault.modify(file, content);
    } else {
      await this.app.vault.create(normalized, content);
    }
  }

  getMetadata(path: string): CachedMetadata | null {
    return this.app.metadataCache.getCache(normalizePath(path));
  }
}
```

### Pattern 3: Tool Registry with Re-registration

**What:** The pi SDK default tools (bash, read, write, edit, glob) are replaced with Obsidian-native equivalents via the tool registry.
**When:** Core pattern. Without this, the agent uses filesystem operations that bypass Obsidian's vault API.
**Trade-offs:** Must implement all tools the agent expects. Any missing tool causes agent failures.

**Example:**
```typescript
class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  registerDefaultTools() {
    // Remove pi SDK defaults
    this.unregisterDefault();

    // Register Obsidian-native equivalents
    this.register('read', this.createVaultReadTool());
    this.register('write', this.createVaultWriteTool());
    this.register('edit', this.createVaultEditTool());
    this.register('glob', this.createSearchTool());
    this.register('bash', this.createObsidianBashTool()); // Desktop-only
    this.register('grep', this.createSearchContentTool());
  }

  private createVaultReadTool(): Tool {
    return {
      name: 'read',
      description: 'Read content from an Obsidian note',
      parameters: { path: { type: 'string', required: true } },
      execute: async ({ path }) => {
        return await vaultAdapter.readNote(path);
      }
    };
  }
}
```

### Pattern 4: Session-Backed Cognitive Memory

**What:** Session state (context, memory, recent operations) is persisted to vault notes, not localStorage or plugin state files.
**When:** Required for R-04 (agent loads session context on startup) and R-11 (session state persists across conversations).
**Trade-offs:** Uses vault notes as storage, which means the agent can read/write its own memory using the same tools it uses for user notes.

**Example:**
```typescript
class CognitiveMemory {
  private memoryNote = 'forge/cognitive-memory.md';

  async load(): Promise<SessionContext> {
    try {
      const content = await this.vault.readNote(this.memoryNote);
      return this.parseContext(content);
    } catch {
      return this.defaultContext();
    }
  }

  async persist(ctx: SessionContext): Promise<void> {
    const content = this.serializeContext(ctx);
    await this.vault.writeNote(this.memoryNote, content);
  }

  // Reduces context to fit token budget by stripping older entries
  async compress(budget: number): Promise<void> { ... }
}
```

### Pattern 5: Sub-Agent Isolation

**What:** Heavy tasks (Slack scan, PR analysis) spawn isolated agent sessions with their own tools and context.
**When:** R-09 (sub-agents can be spawned) and external integrations requiring extended operations.
**Trade-offs:** Each sub-agent is a separate pi Session; must manage lifecycle, termination, and result aggregation.

**Example:**
```typescript
class SubAgentSupervisor {
  private activeAgents: Map<string, pi.Session> = new Map();

  async spawn(task: Task, parentContext: SessionContext): Promise<string> {
    const sessionId = generateId();
    const isolatedTools = this.toolRegistry.getIsolatedTools(task.type);
    const childContext = this.isolateContext(parentContext, task);

    const session = await pi.Session.create({
      tools: isolatedTools,
      systemPrompt: this.buildPrompt(task, childContext)
    });

    this.activeAgents.set(sessionId, session);
    return sessionId;
  }

  async terminate(sessionId: string): Promise<void> {
    const session = this.activeAgents.get(sessionId);
    if (session) {
      await session.terminate();
      this.activeAgents.delete(sessionId);
    }
  }
}
```

### Pattern 6: Context Injector with Token Budget

**What:** Session startup context is assembled from metadataCache first (lightweight), with full content loaded on-demand.
**When:** R-04 and R-65 (token budget constraint). Vault can grow large; loading all content exceeds token budget.
**Trade-offs:** Metadata-first is fast but requires careful content-on-demand logic.

**Example:**
```typescript
class ContextInjector {
  async buildStartupContext(): Promise<string> {
    const metadata = this.loadAllMetadata(); // Fast, lightweight
    const recentFiles = this.getRecentFiles(metadata, 10);
    const recentContent = await this.loadContentOnDemand(recentFiles); // Only recent

    return this.assemble({
      northStar: await this.loadNorthStarNote(),
      activeProjects: metadata.projects,
      recentChanges: recentContent,
      taskList: await this.extractTasks(recentFiles)
    });
  }

  private loadAllMetadata(): CachedMetadata[] {
    return Object.values(this.app.metadataCache.getCache()) as CachedMetadata[];
  }
}
```

### Pattern 7: Graceful Mobile Degradation

**What:** Platform detection at load time; features that require desktop-only APIs (child_process, filesystem) are replaced with silent no-ops or stubbed on mobile.
**When:** R-15 (mobile falls back gracefully). All desktop-only code must be gated.
**Trade-offs:** Users on mobile lose functionality but do not see errors.

**Example:**
```typescript
class PlatformDetection {
  static isDesktop(): boolean {
    return typeof require !== 'undefined' && process.platform !== 'browser';
  }
}

// Usage in tool registration:
if (PlatformDetection.isDesktop()) {
  toolRegistry.register('git', this.createGitTool());
} else {
  toolRegistry.register('git', this.createStubTool('Git operations unavailable on mobile'));
}
```

## Data Flow

### Request Flow (User Message)

```
[User types message in Conversation Panel]
    ↓
[ConversationPanel] → [Plugin Core] → [SessionManager]
    ↓
[SessionManager] → [pi SDK Agent] (with cognitive memory injected)
    ↓
[pi SDK decides to use tool]
    ↓
[pi SDK calls ObsidianTool] (replaces default pi tool)
    ↓
[Tool calls VaultAdapter]
    ↓
[VaultAdapter] → [app.vault] / [app.metadataCache]
    ↓
[Result returned through call chain]
    ↓
[ConversationPanel] renders streaming tokens
```

### State Management

```
┌─────────────────────────────────────────────────────────────┐
│                    Cognitive Memory (Vault)                 │
│  forge/cognitive-memory.md  — Session context, notes       │
│  forge/session-backup/       — Periodic session snapshots   │
└───────────────────────────┬─────────────────────────────────┘
                            ↓ (load on startup)
┌─────────────────────────────────────────────────────────────┐
│                    Session Manager                           │
│  Current pi.Session instance                                │
│  Token budget tracker                                       │
│  Active sub-agents map                                      │
└───────────────────────────┬─────────────────────────────────┘
                            ↓ (subscribe)
┌─────────────────────────────────────────────────────────────┐
│  ConversationPanel ←→ ToolRegistry ←→ VaultAdapter         │
│  SettingsTab          SubAgentSupervisor                     │
│  StatusBar                                                 │
└─────────────────────────────────────────────────────────────┘
```

### Key Data Flows

1. **User Message Flow:** User input → ConversationPanel → SessionManager → pi Agent → ToolRegistry → VaultAdapter → app.vault → response → ConversationPanel

2. **Startup Context Flow:** Plugin load → SessionManager.loadContext() → CognitiveMemory.load() → metadataCache (bulk) + specific notes (on-demand) → pi Session system prompt

3. **Sub-Agent Flow:** User/trigger → SubAgentSupervisor.spawn() → isolated pi Session → ToolRegistry (isolated tools) → external API (Slack/GitHub) → aggregate results → parent context

4. **Settings Change Flow:** User changes API key → SettingsTab.save() → SessionManager reinitializes pi client with new credentials

5. **Write Validation Flow:** Tool execution → VaultAdapter → FrontmatterValidator → wikilink check → pass/rollback

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 users | Monolithic plugin, single session per vault, in-memory cognitive memory with vault backup |
| 100-1k users | Session persistence becomes more critical; consider indexing metadataCache for faster context building |
| 1k-100k users | Vault operations may become bottlenecks; consider caching layer for frequently-read notes |

### Scaling Priorities

1. **First bottleneck: Token budget at startup.** As vault grows, context injection exceeds token limit. Mitigation: aggressive metadataCache-first loading, content-on-demand, periodic context compression.
2. **Second bottleneck: Vault operations during writes.** High-frequency note modifications (e.g., task updates) can conflict. Mitigation: use `Vault.process()` for atomic edits, debounce writes.

## Anti-Patterns

### Anti-Pattern 1: Bypassing VaultAdapter

**What people do:** Calling `app.vault.read()` or `app.vault.write()` directly in tool implementations.
**Why it's wrong:** No path validation, inconsistent error handling, untestable in isolation.
**Do this instead:** Always go through VaultAdapter. It enforces vault root boundaries and provides consistent error types.

### Anti-Pattern 2: Loading Full Vault Content at Startup

**What people do:** Reading all note contents during `onload()` to build session context.
**Why it's wrong:** Vaults can be large; blocking startup is slow and exhausts token budget immediately.
**Do this instead:** Use metadataCache first (it parses frontmatter, links, headings without full content). Load content only for recent/relevant files on-demand.

### Anti-Pattern 3: Blocking `onload()` with Async Agent Initialization

**What people do:** Awaiting pi SDK initialization directly in `onload()`.
**Why it's wrong:** Obsidian's plugin loader waits for `onload()` to complete. Slow initialization blocks other plugins.
**Do this instead:** Initialize the agent asynchronously after `onload()` returns, using `setTimeout` or a deferred initialization pattern.

### Anti-Pattern 4: Direct Filesystem Operations (pi defaults)

**What people do:** Using pi SDK's default bash/read/write/edit tools without re-registration.
**Why it's wrong:** pi defaults operate on the filesystem, bypassing Obsidian's vault API. This creates CLI/filesystem duality (R-65 constraint).
**Do this instead:** Register Obsidian-native tools before initializing the pi session. Never use the default tool set.

### Anti-Pattern 5: Global `app` Reference

**What people do:** Storing `app` in a global variable or module-level variable.
**Why it's wrong:** Obsidian's `app` instance is scoped. Global references can become stale or point to wrong instance.
**Do this instead:** Use `this.app` in the plugin class, pass it explicitly to services that need it.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **OpenAI/Anthropic/Google** | Via pi-ai SDK with user-supplied API key | User configures in settings; plugin stores encrypted |
| **Slack** | `requestUrl()` for API calls, OAuth handshake for auth | Evidence capture (R-14); desktop-only |
| **GitHub** | `requestUrl()` for API calls | PR analysis, code review evidence (R-09) |
| **Git** | `child_process.spawn()` for CLI git | Desktop-only (R-55); mobile silently degrades |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Plugin Core ↔ UI** | Direct method calls, events | Plugin owns UI component lifecycle |
| **Plugin Core ↔ Session** | Typed interface (ISessionManager) | Enables testing with mock session |
| **Session ↔ Agent** | pi SDK API | Session wraps pi.Session; agent bridge interfaces |
| **Agent ↔ Tools** | ToolRegistry interface | Tools are registered functions, not classes |
| **Tools ↔ Vault** | VaultAdapter interface | All vault ops go through adapter |

## Build Order Implications

The following build order is recommended because later components depend on earlier ones:

1. **VaultAdapter** first — all subsequent components depend on vault operations
2. **Plugin Core / Lifecycle** second — establishes the plugin entry point
3. **Tool Registry** third — agent cannot operate without tools
4. **Session Manager** fourth — depends on tools and vault adapter
5. **UI Components** fifth — depend on plugin core and session
6. **Integrations** last — depend on full agent and tool infrastructure

Building in this order ensures each layer can be tested in isolation before the next layer depends on it.

## Sources

- Obsidian Plugin API (obsidian.d.ts) — Official type definitions
- Obsidian Plugin Guidelines — Official plugin development guidelines
- Obsidian Sample Plugin — Reference implementation structure
- obsidian-mcp-server (cyanheads) — MCP protocol integration patterns for Obsidian AI tools
- obsidian-ai-agent-sidebar-plugin (coreydaley) — Tool registration, multi-agent tabs, vault operation patterns

---

*Architecture research for: Obsidian Plugin with Embedded AI Agent*
*Researched: 2026-04-13*
