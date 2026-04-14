---
phase: 03-advanced
plan: '01'
subsystem: sub-agent-infrastructure
tags:
  - SUBG-01
  - SUBG-02
  - SUBG-03
  - sub-agents
  - pi-sdk
dependency_graph:
  requires: []
  provides:
    - SUBG-01: spawnSubAgent() creates isolated sessions
    - SUBG-02: loadAgentDefinition() parses forge/agents/*.md frontmatter
    - SUBG-03: runWhenIdle() wraps with requestIdleCallback
  affects:
    - src/AgentBridge.ts
    - src/main.ts
tech_stack:
  added:
    - src/agents/sub-agent-manager.ts
    - src/agents/agent-loader.ts
    - src/agents/idle-guard.ts
    - src/agents/index.ts
    - forge/agents/win-discoverer.md
    - forge/agents/audit-agent.md
  patterns:
    - SessionManager.inMemory() for sub-agent isolation
    - requestIdleCallback for non-blocking UI
    - YAML frontmatter for agent definition metadata
key_files:
  created:
    - src/agents/sub-agent-manager.ts
    - src/agents/agent-loader.ts
    - src/agents/idle-guard.ts
    - src/agents/index.ts
    - forge/agents/win-discoverer.md
    - forge/agents/audit-agent.md
  modified:
    - src/AgentBridge.ts
    - src/main.ts
decisions:
  - id: SUBG-01
    description: Sub-agents use createAgentSession() with SessionManager.inMemory() for isolation
  - id: SUBG-02
    description: Agent definitions stored as forge/agents/*.md with YAML frontmatter
  - id: SUBG-03
    description: Long-running sub-agents wrapped with requestIdleCallback via runWhenIdle()
metrics:
  duration: "<1 minute"
  completed: 2026-04-14
  tasks_completed: 5
---

# Phase 03 Plan 01: Sub-agent Infrastructure Summary

## One-liner

Sub-agent infrastructure with SubAgentManager, agent loader, idle guard, and sample agent definitions.

## What Was Built

**SubAgentManager** (`src/agents/sub-agent-manager.ts`):
- `spawnSubAgent(agentName, taskPrompt, callbacks?)` - Creates isolated sub-agent session via `createAgentSession()` with `SessionManager.inMemory()` for isolation
- `runSubAgentWithIdleGuard()` - Wraps spawnSubAgent with requestIdleCallback for non-blocking UI
- `runSubAgentBlocking()` - Synchronous version for short-running tasks
- Filters tools via customTools parameter to enforce whitelist at spawn time (SUBG-02)

**Agent Loader** (`src/agents/agent-loader.ts`):
- `AgentDefinition` interface with name, description, tools, model, maxTurns, systemPrompt
- `parseFrontmatter(content)` - Extracts YAML frontmatter and markdown body
- `loadAgentDefinition(vaultAdapter, agentName)` - Loads single agent definition
- `listAvailableAgents(vaultAdapter)` - Returns all valid agent names in forge/agents/

**Idle Guard** (`src/agents/idle-guard.ts`):
- `scheduleIdleCallback(callback, options?)` - Schedules work during idle periods with requestIdleCallback
- `runWhenIdle(fn, options?)` - Wraps async function in idle callback
- `processWithIdleBreaks(items, processor, options?)` - Yields between items for long batches

**Sample Agents**:
- `forge/agents/win-discoverer.md` - Finds undocumented achievements in work/ notes and Git history
- `forge/agents/audit-agent.md` - Audits knowledge base for orphans, broken links, frontmatter gaps

## Commits

- `609564e`: feat(03-advanced-01): implement sub-agent infrastructure

## Verification Results

All automated checks passed:
- `loadAgentDefinition|listAvailableAgents` found in agent-loader.ts
- `parseFrontmatter` found in agent-loader.ts
- `scheduleIdleCallback|runWhenIdle` found in idle-guard.ts
- `requestIdleCallback` found in idle-guard.ts
- `spawnSubAgent|runSubAgentWithIdleGuard` found in sub-agent-manager.ts
- `SessionManager.inMemory` found in sub-agent-manager.ts
- YAML frontmatter fields found in agent definition files
- SubAgentManager wired to main.ts

## Requirements Satisfied

| Requirement | Description | Status |
|-------------|-------------|--------|
| SUBG-01 | Sub-agents spawn via createAgentSession() with SessionManager.inMemory() | Done |
| SUBG-02 | Agent definitions in forge/agents/*.md with YAML frontmatter | Done |
| SUBG-03 | requestIdleCallback wrapper for long-running tasks | Done |

## Self-Check: PASSED

All created files verified:
- FOUND: src/agents/agent-loader.ts
- FOUND: src/agents/idle-guard.ts
- FOUND: src/agents/sub-agent-manager.ts
- FOUND: src/agents/index.ts
- FOUND: forge/agents/win-discoverer.md
- FOUND: forge/agents/audit-agent.md
- FOUND: 609564e
