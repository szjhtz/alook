/**
 * Per-agent typing-scope tracker — the daemon's in-memory record of which
 * DM conversation ids each running bot should be broadcasting a "bot is
 * typing…" pill for. Populated on each `agent:wake` (from
 * `unreadNotice.dmConversationId`), read by the heartbeat manager, and
 * cleared bulk on turn end.
 *
 * Set semantics — repeated `add` for the same scope is a no-op, so two
 * wakes for the same DM inside one coalesced turn don't double the frame
 * rate. Kept as a plain in-memory Map (daemon is single-process per
 * machine, tracker doesn't need to survive a crash — the client's 8s
 * auto-expire cleans up if the daemon dies mid-turn).
 */
export interface TypingScopeTracker {
  /** Insert (idempotent) a DM scope for this agent. */
  add(agentId: string, dmConversationId: string): void;
  /** Current DM scopes for this agent (empty if none / unknown). */
  snapshot(agentId: string): string[];
  /** Whether this agent has ANY active scope. */
  hasAny(agentId: string): boolean;
  /** Drop all scopes for this agent. */
  clear(agentId: string): void;
}

export function createTypingScopeTracker(): TypingScopeTracker {
  const scopes = new Map<string, Set<string>>();
  return {
    add(agentId, dmConversationId) {
      let set = scopes.get(agentId);
      if (!set) {
        set = new Set();
        scopes.set(agentId, set);
      }
      set.add(dmConversationId);
    },
    snapshot(agentId) {
      const set = scopes.get(agentId);
      return set ? [...set] : [];
    },
    hasAny(agentId) {
      const set = scopes.get(agentId);
      return !!set && set.size > 0;
    },
    clear(agentId) {
      scopes.delete(agentId);
    },
  };
}
