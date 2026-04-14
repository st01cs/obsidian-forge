/**
 * SubAgentManager - manages sub-agent spawning and execution.
 *
 * SUBG-01: Heavy tasks spawn isolated sub-agent sessions via createAgentSession().
 * SUBG-02: Tool whitelist enforced at spawn time via customTools parameter.
 * SUBG-03: Long-running sub-agents use requestIdleCallback via runWhenIdle().
 *
 * Sub-agents use SessionManager.inMemory() for isolation - each sub-agent has
 * its own session that doesn't share state with the main session.
 */

import { VaultAdapter } from '../VaultAdapter';
import { ToolRegistry } from '../ToolRegistry';
import { getPiSDK } from '../pi-loader';
import { loadAgentDefinition, AgentDefinition } from './agent-loader';
import { runWhenIdle } from './idle-guard';

export interface SubAgentSession {
  session: any;
  cancel: () => void;
}

export interface SubAgentCallbacks {
  onChunk?: (chunk: string) => void;
  onComplete?: (result: string) => void;
  onError?: (error: Error) => void;
}

/**
 * SubAgentManager handles the lifecycle of sub-agents.
 *
 * Sub-agents are isolated agent sessions that can run heavy tasks without
 * blocking the main session. They are defined in forge/agents/*.md files
 * with YAML frontmatter specifying their configuration.
 */
export class SubAgentManager {
  private vaultAdapter: VaultAdapter;
  private toolRegistry: ToolRegistry;

  constructor(vaultAdapter: VaultAdapter, toolRegistry: ToolRegistry) {
    this.vaultAdapter = vaultAdapter;
    this.toolRegistry = toolRegistry;
  }

  /**
   * Spawn a new sub-agent with the given configuration.
   *
   * SUBG-01: Uses createAgentSession() with SessionManager.inMemory() for isolation.
   * SUBG-02: Filters tools via customTools to enforce whitelist at spawn time.
   *
   * @param agentName - Name of the agent definition (without .md extension)
   * @param taskPrompt - The task/instruction for the sub-agent
   * @param callbacks - Optional callbacks for streaming results
   * @returns SubAgentSession with session and cancel function
   */
  async spawnSubAgent(
    agentName: string,
    taskPrompt: string,
    callbacks?: SubAgentCallbacks
  ): Promise<SubAgentSession> {
    // Load agent definition
    const agentDef = await loadAgentDefinition(this.vaultAdapter, agentName);

    if (!agentDef) {
      throw new Error(`SubAgentManager: Agent definition not found for "${agentName}"`);
    }

    const sdk = getPiSDK();

    // Get all registered tools and filter by whitelist
    const allTools = this.toolRegistry.getTools();
    const allowedToolNames = new Set(agentDef.tools);
    const filteredTools = allTools.filter(tool => allowedToolNames.has(tool.name));

    if (filteredTools.length === 0 && agentDef.tools.length > 0) {
      console.warn(`[SubAgentManager] No tools matched whitelist for agent ${agentName}:`, agentDef.tools);
    }

    // Build system prompt: agent definition + task + constraints
    const systemPrompt = this.buildSubAgentSystemPrompt(agentDef, taskPrompt);

    // Create resource loader with custom system prompt
    const resourceLoader = new sdk.DefaultResourceLoader({
      cwd: this.getVaultPath(),
      agentDir: '~/.pi/forge/subagents',
      systemPromptOverride: () => systemPrompt
    });
    await resourceLoader.reload();

    // Set up auth and model
    const authStorage = sdk.AuthStorage.create();
    const modelRegistry = sdk.ModelRegistry.create(authStorage);
    const model = agentDef.model
      ? sdk.getModel(agentDef.model as any)
      : sdk.getModel('openai', 'gpt-4o');

    // Create isolated session with filtered tools
    const { session, cancel } = await sdk.createAgentSession({
      cwd: this.getVaultPath(),
      agentDir: '~/.pi/forge/subagents',
      model,
      authStorage,
      modelRegistry,
      customTools: filteredTools,
      resourceLoader,
      sessionManager: sdk.SessionManager.inMemory(), // SUBG-01: Isolation
      settingsManager: undefined,
      maxTurns: agentDef.maxTurns
    });

    // Subscribe to session events for streaming
    if (callbacks?.onChunk || callbacks?.onComplete) {
      session.subscribe((event: any) => {
        switch (event.type) {
          case 'message_update':
            if (callbacks.onChunk && event.delta) {
              callbacks.onChunk(event.delta);
            }
            break;

          case 'agent_end':
            if (callbacks.onComplete && event.finalMessage) {
              callbacks.onComplete(event.finalMessage);
            }
            break;

          case 'error':
            if (callbacks.onError && event.error) {
              callbacks.onError(new Error(event.error));
            }
            break;
        }
      });
    }

    return { session, cancel };
  }

  /**
   * Run a sub-agent with idle guard to avoid blocking UI.
   *
   * SUBG-03: Uses runWhenIdle() to wrap execution with requestIdleCallback.
   *
   * @param agentName - Name of the agent definition
   * @param taskPrompt - The task/instruction for the sub-agent
   * @param callbacks - Optional callbacks for streaming results
   * @returns Promise resolving to the agent's final message
   */
  async runSubAgentWithIdleGuard(
    agentName: string,
    taskPrompt: string,
    callbacks?: SubAgentCallbacks
  ): Promise<string> {
    return runWhenIdle(async () => {
      const { session, cancel } = await this.spawnSubAgent(agentName, taskPrompt, callbacks);

      try {
        // Run the session with the task prompt
        const result = await session.prompt(taskPrompt);
        return typeof result === 'string' ? result : JSON.stringify(result);
      } finally {
        // Clean up session
        cancel();
      }
    }, { timeout: 5000 }); // 5 second timeout for idle callback
  }

  /**
   * Run a sub-agent synchronously (blocking).
   * Use for short-running tasks only.
   *
   * @param agentName - Name of the agent definition
   * @param taskPrompt - The task/instruction for the sub-agent
   * @returns Promise resolving to the agent's final message
   */
  async runSubAgentBlocking(
    agentName: string,
    taskPrompt: string
  ): Promise<string> {
    const { session, cancel } = await this.spawnSubAgent(agentName, taskPrompt);

    try {
      const result = await session.prompt(taskPrompt);
      return typeof result === 'string' ? result : JSON.stringify(result);
    } finally {
      cancel();
    }
  }

  /**
   * Build the system prompt for a sub-agent.
   * Combines agent definition system prompt with task context.
   */
  private buildSubAgentSystemPrompt(agentDef: AgentDefinition, taskPrompt: string): string {
    return `## Sub-Agent: ${agentDef.name}

${agentDef.systemPrompt}

---

## Current Task

${taskPrompt}

---

## Constraints
- You are running as a sub-agent with limited tool access
- Available tools: ${agentDef.tools.join(', ') || 'none'}
- Complete your task and provide a clear result
`;
  }

  /**
   * Get the vault root path for session creation.
   */
  private getVaultPath(): string {
    return (this.vaultAdapter as any).app.vault.adapter.getBasePath?.() || '.';
  }
}
