import { App, ItemView, WorkspaceLeaf, setIcon } from 'obsidian';
import { COMMANDS, filterCommands, CommandDefinition } from './commands';
import { ObsidianForge } from './main';
import { Message } from './pi-stub';

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
      .chat-message-content { flex: 1; background: var(--background-secondary); padding: 8px 12px; border-radius: 8px; font-size: 14px; line-height: 1.5; }
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
    const status = header.createEl('span', { cls: 'chat-status', text: 'Ready' });
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

    // CORE-02: Route command to agent for execution with streaming response
    // For Phase 1: Basic command routing - construct a command message and stream the agent's response
    const commandContent = `Execute command: ${cmd.id}. ${cmd.description}`;
    await this.streamToAgent([{
      role: 'user',
      content: commandContent
    }]);
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

    // CORE-02: Send to agent and stream response token-by-token
    // Build message history for context (include recent messages)
    const messageHistory: Message[] = this.messages.slice(-10).map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content
    }));
    // Add current message
    messageHistory.push({ role: 'user', content });

    await this.streamToAgent(messageHistory);
  }

  /**
   * Send messages to the agent and stream the response token-by-token.
   * CORE-02: Agent responses stream in real-time
   *
   * @param messages - Message history to send to the agent
   */
  private async streamToAgent(messages: Message[]): Promise<void> {
    // Create a placeholder message for streaming response
    const responseId = `response-${Date.now()}`;
    const responseMsg: ChatMessage = {
      id: responseId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true
    };
    this.addMessage(responseMsg);

    // Get the streaming message element
    const getStreamingEl = () =>
      this.messagesEl?.querySelector(`[data-msg-id="${responseId}"] .chat-message-content`);

    try {
      // CORE-02: Wire pi.ai.stream() onToken callback to appendToken()
      // The streaming can work with a basic session - no full agent loop needed
      await pi.ai.stream(messages, {
        onToken: (token: string) => {
          // Append token to streaming message content
          const msgIndex = this.messages.findIndex(m => m.id === responseId);
          if (msgIndex !== -1) {
            this.messages[msgIndex].content += token;
          }
          // Update the DOM element
          const contentEl = getStreamingEl();
          if (contentEl) {
            contentEl.textContent = this.messages[msgIndex].content;
            this.messagesEl!.scrollTop = this.messagesEl!.scrollHeight;
          }
        },
        onComplete: () => {
          // Mark streaming as complete
          const msgIndex = this.messages.findIndex(m => m.id === responseId);
          if (msgIndex !== -1) {
            this.messages[msgIndex].isStreaming = false;
          }
          const msgEl = this.messagesEl?.querySelector(`[data-msg-id="${responseId}"]`);
          msgEl?.removeClass('chat-message-streaming');
          console.log('[ChatPanel] Stream complete');
        },
        onError: (error: Error) => {
          // Show error in message
          const msgIndex = this.messages.findIndex(m => m.id === responseId);
          if (msgIndex !== -1) {
            this.messages[msgIndex].content = `Error: ${error.message}`;
            this.messages[msgIndex].isStreaming = false;
          }
          const contentEl = getStreamingEl();
          if (contentEl) {
            contentEl.setText(`Error: ${error.message}`);
          }
          console.error('[ChatPanel] Stream error:', error);
        }
      });
    } catch (error) {
      // Handle case where pi.ai is not available
      const msgIndex = this.messages.findIndex(m => m.id === responseId);
      if (msgIndex !== -1) {
        this.messages[msgIndex].content = 'Agent not available. Please configure your API key in settings.';
        this.messages[msgIndex].isStreaming = false;
      }
      const contentEl = getStreamingEl();
      if (contentEl) {
        contentEl.setText('Agent not available. Please configure your API key in settings.');
      }
      console.warn('[ChatPanel] pi.ai not available:', error);
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

    // Avatar/icon
    const avatar = msgEl.createDiv({ cls: 'chat-message-avatar' });
    if (message.role === 'user') {
      setIcon(avatar, 'user');
    } else if (message.role === 'assistant') {
      setIcon(avatar, 'bot');
    }

    // Content
    const contentEl = msgEl.createDiv({ cls: 'chat-message-content' });
    contentEl.setText(message.content);

    // Scroll to bottom
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  /**
   * Append a token to the last assistant message (for streaming).
   * Called by streamToAgent() when pi.ai.stream delivers tokens.
   * CORE-02: Streaming agent responses
   */
  appendToken(token: string): void {
    if (!this.messagesEl) return;
    const lastMsg = this.messagesEl.querySelector('.chat-message-assistant:last-child .chat-message-content');
    if (lastMsg) {
      lastMsg.setText(lastMsg.textContent + token);
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }
  }

  async onClose(): Promise<void> {
    // Cleanup if needed
  }
}
