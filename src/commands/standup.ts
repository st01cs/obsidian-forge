import { AgentBridge } from '../AgentBridge';
import { Notice } from 'obsidian';

export interface StandupContext {
  northStar: string;
  activeProjects: string[];
  yesterdaySession: string | null;
  tasks: string[];
  gitCommits: string | null;
}

/**
 * Build standup context from session manager.
 * D-08: Loads NORTHSTAR, active projects (metadataCache), yesterday's session, tasks.
 */
export async function buildStandupContext(agentBridge: AgentBridge): Promise<StandupContext> {
  const sessionManager = agentBridge.getSessionManager();

  // Load all context sources in parallel
  const [northStar, recentSessions, tasks] = await Promise.all([
    sessionManager.loadNorthStarContent(),
    sessionManager.loadRecentSessions(1), // Only yesterday
    extractWorkTasks(agentBridge)
  ]);

  const yesterdaySession = recentSessions.length > 0 ? recentSessions[0].summary : null;

  // Detect active projects (reuse SessionManager's logic)
  const activeProjects = detectActiveProjects(agentBridge);

  return {
    northStar: northStar || 'No NORTHSTAR.md found. Ask user to create one.',
    activeProjects,
    yesterdaySession,
    tasks,
    gitCommits: null // Available via git_log tool if user asks
  };
}

/**
 * Build the standup prompt for the agent.
 * D-08: Structured output showing yesterday, today, priorities.
 */
export function buildStandupPrompt(ctx: StandupContext): string {
  const parts: string[] = [
    '# Morning Standup',
    '',
    '## Current Focus (from NORTHSTAR)',
    ctx.northStar,
    ''
  ];

  if (ctx.yesterdaySession) {
    parts.push('## Yesterday');
    parts.push(ctx.yesterdaySession);
    parts.push('');
  }

  if (ctx.activeProjects.length > 0) {
    parts.push('## Active Projects');
    for (const project of ctx.activeProjects.slice(0, 10)) {
      parts.push(`- [[${project}]]`);
    }
    parts.push('');
  }

  if (ctx.tasks.length > 0) {
    parts.push('## Open Tasks');
    for (const task of ctx.tasks.slice(0, 15)) {
      parts.push(task);
    }
    parts.push('');
  }

  parts.push('## Suggested Priorities');
  parts.push('Based on your NORTHSTAR and active projects, what should you focus on today?');

  return parts.join('\n');
}

/**
 * Execute /standup command.
 * Opens chat panel and sends standup prompt to agent.
 */
export async function executeStandupCommand(agentBridge: AgentBridge): Promise<void> {
  if (!agentBridge.isInitialized()) {
    new Notice('Agent not initialized. Configure your API key in settings.', 4000);
    return;
  }

  new Notice('Preparing standup...', 2000);

  try {
    const ctx = await buildStandupContext(agentBridge);
    const prompt = buildStandupPrompt(ctx);

    const session = agentBridge.getSession();
    if (session) {
      // Send standup context to agent for processing
      await session.prompt(prompt);
    } else {
      // Fallback: show standup directly in chat format
      const standupText = buildStandupPrompt(ctx);
      new Notice('Standup: ' + ctx.activeProjects.length + ' projects, ' + ctx.tasks.length + ' tasks', 3000);
    }
  } catch (error) {
    console.error('[StandupCommand] Error:', error);
    new Notice('Standup failed: ' + String(error), 4000);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function detectActiveProjects(agentBridge: AgentBridge): string[] {
  const vaultAdapter = agentBridge.getSessionManager() ? (agentBridge as any).vaultAdapter : null;
  if (!vaultAdapter) return [];

  const projects: string[] = [];
  const workDir = 'work/';
  const files = vaultAdapter.listFiles('md');

  for (const file of files) {
    if (file.path.startsWith(workDir)) {
      projects.push(file.path);
    } else {
      const metadata = vaultAdapter.getMetadata(file.path);
      if (metadata?.frontmatter?.project === true) {
        projects.push(file.path);
      }
    }
  }

  return projects.slice(0, 20);
}

async function extractWorkTasks(agentBridge: AgentBridge): Promise<string[]> {
  const vaultAdapter = (agentBridge as any).vaultAdapter as any;
  if (!vaultAdapter) return [];

  const tasks: string[] = [];
  const workDir = 'work/';
  const files = vaultAdapter.listFiles('md').filter((f: any) => f.path.startsWith(workDir));

  const sortedFiles = files.sort((a: any, b: any) =>
    (b.stat?.mtime?.getTime() || 0) - (a.stat?.mtime?.getTime() || 0)
  );

  for (const file of sortedFiles.slice(0, 10)) {
    try {
      const content = await vaultAdapter.readNote(file.path);
      const matches = content.matchAll(/^- \[ \] (.+)$/gm);
      for (const match of matches) {
        const text = match[1];
        const dateMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
        const dateStr = dateMatch ? ` (due: ${dateMatch[1]})` : '';
        tasks.push(`- [ ] ${text}${dateStr}`);
      }
    } catch { /* ignore */ }
  }

  return tasks.slice(0, 20);
}
