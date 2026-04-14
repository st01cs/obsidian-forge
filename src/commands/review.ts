import { AgentBridge } from '../AgentBridge';
import { Notice } from 'obsidian';

/**
 * Execute /review command.
 * D-10: Scan orphans, check frontmatter, update indexes, discover missed wins.
 */
export async function executeReviewCommand(agentBridge: AgentBridge): Promise<void> {
  if (!agentBridge.isInitialized()) {
    new Notice('Agent not initialized. Configure your API key in settings.', 4000);
    return;
  }

  new Notice('Running review...', 2000);

  try {
    const session = agentBridge.getSession();
    if (session) {
      const reviewPrompt = `# Session Review

Run a comprehensive review of the knowledge base:

## 1. Orphan Notes Check
Use get_orphans tool to find notes with no backlinks. Report how many orphans exist.

## 2. Frontmatter Completeness
Scan recent notes (last 30 files) and check for required frontmatter:
- date: YYYY-MM-DD
- description: ~150 chars
- tags: [...]

Report notes missing frontmatter.

## 3. Index Updates
Check if these index files exist and are up to date:
- work/index.md (lists active projects)
- cognitive/decisions/index.md (lists recent decisions)
- reference/events/index.md (lists recent events)

Update them if needed.

## 4. Missed Wins Discovery
Scan recent work/ notes for achievement mentions:
- Look for words like "shipped", "launched", "completed", "achieved", "won", "delivered"
- Extract any wins not yet in performance/ zone

## 5. Summary
Report:
- Number of orphans found
- Number of frontmatter issues
- Index updates made (if any)
- New wins discovered (if any)

Be thorough but concise in your report.
`;
      await session.prompt(reviewPrompt);
    } else {
      // Fallback: run basic review directly
      await runBasicReview(agentBridge);
    }
  } catch (error) {
    console.error('[ReviewCommand] Error:', error);
    new Notice('Review failed: ' + String(error), 4000);
  }
}

/**
 * Basic review when agent session is not available.
 */
async function runBasicReview(agentBridge: AgentBridge): Promise<void> {
  const vaultAdapter = (agentBridge as any).vaultAdapter as any;
  if (!vaultAdapter) return;

  const results: string[] = [];

  // Count orphans
  const allFiles = vaultAdapter.listFiles('md');
  let orphanCount = 0;
  const orphans: string[] = [];

  for (const file of allFiles) {
    const backlinks = vaultAdapter.getBacklinksForFile(file.path);
    if (backlinks.length === 0) {
      orphanCount++;
      orphans.push(file.path);
    }
  }

  results.push(`## Orphan Notes: ${orphanCount}`);
  if (orphans.length > 0) {
    results.push(orphans.slice(0, 10).map(o => `- ${o}`).join('\n'));
    if (orphans.length > 10) results.push(`...and ${orphans.length - 10} more`);
  }

  // Check frontmatter on recent files
  let fmIssues = 0;
  const recentFiles = allFiles
    .sort((a: any, b: any) => (b.stat?.mtime?.getTime() || 0) - (a.stat?.mtime?.getTime() || 0))
    .slice(0, 20);

  for (const file of recentFiles) {
    const metadata = vaultAdapter.getMetadata(file.path);
    if (!metadata?.frontmatter?.date || !metadata?.frontmatter?.description || !metadata?.frontmatter?.tags) {
      fmIssues++;
    }
  }

  results.push(`\n## Frontmatter Issues: ${fmIssues} of ${recentFiles.length} recent files`);

  // Check for work index
  if (vaultAdapter.exists('work/index.md')) {
    results.push('\n## work/index.md exists');
  } else {
    results.push('\n## work/index.md missing - should be created');
  }

  new Notice(results.join('\n'), 5000);
}

/**
 * Helper to find missed wins in work/ zone.
 */
export async function findMissedWins(agentBridge: AgentBridge): Promise<string[]> {
  const vaultAdapter = (agentBridge as any).vaultAdapter as any;
  if (!vaultAdapter) return [];

  const wins: string[] = [];
  const workDir = 'work/';
  const files = vaultAdapter.listFiles('md').filter((f: any) => f.path.startsWith(workDir));

  // Check recent files
  const recentFiles = files
    .sort((a: any, b: any) => (b.stat?.mtime?.getTime() || 0) - (a.stat?.mtime?.getTime() || 0))
    .slice(0, 30);

  const winPatterns = [
    /\b(shipped|launched|completed|delivered|achieved|won|finished|released)\b/gi,
    /\b( вперше|впервые|успех|достижение)\b/gi // Russian wins
  ];

  for (const file of recentFiles) {
    try {
      const content = await vaultAdapter.readNote(file.path);
      for (const pattern of winPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          wins.push(`"${matches[0]}" in ${file.path}`);
        }
      }
    } catch { /* ignore */ }
  }

  return [...new Set(wins)]; // Dedupe
}
