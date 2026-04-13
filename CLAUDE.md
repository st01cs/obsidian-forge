<!-- GSD:project-start source:PROJECT.md -->
## Project

**Obsidian Forge**

Obsidian Forge is an **Obsidian community plugin** that embeds an AI agent (via pi SDK) directly into Obsidian's Electron process. It provides persistent memory across sessions, automated knowledge routing, and performance evidence capture — all within Obsidian's native interface, with no CLI or external tools required.

Users install from the Obsidian community plugin market, configure an LLM API key, and interact via a sidebar conversation panel. The agent operates through Obsidian's Vault API, maintaining context across sessions through a cognitive memory system.

**Core Value:** **Give your Obsidian a brain.** Knowledge flows between sessions, connects across notes, and compounds over quarters — without ever leaving Obsidian.

### Constraints

- **Platform**: Obsidian Desktop 1.12+ (plugin API required)
- **Runtime**: Electron renderer process (same-process as Obsidian)
- **LLM**: User-supplied API key (OpenAI / Anthropic / Google via pi-ai)
- **Bundle size**: < 5MB (tree-shaking required)
- **Token budget**: Session startup context must be lightweight (metadataCache first, content on-demand)
- **No CLI/filesystem duality**: All vault operations via Vault API only
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

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
### TypeScript Configuration (tsconfig.json)
### esbuild Configuration (esbuild.config.mjs)
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
## Installation
# Core dependencies
# Dev dependencies
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
- Use `format: 'cjs'` not ESM — Obsidian plugins load as CommonJS
- External all CodeMirror/Lezer packages — Obsidian provides them
- Use `platform: 'node'` — pi SDK uses Node.js APIs
- Tree-shaking is mandatory for <5MB bundle
- Create custom tools via `defineTool()` from pi-coding-agent
- Tools execute `app.vault.read()`, `app.vault.modify()`, `app.vault.create()` etc.
- Do NOT use the default bash tool — it spawns shell processes unavailable in renderer
- Use `SessionManager.create(cwd)` instead of `SessionManager.inMemory()`
- Sessions stored as JSONL files in `~/.pi/agent/sessions/`
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
### Tool Re-registration Pattern
### Mobile Fallback
## Sources
- [obsidianmd/obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin) — Official plugin template, esbuild config, TypeScript setup — HIGH confidence
- [obsidianmd/obsidian-api@1.12.3](https://github.com/obsidianmd/obsidian-api) — API type definitions — HIGH confidence
- [badlogic/pi-mono (pi-coding-agent docs/sdk.md)](https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/docs/sdk.md) — SDK embedding, tool registration, session management — HIGH confidence
- [badlogic/pi-mono (pi-ai README)](https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/ai/README.md) — Unified LLM API, streaming, model discovery — HIGH confidence
- [badlogic/pi-mono (pi-web-ui README)](https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/web-ui/README.md) — ChatPanel embedding, UI components — HIGH confidence
- [badlogic/pi-mono (extensions.md)](https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/docs/extensions.md) — Extension API, tool registration — HIGH confidence
- [obsidianmd/obsidian-releases (community-plugins.json)](https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json) — Plugin distribution format — HIGH confidence
- [npm registry: @mariozechner/* packages](https://registry.npmjs.org/-/v1/search?text=mariozechner) — Package versions — MEDIUM confidence (verified via npm registry)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
