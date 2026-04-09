import type {
  Agent,
  Conversation,
  CreateAgentRequest,
  UpdateAgentRequest,
  LoginResponse,
  Message,
  Runtime,
  Task,
  TaskMessage,
  User,
  Workspace,
} from "./types";
import { ApiError } from "./errors";

const API_BASE = "";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("alook_token") : null;
  const workspaceId =
    typeof window !== "undefined"
      ? localStorage.getItem("alook_workspace_id")
      : null;

  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(workspaceId && { "X-Workspace-ID": workspaceId }),
        ...options?.headers,
      },
    });
  } catch (err) {
    if (err instanceof TypeError) {
      throw new ApiError("Unable to connect — check your network", 0);
    }
    throw err;
  }

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("alook_token");
      localStorage.removeItem("alook_workspace_id");
      document.cookie = "alook_session=; path=/; max-age=0";
      window.location.href = "/login";
    }
    throw new ApiError("Unauthorized", 401);
  }

  if (!res.ok) {
    let serverError: string | undefined;
    let details: string[] | undefined;
    try {
      const body = await res.json();
      serverError = body.error;
      details = body.details;
    } catch {
      // non-JSON body (HTML from proxy, empty body, etc.)
    }

    if (res.status === 429) {
      throw new ApiError("Please wait a moment before trying again", 429);
    }

    if (res.status >= 500) {
      throw new ApiError(
        serverError || "Something went wrong — please try again",
        res.status,
        details,
      );
    }

    throw new ApiError(
      serverError || "Something went wrong",
      res.status,
      details,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export const sendCode = (email: string) =>
  apiFetch("/auth/send-code", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const verifyCode = (email: string, code: string) =>
  apiFetch<LoginResponse>("/auth/verify-code", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });

export const getMe = () => apiFetch<User>("/api/me");

// Workspaces
export const listWorkspaces = () => apiFetch<Workspace[]>("/api/workspaces");

export const createWorkspace = (name: string) =>
  apiFetch<Workspace>("/api/workspaces", {
    method: "POST",
    body: JSON.stringify({ name }),
  });

// Agents
export const listAgents = () => apiFetch<Agent[]>("/api/agents");

export const createAgent = (req: CreateAgentRequest) =>
  apiFetch<Agent>("/api/agents", {
    method: "POST",
    body: JSON.stringify(req),
  });

export const updateAgent = (id: string, req: UpdateAgentRequest) =>
  apiFetch<Agent>(`/api/agents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(req),
  });

export const deleteAgent = (id: string) =>
  apiFetch<void>(`/api/agents/${id}`, { method: "DELETE" });

// Runtimes
export const listRuntimes = () => apiFetch<Runtime[]>("/api/runtimes");

export const deleteMachine = (daemonId: string) =>
  apiFetch<void>(`/api/runtimes/machine?daemon_id=${encodeURIComponent(daemonId)}`, {
    method: "DELETE",
  });

// Conversations
export const listConversations = () =>
  apiFetch<Conversation[]>("/api/conversations");

export const createConversation = (agentId: string) =>
  apiFetch<Conversation>("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId }),
  });

export const getConversation = (id: string) =>
  apiFetch<Conversation>(`/api/conversations/${id}`);

export const listMessages = (conversationId: string) =>
  apiFetch<Message[]>(`/api/conversations/${conversationId}/messages`);

export const sendMessage = (conversationId: string, content: string) =>
  apiFetch<{ message: Message; task: Task }>(
    `/api/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ content }),
    }
  );

// Machine tokens
export const createMachineToken = (name?: string) =>
  apiFetch<{ token: string; id: string; name: string; created_at: string }>(
    "/api/machine-tokens",
    {
      method: "POST",
      body: JSON.stringify({ name: name || "default" }),
    }
  );

// Tasks (polling)
export const getTask = (id: string) => apiFetch<Task>(`/api/tasks/${id}`);

export const getTaskMessages = (id: string, since?: number) =>
  apiFetch<TaskMessage[]>(
    `/api/tasks/${id}/messages${since ? `?since=${since}` : ""}`
  );
