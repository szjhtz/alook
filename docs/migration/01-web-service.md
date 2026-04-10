# 01 — Web Service

> `@alook/web` — Next.js App Router, frontend pages + API routes.
> Location: `src/web/`
> Runtime: Cloudflare Workers via OpenNext.

---

## Dependencies

### Current (main)

```
next 16.2.2, react 19.2.4, drizzle-orm 0.39, postgres 3.4
jose 6.0, resend 4.0, zod 3.25, sonner 2.0, streamdown 2.5
shadcn 4.2, tailwind-merge 3.5, lucide-react 1.7, next-themes 0.4
@base-ui/react 1.3, input-otp 1.4, class-variance-authority 0.7
```

### Target changes

| Remove | Replace with |
|--------|-------------|
| `postgres` (pg driver) | `drizzle-orm/d1` (Drizzle's D1 adapter) |
| `jose` (JWT library) | `better-auth` (managed auth) |
| `input-otp` | Remove (Better Auth handles auth UI) |

Add: `better-auth`, `@opennextjs/cloudflare`

---

## Database

### Connection

Target: Cloudflare D1 via Drizzle ORM (`drizzle-orm/d1` adapter).

Schema, DB factory, and query modules live in `@alook/shared` (shared with Email Worker and WS-DO):

```
src/shared/db/index.ts       — createDb(d1Binding) factory
src/shared/db/schema.ts      — Drizzle table definitions (single source of truth)
src/shared/db/queries/*.ts   — Query modules (one per domain)
```

Web Service owns migration execution:

```
src/web/drizzle/             — Generated migration files (drizzle-kit)
src/web/drizzle.config.ts    — drizzle-kit config pointing to @alook/shared schema
```

D1 binding name: `DB` (from wrangler.toml, database `alook-app`).

### Current connection (main, to be replaced)

PostgreSQL via `postgres` driver + Drizzle ORM.
Env: `DATABASE_URL` (default: `postgres://postgres:postgres@localhost:5432/alook?sslmode=disable`)

### D1 Adaptation Notes

| PostgreSQL (main) | D1 / SQLite (target) |
|-------------------|---------------------|
| `uuid` PK with `defaultRandom()` | `text` PK with nanoid generation |
| `timestamp` with timezone | `text` with `DEFAULT (datetime('now'))` |
| `jsonb` columns | `text` columns (JSON serialized) |
| `boolean` | `integer` (0/1) |
| `SELECT ... FOR UPDATE SKIP LOCKED` (task claiming) | CAS-style `UPDATE ... WHERE status='queued'` (see Task Claiming Strategy below) |
| `uniqueIndex().where()` (partial indexes) | Supported in SQLite via `CREATE UNIQUE INDEX ... WHERE` |
| Drizzle `pgTable` | Drizzle `sqliteTable` |

### Schema

#### Better Auth Managed Tables (4 tables)

These tables use camelCase columns as required by Better Auth. Better Auth manages them directly.

| Table | PK | Key Columns |
|-------|-----|-------------|
| `user` | text | email (unique), name, emailVerified, image, createdAt, updatedAt |
| `session` | text | userId (FK user), token (unique), expiresAt, ipAddress, userAgent |
| `account` | text | userId (FK user), accountId, providerId, accessToken, refreshToken, password |
| `verification` | text | identifier, value, expiresAt |

#### Application Tables (11 tables)

| Table | PK | Key Columns | Relationships |
|-------|-----|-------------|---------------|
| `workspace` | text | name, slug (unique) | - |
| `member` | text | workspace_id, user_id, role | FK workspace, user. Unique (workspace_id, user_id) |
| `agent_runtime` | text | workspace_id, daemon_id, provider, status, device_info, metadata, last_seen_at | FK workspace. Unique (workspace_id, daemon_id, provider) |
| `agent` | text | workspace_id, name, instructions, email_handle (unique), runtime_id, status, max_concurrent_tasks, owner_id, runtime_config, tools, triggers, visibility, forward_to_email | FK workspace, agent_runtime, user |
| `agent_whitelist` | text | agent_id, email | FK agent (cascade). Unique (agent_id, email) |
| `conversation` | text | workspace_id, agent_id, user_id, title | FK workspace, agent, user (all cascade) |
| `message` | text | conversation_id, role, content, task_id | FK conversation (cascade) |
| `agent_task_queue` | text | agent_id, runtime_id, workspace_id, conversation_id, prompt, status, priority, result, session_id, work_dir | FK agent (cascade), agent_runtime, workspace, conversation |
| `task_message` | text | task_id, seq, type, tool, content, input, output | FK agent_task_queue (cascade) |
| `emails` | text | agent_id, from_email, to_email, subject, r2_key, is_whitelisted, forwarded | FK agent (cascade) |
| `machine_token` | text | user_id, workspace_id, token_hash (unique), name, last_used_at | FK user, workspace (cascade) |

> **Note:** Main's `verification_code` table is removed — Better Auth manages verification via its own `verification` table. The `agent` table gains `email_handle` and `forward_to_email` columns. New tables: `agent_whitelist`, `emails`.

### Indexes

- `idx_one_pending_per_conversation` — unique partial on `agent_task_queue.conversation_id` WHERE status IN ('queued','dispatched')
- `idx_task_queue_pending` — on `agent_task_queue(agent_id, status)` WHERE status IN ('queued','dispatched')
- `idx_task_message_task_seq` — on `task_message(task_id, seq)`
- `idx_machine_token_hash` — on `machine_token(token_hash)`

### Task Claiming Strategy (D1)

PostgreSQL uses `SELECT ... FOR UPDATE SKIP LOCKED` for concurrent task claiming. D1 (SQLite) does not support row-level locking. Instead, use a **CAS (Compare-And-Swap) style conditional UPDATE**:

```sql
UPDATE agent_task_queue
SET status = 'dispatched',
    runtime_id = ?,
    dispatched_at = datetime('now')
WHERE id = (
  SELECT id FROM agent_task_queue
  WHERE agent_id = ? AND status = 'queued'
  ORDER BY priority DESC, created_at ASC
  LIMIT 1
)
AND status = 'queued'
RETURNING *
```

If another worker claims the same task concurrently, the `AND status = 'queued'` guard causes the UPDATE to affect 0 rows — the caller retries with the next queued task. This works because:

- D1 operates in **auto-commit mode** — each statement is atomic
- D1's `batch()` API runs statements as an **implicit SQL transaction** (sequential, non-concurrent, rolls back on failure)
- The `WHERE status = 'queued'` acts as the compare step — if status changed since the subquery, the update is a no-op
- No explicit `BEGIN`/`COMMIT` needed; the single statement is atomic

For the full `claimTask` flow that combines concurrent-task counting with the claim UPDATE, use `db.batch()` to wrap both statements in a single transaction.

> **Reference:** [Cloudflare D1 Worker API — batch()](https://developers.cloudflare.com/d1/worker-api/d1-database/)

---

### Query Modules (in `@alook/shared`)

All query modules now live in `@alook/shared/db/queries/` and are shared across Web Service, Email Worker, and WS-DO. See [05-shared-library.md](05-shared-library.md) for the full list.

Key queries used by Web Service:

| Module | Functions |
|--------|-----------|
| **user** | `getUser`, `getUserByEmail`, `createUser`, `updateUser` |
| **workspace** | `getWorkspace`, `listWorkspaces(userId)`, `createWorkspace` |
| **member** | `getMemberByUserAndWorkspace`, `listMembers`, `createMember` |
| **agent** | `getAgent`, `getAgentByHandle`, `getAgentInWorkspace`, `listAgents(workspaceId)`, `createAgent`, `deleteAgent` (tx: deletes tasks first), `updateAgent`, `updateAgentStatus` |
| **runtime** | `upsertAgentRuntime` (on-conflict update), `listAgentRuntimes`, `getAgentRuntime`, `updateAgentRuntimeHeartbeat`, `setAgentRuntimeOffline`, `deleteRuntimesByDaemonId`, `markStaleRuntimesOffline` (>45s) |
| **conversation** | `createConversation`, `getConversation`, `listConversations`, `listConversationsByAgent` (with message count), `updateConversationTitle`, `deleteConversation` |
| **message** | `createMessage`, `listMessages(conversationId)`, `getMessage` |
| **task** | `createTask`, `getTask`, `claimTask`, `startTask`, `completeTask`, `failTask`, `getLastTaskSession`, `listPendingTasksByRuntime`, `failStaleDispatchedTasks(20s)`, `countRunningTasks`, ... |
| **task-message** | `createTaskMessage`, `listTaskMessages`, `listTaskMessagesSince(afterSeq)`, `deleteTaskMessages` |
| **machine-token** | `createMachineToken`, `getMachineTokenByHash`, `listMachineTokens`, `deleteMachineToken`, `updateMachineTokenLastUsed` |
| **whitelist** | `getWhitelist`, `addWhitelist`, `removeWhitelist`, `isWhitelisted` |
| **email** | `createEmail`, `getEmailById`, `getEmailsByAgent`, `getEmailsByUser` |

> **Removed:** `verification-code` module — Better Auth manages verification internally.

---

## Authentication & Middleware

### Target: Better Auth

Replace main's custom JWT + OTP auth with Better Auth. Better Auth manages user, session, account, and verification tables directly in D1.

#### Better Auth Setup (`lib/auth.ts`)

```typescript
import { betterAuth } from "better-auth"

export function createAuth(env: Env) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    database: env.DB,               // D1 binding
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
  })
}
```

#### Auth Client (`lib/auth-client.ts`)

```typescript
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
})

export const { signIn, signUp, signOut, useSession } = authClient
```

#### Auth Route (`app/api/auth/[...all]/route.ts`)

Better Auth catch-all route handles all auth endpoints (sign-in, sign-up, sign-out, callback, session).

#### Dual Auth Middleware

Every API route uses dual auth — supports both browser sessions and machine tokens:

```typescript
// lib/dual-auth.ts
export async function requireAuth(request: Request) {
  // 1. Check for machine token (Bearer al_*)
  const authHeader = request.headers.get("Authorization")
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7)
    if (isValidToken(token)) {
      const runtime = await db.getRuntimeByToken(token)
      if (runtime) return { userId: runtime.user_id, db, error: null }
    }
  }

  // 2. Fall back to Better Auth session (cookie-based)
  const auth = createAuth(env)
  const session = await auth.api.getSession({ headers: request.headers })
  if (session) return { userId: session.user.id, db, error: null }

  return { userId: null, db: null, error: new Response("Unauthorized", { status: 401 }) }
}
```

#### Better Auth Managed Tables (in D1)

| Table | Purpose |
|-------|---------|
| `user` | Users (id, name, email, emailVerified, image, createdAt, updatedAt) — camelCase columns as required by Better Auth |
| `session` | DB-backed sessions (id, userId, token, expiresAt, ipAddress, userAgent) |
| `account` | OAuth accounts (userId, accountId, providerId, accessToken, refreshToken, password) |
| `verification` | Email verification tokens (identifier, value, expiresAt) |

#### Auth Env Vars

| Env Var | Purpose |
|---------|---------|
| `BETTER_AUTH_URL` | Base URL for auth endpoints |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

#### What Changes from Main's Auth

| Main (current) | Target (Better Auth) |
|----------------|---------------------|
| Custom JWT (HS256, 72h, jose library) | DB-backed sessions (Better Auth managed) |
| OTP email verification (custom, Resend) | Email/password + GitHub + Google OAuth |
| `verification_code` table (custom) | `verification` table (Better Auth managed) |
| `machine_token` table (SHA256 hashed) | Machine tokens kept — dual auth checks token first, then session |
| Stateless JWT in Authorization header | Session cookie (Better Auth) + machine token in Authorization header |
| Custom `withAuth` middleware | `requireAuth()` dual-auth helper |
| Frontend stores JWT in localStorage | Frontend uses `useSession()` hook from `better-auth/react` |
| `/login` page (OTP input) | `/sign-in` and `/sign-up` pages (email/password + OAuth buttons) |

### Middleware (kept from main)

| Module | Location | Purpose |
|--------|----------|---------|
| **withWorkspaceMember** | `lib/middleware/workspace.ts` | Resolves workspace_id from query param, `X-Workspace-ID` header, or auth context. Checks membership in `member` table. Returns `{workspaceId}` or 400/401/404. |
| **request-id** | `lib/middleware/request-id.ts` | `getRequestId()` from `X-Request-ID` header or random UUID. `setRequestIdHeader()` on response. |
| **request-logger** | `lib/middleware/request-logger.ts` | `logRequest()` — structured JSON to stdout/stderr. Skips `/health`. |
| **helpers** | `lib/middleware/helpers.ts` | `writeJSON()`, `writeError()`, `formatTimestamp()`, `formatTimestampNullable()`, `parseBody(req, zodSchema)` |

### Task Service (`lib/services/task.ts`)

| Method | Logic |
|--------|-------|
| `enqueueTask(agentId, conversationId, workspaceId, prompt)` | Validates agent exists + has runtime, creates task row |
| `claimTask(agentId)` | Checks `countRunningTasks < maxConcurrentTasks`, calls `task.claimTask`, updates agent status to "working" |
| `claimTaskForRuntime(runtimeId)` | Lists pending tasks for runtime, tries `claimTask` per agent (deduped) |
| `startTask(taskId)` | Transitions dispatched -> running |
| `completeTask(taskId, result, sessionId, workDir)` | Transitions running -> completed, creates assistant message if output present, reconciles agent status |
| `failTask(taskId, error)` | Transitions dispatched/running -> failed, creates error message, reconciles agent status |
| `reconcileAgentStatus(agentId)` | Sets agent to "working" if running tasks > 0, else "idle" |

### Response Formatters (`lib/api/responses.ts`)

Converts Drizzle camelCase rows to snake_case API responses: `userToResponse`, `workspaceToResponse`, `agentToResponse`, `taskToResponse`, `conversationToResponse`, `messageToResponse`, `taskMessageToResponse`, `runtimeToResponse`, `machineTokenToResponse`.

### Client-Side API (`lib/api.ts`)

`apiFetch<T>()` wrapper:
- Reads `alook_workspace_id` from localStorage for `X-Workspace-ID` header
- Session cookie sent automatically by browser (Better Auth manages this)
- On 401: redirects to `/sign-in`
- On 429: "Please wait" error
- Exports typed functions for all endpoints (see API Endpoints below)

### Error Class (`lib/errors.ts`)

`ApiError(message, status, details?)` with helpers: `isNetworkError`, `isRateLimit`, `isUnauthorized`.

### Logger (`lib/logger.ts`)

Structured JSON logger. Levels: debug/info/warn/error/silent. Env: `ALOOK_LOG_LEVEL` (default: info). Errors to stderr, rest to stdout.

---

## API Endpoints (37 routes)

### Authentication (Public)

| Method | Path | Handler |
|--------|------|---------|
| ALL | `/api/auth/[...all]` | **Better Auth catch-all.** Handles sign-in, sign-up, sign-out, session, OAuth callbacks. Replaces main's `/api/auth/send-code` and `/api/auth/verify-code`. |
| GET | `/api/me` | Returns current user profile. Session auth. |
| GET | `/api/health` | `{ status: "ok" }`. No auth. |

### Workspaces (Session Auth)

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/workspaces` | List user's workspaces (via member join) |
| POST | `/api/workspaces` | Create workspace (name, slug). Handles slug collision with random hex suffix. Creates member with "owner" role. |
| GET | `/api/workspaces/[id]` | Get workspace by ID |

### Agents (Session Auth + Workspace Member)

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/agents` | List agents in workspace |
| POST | `/api/agents` | Create agent (name, description, instructions, runtime_id, runtime_config, max_concurrent_tasks). Validates runtime exists. Sets visibility "private", ownerId = current user. Reconciles agent status if runtime online. |
| GET | `/api/agents/[id]` | Get agent in workspace |
| PATCH | `/api/agents/[id]` | Partial update (name, description, instructions, runtime_id) |
| DELETE | `/api/agents/[id]` | Delete agent (transaction: delete tasks first, then agent) |
| GET | `/api/agents/[id]/conversations` | List conversations for agent (includes message count) |

### Conversations & Messages (Session Auth + Workspace Member)

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/conversations` | List user's conversations in workspace |
| POST | `/api/conversations` | Create conversation (agent_id) |
| GET | `/api/conversations/[id]` | Get conversation (validates workspace) |
| DELETE | `/api/conversations/[id]` | Delete conversation (deletes tasks first, messages cascade) |
| GET | `/api/conversations/[id]/messages` | List messages in conversation |
| POST | `/api/conversations/[id]/messages` | Send message. Auto-titles conversation from first message (50 char truncate). Creates task via TaskService.enqueueTask. Returns `{ message, task }`. |

### Tasks (Session Auth + Workspace Member)

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/tasks/[id]` | Get task (validates workspace) |
| GET | `/api/tasks/[id]/messages` | Get task messages. Supports `?since=N` for incremental polling. |

### Machine Tokens (Session Auth + Workspace Member)

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/machine-tokens` | List tokens for user in workspace |
| POST | `/api/machine-tokens` | Create token (name, default: "default"). Returns raw token only at creation. Stores hashed. |
| DELETE | `/api/machine-tokens/[id]` | Delete token (must be owned by user) |

### Runtimes (Session Auth + Workspace Member)

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/runtimes` | List runtimes. Marks stale (>45s) as offline first. |
| DELETE | `/api/runtimes/machine` | Delete all runtimes for `daemon_id` query param |

### Daemon Endpoints (Machine Token Auth)

| Method | Path | Handler |
|--------|------|---------|
| POST | `/api/daemon/register` | Register daemon with runtimes. Upserts runtime rows (on-conflict by workspace+daemon+provider). Body: `{ workspace_id, daemon_id, device_name, cli_version, runtimes[] }` |
| POST | `/api/daemon/deregister` | Set runtimes offline. Body: `{ runtime_ids[] }` |
| POST | `/api/daemon/heartbeat` | Update runtime heartbeat timestamp. Marks stale runtimes offline. Fails stuck dispatched tasks (>20s). Reconciles affected agents. Body: `{ runtime_id }` |
| POST | `/api/daemon/runtimes/[runtimeId]/tasks/claim` | Claim next queued task. Returns task with agent instructions + prior session context (session_id, work_dir). Returns `{ task: null }` if none. |
| POST | `/api/daemon/tasks/[taskId]/start` | Mark task as started (dispatched -> running) |
| POST | `/api/daemon/tasks/[taskId]/complete` | Mark complete. Stores result, session_id, work_dir. Creates assistant message if output present. Reconciles agent status. Body: `{ output?, session_id?, work_dir?, branch_name? }` |
| POST | `/api/daemon/tasks/[taskId]/fail` | Mark failed. Creates error message. Reconciles agent status. Body: `{ error? }` |
| POST | `/api/daemon/tasks/[taskId]/progress` | No-op heartbeat for task progress |
| GET | `/api/daemon/tasks/[taskId]/status` | Poll task status |
| GET | `/api/daemon/tasks/[taskId]/messages` | Get task messages |
| POST | `/api/daemon/tasks/[taskId]/messages` | Report messages batch. Body: `{ messages: [{ seq, type, tool?, content?, input?, output? }] }` |

---

## Frontend Pages

### Layouts

| Layout | Location | Purpose |
|--------|----------|---------|
| Root | `app/layout.tsx` | Fonts (DM Sans, DM Mono, Caveat), ThemeProvider, ToasterProvider |
| App | `app/(app)/layout.tsx` | Auth guard (Better Auth `useSession()` check), AgentProvider context, AppSidebar + floating content panel with gradient background |

### Pages

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Redirect: has session -> `/home`, else -> `/sign-in` |
| `/sign-in` | `app/(auth)/sign-in/page.tsx` | Email/password sign-in + GitHub + Google OAuth buttons (Better Auth) |
| `/sign-up` | `app/(auth)/sign-up/page.tsx` | Email/password sign-up + OAuth (Better Auth) |
| `/home` | `app/(app)/home/page.tsx` | Redirect to first agent's detail page (sorted by name). Empty states for no agents / no runtimes. |
| `/agents` | `app/(app)/agents/page.tsx` | Redirect to `/home` |
| `/agents/new` | `app/(app)/agents/new/page.tsx` | Create agent form (AgentEditForm). On save: create agent -> create conversation -> redirect to `/chat/{conversationId}?agent={agentId}` |
| `/agents/[id]` | `app/(app)/agents/[id]/page.tsx` | Agent detail: runtime status indicator, inline edit (AgentEditForm), session list with message counts, new session button, delete agent |
| `/chat/[id]` | `app/(app)/chat/[id]/page.tsx` | Chat UI: user messages (right-aligned), agent messages (left, Streamdown markdown). Active task: status badge, scrollable task message log (tool calls, thinking, text). Input textarea (Enter to send). Polls task messages every 1s. |
| `/runtimes` | `app/(app)/runtimes/page.tsx` | Machine list grouped by daemon_id. Runtime cards with provider, version, status badge. "New machine" sheet: generate token, show CLI commands. |

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `AgentEditForm` | `components/agent-edit-form.tsx` | Form for agent name, description, instructions, runtime select |
| `AppSidebar` | `components/app-sidebar.tsx` | Narrow sidebar: agent avatar buttons (initial letter), create agent (+), runtimes (Monitor icon), sign out via `signOut()` from Better Auth client |
| `GradientBackground` | `components/gradient-background.tsx` | Decorative background |
| `Logo` | `components/logo.tsx` | Alook logo, supports `iconOnly` mode |
| `RuntimeSelect` | `components/runtime-select.tsx` | Runtime picker dropdown |
| `ThemeProvider` | `components/theme-provider.tsx` | next-themes wrapper |
| `ThemeToggle` | `components/theme-toggle.tsx` | Light/dark toggle |
| `ToasterProvider` | `components/toaster-provider.tsx` | Sonner toast wrapper |
| `DashboardNavbar` | `components/dashboard-navbar.tsx` | Top navbar |
| UI primitives | `components/ui/*` | avatar, badge, button, card, confirm-dialog, dialog, input-otp, input, label, scroll-area, select, separator, sheet, textarea |

### Context

`AgentProvider` (`contexts/agent-context.tsx`) — global state for the `(app)` route group:

| Value | Type | Purpose |
|-------|------|---------|
| `agents` | Agent[] | All agents in workspace |
| `runtimes` | Runtime[] | All runtimes in workspace |
| `loading` | boolean | Initial load state |
| `reload()` | async | Refresh agents + runtimes |
| `handleCreateAgent(req)` | async -> Agent | Create agent + reload |
| `handleUpdateAgent(id, req)` | async -> boolean | Update agent + reload |
| `handleDeleteAgent(id)` | async -> boolean | Delete agent + reload |
| `chatWithAgent(agentId)` | async -> string | Create conversation, return ID |
| `getFirstOnlineRuntimeId()` | -> string | First online runtime ID |
| `handleGenerateToken()` | async -> string | Create machine token |
| `handleDeleteMachine(daemonId)` | async -> boolean | Delete machine + reload |

---

## Test Files

### Existing tests (from main, to be adapted for D1)

```
app/api/agents/route.test.ts
app/api/agents/[id]/route.test.ts
app/api/agents/[id]/conversations/route.test.ts
app/api/conversations/route.test.ts
app/api/conversations/[id]/route.test.ts
app/api/conversations/[id]/messages/route.test.ts
app/api/daemon/routes.test.ts
app/api/daemon/deregister/route.test.ts
app/api/daemon/heartbeat/route.test.ts
app/api/daemon/runtimes/[runtimeId]/tasks/claim/route.test.ts
app/api/daemon/tasks/[taskId]/start/route.test.ts
app/api/daemon/tasks/[taskId]/status/route.test.ts
app/api/health/route.test.ts
app/api/machine-tokens/route.test.ts
app/api/machine-tokens/[id]/route.test.ts
app/api/me/route.test.ts
app/api/runtimes/route.test.ts
app/api/runtimes/machine/route.test.ts
app/api/tasks/[id]/route.test.ts
app/api/tasks/[id]/messages/route.test.ts
app/api/workspaces/route.test.ts
app/api/workspaces/[id]/route.test.ts
lib/api.test.ts
lib/api/responses.test.ts
lib/logger.test.ts
lib/middleware/helpers.test.ts
lib/middleware/request-id.test.ts
lib/middleware/request-logger.test.ts
lib/middleware/workspace.test.ts
lib/services/task.test.ts
lib/db/queries/agent.integration.test.ts
lib/db/queries/conversation.integration.test.ts
lib/db/queries/conversation.test.ts
lib/db/queries/machine-token.integration.test.ts
lib/db/queries/runtime.integration.test.ts
lib/db/queries/task-extended.integration.test.ts
lib/db/queries/task.integration.test.ts
lib/db/queries/task.test.ts
lib/db/queries/task-queries.test.ts
lib/db/queries/workspace.integration.test.ts
```

> **Removed:** `auth/send-code`, `auth/verify-code`, `auth/jwt`, `services/email`, `verification-code` tests — replaced by Better Auth.
> **To add:** tests for dual-auth middleware, whitelist queries, email queries.
