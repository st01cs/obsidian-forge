import { App, Plugin, PluginManifest, TFolder } from 'obsidian';
import { VaultAdapter } from './VaultAdapter';
import { ToolRegistry } from './ToolRegistry';
import { ChatPanel, VIEW_TYPE_CHAT } from './ChatPanel';
import { ObsidianForgeSettingsTab } from './SettingsTab';
import { COMMANDS } from './commands';

// ═══════════════════════════════════════════════════════════════
// SETTINGS INTERFACE
// ═══════════════════════════════════════════════════════════════

export interface ObsidianForgeSettings {
  provider: string;
  apiKey: string;
  model: string;
}

export const DEFAULT_SETTINGS: Partial<ObsidianForgeSettings> = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o'
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

    // Close chat panel if open
    if (this.chatPanel) {
      this.chatPanel = null;
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

    // Create FORGE.md with manual content
    const forgeMdPath = `${FORGE_ROOT}/FORGE.md`;
    await vault.create(forgeMdPath, buildForgeMdContent());

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

    // Command palette entries for each command (CORE-04)
    // Phase 1: These are registered but have no implementation yet
    for (const cmd of COMMANDS) {
      if (cmd.id === 'open-chat') continue; // Already registered above

      this.addCommand({
        id: `forge-${cmd.id}`,
        name: `Forge: ${cmd.name}`,
        description: cmd.description,
        callback: () => {
          // Open chat panel first
          this.app.workspace.getLeaf(false).setViewState({
            type: VIEW_TYPE_CHAT
          });
          // TODO: Phase 2 - trigger command execution
          console.log(`[ObsidianForge] Command /${cmd.id} invoked (Phase 2 implementation)`);
        }
      });
    }
  }
}
