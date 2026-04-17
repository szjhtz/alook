import { describe, it, expect } from "vitest";
import {
  RepeatIntervalSchema,
  CreateCalendarEventRequestSchema,
  UpdateCalendarEventRequestSchema,
  DeleteCalendarEventRequestSchema,
  CalendarEventApiSchema,
} from "../src/schemas";

describe("RepeatIntervalSchema", () => {
  it("accepts valid intervals", () => {
    for (const v of ["30min", "1hour", "1day", "7day", "1week", "1month"]) {
      expect(RepeatIntervalSchema.parse(v)).toBe(v);
    }
  });

  it("rejects invalid intervals", () => {
    for (const v of ["0", "1year", "day1", "1DAY", "", "1.5day"]) {
      expect(() => RepeatIntervalSchema.parse(v)).toThrow();
    }
  });
});

describe("CreateCalendarEventRequestSchema", () => {
  const base = {
    agent_id: "ag_1",
    title: "Run standup",
    scheduled_at: "2026-04-17T09:00:00.000Z",
  };

  it("accepts minimum valid payload", () => {
    expect(CreateCalendarEventRequestSchema.parse(base)).toMatchObject(base);
  });

  it("accepts repeat_interval and repeat_stop_date together", () => {
    const payload = {
      ...base,
      repeat_interval: "1day",
      repeat_stop_date: "2026-05-17",
    };
    expect(CreateCalendarEventRequestSchema.parse(payload)).toMatchObject(payload);
  });

  it("rejects repeat_stop_date without repeat_interval", () => {
    expect(() =>
      CreateCalendarEventRequestSchema.parse({
        ...base,
        repeat_stop_date: "2026-05-17",
      })
    ).toThrow();
  });

  it("rejects malformed repeat_interval", () => {
    expect(() =>
      CreateCalendarEventRequestSchema.parse({
        ...base,
        repeat_interval: "weekly",
      })
    ).toThrow();
  });

  it("rejects malformed repeat_stop_date", () => {
    expect(() =>
      CreateCalendarEventRequestSchema.parse({
        ...base,
        repeat_interval: "1day",
        repeat_stop_date: "May 17",
      })
    ).toThrow();
  });

  it("rejects invalid scheduled_at", () => {
    expect(() =>
      CreateCalendarEventRequestSchema.parse({
        ...base,
        scheduled_at: "not a date",
      })
    ).toThrow();
  });

  it("rejects empty agent_id / title", () => {
    expect(() =>
      CreateCalendarEventRequestSchema.parse({ ...base, agent_id: "" })
    ).toThrow();
    expect(() =>
      CreateCalendarEventRequestSchema.parse({ ...base, title: "" })
    ).toThrow();
  });
});

describe("CreateCalendarEventRequestSchema — description", () => {
  const base = {
    agent_id: "ag_1",
    title: "Run standup",
    scheduled_at: "2026-04-17T09:00:00.000Z",
  };

  it("accepts description as a short string", () => {
    const payload = { ...base, description: "<p>hi</p>" };
    expect(CreateCalendarEventRequestSchema.parse(payload)).toMatchObject(payload);
  });

  it("accepts empty-string description", () => {
    const payload = { ...base, description: "" };
    expect(CreateCalendarEventRequestSchema.parse(payload)).toMatchObject(payload);
  });

  it("accepts payloads without description", () => {
    expect(CreateCalendarEventRequestSchema.parse(base)).toMatchObject(base);
  });

  it("rejects description longer than 20k chars", () => {
    const payload = { ...base, description: "x".repeat(20_001) };
    expect(() => CreateCalendarEventRequestSchema.parse(payload)).toThrow();
  });
});

describe("UpdateCalendarEventRequestSchema", () => {
  it("accepts { title } alone", () => {
    expect(
      UpdateCalendarEventRequestSchema.parse({ title: "new title" })
    ).toMatchObject({ title: "new title" });
  });

  it("accepts { description } alone", () => {
    expect(
      UpdateCalendarEventRequestSchema.parse({ description: "<p>x</p>" })
    ).toMatchObject({ description: "<p>x</p>" });
  });

  it("accepts both fields together", () => {
    const payload = { title: "t", description: "<p>d</p>" };
    expect(UpdateCalendarEventRequestSchema.parse(payload)).toMatchObject(payload);
  });

  it("accepts description: null for clearing", () => {
    expect(
      UpdateCalendarEventRequestSchema.parse({ description: null })
    ).toMatchObject({ description: null });
  });

  it("accepts description: \"\" (server normalizes to null)", () => {
    expect(
      UpdateCalendarEventRequestSchema.parse({ description: "" })
    ).toMatchObject({ description: "" });
  });

  it("rejects an empty object", () => {
    expect(() => UpdateCalendarEventRequestSchema.parse({})).toThrow();
  });

  it("rejects empty title string", () => {
    expect(() =>
      UpdateCalendarEventRequestSchema.parse({ title: "" })
    ).toThrow();
  });

  it("accepts agent_id / scheduled_at / repeat_interval / repeat_stop_date / scope", () => {
    const payload = {
      agent_id: "ag_2",
      scheduled_at: "2026-05-01T12:00:00.000Z",
      repeat_interval: "1week",
      repeat_stop_date: "2026-07-01",
      scope: "this" as const,
    };
    expect(UpdateCalendarEventRequestSchema.parse(payload)).toMatchObject(payload);
  });

  it("accepts repeat_interval: null (clear repeat)", () => {
    expect(
      UpdateCalendarEventRequestSchema.parse({ repeat_interval: null })
    ).toMatchObject({ repeat_interval: null });
  });

  it("accepts repeat_stop_date: null (clear stop)", () => {
    expect(
      UpdateCalendarEventRequestSchema.parse({ repeat_stop_date: null })
    ).toMatchObject({ repeat_stop_date: null });
  });

  it("rejects body with only scope (no actual edit)", () => {
    expect(() =>
      UpdateCalendarEventRequestSchema.parse({ scope: "this" })
    ).toThrow();
  });

  it("rejects malformed scheduled_at", () => {
    expect(() =>
      UpdateCalendarEventRequestSchema.parse({ scheduled_at: "not a date" })
    ).toThrow();
  });

  it("rejects malformed repeat_interval", () => {
    expect(() =>
      UpdateCalendarEventRequestSchema.parse({ repeat_interval: "weekly" })
    ).toThrow();
  });

  it("rejects malformed scope", () => {
    expect(() =>
      UpdateCalendarEventRequestSchema.parse({
        title: "t",
        scope: "oops" as unknown,
      })
    ).toThrow();
  });

  it("accepts occurrence_at as a valid ISO datetime", () => {
    expect(
      UpdateCalendarEventRequestSchema.parse({
        title: "t",
        occurrence_at: "2026-04-20T09:00:00.000Z",
      })
    ).toMatchObject({ occurrence_at: "2026-04-20T09:00:00.000Z" });
  });

  it("rejects a malformed occurrence_at", () => {
    expect(() =>
      UpdateCalendarEventRequestSchema.parse({
        title: "t",
        occurrence_at: "not a date",
      })
    ).toThrow();
  });
});

describe("DeleteCalendarEventRequestSchema", () => {
  it("accepts an empty body (legacy full delete)", () => {
    expect(DeleteCalendarEventRequestSchema.parse({})).toEqual({});
  });

  it("accepts scope: 'this' with no occurrence_at", () => {
    expect(
      DeleteCalendarEventRequestSchema.parse({ scope: "this" })
    ).toMatchObject({ scope: "this" });
  });

  it("accepts scope + occurrence_at", () => {
    const payload = {
      scope: "this" as const,
      occurrence_at: "2026-04-20T09:00:00.000Z",
    };
    expect(DeleteCalendarEventRequestSchema.parse(payload)).toMatchObject(
      payload
    );
  });

  it("accepts scope: 'following'", () => {
    expect(
      DeleteCalendarEventRequestSchema.parse({ scope: "following" })
    ).toMatchObject({ scope: "following" });
  });

  it("rejects a malformed scope", () => {
    expect(() =>
      DeleteCalendarEventRequestSchema.parse({
        scope: "all" as unknown,
      })
    ).toThrow();
  });

  it("rejects a malformed occurrence_at", () => {
    expect(() =>
      DeleteCalendarEventRequestSchema.parse({
        scope: "this",
        occurrence_at: "not a date",
      })
    ).toThrow();
  });
});

describe("CalendarEventApiSchema", () => {
  it("parses a full wire-format response", () => {
    const row = {
      id: "ce_1",
      agent_id: "ag_1",
      workspace_id: "ws_1",
      title: "Run standup",
      description: null,
      scheduled_at: "2026-04-17T09:00:00Z",
      occurrence_at: "2026-04-17T09:00:00Z",
      repeat_interval: null,
      repeat_stop_at: null,
      last_triggered_at: null,
      created_at: "2026-04-10T00:00:00Z",
      updated_at: "2026-04-10T00:00:00Z",
    };
    expect(CalendarEventApiSchema.parse(row)).toEqual(row);
  });

  it("accepts description as a string", () => {
    const row = {
      id: "ce_1",
      agent_id: "ag_1",
      workspace_id: "ws_1",
      title: "Run standup",
      description: "<p>hello</p>",
      scheduled_at: "2026-04-17T09:00:00Z",
      occurrence_at: "2026-04-17T09:00:00Z",
      repeat_interval: null,
      repeat_stop_at: null,
      last_triggered_at: null,
      created_at: "2026-04-10T00:00:00Z",
      updated_at: "2026-04-10T00:00:00Z",
    };
    expect(CalendarEventApiSchema.parse(row)).toEqual(row);
  });
});
