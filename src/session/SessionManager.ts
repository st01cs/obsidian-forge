/**
 * ForgeSessionManager - handles cognitive memory persistence via session journal approach.
 *
 * D-02: Session context injection uses metadataCache-first loading to avoid token overflow.
 * D-03: Cognitive memory uses note-based session journal approach (not JSONL summaries).
 *
 * Session journal format:
 * - forge/cognitive/sessions/YYYY-MM-DD.md - one file per day
 * - Frontmatter: date, type: session, summary, decisions[], events[], wins[], projects_touched[]
 * - Agent appends entries under ## Session headings within the day
 */

import { VaultAdapter } from '../VaultAdapter';

export interface SessionEntry {
  date: string;           // YYYY-MM-DD
  type: 'session';
  summary: string;
  decisions: string[];
  events: string[];
  wins: string[];
  projects_touched: string[];
}

export class ForgeSessionManager {
  private vaultAdapter: VaultAdapter;
  private forgeContent: string | null = null;
  private northStarContent: string | null = null;

  constructor(vaultAdapter: VaultAdapter) {
    this.vaultAdapter = vaultAdapter;
  }

  /**
   * Load FORGE.md content for system prompt.
   * Cached after first load.
   */
  async loadForgeContent(): Promise<string> {
    if (this.forgeContent !== null) return this.forgeContent;
    try {
      if (this.vaultAdapter.exists('forge/FORGE.md')) {
        this.forgeContent = await this.vaultAdapter.readNote('forge/FORGE.md');
      } else {
        this.forgeContent = '';
      }
    } catch {
      this.forgeContent = '';
    }
    return this.forgeContent;
  }

  /**
   * Load NORTHSTAR.md content for system prompt.
   * Returns empty string if file doesn't exist.
   */
  async loadNorthStarContent(): Promise<string> {
    if (this.northStarContent !== null) return this.northStarContent;
    try {
      if (this.vaultAdapter.exists('forge/NORTHSTAR.md')) {
        this.northStarContent = await this.vaultAdapter.readNote('forge/NORTHSTAR.md');
      } else {
        this.northStarContent = '';
      }
    } catch {
      this.northStarContent = '';
    }
    return this.northStarContent;
  }

  /**
   * Build startup context string for session initialization (SESS-01).
   * Uses metadataCache-first approach for token budget.
   * D-01: Context includes NORTHSTAR, active projects, tasks, recent sessions.
   */
  async buildStartupContext(): Promise<string> {
    const parts: string[] = [];

    // 1. Yesterday's session note (for continuity)
    const yesterday = this.getYesterdayDate();
    const yesterdayPath = `forge/cognitive/sessions/${yesterday}.md`;
    if (this.vaultAdapter.exists(yesterdayPath)) {
      try {
        const content = await this.vaultAdapter.readNote(yesterdayPath);
        parts.push(`## Yesterday's Session\n${this.truncate(content, 2000)}`);
      } catch { /* ignore */ }
    }

    // 2. Active projects from metadataCache (fast, no content loading)
    // D-01: work/ folder + project:true frontmatter
    const activeProjects = this.detectActiveProjects();
    if (activeProjects.length > 0) {
      parts.push(`## Active Projects\n${activeProjects.map(p => `- ${p}`).join('\n')}`);
    }

    // 3. Recent sessions (last 7 days) for longer memory
    const recentSessions = await this.loadRecentSessions(7);
    if (recentSessions.length > 0) {
      const summaries = recentSessions.map(s => `- ${s.date}: ${s.summary}`).join('\n');
      parts.push(`## Recent Sessions\n${summaries}`);
    }

    // 4. Task list from work/ zone (date-referenced checkboxes)
    const tasks = await this.extractTasks();
    if (tasks.length > 0) {
      parts.push(`## Open Tasks\n${tasks.join('\n')}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Load recent session entries from forge/cognitive/sessions/ (SESS-02).
   * Returns last N days of session notes.
   */
  async loadRecentSessions(days = 7): Promise<SessionEntry[]> {
    const sessions: SessionEntry[] = [];

    for (let i = 1; i <= days; i++) {
      const date = this.getDateDaysAgo(i);
      const path = `forge/cognitive/sessions/${date}.md`;
      if (this.vaultAdapter.exists(path)) {
        try {
          const content = await this.vaultAdapter.readNote(path);
          const entry = this.parseSessionNote(content, date);
          if (entry) sessions.push(entry);
        } catch { /* ignore */ }
      }
    }

    return sessions;
  }

  /**
   * Append a session entry on session close (SESS-03).
   * Writes to forge/cognitive/sessions/YYYY-MM-DD.md.
   * If today's file exists, appends under new ## Session heading.
   * Otherwise creates new file with frontmatter.
   */
  async appendSessionEntry(entry: Omit<SessionEntry, 'date' | 'type'>): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const path = `forge/cognitive/sessions/${today}.md`;

    const newEntry = this.formatSessionEntry(entry);

    // Ensure the cognitive/sessions directory exists
    await this.ensureCognitiveDirectory();

    if (this.vaultAdapter.exists(path)) {
      // Append to existing daily note
      await this.vaultAdapter.editNote(path, content => content + '\n\n' + newEntry);
    } else {
      // Create new daily note
      const frontmatter = `---
date: ${today}
type: session
summary: "${entry.summary}"
decisions: [${entry.decisions.map(d => `"${d}"`).join(', ')}]
events: [${entry.events.map(e => `"${e}"`).join(', ')}]
wins: [${entry.wins.map(w => `"${w}"`).join(', ')}]
projects_touched: [${entry.projects_touched.map(p => `"${p}"`).join(', ')}]
---

`;
      await this.vaultAdapter.writeNote(path, frontmatter + newEntry);
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────

  private async ensureCognitiveDirectory(): Promise<void> {
    const cognitiveDir = 'forge/cognitive/sessions';
    // Check if directory exists by seeing if any file exists in it
    // VaultAdapter doesn't have a directory exists method, so we check for a known path
    const testPath = `${cognitiveDir}/.gitkeep`;
    if (!this.vaultAdapter.exists(testPath)) {
      // Try to create by writing a placeholder if directory doesn't exist
      try {
        await this.vaultAdapter.createFolder(cognitiveDir);
      } catch {
        // Folder might already exist or createFolder might not be available
        // The writeNote will create parent folders if needed
      }
    }
  }

  private detectActiveProjects(): string[] {
    const projects: string[] = [];
    const workDir = 'work/';
    const files = this.vaultAdapter.listFiles('md');

    for (const file of files) {
      // D-01: work/ folder OR project:true frontmatter
      if (file.path.startsWith(workDir)) {
        projects.push(file.path);
      } else {
        const metadata = this.vaultAdapter.getMetadata(file.path);
        if (metadata?.frontmatter?.project === true) {
          projects.push(file.path);
        }
      }
    }

    // Limit to 20 projects to respect token budget
    return projects.slice(0, 20);
  }

  private async extractTasks(): Promise<string[]> {
    const tasks: string[] = [];
    const workDir = 'work/';
    const files = this.vaultAdapter.listFiles('md').filter(f => f.path.startsWith(workDir));

    for (const file of files.slice(0, 10)) { // Limit file scan for token budget
      try {
        const content = await this.vaultAdapter.readNote(file.path);
        // Match checkbox patterns: - [ ] or - [x]
        const matches = content.matchAll(/- \[([ x])\] (.+)/g);
        for (const match of matches) {
          const [_, status, text] = match;
          if (status === ' ') { // Only open tasks
            tasks.push(`- [ ] ${text} (${file.path})`);
          }
        }
      } catch { /* ignore */ }
    }

    return tasks.slice(0, 20); // Limit total tasks
  }

  private parseSessionNote(content: string, date: string): SessionEntry | null {
    // Parse frontmatter or extract from content
    // Simplified: extract summary from first line after frontmatter
    const lines = content.split('\n');
    let summary = '';
    let decisions: string[] = [];
    let events: string[] = [];
    let wins: string[] = [];
    let projects_touched: string[] = [];

    // Try to extract summary from first heading
    for (const line of lines) {
      if (line.startsWith('## Session')) {
        const parts = line.split('|');
        if (parts.length >= 2) {
          summary = parts[1].trim();
        }
        break;
      }
    }

    return { date, type: 'session', summary, decisions, events, wins, projects_touched };
  }

  private formatSessionEntry(entry: Omit<SessionEntry, 'date' | 'type'>): string {
    return `## Session

**Summary:** ${entry.summary}
${entry.decisions.length > 0 ? `**Decisions:**\n${entry.decisions.map(d => `- ${d}`).join('\n')}\n` : ''}
${entry.events.length > 0 ? `**Events:**\n${entry.events.map(e => `- ${e}`).join('\n')}\n` : ''}
${entry.wins.length > 0 ? `**Wins:**\n${entry.wins.map(w => `- ${w}`).join('\n')}\n` : ''}
${entry.projects_touched.length > 0 ? `**Projects:**\n${entry.projects_touched.map(p => `- ${p}`).join('\n')}` : ''}`;
  }

  private getYesterdayDate(): string {
    return this.getDateDaysAgo(1);
  }

  private getDateDaysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  }

  private truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '...';
  }
}
