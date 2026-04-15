/**
 * AgentBridge - connects Obsidian components to pi SDK.
 *
 * This class is the bridge between Obsidian and the pi agent.
 * It creates the agent session with Obsidian-native tools and
 * vault-backed cognitive memory.
 */

import { VaultAdapter } from './VaultAdapter';
import { ToolRegistry } from './ToolRegistry';
import { ObsidianForgeSettings } from './main';
import { SubAgentManager } from './agents';
import { loadPiSDK, isPiLoaded, getPiSDK } from './pi-loader';
import { ForgeSessionManager } from './session/SessionManager';
import { WriteValidator } from './validation/WriteValidator';
import { StatusBarManager } from './StatusBarManager';
import { Notice } from 'obsidian';

export interface AgentBridgeOptions {
  vaultAdapter: VaultAdapter;
  toolRegistry: ToolRegistry;
  settings: ObsidianForgeSettings;
  subAgentManager?: SubAgentManager | null;
  statusBarManager?: StatusBarManager | null;
}

export class AgentBridge {
  private vaultAdapter: VaultAdapter;
  private toolRegistry: ToolRegistry;
  private settings: ObsidianForgeSettings;
  private subAgentManager: SubAgentManager | null;
  private statusBarManager: StatusBarManager | null;
  private sessionManager: ForgeSessionManager;
  private session: any = null;
  private initialized = false;
  private writeValidator: WriteValidator;
  private eventUnsubscribe: (() => void) | null = null;
  private sessionStartTime: number = 0;
  private totalInputTokens: number = 0;
  private totalOutputTokens: number = 0;

  constructor(options: AgentBridgeOptions) {
    this.vaultAdapter = options.vaultAdapter;
    this.toolRegistry = options.toolRegistry;
    this.settings = options.settings;
    this.subAgentManager = options.subAgentManager ?? null;
    this.statusBarManager = options.statusBarManager ?? null;
    this.sessionManager = new ForgeSessionManager(options.vaultAdapter);
    this.writeValidator = new WriteValidator(options.vaultAdapter);
  }

  /**
   * Initialize the agent bridge.
   * Must be called before createSession().
   * Loads pi SDK via dynamic import (ESM).
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Dynamic import of ESM pi packages
    await loadPiSDK();

    if (!isPiLoaded()) {
      throw new Error('pi SDK failed to load');
    }

    this.initialized = true;
    console.log('[AgentBridge] Initialized');
  }

  /**
   * Create a new agent session.
   * SESS-01: Injects startup context (NORTHSTAR, metadataCache projects, recent sessions).
   * Uses SessionManager.inMemory() per D-03 (cognitive memory is vault-backed, not pi session storage).
   */
  async createSession(): Promise<any> {
    if (!this.initialized) {
      throw new Error('AgentBridge not initialized - call initialize() first');
    }

    const sdk = getPiSDK();

    // Build startup context and load guiding documents before session creation.
    const [startupContext, forgeContent, northStarContent] = await Promise.all([
      this.sessionManager.buildStartupContext(),
      this.sessionManager.loadForgeContent(),
      this.sessionManager.loadNorthStarContent()
    ]);

    // Let pi resolve credentials through its standard env-var path.
    this.applyRuntimeApiKeyEnv();
    const model = sdk.getModel(this.settings.provider as any, this.settings.model);
    if (!model) {
      throw new Error(`Model not found: ${this.settings.provider}/${this.settings.model}`);
    }

    // Override baseUrl if custom endpoint is configured (e.g., OpenRouter proxy)
    if (this.settings.baseUrl) {
      (model as any).baseUrl = this.settings.baseUrl;
    }

    // Create session with Obsidian-native tools via customTools
    const { session } = await sdk.createAgentSession({
      cwd: this.getVaultPath(),
      agentDir: '~/.pi/forge',
      model,
      customTools: this.toolRegistry.getTools(),
      systemPrompt: this.buildSystemPrompt(startupContext, forgeContent, northStarContent),
      sessionManager: sdk.SessionManager.inMemory(), // D-03: fresh start, cognitive via vault
      settingsManager: undefined
    });

    this.session = session;
    console.log('[AgentBridge] Session created');

    // Reset token tracking for new session
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.statusBarManager?.reset();
    this.statusBarManager?.update('Idle');

    // Subscribe to session events for streaming, tool execution, session close
    this.eventUnsubscribe = this.session.subscribe((event: any) => {
      switch (event.type) {
        case 'message_update':
          // CORE-02: Streaming response - ChatPanel handles this via getSession()
          break;

        case 'tool_execution_start': {
          const toolName = event.toolName || 'unknown';
          console.log('[AgentBridge] Tool executing:', toolName);
          break;
        }

        case 'tool_execution_end': {
          const toolName = event.toolName || 'unknown';

          // VAULT-03: Non-blocking validation after vault_write
          if (toolName === 'vault_write' && event.result?.details?.path) {
            const path = event.result.details.path;
            this.writeValidator.validateNoteNonBlocking(path);
          }

          // VAULT-04 / D-07: vault_rename wikilink update detection
          // D-07: Agent handles wikilink updates after rename using get_backlinks + vault_edit
          // AgentBridge detects rename completion and logs for agent to handle next
          if (toolName === 'vault_rename' && event.result?.details) {
            const { oldPath, newPath } = event.result.details;
            // Agent will use get_backlinks + vault_edit tools to update wikilinks
            // No automatic wikilink update here - agent-managed per D-07
            console.log('[AgentBridge] vault_rename completed:', oldPath, '->', newPath, '- agent will handle wikilinks via get_backlinks + vault_edit');
          }

          break;
        }

        case 'agent_end': {
          // SESS-03: Session close - write summary to cognitive memory
          this.handleSessionClose().catch(err => {
            console.error('[AgentBridge] Session close error:', err);
          });
          break;
        }

        case 'done': {
          const usage = (event as any).message?.usage;
          if (usage) {
            this.totalInputTokens += usage.input || 0;
            this.totalOutputTokens += usage.output || 0;
            this.statusBarManager?.update('Idle', {
              input: this.totalInputTokens,
              output: this.totalOutputTokens
            });
          }
          break;
        }
      }
    });

    this.sessionStartTime = Date.now();
    console.log('[AgentBridge] Session subscribed to events');

    return session;
  }

  getSession(): any | null {
    return this.session;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getSessionManager(): ForgeSessionManager {
    return this.sessionManager;
  }

  getSubAgentManager(): SubAgentManager | null {
    return this.subAgentManager;
  }

  getTokenUsage(): { input: number; output: number; total: number } {
    return {
      input: this.totalInputTokens,
      output: this.totalOutputTokens,
      total: this.totalInputTokens + this.totalOutputTokens
    };
  }

  getModelName(): string {
    return this.settings.model;
  }

  private getVaultPath(): string {
    // Get vault root path from app
    return (this.vaultAdapter as any).app.vault.adapter.getBasePath?.() || '.';
  }

  private applyRuntimeApiKeyEnv(): void {
    if (!this.settings.apiKey) return;

    const envVarByProvider: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      google: 'GEMINI_API_KEY'
    };

    const envVar = envVarByProvider[this.settings.provider];
    if (envVar) {
      process.env[envVar] = this.settings.apiKey;
    }
  }

  private buildSystemPrompt(startupContext: string, forgeContent: string, northStarContent: string): string {
    return `You are Obsidian Forge, an AI agent embedded in Obsidian.

## Operation Manual (FORGE.md)
${forgeContent || 'See forge/FORGE.md for full manual.'}

## North Star (forge/NORTHSTAR.md)
${northStarContent || 'No NORTHSTAR.md found. Ask user to create one at forge/NORTHSTAR.md'}

## Current Session Context
${startupContext}

## Knowledge Routing Rules (ROUTE-01, ROUTE-02, ROUTE-03)

### Classification Types
When processing user input, classify it as one of:
- **decision**: A choice or conclusion made
- **event**: Something that happened
- **win**: An achievement or positive outcome (成果)
- **1:1**: Meeting notes or conversations
- **architecture**: Technical decisions or system design
- **person**: Information about a person
- **project update**: Progress or status on a project

### Zone Routing (ROUTE-03)
Route classified content to the appropriate PARA zone:
- **decision** → cognitive/decisions/
- **event** → reference/events/
- **win** → performance/
- **1:1** → work/meetings/ or org/meetings/
- **architecture** → reference/architecture/
- **person** → org/people/
- **project update** → work/projects/{project}/

### Required Frontmatter (ROUTE-04, VAULT-03, D-06)
Every note MUST include:
- date: YYYY-MM-DD
- description: ~150 characters describing the note
- tags: array of relevant tags

Notes over 300 characters MUST include at least one wikilink to another note.

## Tool Usage
- All vault operations via Obsidian-native tools: vault_read, vault_write, vault_edit
- NEVER use default bash/read/write/edit tools
- After vault_rename, use get_backlinks + vault_edit to update wikilinks in referencing files (D-07)
`;
  }

  private async handleSessionClose(): Promise<void> {
    if (!this.session || !this.sessionManager) return;

    // Calculate session duration
    const duration = Date.now() - this.sessionStartTime;
    const durationMin = Math.round(duration / 60000);

    // Extract decisions, events, wins from this session's messages
    const sessionMessages = this.session.messages || [];
    const decisions = this.extractDecisions(sessionMessages);
    const events = this.extractEvents(sessionMessages);
    const wins = this.extractWins(sessionMessages);
    const projects = this.extractProjects(sessionMessages);

    // SESS-03: Write session summary
    await this.sessionManager.appendSessionEntry({
      summary: `Session lasting ${durationMin} minutes. Extracted ${decisions.length} decisions, ${events.length} events, ${wins.length} wins.`,
      decisions,
      events,
      wins,
      projects_touched: projects
    });

    new Notice(`Session closed. ${decisions.length} decisions, ${wins.length} wins captured.`, 4000);
  }

  private extractDecisions(messages: any[]): string[] {
    const decisions: string[] = [];
    for (const msg of messages) {
      if (msg.role === 'assistant' && typeof msg.content === 'string') {
        const matches = msg.content.matchAll(/(?:classified as|routed.*)decision[:\s]+(.+)/gi);
        for (const match of matches) {
          decisions.push(match[1].trim().slice(0, 200));
        }
      }
    }
    return decisions.slice(0, 10);
  }

  private extractEvents(messages: any[]): string[] {
    const events: string[] = [];
    for (const msg of messages) {
      if (msg.role === 'assistant' && typeof msg.content === 'string') {
        const matches = msg.content.matchAll(/(?:classified as|routed.*)event[:\s]+(.+)/gi);
        for (const match of matches) {
          events.push(match[1].trim().slice(0, 200));
        }
      }
    }
    return events.slice(0, 10);
  }

  private extractWins(messages: any[]): string[] {
    const wins: string[] = [];
    for (const msg of messages) {
      if (msg.role === 'assistant' && typeof msg.content === 'string') {
        const matches = msg.content.matchAll(/(?:captured|classified as)win[:\s]+(.+)/gi);
        for (const match of matches) {
          wins.push(match[1].trim().slice(0, 200));
        }
      }
    }
    return wins.slice(0, 10);
  }

  private extractProjects(messages: any[]): string[] {
    const projects = new Set<string>();
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        const matches = msg.content.matchAll(/(?:work\/|projects\/)([\w\-]+\/)?[\w\-]+/gi);
        for (const match of matches) {
          projects.add(match[0]);
        }
      }
    }
    return Array.from(projects).slice(0, 10);
  }
}
