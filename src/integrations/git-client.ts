import { IS_MOBILE } from '../mobile';

export interface GitLogOptions {
  limit?: number;
  format?: string;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitDiff {
  hash: string;
  stats: { filesChanged: number; insertions: number; deletions: number };
  message: string;
  author: string;
  date: string;
  files?: { filename: string; additions: number; deletions: number; patch?: string }[];
}

/**
 * GitClient - Git operations via child_process.exec (EXT-03).
 * EXT-03: Desktop-only - do NOT call on mobile.
 * Use IS_MOBILE check before instantiating.
 */
export class GitClient {
  private cwd: string;

  constructor(repoPath: string = '.') {
    if (IS_MOBILE) {
      throw new Error('GitClient is Desktop-only. Check IS_MOBILE before using.');
    }
    this.cwd = repoPath;
  }

  /**
   * Get git log (EXT-03).
   */
  async log(options: GitLogOptions = {}): Promise<GitCommit[]> {
    const limit = options.limit ?? 30;
    const format = options.format ?? '--format=%H|%h|%s|%an|%ai';

    const output = await this.exec(`git log ${format} -n ${limit}`);
    const lines = output.split('\n').filter(Boolean);

    return lines.map(line => {
      const [hash, shortHash, message, author, date] = line.split('|');
      return { hash, shortHash, message, author, date };
    });
  }

  /**
   * Get diff for a specific commit (EXT-03).
   */
  async diff(commitHash: string): Promise<GitDiff> {
    // Get commit info
    const infoOutput = await this.exec(
      `git show ${commitHash} --format="%H|%s|%an|%ai" --no-patch`
    );
    const [hash, message, author, date] = infoOutput.trim().split('|');

    // Get file stats
    const statsOutput = await this.exec(
      `git show ${commitHash} --stat --format=""`
    );

    const statsLines = statsOutput.split('\n').filter(Boolean);
    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;

    for (const line of statsLines) {
      if (line.includes('|')) {
        filesChanged++;
        const match = line.match(/\+(\d+)/);
        if (match) insertions += parseInt(match[1], 10);
        const delMatch = line.match(/-(\d+)/);
        if (delMatch) deletions += parseInt(delMatch[1], 10);
      }
    }

    return {
      hash,
      stats: { filesChanged, insertions, deletions },
      message,
      author,
      date
    };
  }

  /**
   * Get list of changed files in a commit (EXT-03).
   */
  async changedFiles(commitHash: string): Promise<string[]> {
    const output = await this.exec(`git diff-tree --no-commit-id --name-only -r ${commitHash}`);
    return output.split('\n').filter(Boolean);
  }

  /**
   * Get the diff patch for a specific file in a commit (EXT-03).
   */
  async fileDiff(commitHash: string, filename: string): Promise<string | null> {
    const output = await this.exec(`git show ${commitHash} --format="" -p -- "${filename}"`);
    return output || null;
  }

  /**
   * Check if git repo exists at cwd.
   */
  async isRepo(): Promise<boolean> {
    try {
      await this.exec('git rev-parse --git-dir');
      return true;
    } catch {
      return false;
    }
  }

  private exec(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (IS_MOBILE) {
        reject(new Error('GitClient is Desktop-only'));
        return;
      }

      const { exec } = require('child_process');
      exec(command, { cwd: this.cwd, maxBuffer: 10 * 1024 * 1024 }, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          reject(new Error(`${error.message}\n${stderr}`));
        } else {
          resolve(stdout);
        }
      });
    });
  }
}
