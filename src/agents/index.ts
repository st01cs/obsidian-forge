/**
 * Agents barrel export
 *
 * Re-exports all agent-related modules for convenient importing.
 */

export { SubAgentManager } from './sub-agent-manager';
export { loadAgentDefinition, listAvailableAgents, parseFrontmatter } from './agent-loader';
export type { AgentDefinition } from './agent-loader';
export { scheduleIdleCallback, runWhenIdle, processWithIdleBreaks } from './idle-guard';
export type { IdleGuardOptions } from './idle-guard';
