# 02 — Email Worker

> `@alook/email-worker` — Cloudflare Worker for inbound email handling.
> Location: `src/email-worker/`
> Status on `main`: **Not implemented.** This doc preserves the full spec-plans implementation.

---

## Overview

The Email Worker receives inbound emails via Cloudflare Email Routing, verifies agent/whitelist via D1, stores raw email content in R2, and notifies the Web Service which handles task and email record creation. The Email Worker is the verification and storage layer — the Web Service is the task orchestration layer.

```
Inbound SMTP → Cloudflare Email Routing → Email Worker
  → D1 via Drizzle (verify agent + whitelist)
  → R2 (store raw email)
  → Web Service (POST /api/email/notify via service binding — creates email record + task)
```

---

## Dependencies

```json
{
  "@alook/shared": "workspace:*",
  "drizzle-orm": "^0.39.0",
  "nanoid": "latest"
}
```

- `@alook/shared` provides Drizzle schema, DB factory, types, and query functions (shared with Web Service and WS-DO)
- `drizzle-orm` for type-safe D1 queries via the shared schema

Dev: `wrangler`, `vitest`, `@cloudflare/workers-types`, `typescript`

---

## Wrangler Configuration

```toml
name = "alook-email-worker"
main = "src/index.ts"
compatibility_date = "2025-04-01"
compatibility_flags = ["nodejs_compat"]

[dev]
port = 8788

[[d1_databases]]
binding = "DB"
database_id = "FILL_AFTER_CREATE"
database_name = "alook-app"

[[r2_buckets]]
binding = "EMAIL_BUCKET"
bucket_name = "alook-emails"

[[services]]
binding = "WEB_SERVICE"
service = "alook-web"
```

### Bindings

| Binding | Type | Target |
|---------|------|--------|
| `DB` | D1 Database | `alook-app` (shared with Web Service) |
| `EMAIL_BUCKET` | R2 Bucket | `alook-emails` |
| `WEB_SERVICE` | Service Binding | `alook-web` (Web Service worker) |

---

## Environment Interface

```typescript
interface EmailEnv {
  DB: D1Database
  EMAIL_BUCKET: R2Bucket
  WEB_SERVICE: Fetcher
}
```

---

## Handlers

### `email(message, env)` — Inbound Email Handler

Triggered by Cloudflare Email Routing when an email arrives at an `@alook.ai` address.

**Flow:**

```
1. Parse handle from recipient address (message.to)
   └── Uses @alook/shared parseEmailHandle()

2. Look up agent by handle
   └── queries.agent.getAgentByHandle(db, handle)
   └── If not found → message.setReject("No agent found for this address")

3. Check if sender is whitelisted
   └── queries.whitelist.isWhitelisted(db, agentId, senderEmail)

4. Store raw email in R2
   └── Read message.raw stream → ArrayBuffer
   └── PUT to R2 at "emails/{nanoid}/raw"
   └── Content-Type: "message/rfc822"

5a. If whitelisted:
   └── Notify Web Service: POST http://internal/api/email/notify
       Body: { agentId, r2Key, from, subject, isWhitelisted: true }
   └── Web Service handles: create email record, create task, broadcast via WS-DO

5b. If NOT whitelisted:
   └── Resolve forward address: agent.forward_to_email, fallback to user.email
   └── If forwardTo exists:
       └── Notify Web Service: POST http://internal/api/email/notify
           Body: { agentId, r2Key, from, subject, isWhitelisted: false, forwarded: true }
       └── message.forward(forwardTo)
   └── If no forwardTo:
       └── Notify Web Service: POST http://internal/api/email/notify
           Body: { agentId, r2Key, from, subject, isWhitelisted: false, forwarded: false }
   └── NO task created by Web Service (non-whitelisted)
```

> **Design principle:** The Email Worker is responsible for verification (agent lookup, whitelist check) and storage (R2). The Web Service is responsible for persistence (email records, tasks) and orchestration (WS-DO broadcast). This keeps the Email Worker stateless beyond R2 and avoids duplicating task creation logic.

### `fetch(request, env)` — HTTP Simulation Endpoint

Development-only endpoint for testing email flow without real SMTP.

- **POST `/simulate`** — Accepts `{ from, to, subject?, body? }`, constructs a fake `ForwardableEmailMessage`, and calls `this.email()`.
- Returns `{ ok: true }` or `{ error: "..." }` (500).
- All other routes return 404.

---

## Database Access

The Email Worker uses Drizzle ORM via the shared schema and query functions from `@alook/shared` for **read-only verification** (agent lookup, whitelist check). It does **not** write email records or tasks — that is the Web Service's responsibility after receiving the `/api/email/notify` call.

```typescript
import { createDb, schema, queries } from "@alook/shared"

const db = createDb(env.DB) // D1 binding → Drizzle instance
```

### Queries Used

| Operation | Shared Query Function | Table | Access |
|-----------|----------------------|-------|--------|
| Look up agent by email handle | `queries.agent.getAgentByHandle(db, handle)` | `agent` | Read |
| Get user email (for forward fallback) | `queries.user.getUser(db, userId)` | `user` | Read |
| Check sender whitelist | `queries.whitelist.isWhitelisted(db, agentId, email)` | `agent_whitelist` | Read |

> **All tables are defined and migrated by the Web Service.** The Email Worker only reads from them for verification. Email records and tasks are created by the Web Service upon receiving the `/api/email/notify` call. See [01-web-service.md](01-web-service.md) for the full schema definition.

### Referenced Tables

| Table | Access | Purpose |
|-------|--------|---------|
| `agent` | Read | Look up agent by `email_handle`, get `forward_to_email`, `runtime_id`, `owner_id` |
| `user` | Read | Get owner email for forward fallback |
| `agent_whitelist` | Read | Check if sender is whitelisted |

---

## Service Binding Notification

The Email Worker notifies the Web Service after storing the raw email in R2. The Web Service handles all persistence and orchestration.

```
POST http://internal/api/email/notify
Content-Type: application/json

{
  "agentId": "agent-1",
  "r2Key": "emails/abc123/raw",
  "from": "sender@example.com",
  "subject": "Hello",
  "isWhitelisted": true,
  "forwarded": false
}
```

### What the Web Service does on `/api/email/notify`

| Field | Web Service Action |
|-------|-------------------|
| `isWhitelisted: true` | Create email record + create task in `agent_task_queue` + broadcast `email.received` via WS-DO |
| `isWhitelisted: false, forwarded: true` | Create email record only (forwarded, no task) |
| `isWhitelisted: false, forwarded: false` | Create email record only (dropped, no task) |

This keeps task creation logic in the Web Service (single owner of write operations) and the Email Worker focused on verification + R2 storage.

---

## R2 Storage Layout

```
alook-emails/
  emails/{nanoid}/raw    ← RFC 822 raw email bytes
                           Content-Type: message/rfc822
```

---

## Test Coverage

**File:** `src/email-worker/src/index.test.ts`

### Test Groups

| Group | Tests | What's Covered |
|-------|-------|----------------|
| Agent resolution | 3 | Reject on no agent, parse handle from alook.ai address, reject non-alook domain |
| R2 storage | 2 | Correct R2 key + content-type, ArrayBuffer matches raw email |
| Whitelisted path | 5 | R2 stored, Web Service notified with `isWhitelisted: true` + correct payload, empty subject default, no forward called |
| Non-whitelisted path | 4 | R2 stored, Web Service notified with `isWhitelisted: false`, forward when `forward_to_email` set, no forward when empty |
| Error propagation | 3 | D1 failure, R2 failure, web service binding failure |

### Test Mocks (`src/email-worker/src/__mocks__/cf.ts`)

| Mock | Factory | Purpose |
|------|---------|---------|
| `createMockD1(config)` | D1 Database | Configurable agents map + whitelist set. Tracks all SQL calls with bindings. To be adapted for Drizzle — mock the Drizzle DB instance instead of raw D1. |
| `createMockR2()` | R2 Bucket | Mock `put()` method, tracks calls |
| `createMockFetcher()` | Service Binding | Mock `fetch()`, tracks calls. Verify `/api/email/notify` is called with correct payload (agentId, r2Key, from, subject, isWhitelisted, forwarded). |
| `createMockMessage(opts)` | ForwardableEmailMessage | Creates mock email with from, to, subject, body. Returns `setReject`, `forward`, `rawText` spies. |

---

## Migration Notes

### Changes from spec-plans implementation

| Spec-plans | Target |
|------------|--------|
| Raw D1 `db.prepare().bind()` queries | Drizzle ORM via shared schema from `@alook/shared` |
| Inline `getDb()` helper with all queries | Import shared query modules from `@alook/shared` (read-only verification) |
| Creates event in `events` table | Notifies Web Service via `POST /api/email/notify` — Web Service creates task |
| Email Worker writes email records + tasks | Email Worker only reads (verify) + stores R2 — Web Service handles all writes |
| `nanoid` for ID generation | Drizzle handles ID generation via schema defaults |
| Table definitions duplicated in worker | Tables defined once in `@alook/shared` schema, migrated by Web Service |

### Task Creation via Web Service API

The Email Worker does not create tasks or email records directly. Instead:

```
Spec-plans: email → create event in events table → CLI polls events → CLI creates task
Target:     email → verify + store R2 → POST /api/email/notify → Web Service creates email record + task → CLI claims task
```

This keeps the Web Service as the single owner of write operations, avoiding duplicated task creation logic across services. The CLI daemon claims tasks through the existing `/api/daemon/runtimes/{id}/tasks/claim` endpoint. No events table needed.

### Schema and queries are in `@alook/shared`

All Drizzle schema definitions, the DB factory (`createDb(d1Binding)`), and query modules live in `@alook/shared`. The Email Worker imports them for **read-only verification** (agent lookup, whitelist check) — it does not write to D1. See [05-shared-library.md](05-shared-library.md) for the shared module structure.
