import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  RuntimeNotificationState,
  inboxNoticeMessageIdentity,
  computeInboxNoticeFingerprint,
} from "../notificationState.js";

describe("inboxNoticeMessageIdentity", () => {
  it("numeric seq gets s: prefix", () => {
    expect(inboxNoticeMessageIdentity({ seq: 42 })).toBe("s:42");
  });

  it("string message_id gets m: prefix", () => {
    expect(inboxNoticeMessageIdentity({ message_id: "abc" })).toBe("m:abc");
  });

  it("string id gets m: prefix", () => {
    expect(inboxNoticeMessageIdentity({ id: "xyz" })).toBe("m:xyz");
  });

  it("empty fields return empty string", () => {
    expect(inboxNoticeMessageIdentity({})).toBe("");
  });

  it("invalid seq (NaN) falls through to id", () => {
    expect(inboxNoticeMessageIdentity({ seq: NaN as unknown as number, id: "fallback" })).toBe("m:fallback");
  });

  it("negative seq falls through", () => {
    expect(inboxNoticeMessageIdentity({ seq: -1, message_id: "mid" })).toBe("m:mid");
  });

  it("seq priority over message_id", () => {
    expect(inboxNoticeMessageIdentity({ seq: 5, message_id: "mid" })).toBe("s:5");
  });
});

describe("computeInboxNoticeFingerprint", () => {
  it("empty messages → empty fingerprint", () => {
    expect(computeInboxNoticeFingerprint([])).toBe("");
  });

  it("sorted keys joined by comma", () => {
    const fp = computeInboxNoticeFingerprint([{ seq: 2 }, { seq: 1 }]);
    expect(fp).toBe("s:1,s:2");
  });

  it("skips messages with no identity", () => {
    const fp = computeInboxNoticeFingerprint([{ seq: 1 }, {}]);
    expect(fp).toBe("s:1");
  });
});

describe("RuntimeNotificationState", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  describe("isDuplicateNotice", () => {
    it("same fingerprint + same session → duplicate", () => {
      const ns = new RuntimeNotificationState();
      ns.recordNoticeWritten("fp1", "sess1");
      expect(ns.isDuplicateNotice("fp1", "sess1")).toBe(true);
    });

    it("same fingerprint + different session → not duplicate", () => {
      const ns = new RuntimeNotificationState();
      ns.recordNoticeWritten("fp1", "sess1");
      expect(ns.isDuplicateNotice("fp1", "sess2")).toBe(false);
    });

    it("empty fingerprint → never duplicate", () => {
      const ns = new RuntimeNotificationState();
      ns.recordNoticeWritten("", "sess1");
      expect(ns.isDuplicateNotice("", "sess1")).toBe(false);
    });
  });

  describe("session boundary resets contribution tracking", () => {
    it("filterUncontributedMessages returns all on new session", () => {
      const ns = new RuntimeNotificationState();
      ns.recordNoticeWritten("fp1", "sess1", [{ seq: 1 }]);
      const result = ns.filterUncontributedMessages([{ seq: 1 }], "sess2");
      expect(result).toHaveLength(1);
    });

    it("filterUncontributedMessages filters contributed in same session", () => {
      const ns = new RuntimeNotificationState();
      ns.recordNoticeWritten("fp1", "sess1", [{ seq: 1 }, { seq: 2 }]);
      const result = ns.filterUncontributedMessages([{ seq: 1 }, { seq: 3 }], "sess1");
      expect(result).toHaveLength(1);
      expect(result[0].seq).toBe(3);
    });
  });

  describe("debounce timer", () => {
    it("schedule fires after delay", () => {
      const ns = new RuntimeNotificationState();
      let called = false;
      ns.schedule(() => { called = true; }, 100);
      expect(called).toBe(false);
      vi.advanceTimersByTime(100);
      expect(called).toBe(true);
    });

    it("second schedule returns false while armed", () => {
      const ns = new RuntimeNotificationState();
      expect(ns.schedule(() => {}, 100)).toBe(true);
      expect(ns.schedule(() => {}, 100)).toBe(false);
    });

    it("takePendingAndClearTimer cancels timer", () => {
      const ns = new RuntimeNotificationState();
      ns.add(3);
      let called = false;
      ns.schedule(() => { called = true; }, 100);
      const count = ns.takePendingAndClearTimer();
      expect(count).toBe(3);
      vi.advanceTimersByTime(200);
      expect(called).toBe(false);
    });
  });

  describe("encode failure tracking", () => {
    it("recordNoticeEncodeFailed caches failure", () => {
      const ns = new RuntimeNotificationState();
      ns.recordNoticeEncodeFailed("fp1", "sess1");
      expect(ns.isDuplicateEncodeFailedNotice("fp1", "sess1")).toBe(true);
    });

    it("successful write clears encode failure", () => {
      const ns = new RuntimeNotificationState();
      ns.recordNoticeEncodeFailed("fp1", "sess1");
      ns.recordNoticeWritten("fp1", "sess1");
      expect(ns.isDuplicateEncodeFailedNotice("fp1", "sess1")).toBe(false);
    });

    it("empty fingerprint not cached", () => {
      const ns = new RuntimeNotificationState();
      ns.recordNoticeEncodeFailed("", "sess1");
      expect(ns.isDuplicateEncodeFailedNotice("", "sess1")).toBe(false);
    });
  });

  describe("pending count", () => {
    it("add increments, takePending resets", () => {
      const ns = new RuntimeNotificationState();
      ns.add(1);
      ns.add(2);
      expect(ns.pendingCount).toBe(3);
      const count = ns.takePendingAndClearTimer();
      expect(count).toBe(3);
      expect(ns.pendingCount).toBe(0);
    });
  });
});
