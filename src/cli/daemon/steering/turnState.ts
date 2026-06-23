/**
 * RuntimeTurnState — the fine-grained steering gate.
 *
 * For `busyDeliveryMode: "gated"` runtimes (Claude), the daemon may NOT inject a
 * busy message at an arbitrary instant: a raw stdin write mid-stream can collide
 * with an active signed thinking block. This tiny state machine tracks whether
 * we're currently at a safe point.
 *
 *   turn starts        → gate OPEN  (canSteerBusy = true)
 *   tool boundary hit  → gate SHUT  (hold writes)
 *   progress observed  → gate OPEN
 *   turn completes     → idle, gate OPEN
 *
 * `canSteerBusy` is the single question the delivery path asks before writing.
 */
export class RuntimeTurnState {
  private currentTurnId: string | null = null;
  private steeringGateActive = false;

  get isInTurn(): boolean {
    return this.currentTurnId !== null;
  }

  get turnId(): string | null {
    return this.currentTurnId;
  }

  get canSteerBusy(): boolean {
    return Boolean(this.currentTurnId && !this.steeringGateActive);
  }

  markTurnStarted(turnId?: string | null): void {
    if (turnId !== undefined && turnId !== null) {
      this.currentTurnId = turnId;
    }
    this.steeringGateActive = false;
  }

  adoptTurnId(turnId: string | null): void {
    this.currentTurnId = turnId;
  }

  markToolBoundary(): void {
    this.steeringGateActive = true;
  }

  markProgress(): void {
    this.steeringGateActive = false;
  }

  markTurnCompleted(): void {
    this.currentTurnId = null;
    this.steeringGateActive = false;
  }

  reset(): void {
    this.currentTurnId = null;
    this.steeringGateActive = false;
  }
}
