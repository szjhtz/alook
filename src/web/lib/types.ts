export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  runtime_id: string;
  status: string;
  created_at: string;
}

export interface Runtime {
  id: string;
  daemon_id: string | null;
  name: string;
  provider: string;
  status: string;
  device_info: string;
  metadata: Record<string, unknown>;
  last_seen_at: string;
}

export interface Conversation {
  id: string;
  agent_id: string;
  title: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  task_id?: string;
  created_at: string;
}

export interface Task {
  id: string;
  status: string;
  prompt: string;
  result?: string;
  error?: string;
  created_at: string;
}

export interface TaskMessage {
  id: string;
  task_id: string;
  seq: number;
  type: string;
  tool: string;
  content: string;
  output: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface CreateAgentRequest {
  name: string;
  description?: string;
  instructions?: string;
  runtime_id: string;
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  instructions?: string;
  runtime_id?: string;
}
