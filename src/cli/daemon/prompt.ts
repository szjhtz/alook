import type { Task } from "./types.js";

export function buildPrompt(task: Task): string {
  return task.prompt;
}
