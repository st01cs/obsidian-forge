import { AgentBridge } from '../AgentBridge';
import { Notice } from 'obsidian';

/**
 * CMND-08: /report command - Generate performance review brief from evidence chain.
 *
 * Scans performance/brag.md, work/ completions, cognitive/decisions/, and session
 * summaries to generate a structured performance brief.
 */

export interface ReviewPeriod {
  startDate: string;
  endDate: string;
  label: string;
}

/**
 * Calculate the review period based on last review date.
 * @param lastReviewDate - Optional ISO date string of last review
 * @returns ReviewPeriod object
 */
export function getReviewPeriod(lastReviewDate?: string): ReviewPeriod {
  const now = new Date();
  const endDate = now.toISOString().split('T')[0];

  let startDate: string;
  let label: string;

  if (lastReviewDate) {
    // If we have a last review date, cover that period
    startDate = lastReviewDate;
    const start = new Date(lastReviewDate);
    const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    label = `Since ${lastReviewDate} (${days} days)`;
  } else {
    // Default to last 90 days
    const start = new Date(now);
    start.setDate(start.getDate() - 90);
    startDate = start.toISOString().split('T')[0];
    label = 'Last 90 days';
  }

  return { startDate, endDate, label };
}

/**
 * Execute /report command.
 * Opens chat panel and generates a performance review brief.
 */
export async function executeReportCommand(agentBridge: AgentBridge): Promise<void> {
  if (!agentBridge.isInitialized()) {
    new Notice('Agent not initialized. Configure your API key in settings.', 4000);
    return;
  }

  new Notice('Generating performance brief...', 2000);

  try {
    const session = agentBridge.getSession();
    if (session) {
      const period = getReviewPeriod();
      const today = new Date().toISOString().split('T')[0];
      const prompt = `# Performance Review Brief Generator

Generate a structured performance review brief from your evidence chain.

## Review Period: ${period.label}
Start: ${period.startDate}
End: ${period.endDate}

## Your Task

1. **Gather Evidence from Multiple Sources**

   a) **Brag Document** (\`performance/brag.md\`)
   - Read all entries from the brag document
   - Filter for entries within the review period
   - Extract achievements with quantified impact

   b) **Work Zone** (\`work/\`)
   - Scan for project completions, milestones reached
   - Look for shipping events, launches, deliveries
   - Extract any measurable outcomes

   c) **Cognitive Decisions** (\`cognitive/decisions/\`)
   - Read recent decisions made during the period
   - Note the context and impact of key decisions

   d) **Session Summaries** (\`forge/cognitive/sessions/\`)
   - Review recent session summaries for context
   - Extract wins, patterns, and progress indicators

2. **Structure the Brief**

   Create a comprehensive brief at: \`performance/reviews/${today}-review-brief.md\`

   Format:
   \`\`\`markdown
   ---
   type: performance-review
   period: "${period.label}"
   start_date: ${period.startDate}
   end_date: ${period.endDate}
   date: ${today}
   tags: [performance, review]
   ---

   # Performance Review Brief — ${period.label}

   ## Executive Summary
   [2-3 sentence overview of the period]

   ## Key Achievements (成果)
   | Achievement | Impact | Evidence |
   |-------------|--------|----------|
   | [What] | [So what] | [Link] |

   ## Project Completions
   - [Project 1]: [description]
   - [Project 2]: [description]

   ## Key Decisions
   - [Decision 1]: [impact]
   - [Decision 2]: [impact]

   ## Growth & Learning
   - [New skills or knowledge gained]
   - [Areas of improvement identified]

   ## Collaboration Highlights
   - [Team contributions, code reviews, mentoring, etc.]

   ## Looking Forward
   - [Goals for next period]
   - [Areas to focus on]
   \`\`\`

3. **Ensure Reviews Directory**
   - Create \`performance/reviews/\` directory if it doesn't exist
   - Update \`performance/index.md\` to reference the new brief

4. **Output Summary**
   Present a summary of what was found and documented in the brief.

Be thorough. Performance briefs are most valuable when they include specific, quantifiable achievements.
`;
      await session.prompt(prompt);
    } else {
      new Notice('Agent session not available. Cannot generate report.', 4000);
    }
  } catch (error) {
    console.error('[ReportCommand] Error:', error);
    new Notice('Report generation failed: ' + String(error), 4000);
  }
}
