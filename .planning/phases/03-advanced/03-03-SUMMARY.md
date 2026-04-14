---
phase: '03'
plan: '03'
subsystem: commands
tags: [phase-03, commands, CMND-04, CMND-05, CMND-06, CMND-07, CMND-08, CMND-09]
dependency_graph:
  requires: []
  provides:
    - CMND-04: /weekly command (cross-session summary, pattern discovery)
    - CMND-05: /1on1 command (meeting notes formatter)
    - CMND-06: /incident command (Slack timeline reconstruction)
    - CMND-07: /brag command (achievement recording with GitHub evidence)
    - CMND-08: /report command (performance review brief)
    - CMND-09: /audit command (knowledge base audit)
  affects:
    - src/main.ts
    - src/commands/
tech_stack:
  added: []
  patterns:
    - session.prompt() pattern for all commands
    - SlackClient integration for incident.ts
    - GitHubClient integration for brag.ts
    - SubAgentManager.runSubAgentWithIdleGuard() for audit.ts
key_files:
  created:
    - src/commands/weekly.ts (CMND-04)
    - src/commands/1on1.ts (CMND-05)
    - src/commands/incident.ts (CMND-06)
    - src/commands/brag.ts (CMND-07)
    - src/commands/report.ts (CMND-08)
    - src/commands/audit.ts (CMND-09)
  modified:
    - src/main.ts (wired all 6 commands)
decisions: []
metrics:
  duration: ~
  completed: '2026-04-14'
---

# Phase 03 Plan 03: Advanced Commands Summary

## One-liner
Six advanced commands implemented: /weekly, /1on1, /incident, /brag, /report, /audit — all using session.prompt() pattern with external integrations.

## What Was Built

Implemented all six advanced Obsidian Forge commands (CMND-04 through CMND-09):

| Command | File | Description |
|---------|------|-------------|
| `/weekly` | weekly.ts | Cross-session weekly summary with ISO week formatting, pattern discovery, and 成果 report |
| `/1on1` | 1on1.ts | Structures meeting notes into standard 1:1 format with participant, topics, decisions, action items |
| `/incident` | incident.ts | Captures incidents from Slack, reconstructs chronological timeline, creates event docs |
| `/brag` | brag.ts | Records achievements with GitHub PR evidence links to performance/brag.md |
| `/report` | report.ts | Generates performance review brief from brag doc, work/, cognitive/decisions/, and session summaries |
| `/audit` | audit.ts | Comprehensive knowledge base audit: orphans, frontmatter, stale content, wikilinks, index status |

## Key Design Decisions

- **session.prompt() pattern**: All commands follow the established Phase 2 pattern — open chat panel, send structured prompt to agent
- **Integration points**: incident.ts uses SlackClient, brag.ts uses GitHubClient, audit.ts uses SubAgentManager
- **Fallback handling**: audit.ts has runQuickAudit() for when agent session is unavailable
- **Output paths**: Weekly summaries → forge/cognitive/sessions/YYYY-WXX.md, Incidents → reference/events/, Brags → performance/brag.md, Reports → performance/reviews/, Audits → cognitive/audits/

## Deviations from Plan

None — plan executed exactly as written.

## Commits

All 7 tasks committed individually. See individual task commits for details.

## Verification

All must_haves satisfied:
- /weekly command produces cross-session weekly summary with pattern discovery and 成果 report
- /1on1 command structures meeting notes into standard 1:1 format
- /incident command captures incident from Slack, reconstructs timeline, creates event doc
- /brag command records 成果 with evidence links to Brag Doc
- /report command generates performance review brief from evidence chain
- /audit command checks knowledge base: orphans, broken links, frontmatter gaps, stale content
- All commands registered in command palette via main.ts registerCommands()

## Self-Check: PASSED

Files created: weekly.ts, 1on1.ts, incident.ts, brag.ts, report.ts, audit.ts — all verified with grep patterns matching plan specifications.
