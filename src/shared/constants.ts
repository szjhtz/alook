export const AgentStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  ERROR: "error",
} as const;

export type AgentStatusType = (typeof AgentStatus)[keyof typeof AgentStatus];

export const RuntimeStatus = {
  ONLINE: "online",
  OFFLINE: "offline",
  ERROR: "error",
} as const;

export type RuntimeStatusType =
  (typeof RuntimeStatus)[keyof typeof RuntimeStatus];

export const TaskStatus = {
  QUEUED: "queued",
  DISPATCHED: "dispatched",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type TaskStatusType = (typeof TaskStatus)[keyof typeof TaskStatus];

export const MessageRole = {
  USER: "user",
  ASSISTANT: "assistant",
} as const;

export type MessageRoleType = (typeof MessageRole)[keyof typeof MessageRole];
