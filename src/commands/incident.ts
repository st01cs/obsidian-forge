import { AgentBridge } from '../AgentBridge';
import { Notice } from 'obsidian';
import { SlackClient, SlackMessage } from '../integrations/slack-client';

/**
 * CMND-06: /incident command - Capture incident from Slack, reconstruct timeline, create event doc.
 *
 * Uses SlackClient to fetch incident messages, reconstructs a chronological timeline,
 * and creates an event document at reference/events/.
 */

export interface IncidentTimeline {
  messages: SlackMessage[];
  startTime: string;
  endTime: string;
  channelId: string;
}

/**
 * Fetch incident timeline from Slack.
 * @param slackClient - The SlackClient instance
 * @param channelId - Slack channel ID where the incident occurred
 * @param startTime - ISO timestamp for when incident started
 * @param endTime - ISO timestamp for when incident ended (or now if not provided)
 * @returns Promise resolving to incident timeline data
 */
export async function fetchIncidentTimeline(
  slackClient: SlackClient,
  channelId: string,
  startTime: string,
  endTime?: string
): Promise<IncidentTimeline> {
  const end = endTime || new Date().toISOString();

  // Fetch messages from the channel within the time range
  const result = await slackClient.getChannelMessages(channelId, 100);

  if (!result.ok || !result.messages) {
    throw new Error(`Failed to fetch Slack messages: ${result.error || 'Unknown error'}`);
  }

  // Filter messages to the incident time range
  const startMs = new Date(startTime).getTime() / 1000;
  const endMs = new Date(end).getTime() / 1000;

  const incidentMessages = result.messages.filter(msg => {
    const msgTime = parseFloat(msg.ts);
    return msgTime >= startMs && msgTime <= endMs;
  });

  // Sort chronologically
  incidentMessages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));

  return {
    messages: incidentMessages,
    startTime,
    endTime: end,
    channelId
  };
}

/**
 * Execute /incident command.
 * Opens chat panel and initiates incident capture workflow using Slack.
 */
export async function executeIncidentCommand(agentBridge: AgentBridge): Promise<void> {
  if (!agentBridge.isInitialized()) {
    new Notice('Agent not initialized. Configure your API key in settings.', 4000);
    return;
  }

  // Get Slack token from settings
  const settings = (agentBridge as any).settings as { slackToken?: string };
  if (!settings?.slackToken) {
    new Notice('Slack token not configured. Add it in plugin settings.', 4000);
    return;
  }

  new Notice('Incident capture mode...', 2000);

  try {
    const session = agentBridge.getSession();
    const vaultAdapter = (agentBridge as any).vaultAdapter as any;
    const app = vaultAdapter?.app;

    if (!app) {
      new Notice('Cannot access Obsidian app.', 4000);
      return;
    }

    // Create SlackClient instance
    const slackClient = new SlackClient(app, settings.slackToken);

    if (session) {
      const today = new Date().toISOString().split('T')[0];
      const prompt = `# Incident Capture Mode

Capture and reconstruct an incident timeline from Slack.

## Context
SlackClient is now available for fetching messages. The user will provide:
- Slack channel ID or URL
- Time range of the incident (or "recent" for last hour)

## Your Task

1. **Collect Incident Details**
   Ask the user for:
   - The Slack channel where the incident is documented (channel ID or name)
   - The approximate time the incident started
   - A brief description or slug for the incident (e.g., "db-outage" or "deploy-failure")

2. **Fetch and Reconstruct Timeline**
   Use the \`http_request\` tool to call the Slack API:
   - Endpoint: \`https://slack.com/api/conversations.history\`
   - Parameters: channel ID, oldest (start time), latest (end time)
   - Parse the JSON response and extract messages chronologically

   Example API call:
   \`\`\`
   GET https://slack.com/api/conversations.history?channel={channel_id}&oldest={start_ts}&latest={end_ts}
   Authorization: Bearer {slack_token}
   \`\`\`

3. **Create Event Document**
   Save the incident timeline to:
   \`reference/events/${today}-incident-[slug].md\`

   Format:
   \`\`\`markdown
   ---
   type: incident
   date: ${today}
   tags: [incident, event]
   channel: "[slack_channel]"
   ---

   # Incident — [slug] — ${today}

   ## Timeline
   [Chronological list of events from Slack messages]

   ## Impact
   [What was affected]

   ## Resolution
   [How it was resolved]

   ## Post-Incident Actions
   - [ ] Action item 1
   - [ ] Action item 2
   \`\`\`

4. **Index Update**
   - Update \`reference/events/index.md\` to include this incident

Use the Slack messages to create an accurate chronological timeline.
`;
      await session.prompt(prompt);
    } else {
      new Notice('Agent session not available. Cannot capture incident.', 4000);
    }
  } catch (error) {
    console.error('[IncidentCommand] Error:', error);
    new Notice('Incident capture failed: ' + String(error), 4000);
  }
}
