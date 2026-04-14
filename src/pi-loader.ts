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

import type { VaultAdapter } from './VaultAdapter';
import type { ToolRegistry } from './ToolRegistry';
import type { ObsidianForgeSettings } from './main';

let sdk: PiSDK | null = null;
let loadError: string | null = null;

// Re-export pi-stub types for backwards compatibility during transition
export { Type } from './pi-stub';
export type { ToolDefinition, Message, StreamCallbacks } from './pi-stub';
export { defineTool, pi } from './pi-stub';

export interface PiSDK {
  createAgentSession: typeof import('@mariozechner/pi-coding-agent').createAgentSession;
  SessionManager: typeof import('@mariozechner/pi-coding-agent').SessionManager;
  DefaultResourceLoader: typeof import('@mariozechner/pi-coding-agent').DefaultResourceLoader;
  defineTool: typeof import('@mariozechner/pi-coding-agent').defineTool;
  pi: typeof import('@mariozechner/pi-ai');
  AuthStorage: typeof import('@mariozechner/pi-ai').AuthStorage;
  ModelRegistry: typeof import('@mariozechner/pi-ai').ModelRegistry;
  getModel: typeof import('@mariozechner/pi-ai').getModel;
}

/**
 * Dynamically import pi SDK packages (ESM-only).
 * Called once at plugin onload, stores result in module singleton.
 *
 * The pi packages (@mariozechner/pi-coding-agent@0.67.1, @mariozechner/pi-ai@0.67.1)
 * are ESM-only and CANNOT be statically imported in a CJS Obsidian plugin.
 * Dynamic import() returns a Promise and works across module boundaries.
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
      DefaultResourceLoader: codingAgent.DefaultResourceLoader,
      defineTool: codingAgent.defineTool,
      pi: ai,
      AuthStorage: ai.AuthStorage,
      ModelRegistry: ai.ModelRegistry,
      getModel: ai.getModel
    };
    console.log('[pi-loader] pi SDK loaded successfully');
    return sdk;
  } catch (error) {
    loadError = String(error);
    console.error('[pi-loader] Failed to load pi SDK:', error);
    throw new Error(`pi SDK load failed: ${error}. Install: npm install @mariozechner/pi-coding-agent@0.67.1 @mariozechner/pi-ai@0.67.1`);
  }
}

export function isPiLoaded(): boolean {
  return sdk !== null;
}

export function getPiSDK(): PiSDK {
  if (!sdk) throw new Error('pi SDK not loaded - call loadPiSDK() first');
  return sdk;
}

export function getLoadError(): string | null {
  return loadError;
}
