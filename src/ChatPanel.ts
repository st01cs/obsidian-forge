import { App, ItemView, WorkspaceLeaf, setIcon, requestUrl } from 'obsidian';
import { COMMANDS, filterCommands, CommandDefinition } from './commands';
import ObsidianForge from './main';
import { loadPiSDK, getPiSDK } from './pi-loader';

type ChatModel = {
  id: string;
  name: string;
  api: string;
  provider: string;
  baseUrl?: string;
  reasoning?: boolean;
  input?: string[];
  cost?: Record<string, number>;
  contextWindow?: number;
  maxTokens?: number;
  headers?: Record<string, string>;
};

export const VIEW_TYPE_CHAT = 'obsidian-forge-chat';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export class ChatPanel extends ItemView {
  private plugin: ObsidianForge;
  private messages: ChatMessage[] = [];
  private messagesEl: HTMLElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private sendButtonEl: HTMLElement | null = null;
  private commandListEl: HTMLElement | null = null;
  private isCommandMode = false;
  private filteredCommands: CommandDefinition[] = [];

  constructor(leaf: WorkspaceLeaf, plugin: ObsidianForge) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_CHAT;
  }

  getDisplayText(): string {
    return 'Obsidian Forge';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl;
    container.empty();

    // Layout structure:
    // .chat-panel
    //   .chat-header (title, status)
    //   .chat-messages (scrollable message list)
    //   .chat-commands (command dropdown, shown when / typed)
    //   .chat-input-area (textarea + send button)

    container.addClass('obsidian-forge-chat');

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      .obsidian-forge-chat { height: 100%; display: flex; flex-direction: column; }
      .chat-header { padding: 12px; border-bottom: 1px solid var(--background-secondary); display: flex; align-items: center; justify-content: space-between; }
      .chat-header h3 { margin: 0; font-size: 14px; font-weight: 600; }
      .chat-status { font-size: 11px; color: var(--text-muted); }
      .chat-messages { flex: 1; overflow-y: auto; padding: 12px; }
      .chat-message { display: flex; margin-bottom: 12px; }
      .chat-message-user { flex-direction: row-reverse; }
      .chat-message-avatar { width: 24px; height: 24px; margin-right: 8px; flex-shrink: 0; }
      .chat-message-user .chat-message-avatar { margin-right: 0; margin-left: 8px; }
      .chat-message-body { flex: 1; display: flex; flex-direction: column; }
      .chat-message-content { flex: 1; background: var(--background-secondary); padding: 8px 12px; border-radius: 8px; font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; user-select: text; -webkit-user-select: text; cursor: text; }
      .chat-message-user .chat-message-content { background: var(--interactive-accent); color: var(--text-on-accent); }
      .chat-message-streaming .chat-message-content { opacity: 0.8; }
      .chat-commands { max-height: 200px; overflow-y: auto; border: 1px solid var(--border); background: var(--background); }
      .chat-command-item { padding: 8px 12px; cursor: pointer; display: flex; flex-direction: column; }
      .chat-command-item:hover { background: var(--background-secondary); }
      .chat-command-name { font-weight: 500; font-size: 13px; }
      .chat-command-desc { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
      .chat-input-area { display: flex; padding: 12px; border-top: 1px solid var(--background-secondary); align-items: flex-end; gap: 8px; }
      .chat-input { flex: 1; resize: none; min-height: 40px; max-height: 120px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; font-family: inherit; background: var(--background-primary); color: var(--text-primary); }
      .chat-input:focus { outline: none; border-color: var(--interactive-accent); }
      .chat-send-btn { width: 36px; height: 36px; padding: 0; display: flex; align-items: center; justify-content: center; background: var(--interactive-accent); border: none; border-radius: 8px; cursor: pointer; color: var(--text-on-accent); }
      .chat-send-btn:hover { opacity: 0.9; }
    `;
    container.appendChild(style);

    this.renderHeader(container);
    this.renderMessages(container);
    this.renderCommandList(container);
    this.renderInputArea(container);

    // Welcome message
    this.addMessage({
      id: 'welcome',
      role: 'assistant',
      content: 'Welcome to Obsidian Forge! I have access to your vault and can help you manage knowledge. Type `/` to see available commands.',
      timestamp: Date.now()
    });
  }

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: 'chat-header' });
    header.createEl('h3', { text: 'Obsidian Forge' });
    header.createEl('span', { cls: 'chat-status', text: 'Ready' });
  }

  private renderMessages(container: HTMLElement): void {
    const messagesContainer = container.createDiv({ cls: 'chat-messages' });
    this.messagesEl = messagesContainer;
  }

  private renderCommandList(container: HTMLElement): void {
    const commandList = container.createDiv({ cls: 'chat-commands' });
    commandList.style.display = 'none';
    this.commandListEl = commandList;
  }

  private renderInputArea(container: HTMLElement): void {
    const inputArea = container.createDiv({ cls: 'chat-input-area' });

    const textarea = inputArea.createEl('textarea', {
      cls: 'chat-input',
      attr: { placeholder: 'Type a message or / for commands...' }
    }) as HTMLTextAreaElement;
    this.inputEl = textarea;

    // Handle input for slash command detection
    textarea.addEventListener('input', (e) => {
      const value = textarea.value;
      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = value.slice(0, cursorPos);

      // Detect slash command
      const lastSlash = textBeforeCursor.lastIndexOf('/');
      if (lastSlash !== -1 && !textBeforeCursor.slice(lastSlash).includes(' ')) {
        const query = textBeforeCursor.slice(lastSlash);
        this.filteredCommands = filterCommands(query);
        if (this.filteredCommands.length > 0) {
          this.showCommandList(this.filteredCommands);
          this.isCommandMode = true;
        } else {
          this.hideCommandList();
          this.isCommandMode = false;
        }
      } else {
        this.hideCommandList();
        this.isCommandMode = false;
      }
    });

    // Handle Enter key
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (this.isCommandMode && this.filteredCommands.length > 0) {
          // Execute selected command (first for now)
          this.executeCommand(this.filteredCommands[0]);
        } else {
          this.sendMessage();
        }
      }
    });

    // Send button
    const sendBtn = inputArea.createEl('button', { cls: 'chat-send-btn' });
    setIcon(sendBtn, 'send');
    sendBtn.addEventListener('click', () => this.sendMessage());
    this.sendButtonEl = sendBtn;
  }

  private showCommandList(commands: CommandDefinition[]): void {
    if (!this.commandListEl || !this.messagesEl) return;

    this.commandListEl.empty();
    this.commandListEl.style.display = 'block';

    for (const cmd of commands) {
      const item = this.commandListEl.createDiv({ cls: 'chat-command-item' });
      item.createEl('span', { text: `/${cmd.id}`, cls: 'chat-command-name' });
      item.createEl('span', { text: cmd.description, cls: 'chat-command-desc' });
      item.addEventListener('click', () => this.executeCommand(cmd));
    }
  }

  private hideCommandList(): void {
    if (!this.commandListEl) return;
    this.commandListEl.style.display = 'none';
  }

  private async executeCommand(cmd: CommandDefinition): Promise<void> {
    if (!this.inputEl) return;

    // Replace input with command
    this.inputEl.value = '';
    this.hideCommandList();
    this.isCommandMode = false;

    // Add user message
    this.addMessage({
      id: `cmd-${Date.now()}`,
      role: 'user',
      content: `/${cmd.id}`,
      timestamp: Date.now()
    });

    const commandContent = `Execute command: ${cmd.id}. ${cmd.description}`;
    await this.streamToAgent(commandContent);
  }

  private async sendMessage(): Promise<void> {
    if (!this.inputEl) return;
    const content = this.inputEl.value.trim();
    if (!content) return;

    this.inputEl.value = '';
    this.hideCommandList();

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now()
    };
    this.addMessage(userMsg);

    await this.streamToAgent(content);
  }

  private async streamToAgent(content: string): Promise<void> {
    const responseId = `response-${Date.now()}`;
    const responseMsg: ChatMessage = {
      id: responseId,
      role: 'assistant',
      content: 'Thinking...',
      timestamp: Date.now(),
      isStreaming: true
    };
    this.addMessage(responseMsg);

    const getStreamingEl = () =>
      this.messagesEl?.querySelector(`[data-msg-id="${responseId}"] .chat-message-content`);

    try {
      if (!this.plugin.settings.apiKey) {
        throw new Error('Please configure your API key in settings.');
      }

      if (this.plugin.settings.provider === 'anthropic') {
        const anthropicModel = this.resolveAnthropicChatModel();
        const contextMessages = this.messages
          .filter((message) => !message.isStreaming)
          .slice(-12)
          .map((message) => ({
            role: message.role,
            content: message.content,
            timestamp: message.timestamp
          }));

        const reply = await this.requestAnthropicCompatibleReply(anthropicModel, contextMessages);
        const msgIndex = this.messages.findIndex(m => m.id === responseId);
        if (msgIndex !== -1) {
          this.messages[msgIndex].content = reply;
          this.messages[msgIndex].isStreaming = false;
        }
        const contentEl = getStreamingEl();
        if (contentEl) {
          contentEl.setText(reply);
        }
        const msgEl = this.messagesEl?.querySelector(`[data-msg-id="${responseId}"]`);
        msgEl?.removeClass('chat-message-streaming');
        return;
      }

      await loadPiSDK();
      const sdk = getPiSDK();
      const model = this.resolveChatModel(sdk);

      if (this.plugin.settings.baseUrl) {
        (model as any).baseUrl = this.plugin.settings.baseUrl;
      }

      const context = {
        messages: this.messages
          .filter((message) => !message.isStreaming)
          .slice(-12)
          .map((message) => ({
            role: message.role,
            content: message.content,
            timestamp: message.timestamp
          }))
      };

      let finalText = '';
      const stream = sdk.pi.streamSimple(model, context as any, {
        apiKey: this.plugin.settings.apiKey
      });

      for await (const event of stream as any) {
        if (event.type === 'text_delta') {
          finalText += event.delta;
          const msgIndex = this.messages.findIndex(m => m.id === responseId);
          if (msgIndex !== -1) {
            this.messages[msgIndex].content = finalText;
          }
          const contentEl = getStreamingEl();
          if (contentEl) {
            contentEl.setText(finalText);
            this.messagesEl!.scrollTop = this.messagesEl!.scrollHeight;
          }
        } else if (event.type === 'error') {
          throw new Error(event.error?.errorMessage || 'Unknown stream error');
        }
      }

      const reply = finalText.trim() || 'No response received.';
      const msgIndex = this.messages.findIndex(m => m.id === responseId);
      if (msgIndex !== -1) {
        this.messages[msgIndex].content = reply;
        this.messages[msgIndex].isStreaming = false;
      }

      const contentEl = getStreamingEl();
      if (contentEl) {
        contentEl.setText(reply);
      }

      const msgEl = this.messagesEl?.querySelector(`[data-msg-id="${responseId}"]`);
      msgEl?.removeClass('chat-message-streaming');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const msgIndex = this.messages.findIndex(m => m.id === responseId);
      if (msgIndex !== -1) {
        this.messages[msgIndex].content = `Error: ${message}`;
        this.messages[msgIndex].isStreaming = false;
      }
      const contentEl = getStreamingEl();
      if (contentEl) {
        contentEl.setText(`Error: ${message}`);
      }
      const msgEl = this.messagesEl?.querySelector(`[data-msg-id="${responseId}"]`);
      msgEl?.removeClass('chat-message-streaming');
    }
  }

  private resolveChatModel(sdk: ReturnType<typeof getPiSDK>): ChatModel {
    const provider = this.plugin.settings.provider;
    const modelId = this.plugin.settings.model;
    const builtInModel = sdk.getModel(provider as any, modelId) as ChatModel | undefined;
    if (builtInModel) {
      return builtInModel;
    }

    if (provider === 'openai') {
      return {
        id: modelId,
        name: modelId,
        api: 'openai-responses',
        provider,
        baseUrl: this.plugin.settings.baseUrl || 'https://api.openai.com/v1',
        reasoning: true,
        input: ['text', 'image'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 16384
      };
    }

    if (provider === 'google') {
      return {
        id: modelId,
        name: modelId,
        api: 'google',
        provider,
        baseUrl: this.plugin.settings.baseUrl,
        reasoning: true,
        input: ['text', 'image'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 1000000,
        maxTokens: 65536
      };
    }

    throw new Error(`Model not found: ${provider}/${modelId}`);
  }

  private resolveAnthropicChatModel(): ChatModel {
    return {
      id: this.plugin.settings.model,
      name: this.plugin.settings.model,
      api: 'anthropic-messages',
      provider: 'anthropic',
      baseUrl: this.plugin.settings.baseUrl || 'https://api.anthropic.com',
      reasoning: true,
      input: ['text', 'image'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200000,
      maxTokens: 64000
    };
  }

  private async requestAnthropicCompatibleReply(
    model: ChatModel,
    messages: Array<{ role: string; content: string; timestamp: number }>
  ): Promise<string> {
    const endpointBase = (model.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
    const url = endpointBase.endsWith('/v1/messages') ? endpointBase : `${endpointBase}/v1/messages`;

    let response;
    try {
      response = await requestUrl({
        url,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.plugin.settings.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model.id,
          max_tokens: Math.min(model.maxTokens || 4096, 4096),
          messages: messages.map((message) => ({
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: message.content
          }))
        })
      });
    } catch (error) {
      const details = this.extractRequestErrorDetails(error);
      throw new Error(`Anthropic-compatible request failed (${details.statusText}) at ${url}${details.message ? `: ${details.message}` : ''}`);
    }

    const payload = typeof response.json === 'object' && response.json !== null
      ? response.json
      : JSON.parse(response.text);
    if (response.status < 200 || response.status >= 300) {
      const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
      throw new Error(message);
    }

    const text = Array.isArray(payload?.content)
      ? payload.content
          .filter((item: any) => item?.type === 'text' && typeof item?.text === 'string')
          .map((item: any) => item.text)
          .join('\n')
      : '';

    return text.trim() || 'No response received.';
  }

  private extractRequestErrorDetails(error: unknown): { statusText: string; message: string } {
    const requestError = error as {
      status?: number;
      message?: string;
      response?: { status?: number; text?: string; json?: unknown };
    };

    const status = requestError.response?.status ?? requestError.status;
    const responseText = typeof requestError.response?.text === 'string' ? requestError.response.text : '';
    const payload = this.tryParseJson(responseText);
    const message = payload?.error?.message
      || payload?.message
      || responseText
      || requestError.message
      || String(error);

    return {
      statusText: status ? `HTTP ${status}` : 'request error',
      message: message.slice(0, 500)
    };
  }

  private tryParseJson(text: string): any | null {
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  private addMessage(message: ChatMessage): void {
    if (!this.messagesEl) return;

    this.messages.push(message);

    const msgEl = this.messagesEl.createDiv({
      cls: `chat-message chat-message-${message.role}`,
      attr: { 'data-msg-id': message.id }
    });

    if (message.isStreaming) {
      msgEl.addClass('chat-message-streaming');
    }

    const avatar = msgEl.createDiv({ cls: 'chat-message-avatar' });
    if (message.role === 'user') {
      setIcon(avatar, 'user');
    } else if (message.role === 'assistant') {
      setIcon(avatar, 'bot');
    }

    const bodyEl = msgEl.createDiv({ cls: 'chat-message-body' });

    const contentEl = bodyEl.createDiv({ cls: 'chat-message-content' });
    contentEl.setText(message.content);

    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  async onClose(): Promise<void> {
  }
}
