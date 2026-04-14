import { App, Plugin, PluginManifest, TFolder, Notice } from 'obsidian';
import { VaultAdapter } from './VaultAdapter';
import { ToolRegistry } from './ToolRegistry';
import { ChatPanel, VIEW_TYPE_CHAT } from './ChatPanel';
import { ObsidianForgeSettingsTab } from './SettingsTab';
import { COMMANDS } from './commands';
import { AgentBridge } from './AgentBridge';
import { SubAgentManager } from './agents';
import { loadPiSDK } from './pi-loader';
import { executeStandupCommand } from './commands/standup';
import { executeFreeDumpCommand } from './commands/free-dump';
import { executeReviewCommand } from './commands/review';
import { executeWeeklyCommand } from './commands/weekly';
import { execute1on1Command } from './commands/1on1';
import { executeIncidentCommand } from './commands/incident';
import { executeBragCommand } from './commands/brag';
import { executeReportCommand } from './commands/report';
import { executeAuditCommand } from './commands/audit';
import { StatusBarManager } from './StatusBarManager';

// ═══════════════════════════════════════════════════════════════
// SETTINGS INTERFACE
// ═══════════════════════════════════════════════════════════════

export interface ObsidianForgeSettings {
  provider: string;
  apiKey: string;
  model: string;
  // EXT-01: Slack Bot Token
  slackToken: string;
  // EXT-02: GitHub Personal Access Token
  githubToken: string;
}

export const DEFAULT_SETTINGS: Partial<ObsidianForgeSettings> = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o',
  slackToken: '',     // EXT-01
  githubToken: ''    // EXT-02
};

// ═══════════════════════════════════════════════════════════════
// ZONE CONFIGURATION (D-08)
// ═══════════════════════════════════════════════════════════════

const FORGE_ROOT = 'forge';
const ZONES = ['work', 'org', 'performance', 'cognitive', 'reference', 'draft'];

function buildForgeMdContent(): string {
  return `---
type: forge-manual
version: 1.0
created: ${new Date().toISOString()}
---

# Obsidian Forge Manual

Welcome to Obsidian Forge! This is your personal AI-powered knowledge management system.

## Zone Structure

Your vault is organized using the PARA method:

- **work/** - Work notes, projects, and tasks
- **org/** - People, teams, and organizations
- **performance/** - Brag documents, performance reviews, achievements
- **cognitive/** - Memory, decisions, patterns, and learning
- **reference/** - Architecture docs, tech references, guides
- **draft/** - Temporary analysis and drafts
- **forge/** - Operation manual, commands, agents, sessions

## Commands

Type \`/\` in the chat panel to see available commands:

- \`/standup\` - Morning standup
- \`/free-dump\` - Free-form capture
- \`/review\` - Session review
- \`/brag\` - Record an achievement

## How It Works

Obsidian Forge embeds an AI agent that:
1. Reads and writes notes via Obsidian's Vault API
2. Maintains context across sessions
3. Routes knowledge to the correct zones
4. Validates frontmatter and wikilinks

Edit this file to customize your operation manual!
`;
}

// ═══════════════════════════════════════════════════════════════
// MAIN PLUGIN CLASS
// ═══════════════════════════════════════════════════════════════

export default class ObsidianForge extends Plugin {
  // Core components
  vaultAdapter!: VaultAdapter;
  toolRegistry!: ToolRegistry;
  settings!: ObsidianForgeSettings;

  // UI components
  chatPanel: ChatPanel | null = null;
  settingsTab: ObsidianForgeSettingsTab | null = null;

  // Agent components
  agentBridge: AgentBridge | null = null;
  subAgentManager: SubAgentManager | null = null;
  statusBarManager: StatusBarManager | null = null;

  async onload(): Promise<void> {
    try {
      console.log('[ObsidianForge] Loading plugin...');

      // 1. Load settings first (D-06)
      await this.loadSettings();
      console.log('[ObsidianForge] Step 1: settings loaded');

      // 2. Initialize VaultAdapter (foundation for everything)
      this.vaultAdapter = new VaultAdapter(this.app);
      console.log('[ObsidianForge] Step 2: VaultAdapter created');

      // 3. Initialize ToolRegistry with default tools
      this.toolRegistry = new ToolRegistry(this.vaultAdapter);
      this.toolRegistry.registerDefaultTools();
      console.log('[ObsidianForge] Step 3: tools registered');

      // 3b. Initialize SubAgentManager for spawning isolated sub-agents (SUBG-01)
      this.subAgentManager = new SubAgentManager(this.vaultAdapter, this.toolRegistry);
      console.log('[ObsidianForge] Step 3b: SubAgentManager initialized');

      // 4. Register the chat view (CORE-01)
      this.registerView(VIEW_TYPE_CHAT, (leaf) => {
        this.chatPanel = new ChatPanel(leaf, this);
        return this.chatPanel;
      });
      console.log('[ObsidianForge] Step 4: view registered');

      // 5. Register commands (CORE-03, CORE-04)
      this.registerCommands();
      console.log('[ObsidianForge] Step 5: commands registered');

      // 6. Add settings tab (INST-02)
      this.settingsTab = new ObsidianForgeSettingsTab(this.app, this);
      this.addSettingTab(this.settingsTab);
      console.log('[ObsidianForge] Step 6: settings tab added');

      // 7. Create vault structure on first enable (INST-03, OPS-01)
      await this.ensureVaultStructure();
      console.log('[ObsidianForge] Step 7: vault structure checked');

      // 8. Load FORGE.md on startup (OPS-02 - partial; full loading in Phase 2)
      await this.loadForgeInstructions();
      console.log('[ObsidianForge] Step 8: FORGE.md loaded');

      // 9. Initialize pi SDK via dynamic import
      try {
        await loadPiSDK();
        console.log('[ObsidianForge] Step 9: pi SDK loaded');
      } catch (error) {
        console.warn('[ObsidianForge] pi SDK not available:', error);
      }

      // 9b. Create status bar manager (CORE-05)
      this.statusBarManager = new StatusBarManager(this, () => this.settings);
      console.log('[ObsidianForge] Step 9b: StatusBarManager created');

      // 10. Create agent bridge and session
      this.agentBridge = new AgentBridge({
        vaultAdapter: this.vaultAdapter,
        toolRegistry: this.toolRegistry,
        settings: this.settings,
        subAgentManager: this.subAgentManager,
        statusBarManager: this.statusBarManager
      });

      try {
        await this.agentBridge.initialize();
        if (this.settings.apiKey) {
          await this.agentBridge.createSession();
          console.log('[ObsidianForge] Step 10: Agent session created');
        } else {
          console.log('[ObsidianForge] Step 10: Skipped - no API key configured');
        }
      } catch (error) {
        console.warn('[ObsidianForge] Agent session creation failed:', error);
      }

      console.log('[ObsidianForge] Plugin loaded successfully.');

      // Write success marker
      this.app.vault.create('obsidian-forge-load-ok.md', `# Obsidian Forge loaded successfully at ${new Date().toISOString()}`).catch(() => {});
    } catch (error) {
      const msg = `[ObsidianForge] LOAD ERROR: ${error}\n${error?.stack || ''}`;
      console.error(msg);
      // Write error to vault so user can see it
      this.app.vault.create(`obsidian-forge-error.txt`, `ERROR at ${new Date().toISOString()}\n${String(error)}\n${error?.stack || ''}`).catch(() => {});
    }
  }

  async onunload(): Promise<void> {
    console.log('[ObsidianForge] Unloading plugin...');

    // SESS-03: Write session summary on close
    if (this.agentBridge?.isInitialized()) {
      try {
        const sessionManager = this.agentBridge.getSessionManager();
        await sessionManager.appendSessionEntry({
          summary: 'Session ended',
          decisions: [],
          events: [],
          wins: [],
          projects_touched: []
        });
      } catch (error) {
        console.warn('[ObsidianForge] Failed to write session summary:', error);
      }
    }

    // Close chat panel if open
    if (this.chatPanel) {
      this.chatPanel = null;
    }

    // Clean up status bar manager (CORE-05)
    if (this.statusBarManager) {
      this.statusBarManager = null;
    }

    console.log('[ObsidianForge] Plugin unloaded.');
  }

  // ═══════════════════════════════════════════════════════════════
  // SETTINGS (D-06)
  // ═══════════════════════════════════════════════════════════════

  async loadSettings(): Promise<void> {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  // ═══════════════════════════════════════════════════════════════
  // VAULT STRUCTURE (D-08, INST-03, OPS-01)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Check if forge/ directory exists; if not, create all zones + FORGE.md.
   * D-08: On onload(), check for forge/ directory; if absent, create all 7 zones + FORGE.md
   * INST-03: Plugin creates vault structure on first enable
   * OPS-01: FORGE.md created on first enable
   */
  private async ensureVaultStructure(): Promise<void> {
    const { app } = this;
    const { vault } = app;

    // Check if forge/ exists
    const forgeDir = vault.getAbstractFileByPath(FORGE_ROOT);
    if (forgeDir instanceof TFolder) {
      console.log('[ObsidianForge] Vault structure already exists.');
      return;
    }

    console.log('[ObsidianForge] Creating vault structure...');

    // Create forge/ directory
    await vault.createFolder(FORGE_ROOT);

    // Create zone subdirectories
    for (const zone of ZONES) {
      await vault.createFolder(`${FORGE_ROOT}/${zone}`);
    }

    // Create forge/agents/ directory for sub-agent definitions (SUBG-02)
    await vault.createFolder(`${FORGE_ROOT}/agents`);

    // Create FORGE.md with manual content
    const forgeMdPath = `${FORGE_ROOT}/FORGE.md`;
    await vault.create(forgeMdPath, buildForgeMdContent());

    // Create NORTHSTAR.md (D-01)
    const northStarPath = `${FORGE_ROOT}/NORTHSTAR.md`;
    await vault.create(northStarPath, `# North Star

## Purpose
This document contains my guiding principles, current priorities, and what matters most right now.

## Current Focus
-

## Key Projects
-

## Values
1.
2.
3.

## Last Updated
${new Date().toISOString().split('T')[0]}
`);

    console.log('[ObsidianForge] Vault structure created.');
  }

  /**
   * Load FORGE.md content for session initialization.
   * OPS-02: Agent loads FORGE.md on startup as system instructions.
   * Full implementation in Phase 2 (Session Manager loads it).
   */
  private async loadForgeInstructions(): Promise<void> {
    try {
      const forgePath = `${FORGE_ROOT}/FORGE.md`;
      if (this.vaultAdapter.exists(forgePath)) {
        const content = await this.vaultAdapter.readNote(forgePath);
        // TODO: Phase 2 - pass to Session Manager as system instructions
        console.log('[ObsidianForge] FORGE.md loaded, content length:', content.length);
      }
    } catch (error) {
      console.warn('[ObsidianForge] Could not load FORGE.md:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // COMMANDS (D-09, CORE-03, CORE-04)
  // ═══════════════════════════════════════════════════════════════

  private registerCommands(): void {
    // Open chat command (always available)
    this.addCommand({
      id: 'open-chat',
      name: 'Open conversation',
      callback: () => {
        this.app.workspace.getLeaf(false).setViewState({
          type: VIEW_TYPE_CHAT
        });
      }
    });

    // CMND-01: /standup command
    this.addCommand({
      id: 'forge-standup',
      name: 'Forge: Morning Standup',
      description: 'Load context, review yesterday, show tasks, suggest priorities',
      callback: async () => {
        // Open chat panel first
        this.app.workspace.getLeaf(false).setViewState({
          type: VIEW_TYPE_CHAT
        });
        // Execute standup if agent is ready
        if (this.agentBridge) {
          await executeStandupCommand(this.agentBridge);
        } else {
          new Notice('Agent not initialized. Configure your API key.', 4000);
        }
      }
    });

    // CMND-02: /free-dump command
    this.addCommand({
      id: 'forge-free-dump',
      name: 'Forge: Free Dump',
      description: 'Capture non-structured text, auto-classify and route',
      callback: async () => {
        this.app.workspace.getLeaf(false).setViewState({
          type: VIEW_TYPE_CHAT
        });
        if (this.agentBridge) {
          await executeFreeDumpCommand(this.agentBridge);
        } else {
          new Notice('Agent not initialized. Configure your API key.', 4000);
        }
      }
    });

    // CMND-03: /review command
    this.addCommand({
      id: 'forge-review',
      name: 'Forge: Session Review',
      description: 'Validate notes, update indexes, discover missed wins',
      callback: async () => {
        this.app.workspace.getLeaf(false).setViewState({
          type: VIEW_TYPE_CHAT
        });
        if (this.agentBridge) {
          await executeReviewCommand(this.agentBridge);
        } else {
          new Notice('Agent not initialized. Configure your API key.', 4000);
        }
      }
    });

    // CMND-04: /weekly command
    this.addCommand({
      id: 'forge-weekly',
      name: 'Forge: Weekly Summary',
      description: 'Cross-session weekly summary with pattern discovery',
      callback: async () => {
        this.app.workspace.getLeaf(false).setViewState({ type: VIEW_TYPE_CHAT });
        if (this.agentBridge) {
          await executeWeeklyCommand(this.agentBridge);
        } else {
          new Notice('Agent not initialized. Configure your API key.', 4000);
        }
      }
    });

    // CMND-05: /1on1 command
    this.addCommand({
      id: 'forge-1on1',
      name: 'Forge: 1:1 Meeting Notes',
      description: 'Structure meeting notes into standard 1:1 format',
      callback: async () => {
        this.app.workspace.getLeaf(false).setViewState({ type: VIEW_TYPE_CHAT });
        if (this.agentBridge) {
          await execute1on1Command(this.agentBridge);
        } else {
          new Notice('Agent not initialized. Configure your API key.', 4000);
        }
      }
    });

    // CMND-06: /incident command
    this.addCommand({
      id: 'forge-incident',
      name: 'Forge: Incident Capture',
      description: 'Capture incident from Slack, reconstruct timeline',
      callback: async () => {
        this.app.workspace.getLeaf(false).setViewState({ type: VIEW_TYPE_CHAT });
        if (this.agentBridge) {
          await executeIncidentCommand(this.agentBridge);
        } else {
          new Notice('Agent not initialized. Configure your API key.', 4000);
        }
      }
    });

    // CMND-07: /brag command
    this.addCommand({
      id: 'forge-brag',
      name: 'Forge: Record Win',
      description: 'Record an achievement with evidence links to Brag Doc',
      callback: async () => {
        this.app.workspace.getLeaf(false).setViewState({ type: VIEW_TYPE_CHAT });
        if (this.agentBridge) {
          await executeBragCommand(this.agentBridge);
        } else {
          new Notice('Agent not initialized. Configure your API key.', 4000);
        }
      }
    });

    // CMND-08: /report command
    this.addCommand({
      id: 'forge-report',
      name: 'Forge: Performance Brief',
      description: 'Generate performance review brief from evidence chain',
      callback: async () => {
        this.app.workspace.getLeaf(false).setViewState({ type: VIEW_TYPE_CHAT });
        if (this.agentBridge) {
          await executeReportCommand(this.agentBridge);
        } else {
          new Notice('Agent not initialized. Configure your API key.', 4000);
        }
      }
    });

    // CMND-09: /audit command
    this.addCommand({
      id: 'forge-audit',
      name: 'Forge: Knowledge Audit',
      description: 'Check orphans, broken links, frontmatter gaps, stale content',
      callback: async () => {
        this.app.workspace.getLeaf(false).setViewState({ type: VIEW_TYPE_CHAT });
        if (this.agentBridge) {
          await executeAuditCommand(this.agentBridge);
        } else {
          new Notice('Agent not initialized. Configure your API key.', 4000);
        }
      }
    });
  }
}
