import { describe, it, expect } from "vitest";
import { CreateConversationRequestSchema } from "../../src/schemas";

describe("CreateConversationRequestSchema", () => {
  it("accepts valid body with agent_id only", () => {
    const result = CreateConversationRequestSchema.safeParse({ agent_id: "ag_1" });
    expect(result.success).toBe(true);
  });

  it("accepts valid body with agent_id and channel", () => {
    const result = CreateConversationRequestSchema.safeParse({ agent_id: "ag_1", channel: "work" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.channel).toBe("work");
    }
  });

  it("channel is optional", () => {
    const result = CreateConversationRequestSchema.safeParse({ agent_id: "ag_1" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.channel).toBeUndefined();
    }
  });

  it("rejects empty agent_id", () => {
    const result = CreateConversationRequestSchema.safeParse({ agent_id: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing agent_id", () => {
    const result = CreateConversationRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
