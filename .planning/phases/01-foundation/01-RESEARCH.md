# Phase 1: Foundation - Research

**Researched:** 2026-04-13
**Domain:** Obsidian Community Plugin with Embedded AI Agent
**Confidence:** MEDIUM-HIGH

## Summary

Phase 1 delivers the plugin scaffold, VaultAdapter, ToolRegistry, sidebar chat panel, settings tab, platform detection, and vault structure creation -- all the foundational pieces needed before the agent loop can run. The critical constraint throughout is that ALL vault operations must flow through `app.vault` (never filesystem), and pi SDK default tools must be replaced with Obsidian-native equivalents before the first agent invocation. Platform detection at module load gates desktop-only features (child_process, git) on mobile.

**Primary recommendation:** Build in strict dependency order: manifest.json + esbuild config first, then VaultAdapter (all tools depend on it), then ToolRegistry (agent cannot operate without it), then Plugin Core, then Session Manager skeleton, then UI (ChatPanel, SettingsTab). This order enables isolated testing at each layer.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Modular folder structure (`src/main.ts`, `src/VaultAdapter.ts`, `src/ToolRegistry.ts`, `src/ChatPanel.ts`, `src/SettingsTab.ts`, `src/mobile.ts`)
- **D-02:** Custom ItemView chat panel (NOT pi-web-ui) -- Tailwind CSS v4 conflicts with Obsidian CSS system
- **D-03:** `pi-coding-agent` + `pi-ai` only (NO pi-web-ui); packages at `^0.66.1`
- **D-04:** esbuild with `format: cjs`, `platform: node`, `target: es2020`, `electron` external
- **D-05:** TypeScript strict mode, ES2020 target, CommonJS module
- **D-06:** Obsidian plugin data API (`saveData`/`loadData`) for settings; API key in settings object (NOT separate secret storage)
- **D-07:** `Platform.isMobile` at module load time; desktop-only tools silently absent on mobile
- **D-08:** On `onload()`, check for `forge/` directory; if absent, create all 7 zones + FORGE.md
- **D-09:** Commands defined as strings in `src/commands.ts`, registered via `plugin.addCommand()`; slash prefix parsing in ChatPanel input
- **D-10:** `ToolRegistry` class with `register(name, handler)` and `unregister(name)`; removes all pi SDK defaults; registers 11 Obsidian-native tools

### Claude's Discretion

- Bundler choice (esbuild -- standard for Obsidian plugins)
- manifest.json fields (`id`, `name`, `version`, `minAppVersion`, `author`, `description`, `api`)
- ItemView view type: `"obsidian-forge-chat"` registered in `plugin.registerView()`
- Settings tab section under "Obsidian Forge"

### Deferred Ideas (OUT OF SCOPE)

- Semantic search (vector embeddings) -- Phase 3+ decision
- Sub-agent isolation patterns -- Phase 3 decision
- External integration (Slack/GitHub API details) -- Phase 3 decision
- Knowledge graph visualization -- Phase 4+ decision

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INST-01 | Install from community plugin market | manifest.json format, `isDesktopOnly: false`, community-plugins.json distribution |
| INST-02 | Configure LLM provider + API key via settings tab | PluginSettingTab pattern, `apiKey: string` in settings, `<input type="password">` for masking |
| INST-03 | Create vault structure on first enable | Zone creation in `onload()`, vault API for file creation |
| CORE-01 | Conversation panel in sidebar | ItemView + WorkspaceLeaf pattern, `registerView()` |
| CORE-02 | Streaming agent responses | Streaming via pi-ai `stream()` events, token-by-token rendering |
| CORE-03 | Slash command invocation | `plugin.addCommand()`, ChatPanel `/` prefix detection |
| CORE-04 | Command palette + keyboard shortcuts | `addCommand()` with `hotkey`, `addHotkey()` |
| VAULT-01 | Read notes via `vault.cachedRead()` + metadataCache | VaultAdapter pattern, `cachedRead()` vs `read()` distinction |
| VAULT-02 | Create/modify notes via `vault.create()`/`vault.modify()`/`vault.process()` | Atomic edit pattern via `vault.process()` |
| TOOL-01 | Replace pi SDK defaults with Obsidian-native tools | ToolRegistry re-registration before first agent invocation |
| TOOL-02 | Additional tools: vault_search, metadata_query, get_backlinks, get_orphans, vault_rename, list_files, git_log, http_request | 11 total tools in D-10 |
| TOOL-03 | Shell commands desktop-only; mobile silently excludes | `Platform.isMobile` guard, `child_process.spawn()` desktop-only |
| MOBI-01 | bash/Git tools removed on mobile (silent, no error) | Platform detection at module load, no-op registration |
| MOBI-02 | Core chat, vault ops, metadata query, LLM calls on mobile | Full mobile support for these features |
| OPS-01 | FORGE.md created on first enable | Zone creation includes `FORGE.md` with frontmatter schema, command list |
| OPS-02 | Agent loads FORGE.md on startup as system instructions | Phase 2 (Session Manager loads forge/cognitive-memory.md + FORGE.md) |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x | Plugin source language | Required by Obsidian API types, type safety for agent integration |
| esbuild | 0.34.x | Bundler | [VERIFIED: npm registry] Official Obsidian toolchain; 0.21.x in research is stale |
| @mariozechner/pi-coding-agent | 0.66.1 | Agent runtime with tool system | [VERIFIED: npm registry] Session management, `defineTool()`, `createAgentSession()` |
| @mariozechner/pi-ai | 0.66.1 | Unified LLM API | [VERIFIED: npm registry] `getModel()`, `stream()`, `complete()` |
| @sinclair/typebox | latest | JSON schema types | Tool parameter definitions in `defineTool()` |
| @obsidianmd/obsidian-api | 1.12.3 | Plugin runtime types | [CITED: obsidian-api@1.12.3] `App`, `Vault`, `Workspace`, `MetadataCache` interfaces |
| Node.js | 20.x | Runtime | pi SDK requires >= 20.6.0 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron | (bundled) | Desktop runtime | Obsidian ships it -- mark as `external` in esbuild |
| @codemirror/* | (bundled) | Editor components | Obsidian provides them -- external in esbuild |

### Installation

```bash
npm install obsidian @mariozechner/pi-coding-agent@0.66.1 @mariozechner/pi-ai@0.66.1 @sinclair/typebox

npm install -D typescript esbuild
```

**Version notes:**
- esbuild research said 0.21.x but current npm is 0.34.49 [VERIFIED: npm registry] -- use current
- @obsidianmd/obsidian-api (not @types/obsidian) provides Obsidian API types [CITED: obsidian-api@1.12.3]
- All pi packages must be version-locked together at 0.66.1

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── main.ts                    # Plugin entry, onload/onunload
├── VaultAdapter.ts           # Wraps app.vault operations
├── ToolRegistry.ts          # Tool re-registration
├── ChatPanel.ts             # ItemView sidebar panel
├── SettingsTab.ts           # PluginSettingTab
├── mobile.ts                # Platform.isMobile detection + feature gates
└── commands.ts              # Slash command definitions
```

### Pattern 1: Plugin Lifecycle (EXTENDS obsidian.Plugin)

**What:** `main.ts` exports default class extending `Plugin`; `onload()` initializes subsystems, `onunload()` persists state.
**When:** Always -- mandatory entry point.
**Build order:** 1st.

```typescript
// Source: [obsidianmd/obsidian-sample-plugin]
import { App, Plugin } from 'obsidian';

export default class ObsidianForge extends Plugin {
  async onload() {
    // 1. Load settings
    await this.loadSettings();
    // 2. Initialize VaultAdapter
    // 3. Initialize ToolRegistry (MUST precede agent init)
    // 4. Initialize Session Manager skeleton
    // 5. Register views, commands, setting tab
    // 6. Create vault structure if first enable
  }

  onunload() {
    // Persist session state
  }
}
```

### Pattern 2: VaultAdapter (WRAPS app.vault)

**What:** Single class wrapping all vault operations with consistent error handling and path validation.
**When:** ALL vault operations -- never call `app.vault` directly.
**Build order:** 2nd (all tools depend on it).

```typescript
// Source: [ARCHITECTURE.md - Vault-Adapter-Wrapped Operations]
class VaultAdapter {
  constructor(private app: App) {}

  async readNote(path: string): Promise<string> {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
    if (!(file instanceof TFile)) throw new Error('Not a file');
    return await this.app.vault.cachedRead(file); // Use cachedRead, not read
  }

  async writeNote(path: string, content: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
    if (file instanceof TFile) {
      await this.app.vault.modify(file, content);
    } else {
      await this.app.vault.create(normalizePath(path), content);
    }
  }

  // Atomic edit via vault.process()
  async editNote(path: string, fn: (content: string) => string): Promise<void> {
    await this.app.vault.process(
      this.app.vault.getAbstractFileByPath(normalizePath(path)) as TFile,
      fn
    );
  }
}
```

### Pattern 3: ToolRegistry (RE-REGISTERS pi SDK tools)

**What:** Replaces all pi SDK default tools (bash, read, write, edit) with Obsidian-native equivalents before first agent invocation.
**When:** Core pattern -- without this, agent uses filesystem and bypasses vault.
**Build order:** 3rd (agent cannot operate without tools).

```typescript
// Source: [STACK.md - Tool Re-registration Pattern]
import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

class ToolRegistry {
  private tools: Map<string, any> = new Map();

  registerDefaultTools() {
    // CRITICAL: Unregister ALL pi defaults before registering replacements
    // pi SDK default tools: bash, read, write, edit, glob, grep
    this.unregisterAllPiDefaults();

    // Register Obsidian-native equivalents
    this.register('vault_read', this.createVaultReadTool());
    this.register('vault_write', this.createVaultWriteTool());
    this.register('vault_edit', this.createVaultEditTool());
    this.register('vault_search', this.createSearchTool());
    this.register('metadata_query', this.createMetadataQueryTool());
    this.register('get_backlinks', this.createBacklinksTool());
    this.register('list_files', this.createListFilesTool());
    this.register('vault_rename', this.createRenameTool());
    this.register('http_request', this.createHttpTool());
    this.register('bash', this.createBashTool()); // Desktop-only
    this.register('git_log', this.createGitLogTool()); // Desktop-only
  }

  private createVaultReadTool() {
    return defineTool({
      name: 'vault_read',
      description: 'Read content of an Obsidian note',
      parameters: Type.Object({ path: Type.String() }),
      async execute(_, { path }) {
        // Use VaultAdapter here
        const content = await vaultAdapter.readNote(path);
        return { content: [{ type: "text", text: content }] };
      }
    });
  }
}
```

### Pattern 4: ItemView Sidebar Panel (ChatPanel)

**What:** Custom `ItemView` subclass registered as `"obsidian-forge-chat"` rendering chat UI.
**When:** CORE-01 (conversation panel in sidebar).
**Build order:** 5th (depends on Plugin Core).

```typescript
// Source: [obsidianmd/obsidian-sample-plugin - view registration]
export class ChatPanel extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: ObsidianForge) {
    super(leaf);
  }

  getViewType(): string { return 'obsidian-forge-chat'; }

  async onOpen() {
    const container = this.containerEl;
    container.empty();
    // Render: message list, input area, streaming indicator
    // ChatPanel parses '/' prefix for command filtering
  }
}

// Registration in main.ts onload():
this.registerView('obsidian-forge-chat', (leaf) => new ChatPanel(leaf, this));
this.addCommand({ id: 'open-chat', name: 'Open conversation', callback: () => {
  this.app.workspace.getLeaf(false).setViewState({ type: 'obsidian-forge-chat' });
}});
```

### Pattern 5: PluginSettingTab (Settings Tab)

**What:** `PluginSettingTab` subclass with API key field (password type), provider dropdown.
**When:** INST-02 (LLM configuration).
**Build order:** 5th (depends on Plugin Core).

```typescript
// Source: [obsidianmd/obsidian-sample-plugin - settings tab]
export class ObsidianForgeSettingsTab extends PluginSettingTab {
  constructor(app: App, private plugin: ObsidianForge) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Obsidian Forge Settings' });

    new Setting(containerEl)
      .setName('API Provider')
      .addDropdown(cb => cb
        .addOption('openai', 'OpenAI')
        .addOption('anthropic', 'Anthropic')
        .onChange(v => { this.plugin.settings.provider = v; this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('API Key')
      .addTextField(tf => tf
        .setPlaceholder('sk-...')
        .setAttr('type', 'password') // Mask input
        .setValue(this.plugin.settings.apiKey)
        .onChange(v => { this.plugin.settings.apiKey = v; this.plugin.saveSettings(); }));
  }
}
```

### Pattern 6: Platform Detection (Mobile/Desktop)

**What:** `Platform.isMobile` at module load time gates desktop-only features.
**When:** MOBI-01, MOBI-02, TOOL-03.
**Build order:** 2nd (VaultAdapter and ToolRegistry both need it).

```typescript
// Source: [PITFALLS.md - Graceful Mobile Degradation]
// In mobile.ts or at top of tool registry:
import { Platform } from 'obsidian';

export const IS_MOBILE = Platform.isMobile;

// Tool registration conditional:
if (!IS_MOBILE) {
  toolRegistry.register('bash', createBashTool());
  toolRegistry.register('git_log', createGitLogTool());
}
// On mobile, bash/git are simply absent from the tool list (silent degradation)
```

### Anti-Patterns to Avoid

- **Bypassing VaultAdapter:** Calling `app.vault.read()` directly in tools -- no path validation, inconsistent errors, untestable.
- **Loading full vault at startup:** Reading all note content during `onload()` -- exceeds token budget, blocks plugin init.
- **Blocking `onload()` with async agent init:** Awaiting pi SDK init directly in `onload()` -- stalls other plugins. Use deferred init: `setTimeout(() => { initAgent(); }, 0)`.
- **Using pi SDK defaults without replacement:** Agent operates on filesystem, bypassing vault. Must replace ALL defaults before first agent call.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tool re-registration | Custom tool system | `defineTool()` from pi-coding-agent | pi SDK handles tool schema, execution, streaming; hand-rolling breaks agent loop |
| Vault operations | Direct `app.vault` calls | VaultAdapter class | Consistent path validation, error handling, testable in isolation |
| Platform detection | Runtime checks everywhere | `Platform.isMobile` at module load, feature flags | Single source of truth; avoids scattered `if (app.isMobile)` |
| Settings persistence | Custom JSON file | `plugin.saveData()`/`plugin.loadData()` | Obsidian handles encoding, migration, cross-platform |
| Chat panel | Third-party UI library | Custom ItemView | pi-web-ui excluded due to Tailwind CSS conflict; ItemView is Obsidian-native |

---

## Common Pitfalls

### Pitfall 1: pi SDK Tool Contamination (HIGH PRIORITY)
**What goes wrong:** Agent uses default pi tools (bash/read/write) on filesystem instead of vault.
**How to avoid:** Replace ALL pi SDK default tools with Obsidian equivalents BEFORE first agent invocation. Run smoke test: "read note X" must use Vault API.
**Phase 1 addresses:** YES -- TOOL-01, TOOL-02, TOOL-03.

### Pitfall 2: Token Budget Overflow at Startup
**What goes wrong:** Loading all note content at startup exceeds LLM context and burns tokens.
**How to avoid:** metadataCache first (O(n) fast), content on-demand. For Phase 1, vault structure creation does NOT load note content.
**Phase 1 addresses:** PARTIAL -- vault structure creation is lightweight; full token budget management is Phase 2.

### Pitfall 3: Blocking onload() with Async Operations
**What goes wrong:** Awaiting pi SDK init in `onload()` blocks other plugins.
**How to avoid:** Initialize agent asynchronously after `onload()` returns: `setTimeout(() => { initSession(); }, 0)`.
**Phase 1 addresses:** YES -- Session Manager skeleton defers full init.

### Pitfall 4: Mobile Silent Degradation Missing
**What goes wrong:** Plugin crashes or shows errors on mobile due to missing `child_process`.
**How to avoid:** `Platform.isMobile` at module load; desktop-only tools simply not registered on mobile.
**Phase 1 addresses:** YES -- MOBI-01, MOBI-02, TOOL-03.

---

## Code Examples

### manifest.json (Community Plugin Format)

```json
// Source: [obsidianmd/obsidian-releases community-plugins.json]
{
  "id": "obsidian-forge",
  "name": "Obsidian Forge",
  "version": "0.1.0",
  "minAppVersion": "1.12.0",
  "description": "AI agent with persistent memory for personal knowledge management",
  "author": "[author]",
  "authorUrl": "[url]",
  "fundingUrl": "[url]",
  "isDesktopOnly": false
}
```

### esbuild Configuration

```javascript
// Source: [obsidianmd/obsidian-sample-plugin esbuild.config.mjs]
import esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron',
    '@codemirror/autocomplete', '@codemirror/collab', '@codemirror/commands',
    '@codemirror/language', '@codemirror/lint', '@codemirror/search',
    '@codemirror/state', '@codemirror/view',
    '@lezer/common', '@lezer/highlight', '@lezer/lr'],
  format: 'cjs',
  platform: 'node',
  target: 'es2020',
  treeShaking: true,
  minify: process.argv.includes('--production'),
  sourcemap: !process.argv.includes('--production'),
  outfile: 'main.js',
});
```

### Vault Structure Creation (onload check)

```typescript
// Source: [D-08 from CONTEXT.md]
const ZONES = ['work', 'org', 'performance', 'cognitive', 'reference', 'draft'];
const FORGE_ROOT = 'forge';

async ensureVaultStructure(): Promise<void> {
  const forgeDir = this.app.vault.getAbstractFileByPath(FORGE_ROOT);
  if (forgeDir instanceof TFolder) return; // Already exists

  await this.app.vault.createFolder(FORGE_ROOT);
  for (const zone of ZONES) {
    await this.app.vault.createFolder(`${FORGE_ROOT}/${zone}`);
  }
  await this.app.vault.create(FORGE_ROOT + '/FORGE.md', this.buildForgeMdContent());
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Filesystem + CLI tools | Vault API via `app.vault` | Obsidian plugins must use vault API | Agent operates on notes, not files |
| pi-web-ui for chat | Custom ItemView | Phase 1 decision (Tailwind conflict) | No external CSS dependency; streaming UX controlled |
| Load all content at startup | metadataCache-first + on-demand | Known pitfall from research | Token budget preserved; startup fast |
| Global `app` reference | `this.app` passed explicitly | Obsidian pattern | App instance stays valid across contexts |

---

## Assumptions Log

> Claims in this research that could not be fully verified. The planner and discuss-phase use this section to identify decisions needing user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@obsidianmd/obsidian-api` is the correct npm package for Obsidian API types (not `@types/obsidian`) | Standard Stack | If wrong, TypeScript compilation fails; easy to fix by swapping package name |
| A2 | `defineTool()` from pi-coding-agent accepts TypeBox `Type.Object()` for parameters | ToolRegistry pattern | If API differs, tool parameter schemas may not work; verify against pi SDK 0.66.1 source |
| A3 | `vault.cachedRead()` is the correct method for reading notes (not `vault.read()`) | VaultAdapter | `cachedRead()` is documented in Obsidian API; if wrong, use `read()` instead |
| A4 | Platform detection via `Platform.isMobile` works at module load time (not just at runtime) | Platform Detection | If it only works at runtime, mobile gating may need to be deferred to function level |
| A5 | `vault.process()` is the correct API for atomic edits | VaultAdapter | If API differs, atomic edits use `modify()` instead |

**If this table is empty:** All claims in this research were verified or cited.

---

## Open Questions

1. **pi SDK `defineTool()` exact signature**
   - What we know: STACK.md shows `defineTool({ name, description, parameters, execute })` with TypeBox types
   - What's unclear: Whether `parameters` accepts `Type.Object()` directly or requires `Type.Strict()`
   - Recommendation: Verify against pi SDK 0.66.1 source before implementing ToolRegistry

2. **pi SDK session creation API**
   - What we know: `createAgentSession()` takes session manager, auth storage, model registry, model, customTools
   - What's unclear: Exact initialization order and whether `SessionManager.inMemory()` is correct for Phase 1
   - Recommendation: Phase 1 creates SessionManager skeleton only; full wiring in Phase 2

3. **ItemView streaming rendering approach**
   - What we know: ChatPanel extends ItemView; streaming via pi-ai `stream()` events
   - What's unclear: Exact DOM update pattern for token-by-token rendering (requestAnimationFrame vs innerHTML)
   - Recommendation: Use Obsidian's built-in renderMarkdown for message content; streaming as text node append

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies beyond npm packages -- all tools verified via npm registry)

---

## Sources

### Primary (HIGH confidence)
- [obsidianmd/obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin) -- Official plugin template, esbuild config, TypeScript setup
- [badlogic/pi-mono (pi-coding-agent docs/sdk.md)](https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/docs/sdk.md) -- SDK tool registration, session management
- [badlogic/pi-mono (pi-ai README)](https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/ai/README.md) -- Unified LLM API, streaming
- [obsidianmd/obsidian-api@1.12.3](https://github.com/obsidianmd/obsidian-api) -- API type definitions
- [obsidianmd/obsidian-releases (community-plugins.json)](https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json) -- Plugin distribution format
- [npm registry: pi-coding-agent@0.66.1](https://registry.npmjs.org/-/v1/search?text=mariozechner) -- Package version verification
- [npm registry: pi-ai@0.66.1](https://registry.npmjs.org/-/v1/search?text=mariozechner) -- Package version verification
- [npm registry: esbuild@0.34.49](https://registry.npmjs.org/-/v1/search?text=esbuild) -- Current esbuild version

### Secondary (MEDIUM confidence)
- [ARCHITECTURE.md](.planning/research/ARCHITECTURE.md) -- Component patterns, project structure
- [PITFALLS.md](.planning/research/PITFALLS.md) -- Critical pitfalls, avoidance strategies
- [STACK.md](.planning/research/STACK.md) -- Stack patterns, tool re-registration

---

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM-HIGH -- pi SDK verified via npm (0.66.1), esbuild verified (0.34.49), Obsidian API types cited from official repo
- Architecture: MEDIUM -- Patterns from official Obsidian sample plugin; exact pi SDK API needs verification
- Pitfalls: MEDIUM -- Identified from research synthesis; some (tool re-registration order, mobile gating) need validation during implementation

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (30 days -- stable domain)
