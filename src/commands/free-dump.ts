import { AgentBridge } from '../AgentBridge';
import { Notice } from 'obsidian';

/**
 * Execute /free-dump command.
 * D-09: Capture → classify → route in one step.
 *
 * The user will be prompted to enter free-form text.
 * The agent will classify it and route to the appropriate zone.
 */
export async function executeFreeDumpCommand(agentBridge: AgentBridge): Promise<void> {
  if (!agentBridge.isInitialized()) {
    new Notice('Agent not initialized. Configure your API key in settings.', 4000);
    return;
  }

  new Notice('Free dump mode. Type your thought and I\'ll classify and route it.', 3000);

  const session = agentBridge.getSession();
  if (session) {
    // Send guidance prompt to agent for free-dump mode
    const prompt = `# Free Dump Mode

The user is about to share unstructured text. Your job:

1. **Listen** to what they share without judging
2. **Classify** the content type: decision, event, win, 1:1, architecture, person, or project update
3. **Route** to the correct PARA zone with proper frontmatter

## Zone Routing
- **decision** → cognitive/decisions/
- **event** → reference/events/
- **win** → performance/
- **1:1** → work/meetings/ or org/meetings/
- **architecture** → reference/architecture/
- **person** → org/people/
- **project update** → work/projects/{project}/

## Required Frontmatter
- date: YYYY-MM-DD
- description: ~150 chars
- tags: [...]

## Output Format
After the user shares their thought, respond with:
1. Classification: "This is a [type]"
2. Route: "Routing to [zone]"
3. What you captured (brief summary)

Be concise and helpful. This is a capture tool, not a deep analysis.
`;
    await session.prompt(prompt);
  }
}

/**
 * Quick capture helper for direct routing without full agent.
 * Used when user explicitly routes something.
 */
export async function quickCapture(
  agentBridge: AgentBridge,
  content: string,
  classification: 'decision' | 'event' | 'win' | '1:1' | 'architecture' | 'person' | 'project update',
  zone: string
): Promise<void> {
  const vaultAdapter = (agentBridge as any).vaultAdapter as any;
  if (!vaultAdapter) return;

  const today = new Date().toISOString().split('T')[0];
  const date = today;
  const tags = [classification];
  const description = content.slice(0, 150).replace(/[#*`]/g, '').trim();

  const frontmatter = `---
date: ${date}
type: ${classification}
description: "${description}"
tags: [${tags.join(', ')}]
---

# ${classification.charAt(0).toUpperCase() + classification.slice(1)} - ${today}

${content}
`;

  const filename = `${zone}${today}-${Date.now()}.md`;
  await vaultAdapter.writeNote(filename, frontmatter);

  new Notice(`Captured as ${classification} → ${zone}`, 3000);
}
