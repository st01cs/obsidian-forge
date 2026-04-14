import { AgentBridge } from '../AgentBridge';
import { Notice } from 'obsidian';

/**
 * CMND-05: /1on1 command - Structure meeting notes into standard 1:1 format.
 *
 * Prompts the agent to ask the user for meeting notes or a description,
 * then formats the content into a standard 1:1 meeting structure.
 */

export interface OneOnOneData {
  participant: string;
  date: string;
  topics: string[];
  decisions: string[];
  actionItems: string[];
  notes?: string;
}

/**
 * Format structured 1:1 meeting data into markdown.
 * @param data - The structured 1:1 meeting data
 * @returns Formatted markdown string
 */
export function format1on1Notes(data: OneOnOneData): string {
  const lines: string[] = [
    `---
type: 1on1-meeting
participant: "${data.participant}"
date: ${data.date}
tags: [meeting, 1on1]
---`,
    '',
    `# 1:1 Meeting — ${data.participant} — ${data.date}`,
    ''
  ];

  if (data.topics.length > 0) {
    lines.push('## Discussion Topics');
    for (const topic of data.topics) {
      lines.push(`- ${topic}`);
    }
    lines.push('');
  }

  if (data.decisions.length > 0) {
    lines.push('## Decisions Made');
    for (const decision of data.decisions) {
      lines.push(`- ${decision}`);
    }
    lines.push('');
  }

  if (data.actionItems.length > 0) {
    lines.push('## Action Items');
    for (const item of data.actionItems) {
      lines.push(`- [ ] ${item}`);
    }
    lines.push('');
  }

  if (data.notes) {
    lines.push('## Additional Notes');
    lines.push(data.notes);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Execute /1on1 command.
 * Opens chat panel and sends a prompt to structure meeting notes into 1:1 format.
 */
export async function execute1on1Command(agentBridge: AgentBridge): Promise<void> {
  if (!agentBridge.isInitialized()) {
    new Notice('Agent not initialized. Configure your API key in settings.', 4000);
    return;
  }

  new Notice('1:1 formatting mode...', 2000);

  try {
    const session = agentBridge.getSession();
    if (session) {
      const today = new Date().toISOString().split('T')[0];
      const prompt = `# 1:1 Meeting Notes Formatter

Structure meeting notes into a standard 1:1 format.

## Your Task

The user wants to convert their meeting notes into a structured 1:1 format.

1. **Collect Meeting Information**
   Ask the user for:
   - Their meeting notes OR a description of what was discussed
   - The participant's name (who they had the 1:1 with)
   - The meeting date (or use today's date: ${today})

2. **Extract and Structure**
   From the provided notes, extract:
   - **Discussion topics** — what was talked about
   - **Decisions made** — any conclusions or choices
   - **Action items** — tasks assigned with owners

3. **Output Format**
   Format the meeting as a structured note and save it to:
   \`work/meetings/${today}-1on1-[participant].md\`

   The structure should follow this template:
   \`\`\`markdown
   ---
   type: 1on1-meeting
   participant: "[participant name]"
   date: ${today}
   tags: [meeting, 1on1]
   ---

   # 1:1 Meeting — [participant] — ${today}

   ## Discussion Topics
   - [topic 1]
   - [topic 2]

   ## Decisions Made
   - [decision 1]
   - [decision 2]

   ## Action Items
   - [ ] [action item 1] (owner: [name])
   - [ ] [action item 2] (owner: [name])
   \`\`\`

4. **Index Update**
   - Update or create \`work/meetings/index.md\` to list this meeting
   - Include date and participant in the index

Be helpful in clarifying ambiguous notes. Ask follow-up questions if needed.
`;
      await session.prompt(prompt);
    } else {
      new Notice('Agent session not available. Cannot format 1:1 notes.', 4000);
    }
  } catch (error) {
    console.error('[1on1Command] Error:', error);
    new Notice('1:1 formatting failed: ' + String(error), 4000);
  }
}
