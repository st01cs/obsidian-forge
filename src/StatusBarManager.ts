/**
 * StatusBarManager - Manages the Obsidian status bar indicator for Obsidian Forge.
 *
 * Displays model name, session state, and cumulative token usage in real-time.
 * CORE-05: Status bar indicator showing model, session state, and token usage.
 */

import { Plugin } from 'obsidian';
import { ObsidianForgeSettings } from './main';

type SessionState = 'Idle' | 'Streaming' | 'Thinking' | 'Error';

interface TokenUsage {
  input: number;
  output: number;
}

interface StatusBarState {
  model: string;
  state: SessionState;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Manages the plugin's status bar item.
 * Shows: "Forge: {model} | {tokens} | {state}"
 * Total text kept under 40 characters for mobile compatibility.
 */
export class StatusBarManager {
  private statusBarEl: HTMLElement;
  private getSettings: () => ObsidianForgeSettings;
  private state: StatusBarState;
  private lastUpdateTime: number = 0;
  private readonly THROTTLE_MS: number = 500;

  constructor(plugin: Plugin, getSettings: () => ObsidianForgeSettings) {
    this.getSettings = getSettings;
    this.state = {
      model: getSettings().model || 'gpt-4o',
      state: 'Idle',
      inputTokens: 0,
      outputTokens: 0
    };

    // Create status bar element via Obsidian API
    this.statusBarEl = plugin.addStatusBarItem();
    this.statusBarEl.addClass('mod-minimal');

    // Render initial "Ready" state
    this.render();
  }

  /**
   * Update status bar state.
   * @param state - Current session state
   * @param tokens - Optional token counts to accumulate
   */
  update(state: SessionState, tokens?: TokenUsage): void {
    // Update state
    this.state.state = state;

    // Accumulate tokens if provided
    if (tokens) {
      this.state.inputTokens += tokens.input;
      this.state.outputTokens += tokens.output;
    }

    // Throttle DOM updates to avoid performance issues during streaming
    const now = Date.now();
    if (now - this.lastUpdateTime >= this.THROTTLE_MS) {
      this.render();
      this.lastUpdateTime = now;
    }
  }

  /**
   * Reset token counts to zero.
   * Called when creating a new session.
   */
  reset(): void {
    this.state.inputTokens = 0;
    this.state.outputTokens = 0;
    this.render();
  }

  /**
   * Format token count for display.
   * Shows X.XK format for >= 1000 tokens.
   */
  private formatTokens(total: number): string {
    if (total >= 1000) {
      return `${(total / 1000).toFixed(1)}K`;
    }
    return `${total}`;
  }

  /**
   * Render the status bar text.
   * Format: "Forge: {model} | {tokens} | {state}"
   * Kept under 40 characters for mobile compatibility.
   */
  private render(): void {
    const total = this.state.inputTokens + this.state.outputTokens;
    const tokenStr = this.formatTokens(total);
    const stateStr = this.state.state;

    // Format: "Forge: gpt-4o | 1.2K | Idle" (~28 chars)
    // Keep model name short - use settings model
    const model = this.getSettings().model || 'gpt-4o';
    const text = `Forge: ${model} | ${tokenStr} | ${stateStr}`;

    // Truncate if still too long (model names shouldn't be > 12 chars)
    this.statusBarEl.textContent = text.length > 40
      ? text.substring(0, 37) + '...'
      : text;
  }

  /**
   * Get the current model name from settings.
   */
  getModelName(): string {
    return this.getSettings().model || 'gpt-4o';
  }

  /**
   * Get cumulative token usage.
   */
  getTokenUsage(): { input: number; output: number; total: number } {
    const total = this.state.inputTokens + this.state.outputTokens;
    return {
      input: this.state.inputTokens,
      output: this.state.outputTokens,
      total
    };
  }
}
