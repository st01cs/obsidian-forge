---
phase: "01-foundation"
plan: "02"
subsystem: "tool-registry"
tags: ["foundation", "tools", "mobile", "tool-registry"]
dependency_graph:
  requires:
    - "01-01-PLAN.md"
  provides:
    - "ToolRegistry"
    - "IS_MOBILE"
  affects:
    - "agent-session"
tech_stack:
  added: []
  patterns:
    - "defineTool() from pi-coding-agent for all tool definitions"
    - "TypeBox Type.Object() for parameter schemas"
    - "AgentToolResult with content + details structure"
    - "IS_MOBILE gating for desktop-only tools"
    - "vaultAdapter delegation for all vault operations"
key_files:
  created:
    - "src/mobile.ts"
    - "src/ToolRegistry.ts"
decisions:
  - "Added label property to all tools (required by pi-coding-agent ToolDefinition)"
  - "Used explicit type casts for http_request tool details to satisfy TypeScript strict mode"
  - "Wrapped agent fn in Function constructor for vault_edit tool (Rule 1 - Bug)"
metrics:
  duration: "<5 min"
  completed: "2026-04-14"
---

# Phase 01 Plan 02: ToolRegistry Summary

## One-liner

ToolRegistry created with 11 Obsidian-native tools (10 always, 2 desktop-only) and mobile platform detection gating bash/git on mobile.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create mobile platform detection module | a74826c | src/mobile.ts |
| 2 | Create ToolRegistry class with all 11 Obsidian-native tools | 2b0ea4f | src/ToolRegistry.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pi-coding-agent defineTool API mismatch**
- **Found during:** Task 2 - TypeScript compile check
- **Issue:** pi-coding-agent@0.66.1 defineTool() requires `label` property and different execute signature (5 params: toolCallId, params, signal, onUpdate, ctx) and AgentToolResult requires both `content` array and `details` object
- **Fix:** Added `label` to all tool definitions, changed execute signatures to match pi SDK API, returned `{ content: [...], details: {} }` from all tools
- **Files modified:** src/ToolRegistry.ts
- **Commit:** 2b0ea4f

**2. [Rule 1 - Bug] Fixed vault_edit tool Function type**
- **Found during:** Task 2 - TypeScript compile check
- **Issue:** `new Function('content', fn)` returns `Function` type which is not assignable to `(content: string) => string` parameter
- **Fix:** Changed to `new Function('content', `return (${fn})(content)`) as (content: string) => string`
- **Files modified:** src/ToolRegistry.ts
- **Commit:** 2b0ea4f

**3. [Rule 1 - Bug] Fixed http_request tool TypeScript union type mismatch**
- **Found during:** Task 2 - TypeScript compile check
- **Issue:** Union type for details (success: {status, size} | error: {error}) caused type incompatibility
- **Fix:** Added explicit type casts `status: response.status as number | undefined` to unify the types
- **Files modified:** src/ToolRegistry.ts
- **Commit:** 2b0ea4f

## Verification

- TypeScript compiles with strict mode (`npx tsc --noEmit` passes)
- src/mobile.ts exports IS_MOBILE and IS_DESKTOP booleans
- ToolRegistry class has register/unregister/getTools/hasTool/registerDefaultTools methods
- 11 tools defined: vault_read, vault_write, vault_edit, vault_search, metadata_query, get_backlinks, get_orphans, vault_rename, list_files, http_request, bash (desktop), git_log (desktop)
- bash and git_log only registered when IS_MOBILE is false

## Self-Check

- [x] src/mobile.ts created with IS_MOBILE and IS_DESKTOP exports
- [x] src/ToolRegistry.ts created with ToolRegistry class
- [x] All 11 tools defined using defineTool()
- [x] TypeScript compiles without errors
- [x] Commits a74826c and 2b0ea4f exist
