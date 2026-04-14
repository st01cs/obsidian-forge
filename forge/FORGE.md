---
type: forge-manual
version: 1.0
created: 2026-04-14
---

# Obsidian Forge Manual

Welcome to Obsidian Forge! This is your personal AI-powered knowledge management system.

## Zone Structure

Your vault is organized using the PARA method:

- **work/** - Work notes, projects, and tasks
- **org/** - People, teams, and organizations
- **performance/** - Brag documents, performance reviews, achievements
- **cognitive/** - Memory, decisions, patterns, and learning
- **reference/** - Architecture docs, tech references, guides
- **draft/** - Temporary analysis and drafts
- **forge/** - Operation manual, commands, agents, sessions

## Commands

Type `/` in the chat panel to see available commands. Commands can also be invoked from the Obsidian command palette (Ctrl/Cmd+P).

### Core Commands

#### /standup

Morning standup that loads your context and shows tasks.

**Usage:**
1. Type `/standup` in chat or run "Forge: Morning Standup" from command palette
2. Agent loads your NORTHSTAR.md, active projects, yesterday's session, and open tasks
3. Review the structured standup and ask for priority suggestions

**What it shows:**
- Current focus from your NORTHSTAR
- Yesterday's session summary
- Active projects (work/ folder + project:true notes)
- Open tasks with due dates
- Suggested priorities

#### /free-dump

Capture unstructured thoughts and let the agent classify and route them.

**Usage:**
1. Type `/free-dump` in chat
2. Share any thought, idea, or note
3. Agent classifies it (decision, event, win, 1:1, architecture, person, project update)
4. Agent routes to the correct PARA zone with proper frontmatter

**Classification types:**
- decision → cognitive/decisions/
- event → reference/events/
- win → performance/
- 1:1 → work/meetings/ or org/meetings/
- architecture → reference/architecture/
- person → org/people/
- project update → work/projects/

#### /review

Session review that validates your knowledge base.

**Usage:**
1. Type `/review` in chat
2. Agent scans for:
   - Orphan notes (no backlinks)
   - Missing frontmatter (date, description, tags)
   - Outdated indexes
   - Missed wins/achievements
3. Agent updates indexes if needed

### Command Palette

All commands are available in the Obsidian command palette:
- Press Ctrl/Cmd+P to open
- Type "Forge" to see all Obsidian Forge commands
- Commands: Open conversation, Morning Standup, Free Dump, Session Review

### Future Commands

The following commands are planned for future phases:
- `/weekly` - Cross-session weekly summary with pattern discovery
- `/1on1` - Structure meeting notes into standard 1:1 format
- `/incident` - Capture incident from Slack, reconstruct timeline
- `/brag` - Record an achievement with evidence links to Brag Doc
- `/report` - Generate performance review brief from evidence chain
- `/audit` - Check orphans, broken links, frontmatter gaps, stale content

## How It Works

Obsidian Forge embeds an AI agent that:
1. Reads and writes notes via Obsidian's Vault API
2. Maintains context across sessions
3. Routes knowledge to the correct zones
4. Validates frontmatter and wikilinks

## Required Frontmatter

Every note should include:
- date: YYYY-MM-DD
- description: ~150 characters describing the note
- tags: array of relevant tags

Notes over 300 characters should include at least one wikilink to another note.

## Knowledge Routing

When the agent captures content, it classifies and routes to appropriate zones:
- **decisions** → cognitive/decisions/
- **events** → reference/events/
- **wins/achievements** → performance/
- **meetings** → work/meetings/ or org/meetings/
- **architecture decisions** → reference/architecture/
- **people info** → org/people/
- **project updates** → work/projects/{project}/

Edit this file to customize your operation manual!
