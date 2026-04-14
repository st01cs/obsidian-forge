/**
 * Agent Loader - parses agent definition files from forge/agents/.
 *
 * SUBG-02: Agent definitions stored as markdown files with YAML frontmatter.
 *
 * Each agent file has the format:
 * ---
 * name: <agent-name>
 * description: <description>
 * tools: [<tool1>, <tool2>, ...]
 * model: <model-name-or-default>
 * maxTurns: <number>
 * ---
 * <system-prompt-content>
 */

import { VaultAdapter } from '../VaultAdapter';

export interface AgentDefinition {
  name: string;
  description: string;
  tools: string[];
  model?: string;
  maxTurns: number;
  systemPrompt: string;
}

interface ParsedFrontmatter {
  name?: string;
  description?: string;
  tools?: string[];
  model?: string;
  maxTurns?: number;
}

/**
 * Parse YAML frontmatter from markdown content.
 * Handles simple key-value pairs and arrays.
 *
 * @param content - The full file content including frontmatter
 * @returns Object with parsed frontmatter fields and the body content
 */
export function parseFrontmatter(content: string): { frontmatter: ParsedFrontmatter; body: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterStr = match[1];
  const body = match[2];

  const frontmatter: ParsedFrontmatter = {};

  // Parse each line of the frontmatter
  const lines = frontmatterStr.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    if (!key) continue;

    // Handle array values like: tools: [vault_read, vault_search]
    if (value.startsWith('[') && value.endsWith(']')) {
      const arrayContent = value.slice(1, -1);
      // Split by comma, trim whitespace, remove quotes
      frontmatter[key] = arrayContent
        .split(',')
        .map(s => s.trim().replace(/^["']|["']$/g, ''))
        .filter(s => s.length > 0);
    }
    // Handle number values
    else if (!isNaN(Number(value)) && value !== '') {
      frontmatter[key as keyof ParsedFrontmatter] = Number(value) as any;
    }
    // Handle boolean values
    else if (value === 'true') {
      (frontmatter as any)[key] = true;
    } else if (value === 'false') {
      (frontmatter as any)[key] = false;
    }
    // Handle string values (remove surrounding quotes if present)
    else {
      (frontmatter as any)[key] = value.replace(/^["']|["']$/g, '');
    }
  }

  return { frontmatter, body };
}

/**
 * Load a single agent definition by name.
 *
 * @param vaultAdapter - The vault adapter for reading files
 * @param agentName - The name of the agent (matches the filename without .md)
 * @returns AgentDefinition or null if not found/invalid
 */
export async function loadAgentDefinition(
  vaultAdapter: VaultAdapter,
  agentName: string
): Promise<AgentDefinition | null> {
  const agentPath = `forge/agents/${agentName}.md`;

  // Check if file exists
  if (!vaultAdapter.exists(agentPath)) {
    console.log(`[agent-loader] Agent not found: ${agentPath}`);
    return null;
  }

  try {
    const content = await vaultAdapter.readNote(agentPath);
    const { frontmatter, body } = parseFrontmatter(content);

    // Validate required fields
    if (!frontmatter.name || !frontmatter.description) {
      console.warn(`[agent-loader] Agent ${agentName} missing required frontmatter fields`);
      return null;
    }

    const agentDef: AgentDefinition = {
      name: frontmatter.name,
      description: frontmatter.description,
      tools: frontmatter.tools || [],
      model: frontmatter.model,
      maxTurns: frontmatter.maxTurns || 10,
      systemPrompt: body.trim()
    };

    return agentDef;
  } catch (error) {
    console.error(`[agent-loader] Failed to load agent ${agentName}:`, error);
    return null;
  }
}

/**
 * List all available agent definitions in forge/agents/.
 *
 * @param vaultAdapter - The vault adapter for listing files
 * @returns Array of valid agent names
 */
export async function listAvailableAgents(vaultAdapter: VaultAdapter): Promise<string[]> {
  const agents: string[] = [];

  // Check if forge/agents/ directory exists by looking for at least one file
  const testPath = 'forge/agents/.gitkeep';
  if (!vaultAdapter.exists(testPath)) {
    // Check if any agent files exist
    try {
      const files = vaultAdapter.listFiles('md');
      const agentFiles = files.filter(f => f.path.startsWith('forge/agents/') && f.path.endsWith('.md'));

      for (const file of agentFiles) {
        // Extract agent name from filename (remove forge/agents/ prefix and .md suffix)
        const agentName = file.path
          .replace('forge/agents/', '')
          .replace('.md', '');

        // Skip non-agent files
        if (agentName.startsWith('.')) continue;

        // Validate the agent definition
        const agentDef = await loadAgentDefinition(vaultAdapter, agentName);
        if (agentDef) {
          agents.push(agentName);
        }
      }
    } catch (error) {
      console.warn(`[agent-loader] Failed to list agents:`, error);
    }
  }

  return agents;
}
