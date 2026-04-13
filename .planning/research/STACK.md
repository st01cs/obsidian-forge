# Stack Research

**Domain:** Obsidian community plugin with embedded AI agent runtime
**Researched:** 2026-04-13
**Confidence:** MEDIUM-HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | 5.x | Plugin source language | Required by Obsidian API types, provides type safety for complex agent integration |
| esbuild | 0.21.x | Bundler | Official Obsidian toolchain, fast builds, tree-shaking for <5MB bundle constraint |
| obsidian API | 1.12.3 | Plugin runtime types | Latest stable, provides App, Vault, Workspace, MetadataCache interfaces |
| @mariozechner/pi-coding-agent | 0.66.1 | Agent runtime with tool system | Open-source, embeddable, model-agnostic coding agent with session management and extension API |
| @mariozechner/pi-ai | 0.66.1 | Unified LLM API | Auto model discovery, streaming events, cross-provider handoffs, tool definitions |
| @mariozechner/pi-web-ui | 0.66.1 | Chat UI components | Pre-built ChatPanel with artifacts, session list, settings dialog |
| Node.js | 20.x | Runtime | Required by pi SDK (minimum 20.6.0), Electron renderer is Chromium/Node |

### Obsidian Plugin Structure

**manifest.json** — Plugin metadata for community market:
```json
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

**Entry point:** `src/main.ts` — Plugin class extending `obsidian.Plugin`:
```typescript
import { App, Plugin } from 'obsidian';

export default class ObsidianForge extends Plugin {
  async onload() {
    // Lifecycle initialization
  }

  onunload() {
    // Cleanup
  }
}
```

### TypeScript Configuration (tsconfig.json)

```json
{
  "compilerOptions": {
    "baseUrl": "src",
    "inlineSourceMap": true,
    "inlineSources": true,
    "module": "ESNext",
    "target": "ES6",
    "allowJs": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "noImplicitReturns": true,
    "moduleResolution": "node",
    "importHelpers": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "strictNullChecks": true,
    "strictBindCallApply": true,
    "allowSyntheticDefaultImports": true,
    "useUnknownInCatchVariables": true,
    "lib": ["DOM", "ES5", "ES6", "ES7"]
  },
  "include": ["src/**/*.ts"]
}
```

### esbuild Configuration (esbuild.config.mjs)

```javascript
import esbuild from 'esbuild';

const prod = process.argv.includes('--production');

esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: [
    'obsidian', 'electron',
    '@codemirror/autocomplete', '@codemirror/collab', '@codemirror/commands',
    '@codemirror/language', '@codemirror/lint', '@codemirror/search', '@codemirror/state', '@codemirror/view',
    '@lezer/common', '@lezer/highlight', '@lezer/lr'
  ],
  format: 'cjs',
  platform: 'node',
  target: 'es2018',
  treeShaking: true,
  minify: prod,
  sourcemap: !prod,
 源码: prod ? false : 'inline',
  outfile: 'main.js',
  logLevel: 'info',
});
```

**Key points:**
- `external` excludes all CodeMirror/Lezer packages — Obsidian provides these at runtime
- `format: cjs` — Obsidian plugins run in CommonJS context
- `target: es2018` — Good compatibility with Electron renderer process
- Tree-shaking is critical for <5MB bundle

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @sinclair/typebox | latest | JSON schema types | Tool parameter definitions in pi SDK |
| electron | bundled | Desktop runtime | Obsidian is Electron — already available |
| @mariozechner/pi-agent-core | 0.66.1 | Transport abstraction | If needing custom session transport beyond pi-coding-agent defaults |

### Agent Runtime Integration

**pi-coding-agent session creation:**
```typescript
import { createAgentSession, SessionManager, AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import { getModel } from "@mariozechner/pi-ai";

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage: AuthStorage.create(),
  modelRegistry: ModelRegistry.create(AuthStorage.create()),
  model: getModel('anthropic', 'claude-sonnet-4-5'),
  // Replace default bash/read/write/edit tools with Obsidian-native ones
  customTools: [obsidianReadTool, obsidianWriteTool, obsidianEditTool, obsidianBashTool],
});
```

**pi-ai model selection:**
```typescript
import { getModel, stream, complete } from "@mariozechner/pi-ai";

// Streaming response
const s = stream(getModel('anthropic', 'claude-sonnet-4-5'), { systemPrompt, messages, tools });
for await (const event of s) {
  if (event.type === 'text_delta') process.stdout.write(event.delta);
  if (event.type === 'toolcall_end') console.log(event.toolCall.name);
}
```

**pi-web-ui ChatPanel embedding:**
```typescript
import { ChatPanel, ApiKeyPromptDialog } from '@mariozechner/pi-web-ui';
import '@mariozechner/pi-web-ui/app.css';

const chatPanel = new ChatPanel();
await chatPanel.setAgent(agent, {
  onApiKeyRequired: (provider) => ApiKeyPromptDialog.prompt(provider),
});
// Mount chatPanel into Obsidian sidebar container
```

## Installation

```bash
# Core dependencies
npm install obsidian @mariozechner/pi-coding-agent@0.66.1 @mariozechner/pi-ai@0.66.1 @mariozechner/pi-web-ui@0.66.1 @sinclair/typebox

# Dev dependencies
npm install -D typescript esbuild @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| esbuild | rollup | Rollup has better tree-shaking but esbuild is the official Obsidian toolchain and faster |
| pi-coding-agent | raw @mariozechner/pi-agent-core | pi-coding-agent includes session management and default tools out of the box |
| pi-ai (provider abstraction) | Direct SDK per provider (OpenAI SDK, Anthropic SDK) | pi-ai enables cross-provider handoffs and unified streaming API |
| pi-web-ui | Custom React/Svelte component | pi-web-ui provides ready-made ChatPanel with artifacts, settings, session management |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Obsidian API < 1.12 | Older API versions lack key features for agent integration | @obsidianmd/obsidian-api@1.12.3 |
| pi-coding-agent < 0.66 | Older versions have different tool registration API | @mariozechner/pi-coding-agent@0.66.1 |
| Node.js < 20 | pi SDK requires Node.js >= 20.6.0 | Node.js 20 LTS |
| Webpack | Bloats bundle size, slower builds, complex config | esbuild (official Obsidian approach) |
| Browser bundling for pi SDK | pi SDK is Node.js runtime (uses fs, path, child_process) | Bundle for CommonJS/node platform, not browser |

## Stack Patterns by Variant

**If embedding in Electron renderer (Obsidian):**
- Use `format: 'cjs'` not ESM — Obsidian plugins load as CommonJS
- External all CodeMirror/Lezer packages — Obsidian provides them
- Use `platform: 'node'` — pi SDK uses Node.js APIs
- Tree-shaking is mandatory for <5MB bundle

**If replacing default tools with Obsidian Vault API:**
- Create custom tools via `defineTool()` from pi-coding-agent
- Tools execute `app.vault.read()`, `app.vault.modify()`, `app.vault.create()` etc.
- Do NOT use the default bash tool — it spawns shell processes unavailable in renderer

**If enabling session persistence across restarts:**
- Use `SessionManager.create(cwd)` instead of `SessionManager.inMemory()`
- Sessions stored as JSONL files in `~/.pi/agent/sessions/`

**If creating sub-agents for heavy tasks:**
- Spawn via `createAgentSession()` with isolated SessionManager
- Each sub-agent has independent tool registry and session state

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| @mariozechner/pi-coding-agent@0.66.1 | @mariozechner/pi-ai@0.66.1, @mariozechner/pi-web-ui@0.66.1 | All pi packages share version 0.66.1 |
| pi-coding-agent@0.66.1 | Node.js >= 20.6.0 | Required by SDK runtime |
| obsidian@1.12.3 | Obsidian Desktop >= 1.12.0 | minAppVersion in manifest must match |
| esbuild | TypeScript 5.x | Works with all TypeScript versions |
| electron (bundled) | Obsidian 1.12.x | Electron version embedded in Obsidian |

## Key Implementation Notes

### Obsidian API Patterns

```typescript
// Vault operations (preferred over filesystem)
await app.vault.read(file);           // Read note content
await app.vault.modify(file, content); // Update note
await app.vault.create(path, content); // Create new note
app.vault.getAbstractFileByPath(path);  // Get file by path

// Metadata cache (lightweight, no content loading)
app.metadataCache.getFileCache(file);   // Get frontmatter, links, embeds
app.metadataCache.on('changed', callback); // Subscribe to changes

// Workspace (UI manipulation)
app.workspace.getActiveViewOfType(MarkdownView);
this.addRibbonIcon('icon', 'tooltip', callback);
this.addStatusBarItem().setText('Status');
this.addSettingTab(new MySettingTab());
```

### Tool Re-registration Pattern

Replace pi-coding-agent default tools with Obsidian-native ones:
```typescript
import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const obsidianReadTool = defineTool({
  name: "read",
  description: "Read content of a note",
  parameters: Type.Object({ path: Type.String() }),
  async execute(_, { path }) {
    const file = app.vault.getAbstractFileByPath(path);
    if (!file) return { content: [{ type: "text", text: "File not found" }] };
    const content = await app.vault.read(file);
    return { content: [{ type: "text", text: content }] };
  }
});
```

### Mobile Fallback

```typescript
import { Platform } from 'obsidian';

if (Platform.isMobile) {
  // Disable bash tool, git operations, child_process
  // Use read-only Vault operations
  // Show silent degradation notice
}
```

## Sources

- [obsidianmd/obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin) — Official plugin template, esbuild config, TypeScript setup — HIGH confidence
- [obsidianmd/obsidian-api@1.12.3](https://github.com/obsidianmd/obsidian-api) — API type definitions — HIGH confidence
- [badlogic/pi-mono (pi-coding-agent docs/sdk.md)](https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/docs/sdk.md) — SDK embedding, tool registration, session management — HIGH confidence
- [badlogic/pi-mono (pi-ai README)](https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/ai/README.md) — Unified LLM API, streaming, model discovery — HIGH confidence
- [badlogic/pi-mono (pi-web-ui README)](https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/web-ui/README.md) — ChatPanel embedding, UI components — HIGH confidence
- [badlogic/pi-mono (extensions.md)](https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/docs/extensions.md) — Extension API, tool registration — HIGH confidence
- [obsidianmd/obsidian-releases (community-plugins.json)](https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json) — Plugin distribution format — HIGH confidence
- [npm registry: @mariozechner/* packages](https://registry.npmjs.org/-/v1/search?text=mariozechner) — Package versions — MEDIUM confidence (verified via npm registry)

---
*Stack research for: Obsidian community plugin with embedded AI agent runtime*
*Researched: 2026-04-13*
