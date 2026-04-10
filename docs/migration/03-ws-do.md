# 03 — WS-DO (WebSocket Durable Objects)

> `@alook/ws-do` — Cloudflare Durable Objects for real-time browser notifications.
> Location: `src/ws-do/`
> Status on `main`: **Not implemented** (main uses HTTP polling only). This doc preserves the spec-plans implementation with a simplified notification-only protocol.

---

## Overview

WS-DO is a **notification-only** WebSocket channel for the browser frontend. It does not carry data payloads — it sends lightweight event notifications that tell the browser *what changed*, and the browser re-fetches the actual data via the REST API.

```
Browser ←── WebSocket (notifications only) ──→ Durable Object
                                                    ↑
Web Service ── service binding POST /broadcast ──→ WS-DO Worker

Browser ── REST API (data fetches) ──→ Web Service
```

This design keeps a single source of truth (the REST API) and avoids maintaining two data protocols. The WebSocket is purely a signal channel.

### Why notification-only

- **One data protocol** — REST API is the single source of truth for all data. No data duplication over WebSocket.
- **More stable** — browser always fetches fresh data from the API after notification. No stale-cache issues.
- **Simpler WS-DO** — no need to serialize full objects into broadcast messages. Just event type + resource ID.
- **CLI not involved** — CLI daemon uses HTTP polling only. WebSocket is browser-only.

---

## Dependencies

```json
{
  "@alook/shared": "workspace:*",
  "drizzle-orm": "^0.39.0"
}
```

- `@alook/shared` provides Drizzle schema, DB factory, and query functions (shared with Web Service and Email Worker)
- `drizzle-orm` for type-safe D1 queries (token validation)

Dev: `wrangler`, `@cloudflare/workers-types`, `typescript`

---

## Wrangler Configuration

```toml
name = "alook-ws-do"
main = "src/index.ts"
compatibility_date = "2025-04-01"
compatibility_flags = ["nodejs_compat"]

[dev]
port = 8789
inspector_port = 9230

[[d1_databases]]
binding = "DB"
database_id = "FILL_AFTER_CREATE"
database_name = "alook-app"

[[durable_objects.bindings]]
name = "WS_DO"
class_name = "WebSocketDurableObject"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["WebSocketDurableObject"]
```

### Bindings

| Binding | Type | Target |
|---------|------|--------|
| `DB` | D1 Database | `alook-app` (for token validation only) |
| `WS_DO` | Durable Object | `WebSocketDurableObject` class |

---

## Environment Interface

```typescript
interface Env {
  DB: D1Database
  WS_DO: DurableObjectNamespace
}
```

---

## Notification Protocol

### Message Format

All WebSocket messages are JSON with `type` and `id` fields. No data payload.

```typescript
interface WsNotification {
  type: string   // event type
  id: string     // resource ID
}
```

### Event Types

| Type | Sent When | ID Field | Browser Action |
|------|-----------|----------|----------------|
| `task.updated` | Task status changes (started, progress, completed, failed) | task ID | `GET /api/tasks/{id}` |
| `runtime.updated` | Runtime comes online, goes offline, registered, deleted | runtime ID | `GET /api/runtimes` |
| `email.received` | New whitelisted email arrives | email ID | `GET /api/emails` |
| `agent.updated` | Agent config changed, status changed | agent ID | `GET /api/agents/{id}` |

### Browser Handling

```typescript
// Browser receives notification → re-fetches via REST API
ws.onmessage = (event) => {
  const { type, id } = JSON.parse(event.data)
  switch (type) {
    case "task.updated":    refetchTask(id); break
    case "runtime.updated": refetchRuntimes(); break
    case "email.received":  refetchEmails(); break
    case "agent.updated":   refetchAgent(id); break
  }
}
```

---

## Architecture

### Channel Model

Each Durable Object instance represents a **channel**. Channels are identified by name:

| Channel Type | DO Name | Purpose |
|--------------|---------|---------|
| User channel | `user:{userId}` | All notifications for a user (tasks, runtimes, emails, agents) |

The DO name is used with `env.WS_DO.idFromName()` to get a deterministic ID.

> **Why user-only channels (no agent channels):** Agent-scoped events (e.g. `email.received` for agent X, `task.updated` for agent Y) are routed through the agent's **owner's** user channel. The Web Service resolves `agent.owner_id` → `userId` and broadcasts to `user:{userId}`. The browser filters events client-side by agent ID if needed. This avoids managing a second channel tier and keeps the DO model simple — one DO per user, regardless of how many agents they own. Spec-plans implemented both user and agent channels, but the added complexity provided no benefit since the browser already knows which agents belong to the current user.

### Connection Lifecycle

```
1. Browser → GET /?userId=xxx  (WebSocket upgrade)
2. Worker routes to user channel DO
3. DO accepts WebSocket upgrade
4. If X-Authenticated-User header present → auto-authenticated
5. Otherwise → client sends { type: "auth", token: "..." }
6. DO validates token against D1 (Better Auth session)
7. Authenticated connections receive notifications
8. Unauthenticated connections are closed on any non-auth message
```

---

## Worker Entry Point (`src/index.ts`)

### Routes

| Method | Path Pattern | Action |
|--------|-------------|--------|
| POST | `/broadcast/user/:userId` | Send notification to user channel DO |
| GET | `/?userId=xxx` | WebSocket connect to user channel |

### Routing Logic

```typescript
// 1. Broadcast: POST /broadcast/user/:userId
//    → DO name: "user:{userId}"
//    → forward to DO: POST http://internal/broadcast

// 2. WebSocket: GET /?userId=xxx
//    → DO name: "user:{userId}"
//    → forward original request (WebSocket upgrade)
```

---

## Durable Object (`src/ws-durable.ts`)

### Class: `WebSocketDurableObject extends DurableObject<Env>`

#### Connection State

Each WebSocket has serialized attachment state:

```typescript
interface ConnectionState {
  userId: string
  authenticated: boolean
}
```

#### Methods

**`fetch(request)`** — Handles both broadcast (POST) and WebSocket upgrade (GET).

- POST `/broadcast`: reads body as text, calls `this.broadcast(body)`, returns "ok"
- WebSocket upgrade: creates `WebSocketPair`, accepts server socket via `ctx.acceptWebSocket(server)`
  - If `X-Authenticated-User` header present → pre-authenticated
  - Otherwise → unauthenticated, client must send auth message
  - Sets up auto ping/pong response: `WebSocketRequestResponsePair("ping", "pong")`
  - Returns 101 with client socket

**`webSocketMessage(ws, message)`** — Handles incoming messages from clients.

- Parses JSON message
- If `{ type: "auth", token: "..." }`:
  - Validates token via `this.validateToken(token)`
  - On success: updates attachment state to authenticated, sends `{ type: "auth.ok" }`
  - On failure: closes with 1008 "Unauthorized"
- Any other message from unauthenticated client: closes with 1008 "Not authenticated"
- Authenticated clients have no other valid message types (notification-only = server-to-client)

**`webSocketClose()`** — No-op (DO auto-cleans up).

**`webSocketError(ws, error)`** — Logs error, closes with 1011.

**`broadcast(message)`** — Private. Iterates all WebSockets via `ctx.getWebSockets()`, sends to authenticated + OPEN connections.

**`validateToken(token)`** — Private. Validates session token via Drizzle queries from `@alook/shared`:

```typescript
import { createDb, queries } from "@alook/shared"

const db = createDb(this.env.DB)

// Browser session token (Better Auth)
// → queries.session.getValidSession(db, token)
// Returns userId string or null
```

> **Note:** Only browser session tokens are validated. CLI does not use WebSocket — it uses HTTP polling.

---

## How the Web Service Sends Notifications

The Web Service calls WS-DO via service binding when state changes:

```typescript
// Helper function in Web Service
async function notify(userId: string, type: string, id: string) {
  await env.WS_DO_SERVICE.fetch(
    `http://internal/broadcast/user/${userId}`,
    {
      method: "POST",
      body: JSON.stringify({ type, id }),
    }
  )
}

// Usage examples:
await notify(userId, "task.updated", taskId)
await notify(userId, "runtime.updated", runtimeId)
await notify(userId, "email.received", emailId)
await notify(userId, "agent.updated", agentId)
```

Web Service wrangler.toml:
```toml
[[services]]
binding = "WS_DO_SERVICE"
service = "alook-ws-do"
```

### Where to call `notify()`

| Web Service Location | Event Type |
|---------------------|------------|
| `TaskService.completeTask()` | `task.updated` |
| `TaskService.failTask()` | `task.updated` |
| `TaskService.startTask()` | `task.updated` |
| Daemon heartbeat endpoint | `runtime.updated` |
| Daemon register endpoint | `runtime.updated` |
| Daemon deregister endpoint | `runtime.updated` |
| Runtime delete endpoint | `runtime.updated` |
| Email Worker notify endpoint | `email.received` |
| Agent update endpoint | `agent.updated` |
| Agent delete endpoint | `agent.updated` |

---

## Authentication Flow

### Browser (Session Auth)

```
1. Browser gets WS auth token: GET /api/ws/token → { token }
2. Browser opens WebSocket: ws://ws-do/?userId=xxx
3. Client sends: { type: "auth", token: "session_token_here" }
4. DO validates via queries.session.getValidSession(db, token)
5. On success: { type: "auth.ok" } → connection authenticated
6. Browser starts receiving notifications
```

---

## Test Coverage

No test files exist for WS-DO on spec-plans. Testing approach should cover:

- WebSocket upgrade acceptance
- Auth message validation (session tokens)
- Rejection of unauthenticated connections
- Broadcast delivery to authenticated connections only
- Notification message format (`{ type, id }`)
- Connection cleanup on close/error

---

## Migration Notes

### What main's polling model does that WS-DO replaces

| Main (HTTP Polling) | WS-DO (Notification Push) |
|---------------------|--------------------------|
| Frontend polls `GET /api/tasks/{id}/messages?since=N` every 1s | WS-DO sends `{ type: "task.updated", id }` → browser re-fetches |
| No runtime status push — page reload to see changes | WS-DO sends `{ type: "runtime.updated", id }` → browser re-fetches |
| No email notification in browser | WS-DO sends `{ type: "email.received", id }` → browser re-fetches |

### Changes from spec-plans WS-DO

| Spec-plans | Target |
|------------|--------|
| Full data payloads in broadcast messages (runtime status objects, task data, email details) | Notification-only: `{ type, id }` — browser fetches data via REST API |
| Agent channels + user channels | User channels only (notifications scoped per user) |
| CLI + browser both use WebSocket | Browser only — CLI uses HTTP polling |
| Raw D1 queries for token validation | Drizzle queries from `@alook/shared` |
| Validates both session tokens and runtime tokens (`alook_tk_*`) | Session tokens only (browser auth via Better Auth) |

### Required changes to Web Service

1. Add WS-DO service binding in Web Service wrangler.toml
2. Add `notify(userId, type, id)` helper function
3. Call `notify()` at state change points (see table above)
4. Add `GET /api/ws/token` endpoint for browser WebSocket auth

### Schema and queries are in `@alook/shared`

All Drizzle schema definitions, the DB factory (`createDb(d1Binding)`), and query modules live in `@alook/shared`. WS-DO imports them for token validation only. See [05-shared-library.md](05-shared-library.md).
