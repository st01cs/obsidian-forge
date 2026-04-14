/**
 * Command definitions for Obsidian Forge.
 * D-09: Commands defined as strings, registered via plugin.addCommand().
 * Phase 1: No actual implementations — just command palette registration.
 * Phase 2+: Actual command implementations (CMND-01, CMND-02, etc.).
 */

export interface CommandDefinition {
  id: string;
  name: string;
  description: string;
}

export const COMMANDS: CommandDefinition[] = [
  {
    id: 'open-chat',
    name: 'Open conversation',
    description: 'Open the Obsidian Forge chat panel in the sidebar'
  },
  {
    id: 'standup',
    name: 'Morning Standup',
    description: 'Load context, review yesterday, show tasks, suggest priorities'
  },
  {
    id: 'free-dump',
    name: 'Free Dump',
    description: 'Capture non-structured text, auto-classify and route'
  },
  {
    id: 'review',
    name: 'Session Review',
    description: 'Validate notes, update indexes, discover missed wins'
  },
  {
    id: 'weekly',
    name: 'Weekly Summary',
    description: 'Cross-session weekly summary with pattern discovery'
  },
  {
    id: '1on1',
    name: '1:1 Meeting Notes',
    description: 'Structure meeting notes into standard 1:1 format'
  },
  {
    id: 'incident',
    name: 'Incident Capture',
    description: 'Capture incident from Slack, reconstruct timeline'
  },
  {
    id: 'brag',
    name: 'Record Win',
    description: 'Record an achievement with evidence links to Brag Doc'
  },
  {
    id: 'report',
    name: 'Performance Brief',
    description: 'Generate performance review brief from evidence chain'
  },
  {
    id: 'audit',
    name: 'Knowledge Audit',
    description: 'Check orphans, broken links, frontmatter gaps, stale content'
  }
];

/**
 * Slash command prefixes for ChatPanel input filtering.
 * When user types '/' in chat input, show matching commands.
 */
export function filterCommands(query: string): CommandDefinition[] {
  if (!query.startsWith('/')) return [];
  const searchTerm = query.slice(1).toLowerCase();
  if (!searchTerm) return COMMANDS;
  return COMMANDS.filter(cmd =>
    cmd.name.toLowerCase().includes(searchTerm) ||
    cmd.id.includes(searchTerm)
  );
}
