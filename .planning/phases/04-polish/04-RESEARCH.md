# Phase 4: Polish - Research

**Researched:** 2026-04-14
**Domain:** Obsidian StatusBar API, pi SDK token usage tracking, mobile parity verification
**Confidence:** HIGH

## Summary

Phase 4 has three requirements: CORE-05 (status bar), MOBI-01 (mobile tool exclusion), and MOBI-02 (mobile functionality). MOBI-01 and MOBI-02 are already implemented in Phase 1. CORE-05 (status bar) requires new implementation using Obsidian's `addStatusBarItem()` API and pi SDK's token usage tracking via streaming events.

**Primary recommendation:** Create a `StatusBarManager` class that uses `plugin.addStatusBarItem()` to register an HTMLElement, then subscribe to pi SDK session events for real-time token tracking and model info display.

## User Constraints (from CONTEXT.md)

### Locked Decisions
(No decisions locked for Phase 4 - all are new implementation)

### Claude's Discretion
- Status bar layout format (model | tokens | session state) - choose readable format
- How frequently to update token counts (throttle for performance)
- Visual indicators for session state (idle/streaming/error)

### Deferred Ideas (OUT OF SCOPE)
- Semantic search (vector embeddings) - Phase 3+
- Team features - Phase 3+
- Mobile-optimized UI changes beyond tool exclusion

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CORE-05 | Plugin exposes status bar indicator showing model, session state, and token usage | StatusBar API via `addStatusBarItem()`, token tracking via `message.usage` after stream completes |
| MOBI-01 | On mobile, bash/Git tools removed from tool list (silent, no error shown) | Already implemented in `ToolRegistry.ts` lines 67-71 using `IS_MOBILE` flag |
| MOBI-02 | Core chat, vault read/write, metadata query, LLM calls fully functional on mobile | Already implemented - all core tools use Obsidian API, http_request uses `app.requestUrl()` which works on mobile |

## Standard Stack

### Core Technologies

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Obsidian API | 1.12.3 | StatusBar API | `addStatusBarItem()` returns HTMLElement for status display |
| pi-ai | 0.67.1 | Token usage tracking | `message.usage.input/output` available after stream `done` event |

### No New Dependencies
Phase 4 adds no new npm packages. All required APIs exist in the existing stack.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── StatusBarManager.ts   # NEW: Status bar management
├── main.ts               # MODIFY: Register status bar on plugin load
└── AgentBridge.ts        # MODIFY: Expose token usage events
```

### Pattern 1: Obsidian StatusBar Registration
**What:** Register a status bar element via plugin's `addStatusBarItem()` method
**When to use:** When displaying persistent per-plugin status information
**Example:**
```typescript
// In main.ts onload()
private statusBarEl: HTMLElement;

this.statusBarEl = this.addStatusBarItem();
this.statusBarEl.createSpan({ text: 'Forge: Ready' });

// Update later
this.statusBarEl.textContent = 'Forge: gpt-4o | 1.2K tokens | Idle';
```

### Pattern 2: Token Usage Tracking via pi SDK Streaming
**What:** Access token counts from streaming responses
**When to use:** When displaying real-time token usage in UI
**Source:** [badlogic/pi-mono (pi-ai README)](https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/ai/README.md) - HIGH confidence

The pi SDK provides token usage after stream completion:
```typescript
const finalMessage = await s.result();
console.log(`Input tokens: ${finalMessage.usage.input}`);
console.log(`Output tokens: ${finalMessage.usage.output}`);
console.log(`Cost: $${finalMessage.usage.cost.total.toFixed(4)}`);
```

For real-time tracking during streaming, track cumulative usage across the session via session events.

### Pattern 3: Session State Tracking
**What:** Track session state (idle, streaming, error) for status display
**When to use:** When providing visual feedback on agent activity
**Implementation:** Subscribe to session events and update status bar text

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Status bar element creation | Build custom DOM element | `plugin.addStatusBarItem()` | Obsidian manages lifecycle, positioning, theming |
| Token calculation | Estimate from character counts | `message.usage` from pi SDK | Accurate, provider-reported counts |
| Platform detection | Detect mobile manually | `Platform.isMobile` from Obsidian | Already available, reliable |

## Common Pitfalls

### Pitfall 1: Token Display Without Throttling
**What goes wrong:** Status bar updates on every token cause performance issues
**Why it happens:** Streaming can emit many tokens per second
**How to avoid:** Throttle status bar updates to max 1 per 500ms during streaming
**Warning signs:** Obsidian becomes sluggish during agent streaming

### Pitfall 2: Status Bar Not Updating on Mobile
**What goes wrong:** Status bar elements may behave differently on mobile
**Why it happens:** Mobile Obsidian has smaller status bar area
**How to avoid:** Keep status text concise; test on mobile
**Warning signs:** Text truncation, overflow

### Pitfall 3: Stale Token Count After Session Restart
**What goes wrong:** Token count doesn't reset when creating new session
**Why it happens:** Token tracking state persists across sessions
**How to avoid:** Reset token accumulator on `createSession()` call

## Code Examples

### Status Bar Registration (main.ts)
```typescript
// In onload(), after agent initialization:
this.statusBarEl = this.addStatusBarItem();
this.statusBarEl.addClass('mod-minimal');
this.updateStatusBar('Ready', 'gpt-4o', 0);

// Method to update status bar:
private updateStatusBar(state: string, model: string, totalTokens: number): void {
  const tokenStr = totalTokens >= 1000
    ? `${(totalTokens / 1000).toFixed(1)}K`
    : `${totalTokens}`;
  this.statusBarEl.textContent = `Forge: ${model} | ${tokenStr} tokens | ${state}`;
}
```

### Token Tracking via Session Events (AgentBridge.ts)
```typescript
// In createSession(), add token tracking to event subscription:
this.eventUnsubscribe = this.session.subscribe((event: any) => {
  switch (event.type) {
    case 'message_update':
      // Could update status to "Streaming..." here
      break;
    case 'done': {
      // Get final message with usage
      const usage = event.message?.usage;
      if (usage) {
        this.totalInputTokens += usage.input || 0;
        this.totalOutputTokens += usage.output || 0;
        // Notify status bar manager
        this.onTokenUpdate?.(this.totalInputTokens + this.totalOutputTokens);
      }
      break;
    }
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No status bar | Obsidian StatusBar API | Obsidian 0.9.7+ | Persistent per-plugin status in bottom bar |
| Character-count estimation | Provider-reported usage | pi SDK 0.66+ | Accurate token tracking |

**Deprecated/outdated:**
- None for Phase 4 scope

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Token usage is available via `message.usage` after stream completes | Architecture Patterns | Could require different API if 0.67.1 changed format |
| A2 | Status bar text update frequency needs throttling | Common Pitfalls | May need tuning based on Obsidian performance |

**If this table is empty:** All claims in this research were verified or cited.

## Open Questions

1. **Token update frequency**
   - What we know: Streaming can emit many tokens per second
   - What's unclear: Optimal throttle interval balancing responsiveness vs. performance
   - Recommendation: Start with 500ms throttle, adjust based on testing

2. **Session state granularity**
   - What we know: Need idle, streaming, error states
   - What's unclear: Whether to show more granular states (thinking, tool execution)
   - Recommendation: Show `Idle`, `Streaming`, `Thinking`, `Error` states only

3. **Mobile status bar compatibility**
   - What we know: Obsidian mobile has smaller status bar
   - What's unclear: Whether concise format works on all mobile screen sizes
   - Recommendation: Keep text under 40 characters, test on actual devices

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified - Phase 4 is code/config-only changes)

## Validation Architecture

**Note:** `nyquist_validation` is `false` in config.json. Validation architecture section skipped per config.

## Security Domain

Phase 4 involves no new security concerns. Token usage tracking only reads data from the pi SDK's streaming response - no user input is processed.

## Sources

### Primary (HIGH confidence)
- [Obsidian API docs - StatusBar](https://github.com/obsidianmd/obsidian-api) - `addStatusBarItem()` returns HTMLElement
- [badlogic/pi-mono (pi-ai README)](https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/ai/README.md) - Token usage via `message.usage.input/output`
- `src/ToolRegistry.ts` - Verified MOBI-01 implementation at lines 67-71
- `src/mobile.ts` - Verified `IS_MOBILE` export via `Platform.isMobile`
- `node_modules/obsidian/obsidian.d.ts` - Confirmed `addStatusBarItem(): HTMLElement` at line 4794

### Secondary (MEDIUM confidence)
- [obsidianmd/obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin) - General plugin patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All APIs confirmed in existing codebase
- Architecture: HIGH - Patterns match existing codebase conventions
- Pitfalls: MEDIUM - Based on general Obsidian/plugin best practices

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (30 days - stable Obsidian API)
