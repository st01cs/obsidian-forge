# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 01-foundation
**Areas discussed:** Auto mode — all gray areas resolved from PRD/research synthesis

---

## Claude's Discretion

All Phase 1 gray areas resolved via auto-mode synthesis from PRD and research:

- **Plugin code organization:** Modular folder structure — 16 requirements in Phase 1 require modularity
- **Chat panel implementation:** Custom ItemView (NOT pi-web-ui) — Tailwind CSS conflicts with Obsidian
- **pi SDK package set:** pi-coding-agent + pi-ai only (no pi-web-ui)
- **esbuild configuration:** Standard Obsidian plugin config, CommonJS, ES2020 target
- **TypeScript configuration:** Strict mode enabled
- **Settings storage:** Obsidian plugin data API, API key in settings object
- **Platform detection:** Platform.isMobile at module load time
- **Vault structure creation:** Onload check + create zones + FORGE.md
- **Slash command registration:** Command palette + slash prefix parsing
- **ToolRegistry architecture:** Class with register/unregister, Obsidian tool replacements

## Deferred Ideas

- Semantic search (vector embeddings) — Phase 3+
- Sub-agent isolation patterns — Phase 3
- External integration (Slack/GitHub API details) — Phase 3
- Knowledge graph visualization — Phase 4+
