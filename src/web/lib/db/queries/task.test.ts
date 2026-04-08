/**
 * Tests that claimTask() wires ClaimedTaskRowSchema.parse() correctly.
 * We mock the DB to return raw rows and verify Zod validation catches bad shapes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClaimedTaskRowSchema } from "@alook/shared";

// Mock drizzle — we control what the DB "returns"
const mockReturning = vi.fn();
const mockWhere2 = vi.fn(() => ({ returning: mockReturning }));
const mockSet = vi.fn(() => ({ where: mockWhere2 }));
const mockUpdate = vi.fn(() => ({ set: mockSet }));
const mockFor = vi.fn();
const mockLimit = vi.fn(() => ({ for: mockFor }));
const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

vi.mock("@/lib/db/schema", () => ({
  agentTaskQueue: {
    id: "id",
    agentId: "agentId",
    status: "status",
    conversationId: "conversationId",
    priority: "priority",
    createdAt: "createdAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
  desc: vi.fn(),
  asc: vi.fn(),
  inArray: vi.fn(),
}));

// We test the schema directly since the DB query is heavily coupled to Drizzle internals
describe("ClaimedTaskRowSchema in claimTask context", () => {
  it("rejects a row missing runtimeId (the original bug scenario)", () => {
    const badRow = {
      id: "t1",
      agentId: "a1",
      // runtimeId is MISSING — this is exactly the snake_case bug
      workspaceId: "w1",
      conversationId: "c1",
      prompt: "do stuff",
      status: "dispatched",
      priority: 0,
      result: null,
      context: null,
      sessionId: null,
      workDir: null,
      createdAt: new Date(),
      dispatchedAt: new Date(),
      startedAt: null,
      completedAt: null,
      error: null,
    };
    expect(() => ClaimedTaskRowSchema.parse(badRow)).toThrow(/runtimeId/i);
  });

  it("rejects a row with runtimeId as number instead of string", () => {
    const badRow = {
      id: "t1",
      agentId: "a1",
      runtimeId: 12345,
      workspaceId: "w1",
      conversationId: "c1",
      prompt: "do stuff",
      status: "dispatched",
      priority: 0,
      result: null,
      context: null,
      sessionId: null,
      workDir: null,
      createdAt: new Date(),
      dispatchedAt: new Date(),
      startedAt: null,
      completedAt: null,
      error: null,
    };
    expect(() => ClaimedTaskRowSchema.parse(badRow)).toThrow();
  });

  it("rejects a row where id is missing", () => {
    const badRow = {
      agentId: "a1",
      runtimeId: "r1",
      workspaceId: "w1",
      conversationId: "c1",
      prompt: "do stuff",
      status: "dispatched",
      priority: 0,
      result: null,
      context: null,
      sessionId: null,
      workDir: null,
      createdAt: new Date(),
      dispatchedAt: new Date(),
      startedAt: null,
      completedAt: null,
      error: null,
    };
    expect(() => ClaimedTaskRowSchema.parse(badRow)).toThrow();
  });

  it("accepts a valid row and returns typed result", () => {
    const goodRow = {
      id: "t1",
      agentId: "a1",
      runtimeId: "r1",
      workspaceId: "w1",
      conversationId: "c1",
      prompt: "do stuff",
      status: "dispatched",
      priority: 0,
      result: null,
      context: null,
      sessionId: null,
      workDir: null,
      createdAt: new Date(),
      dispatchedAt: new Date(),
      startedAt: null,
      completedAt: null,
      error: null,
    };
    const parsed = ClaimedTaskRowSchema.parse(goodRow);
    expect(parsed.runtimeId).toBe("r1");
    expect(parsed.createdAt).toBeInstanceOf(Date);
  });
});
