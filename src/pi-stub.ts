/**
 * Stub implementations of pi SDK types for Obsidian plugin compatibility.
 *
 * Phase 1: These are minimal stubs to allow the plugin to load.
 * Phase 2+: Will integrate real pi-coding-agent and pi-ai packages.
 *
 * The pi packages (@mariozechner/pi-coding-agent, @mariozechner/pi-ai) are
 * ESM-only and cannot be required() from a CJS Obsidian plugin. This stub
 * provides the same type signatures so the source code compiles correctly.
 */

// Minimal TypeBox stub - only what's used by ToolRegistry
// Used only for type-level schema definitions at compile time
export const Type = {
  Object: (schema: any) => schema,
  String: (opts?: any) => ({ type: 'string', ...opts }),
  Optional: (t: any) => t,
  Number: (opts?: any) => ({ type: 'number', ...opts }),
  Boolean: (opts?: any) => ({ type: 'boolean', ...opts }),
  Array: (t: any) => ({ type: 'array', items: t }),
  Record: (k: any, v: any) => ({ type: 'object', additionalProperties: v })
};

/**
 * Tool definition return type - matches pi-coding-agent's defineTool return.
 * TOOL-01, TOOL-02: ToolRegistry uses this type.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: any;
  execute(context: any, args: any): Promise<{ content: Array<{ type: 'text'; text: string }> }>;
}

/**
 * Stub for pi-coding-agent's defineTool function.
 * Creates a tool definition compatible with the pi SDK interface.
 */
export function defineTool(config: {
  name: string;
  description: string;
  parameters: any;
  execute: (context: any, args: any) => Promise<{ content: Array<{ type: 'text'; text: string }> }>;
}): ToolDefinition {
  return {
    name: config.name,
    description: config.description,
    parameters: config.parameters,
    execute: config.execute
  };
}

/**
 * Message type for chat streaming - matches pi-ai's Message interface.
 * CORE-02: ChatPanel uses this for streamToAgent().
 */
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Stub streaming callback interface for pi.ai.stream().
 * CORE-02: Used by ChatPanel for real-time token display.
 */
export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

/**
 * Stub for pi.ai global singleton.
 * Phase 1: Logs a warning that the agent is not yet configured.
 * Phase 2+: Will be replaced with actual pi.ai integration.
 */
export const pi = {
  /**
   * Stub streaming method - logs warning and returns resolved promise.
   * CORE-02: Real implementation streams tokens from LLM.
   */
  stream: async (messages: Message[], callbacks: StreamCallbacks): Promise<void> => {
    console.warn('[ObsidianForge] pi.ai.stream() stub called - agent not configured');
    callbacks.onComplete();
  }
};
