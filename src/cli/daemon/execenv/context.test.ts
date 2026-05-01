import { describe, it, expect } from "vitest";
import { buildInstructionContent } from "./context.js";
import { tempDir } from "../../lib/platform.js";
import type { Task } from "../types.js";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    agentId: "agent-123",
    runtimeId: "r1",
    conversationId: "c1",
    workspaceId: "ws1",
    prompt: "test",
    status: "running",
    priority: 0,
    type: "user_dm_message",
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildInstructionContent email tool injection", () => {
  it("includes email tool section with full email address when agent has email handle", () => {
    const task = makeTask({
      agent: { name: "test", instructions: "do stuff", emailHandle: "myagent" },
    });
    const content = buildInstructionContent(task);

    expect(content).toContain("npx @alook/cli email pull --agent_id agent-123 --status unread");
    expect(content).toContain("npx @alook/cli email set --agent_id agent-123 --email_id <EMAIL_ID> --status read");
    expect(content).toContain(`${tempDir("alook-emails")}/ws1/agent-123/`);
    expect(content).toContain("metadata.json");
    expect(content).toContain("'myagent@alook.ai' (default, Alook platform address)");
  });

  it("includes send-email docs when agent has email handle", () => {
    const task = makeTask({
      agent: { name: "test", instructions: "do stuff", emailHandle: "myagent" },
    });
    const content = buildInstructionContent(task);

    expect(content).toContain("npx @alook/cli email send --agent_id agent-123");
    expect(content).toContain("--body-file");
    expect(content).toContain("--attachment");
  });

  it("includes reply-to docs when agent has email handle", () => {
    const task = makeTask({
      agent: { name: "test", instructions: "do stuff", emailHandle: "myagent" },
    });
    const content = buildInstructionContent(task);

    expect(content).toContain("--in-reply-to <EMAIL_ID>");
    expect(content).toContain("Replying to an email");
    expect(content).toContain("Re:");
  });

  it("omits send-email docs when agent has no email handle", () => {
    const task = makeTask({
      agent: { name: "test", instructions: "do stuff" },
    });
    const content = buildInstructionContent(task);

    expect(content).not.toContain("email send --agent_id");
  });

  it("includes owner email in opening line when user email is provided", () => {
    const task = makeTask({
      agent: { name: "test", instructions: "do stuff", emailHandle: "myagent", userEmail: "gus@example.com" },
    });
    const content = buildInstructionContent(task);

    expect(content).toContain("'myagent@alook.ai' (default, Alook platform address)");
    expect(content).toContain("Your owner and creator is (gus@example.com).");
  });

  it("omits owner sentence when user email is not provided", () => {
    const task = makeTask({
      agent: { name: "test", instructions: "do stuff", emailHandle: "myagent" },
    });
    const content = buildInstructionContent(task);

    expect(content).toContain("'myagent@alook.ai' (default, Alook platform address)");
    expect(content).not.toContain("owner and creator");
  });

  it("omits email tool section when agent has no email handle", () => {
    const task = makeTask({
      agent: { name: "test", instructions: "do stuff" },
    });
    const content = buildInstructionContent(task);

    expect(content).not.toContain("## Email Tools");
    expect(content).not.toContain("email pull");
  });

  it("omits email tool section when emailHandle is null", () => {
    const task = makeTask({
      agent: { name: "test", instructions: "do stuff", emailHandle: null },
    });
    const content = buildInstructionContent(task);

    expect(content).not.toContain("## Email Tools");
  });

  it("omits email tool section when emailHandle is empty string", () => {
    const task = makeTask({
      agent: { name: "test", instructions: "do stuff", emailHandle: "" },
    });
    const content = buildInstructionContent(task);

    expect(content).not.toContain("## Email Tools");
  });

  it("uses correct agent ID in email tool commands", () => {
    const task = makeTask({
      agentId: "specific-agent-id",
      agent: { name: "test", instructions: "", emailHandle: "handle" },
    });
    const content = buildInstructionContent(task);

    expect(content).toContain("--agent_id specific-agent-id");
  });

  it("still includes big boss instructions alongside email tools", () => {
    const task = makeTask({
      agent: { name: "test", instructions: "Follow these rules", emailHandle: "myagent" },
    });
    const content = buildInstructionContent(task);

    expect(content).toContain("## BIG BOSS Instructions");
  });

  it("includes colleagues section when agent has colleagues", () => {
    const task = makeTask({
      agent: {
        name: "test",
        instructions: "",
        colleagues: [
          { name: "Scout", email: "scout@alook.ai", description: "A researcher agent", instruction: "Share findings via email" },
          { name: "Writer", email: "writer@alook.ai", description: "", instruction: "Draft blog posts" },
        ],
      },
    });
    const content = buildInstructionContent(task);

    expect(content).toContain("## Your Colleagues");
    expect(content).toContain("### Scout (scout@alook.ai)");
    expect(content).toContain("A researcher agent");
    expect(content).toContain("**Relationship:** Share findings via email");
    expect(content).toContain("### Writer (writer@alook.ai)");
    expect(content).toContain("**Relationship:** Draft blog posts");
  });

  it("omits colleagues section when no colleagues", () => {
    const task = makeTask({
      agent: { name: "test", instructions: "", colleagues: [] },
    });
    const content = buildInstructionContent(task);

    expect(content).not.toContain("## Your Colleagues");
  });

  it("omits colleagues section when colleagues undefined", () => {
    const task = makeTask({
      agent: { name: "test", instructions: "" },
    });
    const content = buildInstructionContent(task);

    expect(content).not.toContain("## Your Colleagues");
  });

  it("omits description line for colleague with empty description", () => {
    const task = makeTask({
      agent: {
        name: "test",
        instructions: "",
        colleagues: [
          { name: "Scout", email: "scout@alook.ai", description: "", instruction: "Share data" },
        ],
      },
    });
    const content = buildInstructionContent(task);

    expect(content).toContain("### Scout (scout@alook.ai)");
    expect(content).toContain("**Relationship:** Share data");
    // Only the header + relationship, no blank description line
    const scoutSection = content.split("### Scout")[1].split("##")[0];
    expect(scoutSection).not.toMatch(/\n\n\n/);
  });
});
