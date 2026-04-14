import { App, requestUrl, RequestUrlParam } from 'obsidian';

export interface ApiClientOptions {
  baseUrl?: string;
  headers?: Record<string, string>;
}

/**
 * ApiClient - HTTP client wrapper using Obsidian's app.requestUrl().
 * EXT-01/02/03, MOBI-03: Works on both Desktop and Mobile - no CORS issues.
 *
 * SECURITY: Auth headers are added server-side by this client.
 * The agent NEVER sees raw tokens - they are injected into requests here.
 */
export class ApiClient {
  private app: App;
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(app: App, options: ApiClientOptions = {}) {
    this.app = app;
    this.baseUrl = options.baseUrl ?? '';
    this.defaultHeaders = options.headers ?? {};
  }

  /**
   * Generic HTTP request via app.requestUrl().
   * Works on both Desktop and Mobile - no CORS issues (EXT-01, EXT-02, MOBI-03).
   */
  async request(options: {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: string;
  }): Promise<{ status: number; body: string; headers: Record<string, string> }> {
    const url = options.url.startsWith('http')
      ? options.url
      : `${this.baseUrl}${options.url}`;

    const headers = {
      ...this.defaultHeaders,
      ...options.headers
    };

    const params: RequestUrlParam = {
      url,
      method: options.method ?? 'GET',
      headers
    };

    if (options.body && (options.method === 'POST' || options.method === 'PUT' || options.method === 'PATCH')) {
      params.body = options.body;
    }

    try {
      const response = await requestUrl(params);
      return {
        status: response.status,
        body: typeof response.json === 'function' ? JSON.stringify(response.json()) : response.text,
        headers: response.headers as Record<string, string>
      };
    } catch (error) {
      throw new Error(`ApiClient request failed: ${error}`);
    }
  }

  /**
   * GET request shorthand.
   */
  async get(url: string, headers?: Record<string, string>): Promise<{ status: number; body: string }> {
    const result = await this.request({ url, method: 'GET', headers });
    return { status: result.status, body: result.body };
  }

  /**
   * POST request shorthand.
   */
  async post(url: string, body: string, headers?: Record<string, string>): Promise<{ status: number; body: string }> {
    const result = await this.request({ url, method: 'POST', body, headers });
    return { status: result.status, body: result.body };
  }
}

/**
 * Create an authenticated ApiClient for Slack.
 * SECURITY: Token added server-side, never exposed to agent.
 */
export function createSlackClient(app: App, token: string): ApiClient {
  return new ApiClient(app, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Create an authenticated ApiClient for GitHub.
 * SECURITY: Token added server-side, never exposed to agent.
 */
export function createGitHubClient(app: App, token: string): ApiClient {
  return new ApiClient(app, {
    baseUrl: 'https://api.github.com',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
}
