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
import { loadPiSDK, isPiLoaded, getPiSDK } from './pi-loader';
import { ForgeSessionManager } from './session/SessionManager';

export interface AgentBridgeOptions {
  vaultAdapter: VaultAdapter;
  toolRegistry: ToolRegistry;
  settings: ObsidianForgeSettings;
}

export class AgentBridge {
  private vaultAdapter: VaultAdapter;
  private toolRegistry: ToolRegistry;
  private settings: ObsidianForgeSettings;
  private sessionManager: ForgeSessionManager;
  private session: any = null;
  private initialized = false;

  constructor(options: AgentBridgeOptions) {
    this.vaultAdapter = options.vaultAdapter;
    this.toolRegistry = options.toolRegistry;
    this.settings = options.settings;
    this.sessionManager = new ForgeSessionManager(options.vaultAdapter);
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

    // Build startup context (SESS-01): NORTHSTAR + metadataCache + recent sessions
    const startupContext = await this.sessionManager.buildStartupContext();

    // Configure resource loader with system prompt override
    // This injects FORGE.md + NORTHSTAR.md + startupContext into every session
    const resourceLoader = new sdk.DefaultResourceLoader({
      cwd: this.getVaultPath(),
      agentDir: '~/.pi/forge',
      systemPromptOverride: () => this.buildSystemPrompt(startupContext)
    });
    await resourceLoader.reload();

    // Set up auth and model
    const authStorage = sdk.AuthStorage.create();
    const modelRegistry = sdk.ModelRegistry.create(authStorage);
    const model = sdk.getModel(this.settings.provider as any, this.settings.model);

    // Create session with Obsidian-native tools via customTools
    const { session } = await sdk.createAgentSession({
      cwd: this.getVaultPath(),
      agentDir: '~/.pi/forge',
      model,
      authStorage,
      modelRegistry,
      customTools: this.toolRegistry.getTools(),
      resourceLoader,
      sessionManager: sdk.SessionManager.inMemory(), // D-03: fresh start, cognitive via vault
      settingsManager: undefined
    });

    this.session = session;
    console.log('[AgentBridge] Session created');

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

  private getVaultPath(): string {
    // Get vault root path from app
    return (this.vaultAdapter as any).app.vault.adapter.getBasePath?.() || '.';
  }

  private buildSystemPrompt(startupContext: string): string {
    // Load FORGE.md and NORTHSTAR.md at startup
    const forgePath = 'forge/FORGE.md';
    const northStarPath = 'forge/NORTHSTAR.md';

    let forgeContent = '';
    let northStarContent = '';

    try {
      if (this.vaultAdapter.exists(forgePath)) {
        forgeContent = this.vaultAdapter.readNote ? 'See FORGE.md for operation manual.' : '';
      }
      if (this.vaultAdapter.exists(northStarPath)) {
        northStarContent = this.vaultAdapter.readNote ? 'See NORTHSTAR.md for guiding document.' : '';
      }
    } catch (e) {
      console.warn('[AgentBridge] Could not load FORGE/NORTHSTAR:', e);
    }

    return `You are Obsidian Forge, an AI agent embedded in Obsidian.

## Operation Manual (FORGE.md)
${forgeContent || 'See forge/FORGE.md for full manual.'}

## North Star (forge/NORTHSTAR.md)
${northStarContent || 'No NORTHSTAR.md found. Ask user to create one at forge/NORTHSTAR.md'}

## Current Session Context
${startupContext}

## Key Rules
- All vault operations MUST use Obsidian-native tools (vault_read, vault_write, vault_edit)
- NEVER use default bash/read/write/edit tools
- Route knowledge to correct PARA zones based on content type
- Required frontmatter on all notes: date, description (~150 chars), tags
- Notes over 300 chars MUST include at least one wikilink
- After vault_rename, update wikilinks in all referencing files using get_backlinks + vault_edit
- Classification types: decision, event, win, 1:1, architecture, person, project update
- Zone routing: decision→cognitive/decisions/, event→reference/events/, win→performance/, 1:1→work/meetings/, architecture→reference/architecture/, person→org/people/, project update→work/projects/
`;
  }
}
