import { App, PluginSettingTab, Setting, DropdownComponent, TextComponent } from 'obsidian';
import { ObsidianForge, ObsidianForgeSettings, DEFAULT_SETTINGS } from './main';

export class ObsidianForgeSettingsTab extends PluginSettingTab {
  private plugin: ObsidianForge;

  constructor(app: App, plugin: ObsidianForge) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Header
    containerEl.createEl('h2', { text: 'Obsidian Forge Settings' });
    containerEl.createEl('p', {
      text: 'Configure your AI agent settings. Changes are saved automatically.',
      cls: 'settings-description'
    });

    // Provider selection
    new Setting(containerEl)
      .setName('AI Provider')
      .setDesc('Select your LLM provider')
      .addDropdown((dropdown: DropdownComponent) => {
        dropdown
          .addOption('openai', 'OpenAI')
          .addOption('anthropic', 'Anthropic')
          .addOption('google', 'Google AI')
          .setValue(this.plugin.settings.provider)
          .onChange(async (value: string) => {
            this.plugin.settings.provider = value;
            await this.plugin.saveSettings();
          });
      });

    // API Key
    new Setting(containerEl)
      .setName('API Key')
      .setDesc('Your API key for the selected provider. Stored in vault config.')
      .addTextField((textField: TextComponent) => {
        textField
          .setPlaceholder('sk-...')
          .setAttr('type', 'password') // D-06: Mask input
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value: string) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          });
      });

    // Model selection
    new Setting(containerEl)
      .setName('Model')
      .setDesc('Model to use (varies by provider)')
      .addTextField((textField: TextComponent) => {
        textField
          .setPlaceholder('gpt-4o, claude-3-5-sonnet-20241022, gemini-2.0-flash')
          .setValue(this.plugin.settings.model)
          .onChange(async (value: string) => {
            this.plugin.settings.model = value;
            await this.plugin.saveSettings();
          });
      });

    // Divider for integrations
    containerEl.createEl('hr');

    // Integration settings header
    containerEl.createEl('h3', { text: 'Integrations' });

    // EXT-01: Slack Bot Token
    new Setting(containerEl)
      .setName('Slack Bot Token')
      .setDesc('Bot token (xoxb-) for Slack integration (EXT-01)')
      .addTextField((textField: TextComponent) => {
        textField
          .setPlaceholder('xoxb-...')
          .setAttr('type', 'password')
          .setValue(this.plugin.settings.slackToken)
          .onChange(async (value: string) => {
            this.plugin.settings.slackToken = value;
            await this.plugin.saveSettings();
          });
      });

    // EXT-02: GitHub Personal Access Token
    new Setting(containerEl)
      .setName('GitHub Personal Access Token')
      .setDesc('PAT for GitHub integration (EXT-02)')
      .addTextField((textField: TextComponent) => {
        textField
          .setPlaceholder('ghp_...')
          .setAttr('type', 'password')
          .setValue(this.plugin.settings.githubToken)
          .onChange(async (value: string) => {
            this.plugin.settings.githubToken = value;
            await this.plugin.saveSettings();
          });
      });

    // Divider
    containerEl.createEl('hr');

    // Info section
    containerEl.createEl('h3', { text: 'About' });
    containerEl.createEl('p', {
      text: 'Obsidian Forge embeds an AI agent in your vault with persistent memory across sessions.',
      cls: 'settings-description'
    });
  }
}
