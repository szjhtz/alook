import { describe, it, expect } from "vitest";
import {
  buildMonthCells,
  agentColor,
  agentDot,
  agentInk,
  dateKey,
  sameDay,
  isTodayMonth,
  stepDate,
} from "./calendar-month-grid";

describe("buildMonthCells", () => {
  it("always returns 42 cells (six-week grid)", () => {
    for (const [y, m] of [
      [2026, 0],
      [2026, 1],
      [2026, 3],
      [2026, 11],
      [2028, 1], // leap year February
    ] as const) {
      const cells = buildMonthCells(y, m);
      expect(cells).toHaveLength(42);
    }
  });

  it("starts on Sunday of the week containing the 1st of the month", () => {
    // April 2026: April 1 is a Wednesday, so the grid should start Sunday March 29.
    const cells = buildMonthCells(2026, 3);
    expect(cells[0]!.date.getDay()).toBe(0);
    expect(cells[0]!.inMonth).toBe(false);
    // First in-month cell should be April 1 at position 3 (Sun, Mon, Tue, Wed).
    expect(cells[3]!.inMonth).toBe(true);
    expect(cells[3]!.date.getDate()).toBe(1);
    expect(cells[3]!.date.getMonth()).toBe(3);
  });

  it("marks trailing days as out-of-month", () => {
    const cells = buildMonthCells(2026, 3); // April 2026 (30 days)
    const trailing = cells.filter((c) => !c.inMonth);
    expect(trailing.length).toBeGreaterThan(0);
    // Last cell is always after the 30th in April
    const last = cells[41]!;
    expect(last.inMonth).toBe(false);
  });

  it("handles February in a leap year", () => {
    const cells = buildMonthCells(2028, 1); // Feb 2028 is a leap year
    const inMonth = cells.filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(29);
  });

  it("handles February in a non-leap year", () => {
    const cells = buildMonthCells(2026, 1); // Feb 2026
    const inMonth = cells.filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(28);
  });
});

describe("agentColor", () => {
  it("returns a stable class string for the same agent id", () => {
    const a = agentColor("ag_1");
    const b = agentColor("ag_1");
    expect(a).toBe(b);
  });

  it("returns different classes for sufficiently different ids", () => {
    const classes = new Set([
      agentColor("ag_a"),
      agentColor("ag_bbb"),
      agentColor("ag_zzz"),
      agentColor("ag_1234567"),
    ]);
    expect(classes.size).toBeGreaterThan(1);
  });

  it("first space-separated token is a bg- class (agent filter dot regression)", () => {
    expect(agentColor("ag_1").split(" ")[0]).toMatch(/^bg-/);
  });
});

describe("agentDot", () => {
  it("is deterministic for the same id", () => {
    expect(agentDot("ag_1")).toBe(agentDot("ag_1"));
  });

  it("cycles through the palette", () => {
    const set = new Set([
      agentDot("ag_a"),
      agentDot("ag_bbb"),
      agentDot("ag_zzz"),
      agentDot("ag_1234567"),
    ]);
    expect(set.size).toBeGreaterThan(1);
  });

  it("first space-separated token is a bg- class", () => {
    expect(agentDot("ag_1").split(" ")[0]).toMatch(/^bg-/);
  });
});

describe("agentInk", () => {
  it("is deterministic for the same id", () => {
    expect(agentInk("ag_1")).toBe(agentInk("ag_1"));
  });

  it("cycles through the palette", () => {
    const set = new Set([
      agentInk("ag_a"),
      agentInk("ag_bbb"),
      agentInk("ag_zzz"),
      agentInk("ag_1234567"),
    ]);
    expect(set.size).toBeGreaterThan(1);
  });

  it("first space-separated token is a text- class", () => {
    expect(agentInk("ag_1").split(" ")[0]).toMatch(/^text-/);
  });
});

describe("dateKey", () => {
  it("formats to YYYY-MM-DD with zero-padding", () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(dateKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("sameDay", () => {
  it("ignores time-of-day", () => {
    const a = new Date(2026, 3, 17, 9, 0);
    const b = new Date(2026, 3, 17, 23, 59);
    expect(sameDay(a, b)).toBe(true);
  });
  it("false for different days", () => {
    expect(
      sameDay(new Date(2026, 3, 17), new Date(2026, 3, 18))
    ).toBe(false);
  });
});

describe("isTodayMonth", () => {
  it("true when year+month match the reference", () => {
    const ref = new Date(2026, 3, 17);
    expect(isTodayMonth(2026, 3, ref)).toBe(true);
  });
  it("false when year or month differ", () => {
    const ref = new Date(2026, 3, 17);
    expect(isTodayMonth(2026, 4, ref)).toBe(false);
    expect(isTodayMonth(2025, 3, ref)).toBe(false);
  });
});

describe("stepDate", () => {
  const base = new Date(2026, 3, 17); // Fri Apr 17 2026

  it("ArrowRight → +1 day", () => {
    expect(dateKey(stepDate(base, "ArrowRight")!)).toBe("2026-04-18");
  });
  it("ArrowLeft → -1 day", () => {
    expect(dateKey(stepDate(base, "ArrowLeft")!)).toBe("2026-04-16");
  });
  it("ArrowDown → +7 days", () => {
    expect(dateKey(stepDate(base, "ArrowDown")!)).toBe("2026-04-24");
  });
  it("ArrowUp → -7 days", () => {
    expect(dateKey(stepDate(base, "ArrowUp")!)).toBe("2026-04-10");
  });
  it("Home snaps to Sunday of the same week", () => {
    // Fri Apr 17 2026 → Sun Apr 12
    expect(dateKey(stepDate(base, "Home")!)).toBe("2026-04-12");
  });
  it("End snaps to Saturday of the same week", () => {
    expect(dateKey(stepDate(base, "End")!)).toBe("2026-04-18");
  });
  it("PageDown → next month, clamps day", () => {
    // Jan 31 + PageDown → Feb 28 (2026 not leap)
    const jan31 = new Date(2026, 0, 31);
    expect(dateKey(stepDate(jan31, "PageDown")!)).toBe("2026-02-28");
  });
  it("PageUp → previous month, clamps day", () => {
    // Mar 31 - PageUp → Feb 28
    const mar31 = new Date(2026, 2, 31);
    expect(dateKey(stepDate(mar31, "PageUp")!)).toBe("2026-02-28");
  });
  it("returns null for unrecognized keys", () => {
    expect(stepDate(base, "x")).toBeNull();
    expect(stepDate(base, "Escape")).toBeNull();
    expect(stepDate(base, " ")).toBeNull();
  });
  it("crosses month boundary: Apr 30 + ArrowRight → May 1", () => {
    const apr30 = new Date(2026, 3, 30);
    expect(dateKey(stepDate(apr30, "ArrowRight")!)).toBe("2026-05-01");
  });
});
