import { App } from 'obsidian';
import { ApiClient, createGitHubClient } from './api-client';

export interface GitHubPR {
  number: number;
  title: string;
  state: string;
  body: string;
  user: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  draft: boolean;
  url: string;
  html_url: string;
}

export interface GitHubComment {
  id: number;
  body: string;
  user: { login: string };
  created_at: string;
  updated_at: string;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: { name: string; email: string; date: string };
  url: string;
}

export interface GitHubFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

/**
 * GitHubClient - GitHub REST API via app.requestUrl() (EXT-02).
 * Uses Personal Access Token (PAT) stored in plugin settings.
 * All methods work on both Desktop and Mobile (MOBI-03).
 */
export class GitHubClient {
  private apiClient: ApiClient;

  constructor(app: App, token: string) {
    this.apiClient = createGitHubClient(app, token);
  }

  /**
   * Get a pull request (EXT-02).
   * GET https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}
   */
  async getPR(owner: string, repo: string, prNumber: number): Promise<GitHubPR | null> {
    const result = await this.apiClient.get(`/repos/${owner}/${repo}/pulls/${prNumber}`);

    if (result.status !== 200) {
      console.error(`[GitHubClient] getPR failed: HTTP ${result.status}`);
      return null;
    }

    try {
      return JSON.parse(result.body);
    } catch {
      return null;
    }
  }

  /**
   * Get PR review comments (EXT-02).
   * GET https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/comments
   */
  async getPRComments(owner: string, repo: string, prNumber: number): Promise<GitHubComment[]> {
    const result = await this.apiClient.get(`/repos/${owner}/${repo}/pulls/${prNumber}/comments`);

    if (result.status !== 200) {
      console.error(`[GitHubClient] getPRComments failed: HTTP ${result.status}`);
      return [];
    }

    try {
      return JSON.parse(result.body);
    } catch {
      return [];
    }
  }

  /**
   * Get recent commits (EXT-02).
   * GET https://api.github.com/repos/{owner}/{repo}/commits
   */
  async getCommits(owner: string, repo: string, limit = 30): Promise<GitHubCommit[]> {
    const result = await this.apiClient.get(`/repos/${owner}/${repo}/commits?per_page=${limit}`);

    if (result.status !== 200) {
      console.error(`[GitHubClient] getCommits failed: HTTP ${result.status}`);
      return [];
    }

    try {
      return JSON.parse(result.body);
    } catch {
      return [];
    }
  }

  /**
   * Get a specific commit with diff (EXT-02).
   * GET https://api.github.com/repos/{owner}/{repo}/commits/{sha}
   */
  async getCommit(owner: string, repo: string, sha: string): Promise<{ commit: GitHubCommit; files?: GitHubFile[] } | null> {
    const result = await this.apiClient.get(`/repos/${owner}/${repo}/commits/${sha}`);

    if (result.status !== 200) {
      console.error(`[GitHubClient] getCommit failed: HTTP ${result.status}`);
      return null;
    }

    try {
      return JSON.parse(result.body);
    } catch {
      return null;
    }
  }

  /**
   * Get changed files in a PR (EXT-02).
   * GET https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/files
   */
  async getPRFiles(owner: string, repo: string, prNumber: number): Promise<GitHubFile[]> {
    const result = await this.apiClient.get(`/repos/${owner}/${repo}/pulls/${prNumber}/files`);

    if (result.status !== 200) {
      console.error(`[GitHubClient] getPRFiles failed: HTTP ${result.status}`);
      return [];
    }

    try {
      return JSON.parse(result.body);
    } catch {
      return [];
    }
  }
}
