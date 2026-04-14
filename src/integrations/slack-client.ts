import { App } from 'obsidian';
import { ApiClient, createSlackClient } from './api-client';

export interface SlackMessage {
  type: string;
  text: string;
  user: string;
  ts: string;
  channel: string;
  thread_ts?: string;
  reply_count?: number;
}

export interface SlackUser {
  id: string;
  name: string;
  real_name: string;
  email?: string;
  profile?: {
    image_24?: string;
    image_32?: string;
    title?: string;
  };
}

export interface SlackSearchResult {
  ok: boolean;
  messages?: {
    matches: SlackMessage[];
    total: number;
  };
  error?: string;
}

/**
 * SlackClient - Slack Web API via app.requestUrl() (EXT-01).
 * Uses Bot Token (xoxb-) stored in plugin settings.
 * All methods are async and work on both Desktop and Mobile (MOBI-03).
 */
export class SlackClient {
  private apiClient: ApiClient;

  constructor(app: App, token: string) {
    this.apiClient = createSlackClient(app, token);
  }

  /**
   * Search messages (EXT-01).
   * GET https://slack.com/api/search.messages
   */
  async searchMessages(query: string, limit = 20): Promise<SlackSearchResult> {
    const result = await this.apiClient.get(
      `https://slack.com/api/search.messages?query=${encodeURIComponent(query)}&count=${limit}`
    );

    if (result.status !== 200) {
      return { ok: false, error: `HTTP ${result.status}` };
    }

    try {
      return JSON.parse(result.body);
    } catch {
      return { ok: false, error: 'Invalid JSON response' };
    }
  }

  /**
   * Get user profile by user ID (EXT-01).
   * GET https://slack.com/api/users.info
   */
  async getUserProfile(userId: string): Promise<{ ok: boolean; user?: SlackUser; error?: string }> {
    const result = await this.apiClient.get(
      `https://slack.com/api/users.info?user=${encodeURIComponent(userId)}`
    );

    if (result.status !== 200) {
      return { ok: false, error: `HTTP ${result.status}` };
    }

    try {
      return JSON.parse(result.body);
    } catch {
      return { ok: false, error: 'Invalid JSON response' };
    }
  }

  /**
   * Get channel messages (EXT-01).
   * GET https://slack.com/api/conversations.history
   */
  async getChannelMessages(channelId: string, limit = 100): Promise<{ ok: boolean; messages?: SlackMessage[]; error?: string }> {
    const result = await this.apiClient.get(
      `https://slack.com/api/conversations.history?channel=${encodeURIComponent(channelId)}&limit=${limit}`
    );

    if (result.status !== 200) {
      return { ok: false, error: `HTTP ${result.status}` };
    }

    try {
      return JSON.parse(result.body);
    } catch {
      return { ok: false, error: 'Invalid JSON response' };
    }
  }

  /**
   * Get thread messages (EXT-01).
   * GET https://slack.com/api/conversations.replies
   */
  async getThreadMessages(channelId: string, threadTs: string, limit = 100): Promise<{ ok: boolean; messages?: SlackMessage[]; error?: string }> {
    const result = await this.apiClient.get(
      `https://slack.com/api/conversations.replies?channel=${encodeURIComponent(channelId)}&ts=${threadTs}&limit=${limit}`
    );

    if (result.status !== 200) {
      return { ok: false, error: `HTTP ${result.status}` };
    }

    try {
      return JSON.parse(result.body);
    } catch {
      return { ok: false, error: 'Invalid JSON response' };
    }
  }
}
