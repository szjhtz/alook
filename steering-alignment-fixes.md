# Steering Alignment Fixes — Follow-up Dev Plan

## Features / Showcase

Fix alignment gaps between alook's steering implementation and the agent-backends reference. All issues are in the steering-ON path only — steering-OFF (default) is unaffected.

### Before → After

| Issue | Before | After |
|---|---|---|
| turnState has no tool boundary gate | Messages can inject mid-thinking block | `canSteerBusy` gate blocks during thinking/tool boundaries |
| No stalled recovery | Hung agent stays hung forever | Stalled agent detected and terminated after configurable threshold |
| Notification spam | Every mailbox message sent immediately | Burst batching via debounce timer; session-scoped dedup |
| Claude missing internal_progress events | `system.status` / `stream_event` silently dropped | Mapped to `internal_progress`, improves liveness detection |
| Codex missing MCP/reasoning events | MCP tool calls invisible to steering | Mapped to `tool_call` / `thinking` |
| Weak error classification | No HTTP status extraction, 8 auth patterns | HTTP status detection, 23+ auth patterns, `NotFoundError` class |

---

## Designs Overview

This is a follow-up to the initial steering implementation. All changes are within existing files — no new files needed. The reference source is `agent-backends` at `/Users/gustavoye/Desktop/memodb_w/agent-backends/`.

---

## TODOs

### Prerequisite: Type Updates

- [x] **0.1 Update ParsedEvent type union in types.ts**
  - Extend `internal_progress` variant: add `source?: string`, `itemType?: string`, `payloadBytes?: number` fields (currently only has `detail?: string`)
  - Extend `turn_end` variant: add optional `sessionId?: string` field (needed for recovery features)
  - Add `NotFoundError` to any error class types if referenced in errorDiagnostics
  - **Files:** `src/cli/daemon/types.ts`
  - **Acceptance criteria:** ParsedEvent type supports enriched internal_progress and turn_end fields.

### Critical: Steering Gate

- [x] **1.1 Add steering gate to RuntimeTurnState**
  - Add `steeringGateActive: boolean` private field (default `false`)
  - Add `canSteerBusy` getter: `return Boolean(this._turnId && !this.steeringGateActive)` — this is the actual injection-safety check
  - Add `markToolBoundary()`: sets `steeringGateActive = true` — called on `tool_call`, `thinking`, `compaction_started` events (unsafe to inject)
  - Add `markProgress()`: sets `steeringGateActive = false` — called on `text`, `tool_output`, `compaction_finished` events (safe boundary)
  - Add `adoptTurnId(turnId)`: updates turn ID without changing gate state
  - Add `reset()`: clears all state
  - `markTurnStarted()`: also sets `steeringGateActive = false` (gate open at turn start)
  - `markTurnCompleted()`: also sets `steeringGateActive = false`
  - Reference: `agent-backends/src/runtime/turnState.ts` lines 16-62
  - **Files:** `src/cli/daemon/steering/turnState.ts`
  - **Acceptance criteria:** `canSteerBusy` returns false during tool boundaries, thinking blocks, and compaction. Returns true at safe points (after tool_output, text). Existing `isInTurn` behavior unchanged.

### Critical: Replace ApmStateMachine with Reference-Aligned Version

The current `apmStateMachine.ts` has a fundamentally different state shape (4 fields) and effect type (`{ type: "flush", messages }`) vs the reference (8 fields, `{ kind: "notify_stdin"|"deliver_stdin", reason, stdinMode, clauseId }`). TODOs below are a coordinated rewrite — not incremental patches.

- [x] **1.2 Rewrite ApmStateMachine to match reference**
  - **New state shape** — replace `ApmGatedState` (4 fields) with `ApmGatedSteeringState`:
    ```
    isIdle: boolean
    expectedTerminationReason: string | null
    phase: "idle" | "tool_wait" | "tool_boundary" | "assistant_continuation" | "compacting" | "error"
    outstandingToolUses: number
    compacting: boolean
    toolBoundaryFlushDisabled: boolean  (rename from flushDisabled — more precise)
    lastFlushReason: string | null
    recentEvents: string[]  (capped at 12)
    pendingMessages: string[]  (keep from current)
    ```
  - **New effect type** — replace `StdinDeliveryEffect` with:
    ```
    { kind: "notify_stdin" | "deliver_stdin"; reason: string; stdinMode: "busy" | "idle"; clauseId: "SMR-002" }
    ```
  - **Flush check** — `canFlush()` uses `turnState.canSteerBusy` (not `turnState.isInTurn`). Keep `turnState.isInTurn` for idle-vs-busy mode selection only.
  - **All reducers to implement:**
    - `reduceApmIdleState(state, { isIdle })` — track idle/busy
    - `reduceApmGatedToolUse(state, { kind })` → returns `{ state, hadOutstandingToolUse, shouldFlushToolBatch, effects }`
    - `reduceApmGatedCompaction(state, { kind })` → handles `compaction_started`, `compaction_finished`, `compaction_interrupted` (interrupted = reset without flush)
    - `reduceApmGatedAssistantContinuation(state)` → update phase
    - `reduceApmGatedFlushReadiness(state, { isGated, hasSession, inboxLength, reason })` → central gating decision with structured blockedReason
    - `reduceApmGatedTurnEnd(state, { inboxLength, supportsStdinNotification, hasSession })` → flush remaining + reset
    - `reduceApmGatedError(state, { disableToolBoundaryFlush })` → set phase to error, disable flush
    - `reduceApmGatedFlush(state, { reason })` → record flush reason
    - `reduceApmGatedRecentEvent(state, { event })` → maintain capped event history
    - `reduceApmStalledRecoveryTermination(state, input)` → stalled recovery check (input: `inboxLength, staleForMs, staleThresholdMs, runtimeProgressIsStale, hasSession, busyDeliveryMode, hasDirectStdinRecoveryEvidence`)
    - `reduceApmStartupTimeoutTermination(state, { hasRuntimeProgressEvent })` → startup timeout check
  - **Keep `reduceApmGatedEnqueue()`** — this is alook-specific (reference doesn't need it because messages are held in notificationState inbox, not in APM state). Adapt to new state shape.
  - Reference: `agent-backends/src/runtime/apmStateMachine.ts` (full file, 327 lines)
  - **Files:** `src/cli/daemon/steering/apmStateMachine.ts`
  - **Acceptance criteria:** All reducer functions implemented with reference-matching logic. Phase tracking works. Stalled recovery returns `shouldTerminate` correctly. Event history capped at 12.

- [x] **1.3 Rewire session-runner for new ApmStateMachine + turnState gate**
  - This is a coordinated update — ALL existing reducer call sites change shape. Before/after:
    - `turnState.isInTurn` checks for injection safety → `turnState.canSteerBusy`
    - `reduceApmGatedToolUse(state, input, turnState)` → `reduceApmGatedToolUse(state, input)` (no turnState arg — gate check moves to `reduceApmGatedFlushReadiness`)
    - `reduceApmGatedCompaction(state, input, turnState)` → `reduceApmGatedCompaction(state, input)` (same)
    - `reduceApmGatedEnqueue(state, message, turnState)` → adapt to new state shape
    - `reduceApmGatedTurnEnd(state)` → `reduceApmGatedTurnEnd(state, { inboxLength, ... })`
    - Effect handling: `eff.type === "flush"` → `eff.kind === "notify_stdin" | "deliver_stdin"`
  - **Add turnState gate transitions** in ParsedEvent consumer:
    - `tool_call` → `turnState.markToolBoundary()` BEFORE reducer
    - `tool_output` → `turnState.markProgress()` BEFORE reducer
    - `text` → `turnState.markProgress()`
    - `thinking` → `turnState.markToolBoundary()`
    - `compaction_started` → `turnState.markToolBoundary()`
    - `compaction_finished` → `turnState.markProgress()`
  - **Add stalled recovery timer:** `setInterval` (30s) checks `reduceApmStalledRecoveryTermination()` with `progressState.ageMs()` and `progressState.isStale`. If `shouldTerminate`, kill agent process.
  - **Add startup timeout check:** On first progress timer tick, check `reduceApmStartupTimeoutTermination()`. If no progress events received, kill agent.
  - **Files:** `src/cli/daemon/session-runner.ts`
  - **Acceptance criteria:** All reducer calls updated to new API. turnState gate transitions wired. Stalled recovery and startup timeout active. No old-API calls remain.

### Critical: Notification State

- [x] **2.1 Add session-scoped dedup + debounce to NotificationState**
  - Add `sessionId` tracking: `contributedIdentities: Set<string>`, `contributionSessionId: string | null`
  - `isDuplicateNotice(fingerprint, sessionId)` — 2-part key (fingerprint + sessionId)
  - `recordNoticeWritten(fingerprint, sessionId, messages)` — track contributed identities per session
  - `filterUncontributedMessages(messages, sessionId)` — reset tracking on session boundary
  - Add pending count: `pendingCount` field, `add(count)`, `takePendingAndClearTimer()`
  - Add debounce timer: `schedule(callback, delayMs)` — one-shot timer for batching bursts
  - Add encode failure tracking: `recordNoticeEncodeFailed()`, `isDuplicateEncodeFailedNotice()`
  - Normalize identity: prefix seq with `"s:"`, message_id/id with `"m:"` to prevent collisions between numeric and string IDs
  - Validate `seq` as finite positive number (not just string)
  - Reference: `agent-backends/src/runtime/notificationState.ts` lines 47-134
  - **Files:** `src/cli/daemon/steering/notificationState.ts`
  - **Acceptance criteria:** Bursts of notifications batched via debounce timer. Session boundary resets contribution tracking. Encode failures cached. Identity normalization prevents collisions.

- [x] **2.2 Update session-runner to use new NotificationState API**
  - Update mailbox watcher callback to pass `sessionId` to `isDuplicateNotice()` and `markSent()`
  - Use `schedule()` for debounced delivery instead of immediate
  - **Files:** `src/cli/daemon/session-runner.ts`
  - **Acceptance criteria:** Mailbox watcher uses session-scoped dedup and debounced delivery.

### High: Event Mapping Gaps

- [x] **3.1 Claude: add `internal_progress` for system status/stream events**
  - In `claude.ts` `parseLine()`, `system` case: add mapping for subtypes `"status"` and `"stream_event"` → `{ kind: "internal_progress", source: "system", itemType: subtype }`
  - Uses the enriched `internal_progress` ParsedEvent variant (from TODO 0.1)
  - These currently fall through to the `default` case (logged as debug)
  - Reference: `agent-backends/src/drivers/claudeEventNormalizer.ts` lines 67-74
  - **Files:** `src/cli/daemon/agent/claude.ts`
  - **Depends on:** 0.1
  - **Acceptance criteria:** Claude `system.status` and `system.stream_event` emit `internal_progress` ParsedEvents with source and itemType.

- [x] **3.2 Claude: enrich telemetry + turn_end with sessionId**
  - In `parseLine()` result case, extract additional fields from `usage`: `cache_creation_input_tokens`, `cache_read_input_tokens`, `service_tier`
  - Add `cost` and `duration_ms` from `event.cost` and `event.duration_ms` if present
  - `turn_end` event should carry `sessionId` when available (needed by recovery features in 1.2)
  - Reference: `agent-backends/src/drivers/claudeEventNormalizer.ts` lines 110-132
  - **Files:** `src/cli/daemon/agent/claude.ts`
  - **Depends on:** 0.1
  - **Acceptance criteria:** Telemetry ParsedEvent includes cache/cost/timing fields. turn_end carries sessionId.

- [x] **3.3 Codex: add MCP, WebSearch, CollabAgent, Reasoning, Compaction events**
  - In `codex.ts` `parseLine()`, `item/started` case: add mappings for:
    - `mcpToolCall` → `{ kind: "tool_call", name: "mcp_<toolName>" }`
    - `webSearch` → `{ kind: "tool_call", name: "web_search" }`
    - `collabAgentToolCall` → `{ kind: "tool_call", name: "collab_agent" }`
    - `contextCompaction` → `{ kind: "compaction_started" }`
  - In `item/completed` case: add mappings for:
    - `reasoning` → `{ kind: "thinking", text }`
    - `mcpToolCall` → `{ kind: "tool_output", callId, output }` (MCP tool completion)
    - `contextCompaction` → `{ kind: "compaction_finished" }`
    - `agentMessage` text extraction — verify completeness (already partially implemented)
  - Reference: `agent-backends/src/drivers/codexEventNormalizer.ts` lines 89-125
  - **Files:** `src/cli/daemon/agent/codex.ts`
  - **Acceptance criteria:** Codex MCP, web search, collaboration, reasoning, and compaction events all appear as correct ParsedEvents.

- [x] **3.4 Codex: map `item/agentMessage/delta` as text, not internal_progress**
  - Currently mapped as `{ kind: "internal_progress", detail: delta }` — should be `{ kind: "text", text: delta }` to match agent-backends behavior
  - Reference: `agent-backends/src/drivers/codexEventNormalizer.ts` — delta events emit `text`
  - **Files:** `src/cli/daemon/agent/codex.ts` (line ~170)
  - **Acceptance criteria:** Agent message streaming deltas are `text` events, not `internal_progress`.

### Moderate: Error Diagnostics

- [x] **4.1 Upgrade error classification: HTTP extraction + explicit token detection**
  - Add `extractHttpStatus(message: string): number | null` function — regex to extract HTTP status codes from labeled ("HTTP 429") and semantic ("status: 401") contexts
  - Add explicit `Error`/`Exception` token extraction: regex `/\b([A-Z][A-Za-z0-9_]*(?:Error|Exception))\b/` checked FIRST in priority chain
  - **Change `classifyRuntimeError()` signature** from `(message: string)` to `(message: string, httpStatus?: number | null)`. If httpStatus is not passed, auto-extract via `extractHttpStatus()`.
  - **Update all callers** of `classifyRuntimeError()` in session-runner.ts
  - Classification priority: explicit Error/Exception token → HTTP status → text pattern → fallback
  - HTTP status mappings: 429 → `RateLimitError`, 401/403 → `AuthError`, 404 → `NotFoundError` (new), 5xx → `ProviderServerError`, other 4xx → `ProviderApiError`
  - Add `NotFoundError` to `ErrorClass` type
  - **Remove bare numeric patterns** from `RATE_LIMIT_PATTERNS` (`/429/i`), `AUTH_PATTERNS` (`/401/`, `/403/`), and `SERVER_PATTERNS` (`/5\d{2}/`) — these are now handled by HTTP status extraction and would cause double-matching
  - Reference: `agent-backends/src/runtime/errorDiagnostics.ts` lines 68-100
  - **Files:** `src/cli/daemon/steering/errorDiagnostics.ts`, `src/cli/daemon/session-runner.ts`
  - **Acceptance criteria:** HTTP status correctly extracted and classified. Explicit Error tokens detected first. No double-matching from bare numeric patterns. `NotFoundError` class added. Callers updated.

- [x] **4.2 Expand auth patterns to match agent-backends coverage**
  - Add 15+ additional auth patterns from agent-backends: token revocation, refresh failures, logout states, credential not found, API key missing, etc.
  - Reference: `agent-backends/src/runtime/errorDiagnostics.ts` lines 41-62 (23+ patterns)
  - **Files:** `src/cli/daemon/steering/errorDiagnostics.ts`
  - **Acceptance criteria:** All 23+ auth patterns from agent-backends are covered. Token revocation and refresh failures correctly classified as `AuthError`.

### Moderate: Progress State

- [x] **5.1 Add `ageMs()` to RuntimeProgressState + refactor `shouldMarkStale`**
  - Add `ageMs(nowMs?: number): number` method — returns milliseconds since last event
  - Refactor `shouldMarkStale(thresholdMs, now)` to use `ageMs()` internally for consistency
  - Used by stalled recovery logic (TODO 1.2/1.3)
  - Reference: `agent-backends/src/runtime/progressState.ts` lines 31-33
  - **Files:** `src/cli/daemon/steering/progressState.ts`
  - **Acceptance criteria:** `ageMs()` returns correct elapsed time. `shouldMarkStale` delegates to `ageMs()`.

> **Note:** Phase tracking, event history, `compaction_interrupted`, stalled recovery, and startup timeout are all included in TODO 1.2 (ApmStateMachine rewrite). They are not separate TODOs.

### Tests

- [x] **6.1 Update turnState tests for new gate methods**
  - Test `canSteerBusy`: false during tool boundary, true after markProgress, false during thinking
  - Test `markToolBoundary()` → `markProgress()` cycle
  - Test `adoptTurnId()`, `reset()`
  - **Files:** `src/cli/daemon/steering/__tests__/turnState.test.ts`
  - **Acceptance criteria:** All gate transitions tested. `canSteerBusy` correct at each state.

- [x] **6.2 Rewrite apmStateMachine tests for new API**
  - Test all new reducers: tool use, compaction (including `compaction_interrupted`), flush readiness, turn end, error, stalled recovery, startup timeout
  - Test phase transitions across reducer calls
  - Test `reduceApmStalledRecoveryTermination()`: stale + inbox → terminate; not stale → no terminate
  - Test `reduceApmStartupTimeoutTermination()`: no progress → terminate; has progress → no terminate
  - Test `canFlush()` uses `canSteerBusy` (not `isInTurn`)
  - Test `recentEvents` capped at 12
  - **Files:** `src/cli/daemon/steering/__tests__/apmStateMachine.test.ts`
  - **Acceptance criteria:** All reducers tested including new ones. Phase transitions verified. Recovery/timeout logic covered.

- [x] **6.3 New notificationState tests for session-scoped dedup + debounce**
  - Test session boundary resets contribution tracking
  - Test debounce timer behavior
  - Test encode failure caching
  - Test identity normalization (`s:` / `m:` prefixes)
  - **Files:** `src/cli/daemon/steering/__tests__/notificationState.test.ts` (new file)
  - **Acceptance criteria:** All new NotificationState features tested.

- [x] **6.4 Update parseLine tests for new event mappings**
  - Claude: test `system.status` → `internal_progress`, enriched telemetry
  - Codex: test `mcpToolCall`, `webSearch`, `reasoning`, `agentMessage` delta as `text`
  - **Files:** `src/cli/daemon/agent/__tests__/claude.parseLine.test.ts`, `src/cli/daemon/agent/__tests__/codex.parseLine.test.ts`
  - **Acceptance criteria:** All new event mappings have test coverage.

- [x] **6.5 Update error diagnostics tests**
  - Test HTTP status extraction from various message formats
  - Test `NotFoundError` classification for 404
  - Test expanded auth patterns (token revocation, refresh failures)
  - **Files:** `src/cli/daemon/steering/__tests__/errorDiagnostics.test.ts`
  - **Acceptance criteria:** All new error classes and patterns tested.

---

## Test Cases

### turnState gate
- [ ] `canSteerBusy` false when no turn active
- [ ] `canSteerBusy` true after `markTurnStarted()` (gate open at turn start)
- [ ] `canSteerBusy` false after `markToolBoundary()` (tool call in flight)
- [ ] `canSteerBusy` true after `markProgress()` (tool output received)
- [ ] `canSteerBusy` false after `thinking` event (thinking = gate closed)
- [ ] `canSteerBusy` false during compaction
- [ ] Gate reopens after `compaction_finished`
- [ ] `reset()` clears all state

### Stalled recovery + startup timeout
- [ ] Agent stale > threshold with inbox messages → `shouldTerminate: true`
- [ ] Agent stale > threshold with empty inbox → `shouldTerminate: false` (nothing to deliver)
- [ ] Agent not stale with inbox messages → `shouldTerminate: false`
- [ ] Startup timeout: no progress events within window → `shouldTerminate: true`
- [ ] Startup timeout: has progress events → `shouldTerminate: false`
- [ ] `compaction_interrupted` resets compacting flag without flushing

### Notification dedup
- [ ] Session boundary resets contribution tracking
- [ ] Same fingerprint + same sessionId → duplicate
- [ ] Same fingerprint + different sessionId → not duplicate
- [ ] Debounce timer batches burst of 3 notifications into 1 delivery
- [ ] Encode failure cached, not retried
- [ ] Identity normalization: numeric seq gets `"s:"` prefix
- [ ] Identity normalization: string id gets `"m:"` prefix

### Event mappings
- [ ] Claude `system.status` → `internal_progress`
- [ ] Claude `system.stream_event` → `internal_progress`
- [ ] Claude telemetry includes `cache_creation_input_tokens`, `cache_read_input_tokens`
- [ ] Codex `item/started` mcpToolCall → `tool_call` with name `"mcp_<name>"`
- [ ] Codex `item/started` webSearch → `tool_call` with name `"web_search"`
- [ ] Codex `item/started` contextCompaction → `compaction_started`
- [ ] Codex `item/completed` reasoning → `thinking`
- [ ] Codex `item/completed` mcpToolCall → `tool_output`
- [ ] Codex `item/completed` contextCompaction → `compaction_finished`
- [ ] Codex `item/agentMessage/delta` → `text` (not internal_progress)
- [ ] Claude `turn_end` carries sessionId

### Error diagnostics
- [ ] "HTTP 429" → extracted status 429 → `RateLimitError`
- [ ] "status: 401" → extracted status 401 → `AuthError`
- [ ] "HTTP 404" → extracted status 404 → `NotFoundError`
- [ ] "token revoked" → `AuthError` (expanded pattern)
- [ ] "refresh token expired" → `AuthError` (expanded pattern)

---

## New Dependencies

**None.**

---

## Modified Files Summary

```
src/cli/daemon/steering/turnState.ts           ← add gate (canSteerBusy, markToolBoundary, markProgress)
src/cli/daemon/steering/apmStateMachine.ts      ← wire canSteerBusy, add stalled recovery, phase tracking
src/cli/daemon/steering/notificationState.ts    ← session dedup, debounce, encode failure tracking
src/cli/daemon/steering/progressState.ts        ← add ageMs()
src/cli/daemon/steering/errorDiagnostics.ts     ← HTTP extraction, expanded auth patterns, NotFoundError
src/cli/daemon/agent/claude.ts                  ← internal_progress mapping, enriched telemetry
src/cli/daemon/agent/codex.ts                   ← MCP/reasoning/webSearch mappings, delta as text
src/cli/daemon/session-runner.ts                ← wire gate transitions, stalled recovery timer, new notification API
src/cli/daemon/steering/__tests__/*.test.ts     ← updated tests
src/cli/daemon/agent/__tests__/*.test.ts        ← updated tests
```
