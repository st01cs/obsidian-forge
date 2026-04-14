import { AgentBridge } from '../AgentBridge';
import { Notice } from 'obsidian';

/**
 * CMND-09: /audit command - Check knowledge base for orphans, broken links, frontmatter gaps, stale content.
 *
 * Uses session.prompt() for the main audit checklist, and optionally runs
 * a sub-agent via SubAgentManager.runSubAgentWithIdleGuard() for deep background audit.
 */

export interface AuditResult {
  orphanCount: number;
  frontmatterIssues: number;
  staleCount: number;
  brokenLinks: number;
  notes: string[];
}

/**
 * Run a quick audit directly without sub-agent.
 * Used as fallback when SubAgentManager is not available.
 */
export async function runQuickAudit(agentBridge: AgentBridge): Promise<AuditResult> {
  const vaultAdapter = (agentBridge as any).vaultAdapter as any;
  if (!vaultAdapter) {
    return { orphanCount: 0, frontmatterIssues: 0, staleCount: 0, brokenLinks: 0, notes: ['Vault adapter not available'] };
  }

  const notes: string[] = [];
  const allFiles = vaultAdapter.listFiles('md');
  const now = Date.now();
  const staleThreshold = 90 * 24 * 60 * 60 * 1000; // 90 days

  // Check for orphans
  let orphanCount = 0;
  for (const file of allFiles) {
    const backlinks = vaultAdapter.getBacklinksForFile?.(file.path) || [];
    if (backlinks.length === 0) {
      orphanCount++;
      if (orphanCount <= 5) {
        notes.push(`Orphan: ${file.path}`);
      }
    }
  }
  if (orphanCount > 5) notes.push(`...and ${orphanCount - 5} more orphans`);

  // Check frontmatter on recent files
  let frontmatterIssues = 0;
  const recentFiles = allFiles
    .sort((a: any, b: any) => (b.stat?.mtime?.getTime() || 0) - (a.stat?.mtime?.getTime() || 0))
    .slice(0, 30);

  for (const file of recentFiles) {
    const metadata = vaultAdapter.getMetadata?.(file.path);
    if (!metadata?.frontmatter?.date || !metadata?.frontmatter?.description) {
      frontmatterIssues++;
    }
  }

  // Check for stale content
  let staleCount = 0;
  for (const file of allFiles) {
    const mtime = file.stat?.mtime?.getTime() || 0;
    if (mtime > 0 && (now - mtime) > staleThreshold) {
      staleCount++;
    }
  }

  return {
    orphanCount,
    frontmatterIssues,
    staleCount,
    brokenLinks: 0, // Hard to check without crawling all links
    notes
  };
}

/**
 * Execute /audit command.
 * Opens chat panel and starts a comprehensive knowledge base audit.
 */
export async function executeAuditCommand(agentBridge: AgentBridge): Promise<void> {
  if (!agentBridge.isInitialized()) {
    new Notice('Agent not initialized. Configure your API key in settings.', 4000);
    return;
  }

  new Notice('Starting knowledge base audit...', 2000);

  try {
    const session = agentBridge.getSession();
    const subAgentManager = agentBridge.getSubAgentManager();

    const today = new Date().toISOString().split('T')[0];

    if (session) {
      const prompt = `# Knowledge Base Audit

Perform a comprehensive audit of the knowledge base.

## Audit Checklist

Run the following checks and report findings for each:

### 1. Orphan Notes Check
Use the \`get_orphans\` tool to find notes with no backlinks.
Report how many orphans exist and list the first 10.

### 2. Frontmatter Completeness
Scan recent notes (last 30 files by mtime) and check for required frontmatter:
- \`date\`: YYYY-MM-DD format
- \`description\`: ~150 characters
- \`tags\`: array of tags

Report notes missing frontmatter fields.

### 3. Stale Content Check
Find notes that haven't been modified in 90+ days.
Report count and list the oldest 10 files.

### 4. Long Notes Without Wikilinks
Find notes over 3000 characters that don't contain any [[wikilinks]].
These may need internal linking for navigation.

### 5. Index File Status
Check if these index files exist and are up to date:
- \`work/index.md\`
- \`cognitive/decisions/index.md\`
- \`cognitive/sessions/index.md\`
- \`reference/events/index.md\`
- \`performance/index.md\`

Report which exist and their last modified dates.

### 6. Zone Structure Check
Verify these directories exist:
- \`forge/\`
- \`work/\`
- \`org/\`
- \`performance/\`
- \`cognitive/\`
- \`reference/\`
- \`draft/\`

## Output

Create an audit report at: \`cognitive/audits/${today}-audit.md\`

Format:
\`\`\`markdown
---
type: audit-report
date: ${today}
tags: [audit, knowledge-base]
---

# Knowledge Base Audit — ${today}

## Findings

### Orphan Notes
[Count and list]

### Frontmatter Issues
[Count and affected files]

### Stale Content
[Count and oldest files]

### Long Notes Without Wikilinks
[Count and files]

### Index Status
| Index | Exists | Last Modified |
|-------|--------|---------------|
| work/index.md | yes/no | date |
...

### Zone Structure
[All zones present: yes/no]

## Recommendations
[Priority fixes needed]
\`\`\`

Be thorough. Report actual counts, not just "checked OK."
`;

      await session.prompt(prompt);

      // Also trigger a background deep audit using sub-agent if available
      if (subAgentManager) {
        const auditAgentPrompt = `Run a deep audit of the Obsidian knowledge base.

Focus on:
1. Cross-reference orphans — check if they should be linked or deleted
2. Find broken [[wikilinks]] — links to non-existent files
3. Find broken ![[embed]] links — embeds of non-existent files
4. Check for notes with circular links (A links to B, B links back to A)
5. Find notes that reference deleted/moved files

Output a detailed report with specific file paths and link issues found.`;

        try {
          await subAgentManager.runSubAgentWithIdleGuard('audit-agent', auditAgentPrompt);
          new Notice('Background audit complete. Check cognitive/audits/ for details.', 3000);
        } catch (subAgentError) {
          console.warn('[AuditCommand] Sub-agent audit failed:', subAgentError);
          // Don't fail the main audit if sub-agent fails
        }
      }
    } else {
      // Fallback without agent: run quick audit
      const result = await runQuickAudit(agentBridge);
      const summary = [
        `Orphans: ${result.orphanCount}`,
        `FM Issues: ${result.frontmatterIssues}`,
        `Stale: ${result.staleCount}`
      ].join(' | ');

      new Notice(`Quick audit: ${summary}`, 5000);
    }
  } catch (error) {
    console.error('[AuditCommand] Error:', error);
    new Notice('Audit failed: ' + String(error), 4000);
  }
}
