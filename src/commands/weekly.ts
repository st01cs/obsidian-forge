import { AgentBridge } from '../AgentBridge';
import { Notice } from 'obsidian';

/**
 * CMND-04: /weekly command - Cross-session weekly summary with pattern discovery and 成果 report.
 *
 * Analyzes cognitive/sessions/ notes from the past week, looks for patterns,
 * scans performance/ and work/ for achievements, and outputs to forge/cognitive/sessions/YYYY-WXX.md.
 */

/**
 * Calculate ISO week number for a given date.
 * @param date - The date to calculate the week number for
 * @returns ISO week string in format "YYYY-WXX"
 */
export function getISOWeekNumber(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Execute /weekly command.
 * Opens chat panel and sends a structured prompt for weekly summary generation.
 */
export async function executeWeeklyCommand(agentBridge: AgentBridge): Promise<void> {
  if (!agentBridge.isInitialized()) {
    new Notice('Agent not initialized. Configure your API key in settings.', 4000);
    return;
  }

  new Notice('Compiling weekly summary...', 2000);

  try {
    const session = agentBridge.getSession();
    if (session) {
      const weekNum = getISOWeekNumber(new Date());
      const weekPrompt = `# Weekly Summary (${weekNum})

Generate a comprehensive cross-session weekly summary.

## Your Task

1. **Load Session History**
   - Read all notes from \`forge/cognitive/sessions/\` directory
   - Filter for notes from the current ISO week (${weekNum})
   - If no sessions exist for this week, check the previous week

2. **Pattern Discovery**
   Analyze the sessions and look for:
   - **Recurring themes** — topics discussed multiple times
   - **Decisions made** — choices recorded in cognitive/decisions/
   - **Blockers encountered** — challenges or obstacles noted
   - **Wins achieved** — achievements captured in performance/ or sessions
   - **Progress made** — forward momentum on projects

3. **Achievement Scan (成果 Report)**
   - Scan \`performance/\` zone for any new achievements
   - Scan \`work/\` zone for project completions or milestones
   - Count total wins, decisions, and events this week

4. **Output Format**
   Create a weekly summary note at: \`forge/cognitive/sessions/${weekNum}.md\`

   The note should include:
   \`\`\`markdown
   ---
   type: weekly-summary
   week: "${weekNum}"
   date: ${new Date().toISOString().split('T')[0]}
   tags: [weekly, cognitive]
   ---

   # Weekly Summary — ${weekNum}

   ## Pattern Discoveries
   - [list patterns found]

   ## Decisions Made
   - [list decisions]

   ## Blockers Encountered
   - [list blockers]

   ## Wins & Achievements (成果)
   - [list wins with evidence links]

   ## Progress Summary
   - [what was accomplished]

   ## Focus for Next Week
   - [recommended priorities based on patterns]
   \`\`\`

5. **Index Update**
   - Update \`forge/cognitive/sessions/index.md\` to include this new weekly summary
   - If the index doesn't exist, create it

Be thorough in pattern detection. Look for subtle signals in how the user describes their work.
`;
      await session.prompt(weekPrompt);
    } else {
      new Notice('Agent session not available. Cannot generate weekly summary.', 4000);
    }
  } catch (error) {
    console.error('[WeeklyCommand] Error:', error);
    new Notice('Weekly summary failed: ' + String(error), 4000);
  }
}
