import { describe, it, expect } from "vitest";
import { parseCalendarView } from "./calendar-view-switcher";

describe("parseCalendarView", () => {
  it("returns 'month' for null/undefined/empty", () => {
    expect(parseCalendarView(null)).toBe("month");
    expect(parseCalendarView(undefined)).toBe("month");
    expect(parseCalendarView("")).toBe("month");
  });

  it("returns 'agenda' when explicitly set", () => {
    expect(parseCalendarView("agenda")).toBe("agenda");
  });

  it("clamps unknown values to 'month'", () => {
    expect(parseCalendarView("week")).toBe("month");
    expect(parseCalendarView("bogus")).toBe("month");
    expect(parseCalendarView("MONTH")).toBe("month");
  });
});
