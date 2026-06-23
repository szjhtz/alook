/**
 * RuntimeProgressState — granular liveness detection.
 *
 * Distinguishes real events (tool_call, text, tool_output, turn_end) from
 * internal progress (streaming deltas, compaction). Real events reset clock
 * AND clear stale flag. Internal progress resets clock but does NOT clear stale.
 * markStale() is idempotent: second call does not reset staleSince.
 */

import type { ParsedEvent } from "../types.js";

export class RuntimeProgressState {
  private lastEventAt: number;
  private lastEventKind: string | null = null;
  private _staleSince: number | null = null;
  private _isStale = false;

  constructor(now: number = Date.now()) {
    this.lastEventAt = now;
  }

  get isStale(): boolean {
    return this._isStale;
  }

  get staleSince(): number | null {
    return this._staleSince;
  }

  get lastActivity(): number {
    return this.lastEventAt;
  }

  ageMs(nowMs: number = Date.now()): number {
    return nowMs - this.lastEventAt;
  }

  /**
   * Record a real event — resets clock AND clears stale flag.
   * Real events: text, tool_call, tool_output, turn_end
   */
  recordRealEvent(kind: string, now: number = Date.now()): void {
    this.lastEventAt = now;
    this.lastEventKind = kind;
    this._isStale = false;
    this._staleSince = null;
  }

  /**
   * Record internal progress — resets clock but does NOT clear stale flag.
   * Internal: internal_progress, compaction events, telemetry
   */
  recordInternalProgress(kind: string, now: number = Date.now()): void {
    this.lastEventAt = now;
    this.lastEventKind = kind;
  }

  /**
   * Mark as stale. Idempotent: second call does not reset staleSince.
   */
  markStale(now: number = Date.now()): void {
    if (this._isStale) return;
    this._isStale = true;
    this._staleSince = now;
  }

  /**
   * Check if the agent should be considered stale given a threshold.
   */
  shouldMarkStale(thresholdMs: number, now: number = Date.now()): boolean {
    if (this._isStale) return false; // already stale
    return this.ageMs(now) > thresholdMs;
  }

  /**
   * Convenience: process a ParsedEvent and record it appropriately.
   */
  processEvent(event: ParsedEvent, now: number = Date.now()): void {
    switch (event.kind) {
      case "text":
      case "tool_call":
      case "tool_output":
      case "turn_end":
      case "session_init":
      case "error":
        this.recordRealEvent(event.kind, now);
        break;
      case "internal_progress":
      case "compaction_started":
      case "compaction_finished":
      case "telemetry":
      case "thinking":
        this.recordInternalProgress(event.kind, now);
        break;
      default:
        this.recordInternalProgress(event.kind, now);
    }
  }
}
