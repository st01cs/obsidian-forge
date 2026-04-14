import { AgentBridge } from '../AgentBridge';
import { Notice } from 'obsidian';
import { GitHubClient } from '../integrations/github-client';

/**
 * CMND-07: /brag command - Record 成果 (achievements/outcomes) with evidence links to Brag Doc.
 *
 * Uses GitHubClient to get PR details as evidence, then records achievements
 * to performance/brag.md with proper documentation.
 */

export interface BragEntry {
  achievement: string;
  date: string;
  impact?: string;
  evidence?: string;
  prUrl?: string;
  tags: string[];
}

/**
 * Format a brag entry for the Brag Document.
 * @param data - The brag entry data
 * @returns Formatted markdown string for the brag doc
 */
export function formatBragEntry(data: BragEntry): string {
  const lines: string[] = [];

  lines.push(`## ${data.achievement}`);
  lines.push('');
  lines.push(`**Date:** ${data.date}`);

  if (data.impact) {
    lines.push(`**Impact:** ${data.impact}`);
  }

  if (data.evidence) {
    lines.push(`**Evidence:** ${data.evidence}`);
  }

  if (data.prUrl) {
    lines.push(`**PR:** ${data.prUrl}`);
  }

  if (data.tags.length > 0) {
    lines.push(`**Tags:** ${data.tags.map(t => `#${t}`).join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Execute /brag command.
 * Opens chat panel and initiates the brag/achievement recording workflow.
 */
export async function executeBragCommand(agentBridge: AgentBridge): Promise<void> {
  if (!agentBridge.isInitialized()) {
    new Notice('Agent not initialized. Configure your API key in settings.', 4000);
    return;
  }

  // Get GitHub token from settings
  const settings = (agentBridge as any).settings as { githubToken?: string };
  if (!settings?.githubToken) {
    new Notice('GitHub token not configured. Add it in plugin settings.', 4000);
    return;
  }

  new Notice('Brag mode!', 2000);

  try {
    const session = agentBridge.getSession();
    const vaultAdapter = (agentBridge as any).vaultAdapter as any;
    const app = vaultAdapter?.app;

    if (!app) {
      new Notice('Cannot access Obsidian app.', 4000);
      return;
    }

    // Create GitHubClient instance (can be used by agent via http_request)
    const _githubClient = new GitHubClient(app, settings.githubToken);

    if (session) {
      const today = new Date().toISOString().split('T')[0];
      const prompt = `# Brag Mode — Record Your Achievements

Capture and document your wins and achievements (成果) with evidence links.

## Context
GitHubClient is available for fetching PR details if you need evidence.

## Your Task

1. **Collect Achievement Information**
   Ask the user what they achieved. Get:
   - What did they accomplish? (be specific)
   - When did it happen? (use today: ${today} if not specified)
   - What was the impact? (quantify if possible)
   - Is there a PR, commit, or other evidence to link?

2. **Fetch Evidence (if applicable)**
   If the user mentions a PR URL or number, use \`http_request\` to fetch details:
   - GitHub PR API: \`https://api.github.com/repos/{owner}/{repo}/pulls/{number}\`
   - Authorization: \`Bearer {github_token}\`

3. **Record to Brag Document**
   Update or create: \`performance/brag.md\`

   Format each entry as:
   \`\`\`markdown
   ### [Achievement Title]
   **Date:** YYYY-MM-DD
   **Impact:** [quantified impact or description]

   [Detailed description of what was done and why it matters]

   **Evidence:** [link to PR, commit, or other proof]
   \`\`\`

4. **Ensure Brag Doc Structure**
   If \`performance/brag.md\` doesn't exist, create it with:
   \`\`\`markdown
   ---
   type: brag-document
   tags: [performance, achievements]
   ---

   # Brag Document

   A record of achievements, wins, and measurable impacts.

   ## How to Use
   Add entries below whenever you accomplish something meaningful.

   ---

   ## Entries
   [new entries go here]
   \`\`\`

5. **Index Update**
   - Update \`performance/index.md\` to reference the brag doc if it exists

Make the achievements concrete and impactful. Help the user articulate the "so what?" of their work.
`;
      await session.prompt(prompt);
    } else {
      new Notice('Agent session not available. Cannot record brag.', 4000);
    }
  } catch (error) {
    console.error('[BragCommand] Error:', error);
    new Notice('Brag recording failed: ' + String(error), 4000);
  }
}
