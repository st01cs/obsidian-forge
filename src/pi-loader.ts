/**
 * ESM dynamic import wrapper for pi SDK packages.
 *
 * The pi packages (@mariozechner/pi-coding-agent, @mariozechner/pi-ai) are
 * ESM-only and CANNOT be statically imported in a CJS Obsidian plugin.
 * Dynamic import() returns a Promise and works across module boundaries.
 *
 * This module is the ONLY entry point for pi SDK imports.
 * All other modules must use loadPiSDK(), isPiLoaded(), getPiSDK() from here.
 */

let sdk: PiSDK | null = null;

export { Type } from './pi-stub';
export type { ToolDefinition } from './pi-stub';
export { defineTool } from './pi-stub';

export interface PiSDK {
  createAgentSession: typeof import('@mariozechner/pi-coding-agent').createAgentSession;
  SessionManager: typeof import('@mariozechner/pi-coding-agent').SessionManager;
  defineTool: typeof import('@mariozechner/pi-coding-agent').defineTool;
  pi: typeof import('@mariozechner/pi-ai');
  AuthStorage: typeof import('@mariozechner/pi-coding-agent').AuthStorage;
  ModelRegistry: typeof import('@mariozechner/pi-coding-agent').ModelRegistry;
  getModel: typeof import('@mariozechner/pi-ai').getModel;
}

/**
 * Dynamically import pi SDK packages (ESM-only).
 * Called once at plugin onload and cached in this module.
 */
export async function loadPiSDK(): Promise<PiSDK> {
  if (sdk) return sdk;

  try {
    const [codingAgent, ai] = await Promise.all([
      import('@mariozechner/pi-coding-agent'),
      import('@mariozechner/pi-ai')
    ]);

    sdk = {
      createAgentSession: codingAgent.createAgentSession,
      SessionManager: codingAgent.SessionManager,
      defineTool: codingAgent.defineTool,
      pi: ai,
      AuthStorage: codingAgent.AuthStorage,
      ModelRegistry: codingAgent.ModelRegistry,
      getModel: ai.getModel
    };
    return sdk;
  } catch (error) {
    throw new Error(`pi SDK load failed: ${error}`);
  }
}

export function isPiLoaded(): boolean {
  return sdk !== null;
}

export function getPiSDK(): PiSDK {
  if (!sdk) throw new Error('pi SDK not loaded - call loadPiSDK() first');
  return sdk;
}
