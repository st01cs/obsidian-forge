# Phase 3: Advanced - Research

**Researched:** 2026-04-14
**Domain:** Complex commands (CMND-04-09), sub-agent spawning (SUBG-01-03), external integrations (EXT-01-03), mobile external API support (MOBI-03)
**Confidence:** MEDIUM-HIGH

## Summary

Phase 3 builds on Phase 2's agent loop and session management to add complex commands that orchestrate sub-agents and external evidence capture. The six new commands (`/weekly`, `/1on1`, `/incident`, `/brag`, `/report`, `/audit`) follow the same `session.prompt()` pattern established in Phase 2, but many delegate heavy lifting to isolated sub-agent sessions. Sub-agents are defined as Markdown files in `forge/agents/` with YAML frontmatter (name, description, tools, model, maxTurns), loaded by a new `SubAgentManager` that wraps `createAgentSession()` with isolated tool subsets. External integrations (Slack, GitHub) use Obsidian's `app.requestUrl()` for HTTP calls, which works identically on mobile (MOBI-03). Git history uses `child_process` exec, Desktop-only per existing patterns.

**Primary recommendation:** Reuse the Phase 2 `session.prompt()` command pattern for all 6 new commands, with sub-agents loaded from `forge/agents/*.md` and spawned via `createAgentSession()`. External HTTP calls switch from global `fetch` to `app.requestUrl()` for CORS safety and mobile compatibility.

## Standard Stack

### Core Additions for Phase 3

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @mariozechner/pi-coding-agent | **0.67.1** | `createAgentSession()` for sub-agents, `ctx.newSession()` for command context | Same as Phase 2 |
| @mariozechner/pi-ai | **0.67.1** | Same as Phase 2 | Same as Phase 2 |

**No new npm packages required.** Phase 3 is entirely implementation within existing packages plus Obsidian API.

### Installation

No new packages. All dependencies already in package.json from Phase 2.

## Architecture Patterns

### Recommended Project Structure (Phase 3 additions)

```
src/
├── commands/
│   ├── standup.ts           # Phase 2 (existing)
│   ├── free-dump.ts         # Phase 2 (existing)
│   ├── review.ts            # Phase 2 (existing)
│   ├── weekly.ts            # NEW: CMND-04 /weekly command
│   ├── 1on1.ts              # NEW: CMND-05 /1on1 command
│   ├── incident.ts          # NEW: CMND-06 /incident command
│   ├── brag.ts              # NEW: CMND-07 /brag command
│   ├── report.ts            # NEW: CMND-08 /report command
│   └── audit.ts             # NEW: CMND-09 /audit command
│
├── agents/
│   ├── sub-agent-manager.ts  # NEW: SUBG-01/02 - loads forge/agents/*.md, spawns sub-sessions
│   ├── agent-loader.ts       # NEW: SUBG-02 - parses agent .md definitions
│   └── idle-guard.ts        # NEW: SUBG-03 - requestIdleCallback wrapper
│
├── integrations/
│   ├── api-client.ts         # NEW: EXT-01/02/03 - app.requestUrl() wrapper for Slack/GitHub/Git
│   ├── slack-client.ts       # NEW: EXT-01 - Slack Web API calls
│   ├── github-client.ts      # NEW: EXT-02 - GitHub REST API calls
│   └── git-client.ts         # NEW: EXT-03 - child_process Git (Desktop-only)
│
└── validation/
    └── write-validator.ts    # Phase 2 (existing)
```

### Pattern 1: Command Implementation (Same as Phase 2)

All 6 new commands follow the established Phase 2 pattern: `execute*Command(agentBridge)` calls `session.prompt()` with a structured prompt. No new patterns needed.

**Example - /weekly (CMND-04):**

```typescript
// src/commands/weekly.ts
export async function executeWeeklyCommand(agentBridge: AgentBridge): Promise<void> {
  if (!agentBridge.isInitialized()) {
    new Notice('Agent not initialized.', 4000);
    return;
  }

  new Notice('Compiling weekly summary...', 2000);

  const session = agentBridge.getSession();
  if (session) {
    const prompt = `# Weekly Summary

Generate a cross-session weekly summary covering the past 7 days:

## 1. Pattern Discovery
Analyze your cognitive/sessions/ notes from the past week. Look for:
- Recurring themes or decisions
- Progress on active projects
- blockers or challenges
- Wins and achievements

## 2. Weekly Wins Report (成果)
Scan all performance/ notes and work/ project notes from this week.
List concrete achievements with evidence links.

## 3. Knowledge Growth
What new information was captured this week?
What was routed where?

## 4. Index Updates
Update any index files that need syncing:
- work/index.md (active projects)
- cognitive/decisions/index.md (new decisions)
- performance/brag.md (new wins)

## 5. Output Format
Produce a structured weekly summary in your notes.
Format: forge/cognitive/sessions/YYYY-WXX.md (ISO week number)
`;
    await session.prompt(prompt);
  }
}
```

### Pattern 2: Sub-Agent Definition File (SUBG-02)

Agents defined as `.md` files in `forge/agents/` with YAML frontmatter. [CITED: prd/2026-04-13-obsidian-forge-plugin-prd.md]

```markdown
---
name: win-discoverer
description: Scan work notes and Git history to find undocumented achievements
tools: [vault_read, vault_search, get_backlinks, git_log]
model: default
maxTurns: 15
---

# Win Discovery Agent

You are a specialized agent that finds undocumented achievements (成果/wins) in the user's work.

## Your Task
1. Scan work/ project notes from the past 30 days
2. Look for mentions of: shipped, launched, completed, delivered, achieved, won, released
3. Check Git commit messages for project-related achievements
4. Cross-reference with performance/ zone to find misses
5. For each found win, note: what, when, evidence link

## Output
List all found wins in a summary table with columns:
| Win | Date | Evidence | Already in Brag? |

Use vault_write to create a draft of missed wins for the user to review.
```

**Agent loading (SUBG-02):**

```typescript
// src/agents/agent-loader.ts
import { VaultAdapter } from '../VaultAdapter';

export interface AgentDefinition {
  name: string;
  description: string;
  tools: string[];   // whitelist of allowed tool names
  model?: string;
  maxTurns: number;
  systemPrompt: string;  // markdown body after frontmatter
}

export async function loadAgentDefinition(
  vaultAdapter: VaultAdapter,
  agentName: string
): Promise<AgentDefinition | null> {
  const path = `forge/agents/${agentName}.md`;
  if (!vaultAdapter.exists(path)) return null;

  const content = await vaultAdapter.readNote(path);
  const { data: frontmatter, content: body } = parseFrontmatter(content);

  return {
    name: frontmatter.name ?? agentName,
    description: frontmatter.description ?? '',
    tools: frontmatter.tools ?? [],
    model: frontmatter.model,
    maxTurns: frontmatter.maxTurns ?? 10,
    systemPrompt: body.trim()
  };
}

export async function listAvailableAgents(
  vaultAdapter: VaultAdapter
): Promise<string[]> {
  // List all .md files in forge/agents/
  // Filter to only files with valid frontmatter
  const files = vaultAdapter.listFiles('md').filter(f =>
    f.path.startsWith('forge/agents/')
  );
  return files.map(f => f.path.replace('forge/agents/', '').replace('.md', ''));
}
```

### Pattern 3: Sub-Agent Spawning (SUBG-01)

Spawn isolated sub-agent sessions via `createAgentSession()` with filtered tool registry. [VERIFIED: pi-coding-agent docs - createAgentSession, customTools]

```typescript
// src/agents/sub-agent-manager.ts
import { getPiSDK } from '../pi-loader';
import { loadAgentDefinition, AgentDefinition } from './agent-loader';
import { ForgeSessionManager } from '../session/SessionManager';
import { VaultAdapter } from '../VaultAdapter';
import { ToolRegistry } from '../ToolRegistry';

export class SubAgentManager {
  private vaultAdapter: VaultAdapter;
  private toolRegistry: ToolRegistry;
  private sessionManager: ForgeSessionManager;

  constructor(
    vaultAdapter: VaultAdapter,
    toolRegistry: ToolRegistry,
    sessionManager: ForgeSessionManager
  ) {
    this.vaultAdapter = vaultAdapter;
    this.toolRegistry = toolRegistry;
    this.sessionManager = sessionManager;
  }

  /**
   * Spawn an isolated sub-agent session (SUBG-01).
   * Creates a new createAgentSession() with filtered tools.
   */
  async spawnSubAgent(
    agentName: string,
    taskPrompt: string,
    parentSession: any
  ): Promise<{ session: any; cancel: () => void }> {
    const sdk = getPiSDK();
    const agentDef = await loadAgentDefinition(this.vaultAdapter, agentName);
    if (!agentDef) throw new Error(`Agent not found: ${agentName}`);

    // Filter tools to only those allowed by this sub-agent (SUBG-02)
    const allTools = this.toolRegistry.getTools();
    const filteredTools = allTools.filter(tool =>
      agentDef.tools.includes(tool.name)
    );

    // Build system prompt from agent definition
    const systemPrompt = `${agentDef.systemPrompt}

## Task
${taskPrompt}

## Constraints
- maxTurns: ${agentDef.maxTurns}
- Use only the tools listed above
- Results should be written to vault using vault_write
`;

    // Create isolated session with in-memory SessionManager (SUBG-01)
    const { session } = await sdk.createAgentSession({
      cwd: this.getVaultPath(),
      agentDir: '~/.pi/forge/subagents',
      model: agentDef.model ? sdk.getModel(this.getProvider(), agentDef.model) : undefined,
      authStorage: sdk.AuthStorage.create(),
      modelRegistry: sdk.ModelRegistry.create(sdk.AuthStorage.create()),
      customTools: filteredTools,
      resourceLoader: new sdk.DefaultResourceLoader({
        cwd: this.getVaultPath(),
        agentDir: '~/.pi/forge/subagents',
        systemPromptOverride: () => systemPrompt
      }),
      sessionManager: sdk.SessionManager.inMemory(),  // Isolated (SUBG-01)
      settingsManager: undefined
    });

    // Wrap long-running agent with requestIdleCallback (SUBG-03)
    return { session, cancel: () => session.abort?.() };
  }

  /**
   * Spawn a sub-agent and run it with requestIdleCallback guard (SUBG-03).
   */
  async runSubAgentWithIdleGuard(
    agentName: string,
    taskPrompt: string,
    onChunk?: (text: string) => void
  ): Promise<string> {
    const { session, cancel } = await this.spawnSubAgent(agentName, taskPrompt, null);

    return new Promise((resolve, reject) => {
      const chunks: string[] = [];

      // SUBG-03: requestIdleCallback to avoid blocking UI
      const scheduleIdle = () => {
        if ('requestIdleCallback' in globalThis) {
          (requestIdleCallback as any)(processChunk, { timeout: 2000 });
        } else {
          // Fallback for non-browser environments
          setTimeout(processChunk, 0);
        }
      };

      const processChunk = () => {
        // Run agent turn in idle time
        session.prompt(taskPrompt).then(result => {
          chunks.push(result);
          onChunk?.(result);
          resolve(chunks.join(''));
        }).catch(err => {
          reject(err);
        });
      };

      scheduleIdle();
    });
  }

  private getVaultPath(): string {
    return (this.vaultAdapter as any).app.vault.adapter.getBasePath?.() || '.';
  }

  private getProvider(): string {
    // Get from settings - would need to pass settings through
    return 'openai';
  }
}
```

### Pattern 4: External Integration via app.requestUrl() (EXT-01, EXT-02, MOBI-03)

Replace the global `fetch`-based `http_request` tool with `app.requestUrl()`. The key difference: `app.requestUrl()` is Obsidian's built-in HTTP client that handles CORS, redirects, and works on mobile. [CITED: prd/2026-04-13-obsidian-forge-plugin-prd.md]

```typescript
// src/integrations/api-client.ts
import { App, requestUrl, RequestUrlParam } from 'obsidian';

export class ApiClient {
  constructor(private app: App) {}

  /**
   * Generic HTTP request via app.requestUrl() (EXT-01, EXT-02, MOBI-03).
   * Works on both Desktop and Mobile - no CORS issues.
   */
  async request(options: {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: string;
  }): Promise<{ status: number; body: string; headers: Record<string, string> }> {
    const params: RequestUrlParam = {
      url: options.url,
      method: options.method ?? 'GET',
      headers: options.headers
    };
    if (options.body && (options.method === 'POST' || options.method === 'PUT')) {
      params.body = options.body;
    }

    const response = await requestUrl(params);
    return {
      status: response.status,
      body: typeof response.json === 'function' ? JSON.stringify(response.json) : response.text,
      headers: response.headers
    };
  }
}
```

**Updated http_request tool using ApiClient:**

```typescript
// In ToolRegistry - now takes app reference
private registerHttpRequestTool(app: App): void {
  const apiClient = new ApiClient(app);
  this.register('http_request', defineTool({
    name: 'http_request',
    label: 'HTTP Request',
    description: 'Make an HTTP request to fetch content from a URL. Works on both Desktop and Mobile.',
    parameters: Type.Object({
      url: Type.String({ description: 'The URL to fetch' }),
      method: Type.Optional(Type.String({ description: 'HTTP method: GET, POST, PUT, DELETE' })),
      headers: Type.Optional(Type.Record(Type.String(), Type.String())),
      body: Type.Optional(Type.String())
    }),
    async execute(_toolCallId, { url, method = 'GET', headers, body }) {
      try {
        const result = await apiClient.request({ url, method: method as any, headers, body });
        return {
          content: [{ type: 'text', text: result.body.slice(0, 10000) }],
          details: { url, status: result.status, size: result.body.length }
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `HTTP request failed: ${error}` }],
          details: { url, status: 0, error: String(error) }
        };
      }
    }
  }));
}
```

### Pattern 5: Slack Integration (EXT-01)

Slack calls via `app.requestUrl()` with Bot Token. [CITED: prd/2026-04-13-obsidian-forge-plugin-prd.md]

```typescript
// src/integrations/slack-client.ts
import { ApiClient } from './api-client';

export interface SlackMessage {
  type: string;
  text: string;
  user: string;
  ts: string;
  channel: string;
}

export class SlackClient {
  private apiClient: ApiClient;
  private token: string;

  constructor(apiClient: ApiClient, token: string) {
    this.apiClient = apiClient;
    this.token = token;
  }

  async searchMessages(query: string, limit = 20): Promise<SlackMessage[]> {
    const result = await this.apiClient.request({
      url: 'https://slack.com/api/search.messages',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });
    // Parse result.body - Slack returns JSON
    return JSON.parse(result.body);
  }

  async getUserProfile(userId: string): Promise<any> {
    const result = await this.apiClient.request({
      url: `https://slack.com/api/users.info?user=${userId}`,
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return JSON.parse(result.body);
  }

  async getChannelMessages(channelId: string, limit = 100): Promise<SlackMessage[]> {
    const result = await this.apiClient.request({
      url: `https://slack.com/api/conversations.history?channel=${channelId}&limit=${limit}`,
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return JSON.parse(result.body);
  }
}
```

### Pattern 6: GitHub Integration (EXT-02)

GitHub REST API via `app.requestUrl()` with PAT. [CITED: prd/2026-04-13-obsidian-forge-plugin-prd.md]

```typescript
// src/integrations/github-client.ts
import { ApiClient } from './api-client';

export class GitHubClient {
  private apiClient: ApiClient;
  private token: string;

  constructor(apiClient: ApiClient, token: string) {
    this.apiClient = apiClient;
    this.token = token;
  }

  private headers(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github.v3+json'
    };
  }

  async getPR(owner: string, repo: string, prNumber: number): Promise<any> {
    const result = await this.apiClient.request({
      url: `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      headers: this.headers()
    });
    return JSON.parse(result.body);
  }

  async getPRComments(owner: string, repo: string, prNumber: number): Promise<any[]> {
    const result = await this.apiClient.request({
      url: `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/comments`,
      headers: this.headers()
    });
    return JSON.parse(result.body);
  }

  async getCommits(owner: string, repo: string, limit = 30): Promise<any[]> {
    const result = await this.apiClient.request({
      url: `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${limit}`,
      headers: this.headers()
    });
    return JSON.parse(result.body);
  }
}
```

### Pattern 7: Git History via child_process (EXT-03)

Desktop-only Git operations via `child_process.exec`. Already partially implemented in `ToolRegistry.registerGitLogTool()`.

```typescript
// src/integrations/git-client.ts (extends existing git_log tool)

export class GitClient {
  /**
   * Get git log with custom format (EXT-03).
   * Desktop-only - do not call on mobile.
   */
  async log(repoPath: string, limit = 30, format?: string): Promise<string> {
    const fmt = format ?? '--oneline';
    return this.exec(`git log ${fmt} -n ${limit}`, repoPath);
  }

  /**
   * Get diff for a specific commit (EXT-03).
   */
  async diff(repoPath: string, commitHash: string): Promise<string> {
    return this.exec(`git show ${commitHash} --stat --format="%H%n%an%n%s%n%b"`, repoPath);
  }

  /**
   * Get changed files in a commit (EXT-03).
   */
  async changedFiles(repoPath: string, commitHash: string): Promise<string[]> {
    const output = await this.exec(`git diff-tree --no-commit-id --name-only -r ${commitHash}`, repoPath);
    return output.split('\n').filter(Boolean);
  }

  private exec(command: string, cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      exec(command, { cwd }, (error: Error | null, stdout: string, stderr: string) => {
        if (error) reject(new Error(`${error.message}\n${stderr}`));
        else resolve(stdout);
      });
    });
  }
}
```

## Common Pitfalls

### Pitfall 1: ToolRegistry.http_request Uses Global fetch Instead of app.requestUrl()

**What goes wrong:** The existing `http_request` tool in `ToolRegistry.ts` uses global `fetch()`, which fails with CORS on cross-origin API calls. `app.requestUrl()` handles CORS but is not a global -- it's a method on the Obsidian `app` object.
**Why it happens:** Phase 1 registered `http_request` with a comment "Note: In actual Obsidian plugin, we'd use app.requestUrl()" but used `fetch` as a placeholder.
**How to avoid:** Refactor `http_request` to receive `app` from `VaultAdapter` (which already holds it) and call `app.requestUrl()`.
**Warning signs:** CORS errors in console when Slack/GitHub API calls fail.

### Pitfall 2: Sub-Agent Session Not Isolated from Main Session

**What goes wrong:** Sub-agent shares the same `SessionManager` as main session, causing memory/state leakage.
**Why it happens:** Using `sessionManager` from the main session when spawning sub-agents.
**How to avoid:** Always use `SessionManager.inMemory()` for sub-agents (SUBG-01). Each sub-agent gets its own isolated in-memory session.

### Pitfall 3: Long-Running Sub-Agents Block UI

**What goes wrong:** `createAgentSession().prompt()` runs synchronously from the agent's perspective, blocking the main thread.
**Why it happens:** No idle-time yielding for heavy sub-agent tasks.
**How to avoid:** Wrap sub-agent execution with `requestIdleCallback`. Use `session.abort()` for cancellation. (SUBG-03)

### Pitfall 4: Git History Available on Mobile

**What goes wrong:** `git_log` tool is Desktop-only per `IS_MOBILE` check, but the Git client for sub-agents might accidentally get called on mobile.
**Why it happens:** `EXT-03` explicitly says "Desktop-only" for Git via child_process, but command implementations might not guard this.
**How to avoid:** Wrap Git operations with `IS_MOBILE` check. All Git sub-agent tools should verify platform before execution.

### Pitfall 5: Token Leakage to External APIs

**What goes wrong:** API tokens (Slack, GitHub) passed to `http_request` tool where the agent can log or exfiltrate them.
**Why it happens:** Tokens stored in settings, passed as headers to external APIs via tool calls.
**How to avoid:** Wrap `http_request` in a controlled `ApiClient` that adds auth headers server-side. Never let the agent construct auth headers directly. Token should be stored encrypted in `plugin.saveData()`, accessed only by the ApiClient.

### Pitfall 6: Sub-Agent Tool Whitelist Bypass

**What goes wrong:** Sub-agent with `tools: [vault_read]` can still call `vault_write` if the tool registry is not properly filtered.
**Why it happens:** `customTools` filter in `createAgentSession` restricts what tools the sub-agent's LLM can see, but doesn't prevent direct tool calls.
**How to avoid:** Filter at spawn time AND validate tool names in the tool execution layer.

## Code Examples

### /incident Command (CMND-06)

```typescript
// src/commands/incident.ts
export async function executeIncidentCommand(agentBridge: AgentBridge): Promise<void> {
  const session = agentBridge.getSession();
  if (!session) return;

  const prompt = `# Incident Capture

Capture an incident and reconstruct its timeline.

## Your Task
1. Ask the user for the Slack channel/thread URL or message IDs for the incident
2. Use http_request to fetch Slack messages via Slack Web API:
   - Search: GET https://slack.com/api/search.messages?query=incident
   - Channel history: GET https://slack.com/api/conversations.history?channel={channel_id}
3. Parse the messages chronologically
4. Reconstruct the incident timeline with timestamps and key events
5. Create an event document at: reference/events/YYYY-MM-DD-incident-[slug].md

## Document Format
---
date: YYYY-MM-DD
type: incident
description: Brief description
tags: [incident, postmortem]
severity: high|medium|low
status: investigating|resolved|resolved-with-action
---

# Incident: [Title]

## Timeline
[Chronological events with timestamps]

## Impact
[What was affected]

## Resolution
[How it was resolved]

## Action Items
- [ ] ...

## Evidence
[Links to Slack messages, logs, etc.]
`;
  await session.prompt(prompt);
}
```

### /brag Command (CMND-07)

```typescript
// src/commands/brag.ts
export async function executeBragCommand(agentBridge: AgentBridge): Promise<void> {
  const session = agentBridge.getSession();
  if (!session) return;

  const prompt = `# Record Achievement (成果/Brag)

Record a concrete achievement with evidence links to your Brag Doc.

## Your Task
1. Ask the user: What did you achieve? When? What was the impact?
2. Scan for evidence:
   - GitHub PR links: use GitHub API to get PR details
   - Slack messages referencing the achievement
   - Any documents in work/ related to this
3. Update performance/brag.md with the new entry:
   - Achievement description
   - Date achieved
   - Evidence links
   - Impact metric (if available)
4. Confirm in chat: "Recorded to Brag Doc"

## Brag Doc Format (append to performance/brag.md)
| Achievement | Date | Evidence | Impact |
|-------------|------|----------|--------|
| [description] | YYYY-MM-DD | [links] | [metric] |

## Required Frontmatter (ROUTE-04)
- date: YYYY-MM-DD
- description: ~150 chars
- tags: [win, achievement, brag]
`;
  await session.prompt(prompt);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `http_request` via global `fetch()` | `http_request` via `app.requestUrl()` | Phase 3 | CORS-safe, mobile-compatible |
| No sub-agents | Isolated `createAgentSession()` with filtered tools | Phase 3 | Heavy tasks don't block/poison main session |
| No external API integration | Slack/GitHub clients via `app.requestUrl()` | Phase 3 | Evidence capture from real sources |
| Git via `git_log` tool only | Full Git client with diff, changed files | Phase 3 | Richer incident reconstruction |
| All Git operations Desktop-only | Git via child_process, Slack/GitHub via `requestUrl()` | Phase 3 | Mobile gets Slack/GitHub but not Git |

**Deprecated/outdated:**
- Global `fetch()` for `http_request`: Replaced with `app.requestUrl()` for CORS safety
- No external integrations: Slack/GitHub now available

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `app.requestUrl()` is available in Obsidian's plugin API for HTTP requests | Pattern 4, EXT-01/02 | LOW - Obsidian has had `requestUrl` since early versions; confirmed by PRD |
| A2 | `createAgentSession()` with `SessionManager.inMemory()` creates truly isolated sub-agent sessions | Pattern 3, SUBG-01 | MEDIUM - pi SDK docs confirm `inMemory()` creates non-persistent sessions; isolation within same process is confirmed |
| A3 | `requestIdleCallback` is available in Electron renderer process | Pattern 3, SUBG-03 | LOW - Electron/Chromium supports requestIdleCallback; Obsidian runs in Electron |
| A4 | Agent definition files use YAML frontmatter with name, description, tools, model, maxTurns fields | Pattern 2, SUBG-02 | MEDIUM - Based on PRD specification; not yet verified against actual pi SDK extension examples |
| A5 | Slack Web API uses `xoxb-` Bot Tokens stored in plugin settings | EXT-01 | LOW - Standard Slack Bot Token format; PRD confirms this |
| A6 | Sub-agent directory is `forge/agents/` (not `~/.pi/agent/agents/`) | SUBG-02 | MEDIUM - PRD specifies `forge/agents/`; pi SDK examples use `~/.pi/agent/agents/` |

## Open Questions

1. **Sub-Agent Isolation Granularity**
   - What we know: `SessionManager.inMemory()` creates isolated in-memory sessions per SUBG-01
   - What's unclear: Whether sub-agents share the same Node.js process (memory) or are truly isolated
   - Recommendation: Treat sub-agents as "isolated sessions" not "isolated processes". The PRD mentions `spawn()` for true process isolation, but that requires `process.execPath` to be Node.js (it's Electron in Obsidian). Use session-level isolation for now.

2. **Command vs Sub-Agent Tool Whitelist**
   - What we know: `forge/agents/*.md` frontmatter has a `tools` array as whitelist
   - What's unclear: How to enforce this at runtime - `customTools` filter restricts what the LLM sees, but does it prevent tool execution?
   - Recommendation: Enforce at spawn time AND in tool execution layer. Don't rely solely on LLM behavior.

3. **Slack/GitHub Token Storage**
   - What we know: Tokens stored in plugin settings (PRD says encrypted in data.json)
   - What's unclear: Current settings implementation doesn't have token fields for Slack/GitHub
   - Recommendation: Add Slack Token and GitHub PAT fields to `ObsidianForgeSettings` interface and SettingsTab

4. **Command Invocation Flow for Sub-Agent Commands**
   - What we know: `/incident` needs to collect info (Slack URL) then run sub-agent
   - What's unclear: Whether sub-agents run synchronously in the command handler or are spawned asynchronously
   - Recommendation: Spawn sub-agent asynchronously, stream results to main chat panel via session events

5. **`ctx.isIdle()` vs `requestIdleCallback`**
   - What we know: pi SDK Extension API has `ctx.isIdle()` and `ctx.abort()`; `requestIdleCallback` is a browser API
   - What's unclear: Whether using `requestIdleCallback` conflicts with pi SDK's own idle detection
   - Recommendation: For Phase 3, use `ctx.isIdle()` to check before spawning sub-agents. Use `requestIdleCallback` only for wrapping the outer UI update, not the agent loop itself.

## Environment Availability

Step 2.6: SKIPPED - No external dependencies beyond npm packages already in project. All Phase 3 dependencies are internal components (commands, sub-agent manager, integrations) and Obsidian API.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A - user provides own API key |
| V3 Session Management | no | N/A - personal vault, single user |
| V4 Access Control | yes | Sub-agent tool whitelist enforced at spawn time |
| V5 Input Validation | yes | URL validation for http_request, API token never exposed to agent |
| V6 Cryptography | yes | Slack/GitHub tokens encrypted in plugin data.json |

### Known Threat Patterns for Phase 3 Additions

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API token exfiltration via agent tool logs | Information Disclosure | ApiClient adds auth headers server-side; agent never sees raw tokens |
| SSRF via http_request with agent-controlled URL | Information Disclosure | URL allowlist for Slack/GitHub APIs; validate URL domain before request |
| Sub-agent tool whitelist bypass | Tampering | Filter tools at spawn time AND execution layer |
| Unbounded sub-agent loops (maxTurns ignored) | Denial of Service | Enforce maxTurns at session creation; abort if exceeded |
| CORS failures from global fetch | Availability | Replace fetch with app.requestUrl() which handles CORS |

## Sources

### Primary (HIGH confidence)
- badlogic/pi-mono (extensions.md) — ctx.newSession(), ctx.fork(), ctx.isIdle(), ctx.abort(), pi.exec, subagent example patterns — fetched 2026-04-14
- badlogic/pi-mono (pi-coding-agent docs/sdk.md) — createAgentSession, customTools, SessionManager.inMemory() — fetched 2026-04-14
- prd/2026-04-13-obsidian-forge-plugin-prd.md — Sub-agent definition format (forge/agents/), requestUrl() for external APIs, token storage, command orchestration — internal project doc

### Secondary (MEDIUM confidence)
- npm registry — @mariozechner/pi-coding-agent@0.67.1, @mariozechner/pi-ai@0.67.1 — verified 2026-04-14
- badlogic/pi-mono (pi-ai README) — getModel, streaming API — fetched 2026-04-14

### Tertiary (LOW confidence)
- Obsidian API (requestUrl) — referenced in PRD and Phase 1 comments; exact API signature not independently verified

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH - Same packages as Phase 2, no new npm deps
- Architecture: MEDIUM-HIGH - Patterns well-established (Phase 2 commands, pi SDK sub-agents); PRD provides clear guidance on forge/agents/ format
- Pitfalls: MEDIUM - http_request CORS issue is confirmed; sub-agent isolation granularity is the main uncertainty

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (30 days for stable domain)
