# Feature Research

**Domain:** Obsidian AI Plugin / Personal Knowledge Management Agent
**Researched:** 2026-04-13
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Sidebar Chat Panel** | Core interaction surface for AI communication | LOW | Streaming responses, conversation history, context injection |
| **Note Read/Write** | Fundamental vault operations via Vault API | LOW | Must use `app.vault`, not filesystem |
| **Full-Text Search** | Finding notes by keyword | LOW | MetadataCache for fast search, embeddings optional |
| **Slash Commands** | Quick invocation of common actions | LOW | `/standup`, `/review`, `/free-dump`, etc. |
| **LLM Provider Config** | User-supplied API key (OpenAI/Anthropic/Gemini) | LOW | Settings tab for API key and model selection |
| **Wikilink Support** | Note interconnection | LOW | Auto-linking on note creation |
| **Frontmatter Management** | Note metadata | LOW | Validation on creation, atomic updates |
| **Session Context Injection** | Agent knows current state on startup | MEDIUM | MetadataCache first, content on-demand (token budget) |
| **Status Bar Indicator** | Visibility into agent state | LOW | Model name, token usage, session state |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Persistent Memory Across Sessions** | Agent remembers context between conversations without manual re-setting | HIGH | Cognitive memory system, session backups, index at startup |
| **Automatic Knowledge Routing** | Agent classifies and routes content to correct notes/zone | MEDIUM | Requires content classification + note creation in correct location |
| **Performance Review Evidence Capture** | Aggregates work evidence for reviews automatically | MEDIUM | Integration with Slack/GitHub for evidence, note generation |
| **Sub-Agent Spawning** | Heavy tasks (PR analysis, Slack scan) in isolated contexts | HIGH | pi SDK supports tool re-registration for isolated environments |
| **PARA-Based Knowledge Structure** | Work, Org, Performance, Cognitive, Reference, Draft, Forge zones | MEDIUM | Agent creates/maintains structure automatically |
| **Semantic Search (Embeddings)** | Find related notes by meaning, not keyword | MEDIUM | Optional v1 (fallback to metadataCache), sqlite-vec or local embeddings |
| **Knowledge Graph Visualization** | See connections between notes | MEDIUM | Graph view of wikilinks, semantic relationships |
| **Confidence-Based Knowledge Lifecycle** | Knowledge decays if unused, surfaces when relevant | HIGH | Like "Memory-Like-A-Tree" - sprout, green leaf, decay stages |
| **Self-Evolving Taxonomy** | Auto-reorganizes folder structure based on content | HIGH | MECE + Pyramid principles, link maintenance on move |
| **Event-Driven Workflows** | Triggers on vault events (note create, modify) | MEDIUM | Hooks at conversation or vault lifecycle |
| **Multi-Source Analysis** | Combine PDFs, videos, web content in single prompt | MEDIUM | File conversions, vision model for images |
| **Personas/Working Styles** | Custom system prompts per context | LOW | Per-persona approval settings |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-Time Autonomous Automation** | "Set it and forget it" | Users lose visibility, unexpected changes, no accountability | User-triggered operations with clear preview |
| **Multi-User Collaboration** | Team knowledge bases | Personal PKM scope, massive complexity increase | Not in scope - personal vault only |
| **CLI/Filesystem Duality** | Familiar developer workflow | Inconsistency with Vault API, race conditions | Vault API only (R-06) |
| **Complex Embedding Setup** | "Proper" semantic search | API keys, external services, latency | MetadataCache fallback, optional embeddings v1.x |
| **Background Autonomous Agents** | Always-working AI | Battery, resource, unexpected vault changes | All operations user-triggered (R-08) |
| **Full Cloud Sync** | Access anywhere | Privacy concerns, complexity, cost | Local-first, Obsidian Sync optional |

## Feature Dependencies

```
[Sidebar Chat Panel]
    └──requires──> [Note Read/Write]
    └──requires──> [LLM Provider Config]
    └──requires──> [Slash Commands]

[Session Context Injection]
    └──requires──> [Note Read/Write]
    └──requires──> [Frontmatter Management]

[Automatic Knowledge Routing]
    └──requires──> [Note Read/Write]
    └──requires──> [Wikilink Support]
    └──requires──> [PARA Structure]

[Performance Review Evidence Capture]
    └──requires──> [Note Read/Write]
    └──requires──> [External Integrations] (Slack, GitHub via requestUrl)
    └──requires──> [Knowledge Routing] (route evidence to correct notes)

[Sub-Agent Spawning]
    └──requires──> [Session Context Injection]
    └──requires──> [Note Read/Write] (isolated context for tools)

[Persistent Memory System]
    └──requires──> [Session Context Injection]
    └──requires──> [Note Read/Write]
    └──requires──> [Frontmatter Management]

[Semantic Search]
    └──optional──> [Note Read/Write] (v1 fallback: metadataCache)
    └──enhances──> [Full-Text Search]

[Status Bar Indicator]
    └──requires──> [LLM Provider Config]
```

### Dependency Notes

- **Chat Panel requires Note Read/Write:** Agent must be able to access and modify vault content
- **Session Context requires Note Read/Write + Frontmatter:** Load index of projects, tasks, recent changes
- **Knowledge Routing enhances Note Creation:** Agent auto-classifies and files content correctly
- **Sub-Agents enhance Heavy Tasks:** Isolated contexts prevent tool pollution
- **Semantic Search optional in v1:** MetadataCache sufficient for basic search, embeddings add later

## MVP Definition

### Launch With (v1)

Minimum viable product - what is needed to validate the concept.

- [ ] **Sidebar Chat Panel** - Core interaction surface; no agent is useful without it
- [ ] **Note Read/Write via Vault API** - Fundamental capability; all agent tools operate on notes
- [ ] **LLM Provider Config** - User provides API key; no value without AI
- [ ] **Slash Commands** - Quick invocation; /standup, /free-dump, /review as first commands
- [ ] **Session Context Injection** - North Star, active projects, recent changes loaded on startup
- [ ] **Basic Knowledge Routing** - Classify inbound messages and route to correct notes
- [ ] **PARA Knowledge Structure** - Agent creates/maintains zones (Work, Org, Performance, etc.)
- [ ] **Frontmatter Validation** - Enforce wikilink presence and frontmatter completeness on note creation

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **External Integrations** - Slack/GitHub evidence capture via requestUrl()
- [ ] **Performance Review Preparation** - Evidence aggregation, review brief generation
- [ ] **Sub-Agent Spawning** - Heavy tasks in isolated contexts
- [ ] **Status Bar Indicator** - Model, token usage, session state visibility
- [ ] **Mobile Graceful Degradation** - Silent feature removal on mobile

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Semantic Search (Embeddings)** - Vector search with sqlite-vec or local embeddings
- [ ] **Knowledge Graph Visualization** - Graph view of note connections
- [ ] **Confidence-Based Knowledge Lifecycle** - Auto-decay, surface relevant knowledge
- [ ] **Self-Evolving Taxonomy** - Auto-reorganize folder structure
- [ ] **Personas/Working Styles** - Custom system prompts per context
- [ ] **Event-Driven Workflows** - Trigger actions on vault events

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Sidebar Chat Panel | HIGH | LOW | P1 |
| Note Read/Write via Vault API | HIGH | LOW | P1 |
| LLM Provider Config | HIGH | LOW | P1 |
| Slash Commands | HIGH | LOW | P1 |
| Session Context Injection | HIGH | MEDIUM | P1 |
| PARA Knowledge Structure | HIGH | MEDIUM | P1 |
| Automatic Knowledge Routing | HIGH | MEDIUM | P1 |
| Frontmatter Validation | MEDIUM | LOW | P1 |
| External Integrations (Slack, GitHub) | HIGH | MEDIUM | P2 |
| Performance Review Preparation | HIGH | MEDIUM | P2 |
| Sub-Agent Spawning | MEDIUM | HIGH | P2 |
| Status Bar Indicator | MEDIUM | LOW | P2 |
| Semantic Search (Embeddings) | MEDIUM | MEDIUM | P3 |
| Knowledge Graph Visualization | MEDIUM | MEDIUM | P3 |
| Confidence-Based Knowledge Lifecycle | LOW | HIGH | P3 |
| Self-Evolving Taxonomy | LOW | HIGH | P3 |
| Personas/Working Styles | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Obsidian Copilot | Smart Connections | Claudian | Obsidian-Claude (ZanderRuss) | Obsidian PKM (AdrianV) | Our Approach |
|---------|-----------------|-------------------|----------|------------------------------|------------------------|--------------|
| Sidebar Chat | YES | NO (view only) | YES | YES (via Claude Code) | YES (MCP tools) | YES - sidebar panel |
| Note Read/Write | YES | NO | YES | YES (20 tools) | YES (20 MCP tools) | YES - Vault API |
| Semantic Search | NO | YES (embeddings) | NO | NO | YES (OpenAI embeddings) | Optional v1, MetadataCache fallback |
| Slash Commands | YES | YES | YES | YES (31 commands) | YES (2 commands) | YES - /standup, /free-dump, /review |
| Session Memory | NO | NO | YES | YES (VAULT-INDEX, MOCs) | YES (vault_activity log) | YES - cognitive memory system |
| PARA/Knowledge Zones | NO | NO | NO | YES | YES (PARA scaffolding) | YES - 7-zone structure |
| Sub-Agents | NO | NO | NO | YES (27 agents) | YES (3 agents) | YES - pi SDK isolation |
| External Integrations | YES (web) | NO | YES | NO | NO | YES (Slack, GitHub via requestUrl) |
| Performance Review | NO | NO | NO | YES (review commands) | NO | YES - evidence aggregation |
| Knowledge Routing | NO | NO | NO | YES (moc-agent) | NO | YES - auto-classification |
| Mobile Fallback | YES | YES | YES | UNKNOWN | YES | YES - silent degradation |

### Key Observations

1. **Session memory is a differentiator:** Most plugins do not persist context across sessions. Obsidian-Claude and Obsidian PKM have logging but not true cognitive memory.

2. **Knowledge routing is rare:** Only Obsidian-Claude has explicit routing agents (moc-agent, content-curator).

3. **Performance review is underserved:** Only Obsidian-Claude (ZanderRuss) has review-related commands; no plugin focuses on evidence capture and aggregation.

4. **PARA/zone structure is uncommon:** Only two plugins (Obsidian-Claude, Obsidian PKM) explicitly support PARA-based organization.

5. **Sub-agents exist but are complex:** Obsidian-Claude has 27 agents but requires Claude Code CLI; Obsidian Forge can use pi SDK for isolation.

## Sources

- [Obsidian Copilot (logancyang)](https://github.com/logancyang/obsidian-copilot) - Chat panel, commands, quick actions
- [Smart Connections (brianpetro)](https://github.com/brianpetro/obsidian-smart-connections) - Zero-setup embeddings, connections view, semantic search
- [Claudian](https://github.com/nickmackenzie/claudian) - Claude Code integration, session hooks
- [Obsidian-Claude (ZanderRuss)](https://github.com/ZanderRuss/obsidian-claude) - 31 commands, 27 agents, PARA, academic workflows
- [Obsidian PKM (AdrianV)](https://github.com/AdrianV101/obsidian-pkm-plugin) - 20 MCP tools, PARA scaffolding, 3 agents, vault operations
- [Notor](https://github.com/zachmueller/notor) - 19 vault tools, personas, workflows, MCP integration
- [VaultMind](https://github.com/Mathews-Tom/VaultMind) - Hybrid search, knowledge graph, episodic/procedural memory
- [Memory-Like-A-Tree](https://github.com/loryoncloud/Memory-Like-A-Tree) - Confidence-based knowledge lifecycle, auto-decay
- [My-Brain-System](https://github.com/Timeverse/My-Brain-System) - Self-evolving taxonomy, auto-reorganization
- [Obsidian MCP Server](https://github.com/cyanheads/obsidian-mcp-server) - Vault cache service, persistent memory for agents

---
*Feature research for: Obsidian AI Plugin / Personal Knowledge Management Agent*
*Researched: 2026-04-13*
