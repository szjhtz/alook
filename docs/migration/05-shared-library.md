# 05 — Shared Library

> `@alook/shared` — Drizzle schema, DB factory, query modules, types, constants, and Zod validation schemas.
> Location: `src/shared/`
> No runtime — consumed as workspace dependency by web, cli, email-worker, and ws-do.

---

## Package Config

```json
{
  "name": "@alook/shared",
  "version": "0.1.0",
  "type": "module",
  "exports": { ".": "./index.ts" },
  "dependencies": {
    "drizzle-orm": "^0.39.0",
    "zod": "^3.24"
  }
}
```

No build step — exports raw TypeScript via `"exports": { ".": "./index.ts" }`.

---

## Module Structure

```
src/shared/
├── index.ts           # Re-exports everything
├── types.ts           # Core domain types (interfaces)
├── api-types.ts       # API request/response wrapper types
├── constants.ts       # Status enums
├── schemas.ts         # Zod validation schemas
├── db/
│   ├── index.ts       # createDb(d1Binding) factory, Database type export
│   ├── schema.ts      # Drizzle table definitions (all tables, single source of truth)
│   └── queries/       # Query modules (one per domain)
│       ├── user.ts
│       ├── workspace.ts
│       ├── member.ts
│       ├── agent.ts
│       ├── runtime.ts
│       ├── conversation.ts
│       ├── message.ts
│       ├── task.ts
│       ├── task-message.ts
│       ├── machine-token.ts
│       ├── whitelist.ts
│       ├── email.ts
│       └── session.ts
├── utils/
│   ├── email.ts       # parseEmailHandle()
│   └── validation.ts  # isValidToken()
├── schemas.test.ts
├── package.json
└── tsconfig.json
```

---

## Database (NEW — moved from Web Service)

### DB Factory (`db/index.ts`)

```typescript
import { drizzle } from "drizzle-orm/d1"
import * as schema from "./schema"

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

export type Database = ReturnType<typeof createDb>
```

All three D1 consumers create a Drizzle instance from their D1 binding:

```typescript
import { createDb } from "@alook/shared"
const db = createDb(env.DB)
```

### Schema (`db/schema.ts`)

Single source of truth for all Drizzle table definitions. Tables are owned and migrated by the Web Service, but defined here so all services share the same typed schema.

See [01-web-service.md](01-web-service.md) for the full schema details (Better Auth tables + application tables).

### Query Modules (`db/queries/`)

Moved from `src/web/lib/db/queries/` into `@alook/shared` so all services share one implementation.

| Module | Functions | Used by |
|--------|-----------|---------|
| `user` | getUser, getUserByEmail, createUser, updateUser | Web, Email Worker (read only) |
| `workspace` | getWorkspace, listWorkspaces, createWorkspace | Web |
| `member` | getMemberByUserAndWorkspace, listMembers, createMember | Web |
| `agent` | getAgent, getAgentByHandle, getAgentInWorkspace, listAgents, createAgent, deleteAgent, updateAgent, updateAgentStatus | Web, Email Worker (read only) |
| `runtime` | upsertAgentRuntime, listAgentRuntimes, getAgentRuntime, updateAgentRuntimeHeartbeat, setAgentRuntimeOffline, deleteRuntimesByDaemonId, markStaleRuntimesOffline | Web |
| `conversation` | createConversation, getConversation, listConversations, listConversationsByAgent, updateConversationTitle, deleteConversation | Web |
| `message` | createMessage, listMessages, getMessage | Web |
| `task` | createTask, getTask, claimTask, startTask, completeTask, failTask, getLastTaskSession, listPendingTasksByRuntime, failStaleDispatchedTasks, countRunningTasks, ... | Web |
| `task-message` | createTaskMessage, listTaskMessages, listTaskMessagesSince, deleteTaskMessages | Web |
| `machine-token` | createMachineToken, getMachineTokenByHash, listMachineTokens, deleteMachineToken, updateMachineTokenLastUsed | Web, WS-DO |
| `whitelist` | getWhitelist, addWhitelist, removeWhitelist, isWhitelisted | Web, Email Worker (read only) |
| `email` | createEmail, getEmailById, getEmailsByAgent, getEmailsByUser | Web |
| `session` | getValidSession | WS-DO |

---

## Types (`types.ts`)

Core domain interfaces used across web, CLI, and workers.

| Type | Key Fields |
|------|------------|
| `User` | id, name, email, avatar_url, created_at, updated_at |
| `Workspace` | id, name, slug, created_at, updated_at |
| `Agent` | id, workspace_id, runtime_id, name, description, instructions, runtime_mode, runtime_config, status, max_concurrent_tasks, created_at, updated_at |
| `AgentRuntime` | id, workspace_id, daemon_id, name, runtime_mode, provider, status, device_info, metadata, last_seen_at, created_at, updated_at |
| `Conversation` | id, agent_id, title, created_at |
| `Message` | id, conversation_id, role ("user"\|"assistant"), content, task_id, created_at |
| `AgentTask` | *deprecated — use TaskApiSchema* id, agent_id, runtime_id, conversation_id, workspace_id, prompt, status, priority, dispatched_at, started_at, completed_at, result, error, agent?, created_at, prior_session_id?, prior_work_dir? |
| `TaskAgentData` | id, name, instructions |
| `TaskMessage` | id, task_id, seq, type, tool, content, input?, output |
| `MachineToken` | id, name, last_used_at, created_at |
| `LoginResponse` | token, user (User) |
| `CreateAgentRequest` | name, description?, instructions?, runtime_id, runtime_config?, max_concurrent_tasks? |

---

## API Types (`api-types.ts`)

Generic wrapper types for API responses + typed request/response interfaces.

### Generic Wrappers

| Type | Shape |
|------|-------|
| `ApiResponse<T>` | `{ data: T }` |
| `ApiListResponse<T>` | `{ data: T[], total?: number }` |
| `ApiErrorResponse` | `{ error: string, code?: string }` |

### Typed Responses

| Type | Wraps |
|------|-------|
| `GetUserResponse` | `ApiResponse<User>` |
| `ListWorkspacesResponse` | `ApiListResponse<Workspace>` |
| `GetWorkspaceResponse` | `ApiResponse<Workspace>` |
| `ListAgentsResponse` | `ApiListResponse<Agent>` |
| `GetAgentResponse` | `ApiResponse<Agent>` |
| `ListRuntimesResponse` | `ApiListResponse<AgentRuntime>` |
| `GetRuntimeResponse` | `ApiResponse<AgentRuntime>` |
| `ListConversationsResponse` | `ApiListResponse<Conversation>` |
| `GetConversationResponse` | `ApiResponse<Conversation>` |
| `ListMessagesResponse` | `ApiListResponse<Message>` |
| `ListTasksResponse` | `ApiListResponse<AgentTask>` |
| `GetTaskResponse` | `ApiResponse<AgentTask>` |
| `ListTaskMessagesResponse` | `ApiListResponse<TaskMessage>` |
| `ListMachineTokensResponse` | `ApiListResponse<MachineToken>` |

### Request Types

| Type | Fields |
|------|--------|
| `CreateWorkspaceRequest` | `{ name: string }` |
| `UpdateAgentRequest` | `{ name?, description?, instructions?, runtime_config?, max_concurrent_tasks? }` |
| `SendMessageRequest` | `{ content: string }` |
| `CreateMachineTokenRequest` | `{ name: string }` |
| `CreateMachineTokenResponse` | `{ token: string, id: string, name: string }` |

---

## Constants (`constants.ts`)

Status enum objects with TypeScript type exports.

| Constant | Values | Type |
|----------|--------|------|
| `AgentStatus` | ACTIVE, INACTIVE, ERROR | `AgentStatusType` |
| `RuntimeStatus` | ONLINE, OFFLINE, ERROR | `RuntimeStatusType` |
| `TaskStatus` | QUEUED, DISPATCHED, RUNNING, COMPLETED, FAILED, CANCELLED | `TaskStatusType` |
| `MessageRole` | USER, ASSISTANT | `MessageRoleType` |

Pattern: `const X = { ... } as const` + `type XType = (typeof X)[keyof typeof X]`

---

## Schemas (`schemas.ts`)

Zod validation schemas for runtime validation. Used by both Web Service (API route validation) and CLI daemon (response parsing).

### Task Schemas

| Schema | Purpose |
|--------|---------|
| `TaskStatusSchema` | `z.enum(["queued","dispatched","running","completed","failed","cancelled"])` |
| `ClaimedTaskRowSchema` | Raw SQL row from `agent_task_queue` — boundary between DB and app. All fields typed with coerce for dates. |
| `TaskAgentDataApiSchema` | Agent data in task claim response: `{ instructions, name, runtime_config }` |
| `TaskApiBaseSchema` | Base task fields in snake_case API format |
| `TaskApiSchema` | Full task = base + optional `agent`, `prior_session_id`, `prior_work_dir` |
| `ClaimTaskResponseSchema` | `{ task: TaskApi | null }` |

### Daemon API Schemas

| Schema | Purpose | Key Fields |
|--------|---------|------------|
| `RegisterResponseSchema` | Register response | `{ runtimes: [{ id }] }` |
| `DaemonRuntimeItemSchema` | Single runtime in register request | type?, provider?, runtime_mode?, name?, version?, status?, model? |
| `RegisterDaemonRequestSchema` | Register request body | workspace_id, daemon_id, device_name?, cli_version?, runtimes[] (min 1) |
| `DeregisterRequestSchema` | Deregister request | `{ runtime_ids: string[] }` |
| `HeartbeatRequestSchema` | Heartbeat request | `{ runtime_id: string }` (min 1 char) |
| `CompleteTaskRequestSchema` | Complete task body | output?, session_id?, work_dir?, branch_name? |
| `FailTaskRequestSchema` | Fail task body | error? (default: "") |
| `MessageItemSchema` | Single task message | seq (number), type (string), tool?, content?, input? (record), output? |
| `ReportMessagesRequestSchema` | Report messages batch | `{ messages: MessageItem[] }` |

---

## Exports (`index.ts`)

All modules re-exported from the index:

- **DB**: `createDb`, `Database` type, `schema` (all table definitions), `queries` (all query modules)
- **Types**: User, Workspace, Agent, AgentRuntime, Conversation, Message, AgentTask, TaskAgentData, TaskMessage, MachineToken, LoginResponse, CreateAgentRequest
- **API Types**: ApiResponse, ApiListResponse, ApiErrorResponse, all typed response/request types
- **Constants**: AgentStatus, RuntimeStatus, TaskStatus, MessageRole (+ their type aliases)
- **Schemas**: All Zod schemas and their inferred types
- **Utils**: `parseEmailHandle`, `isValidToken`

---

## Test Files

```
src/shared/schemas.test.ts
```

---

## Usage Across Packages

| Consumer | What It Uses |
|----------|-------------|
| **Web Service** | `createDb` + `queries.*` for all DB operations, `schema` for migrations (drizzle-kit), types for API responses, schemas for request validation, constants for status comparisons |
| **Email Worker** | `createDb` + `queries.agent.getAgentByHandle` (read), `queries.user.getUser` (read), `queries.whitelist.isWhitelisted` (read), `parseEmailHandle` utility. Email Worker does not write to D1 — it notifies Web Service via `POST /api/email/notify` which handles email record + task creation. |
| **WS-DO** | `createDb` + `queries.machineToken.getMachineTokenByHash`, `queries.session.getValidSession` for token validation |
| **CLI Daemon** | `TaskApiSchema` + `ClaimTaskResponseSchema` for parsing claim responses, `RegisterDaemonRequestSchema` for building register payload, `ReportMessagesRequestSchema` for message batch, types for internal data models |

---

## Migration Notes

### What moves into `@alook/shared`

| From | To | Content |
|------|----|---------|
| `src/web/lib/db/schema.ts` | `src/shared/db/schema.ts` | All Drizzle table definitions |
| `src/web/lib/db/index.ts` | `src/shared/db/index.ts` | DB factory (adapted from postgres to D1) |
| `src/web/lib/db/queries/*.ts` | `src/shared/db/queries/*.ts` | All query modules |

### What stays in Web Service

- Migration runner (`drizzle-kit` config and `drizzle/` migrations folder) — only Web Service runs migrations
- Response formatters (`lib/api/responses.ts`) — Web-specific snake_case formatting
- Service classes (`TaskService`, `EmailService`) — orchestration logic that uses queries
- Middleware — Web-specific request handling

### D1 compatibility

- `ClaimedTaskRowSchema` uses `.coerce.date()` — works with D1's text dates
- Drizzle's `sqliteTable` replaces `pgTable` in schema definitions
- `SELECT FOR UPDATE SKIP LOCKED` (task claiming) not available in SQLite — replaced with CAS-style `UPDATE ... WHERE status='queued'` using `db.batch()` for atomicity. See [01-web-service.md](01-web-service.md) Task Claiming Strategy section.
