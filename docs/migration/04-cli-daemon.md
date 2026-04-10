# 04 — CLI Daemon

> `@alook/cli` — Commander.js CLI + daemon that spawns agent subprocesses.
> Location: `src/cli/`
> Runtime: Node.js (Bun for dev and build). Follows main branch.

---

## Auth

The CLI daemon continues using **machine tokens** (`Bearer al_*`) for all API communication. The Better Auth migration (JWT → session-based auth) affects the Web Service's browser authentication only — it does not change the CLI's auth flow. Machine tokens are validated independently of Better Auth sessions via the dual-auth middleware in the Web Service (see [01-web-service.md](01-web-service.md)).

---

## Dependencies

```json
{
  "@alook/shared": "workspace:*",
  "commander": "^13.0.0",
  "dotenv": "^16.0.0"
}
```

Dev: `eslint`, `typescript`, `typescript-eslint`

Build: `bun build src/index.ts --outdir dist --target node`
Binary: `dist/index.js` (ESM, exposed as `alook` in package.json `bin`)

---

## Commands

Entry point: `src/cli/src/index.ts` — sets up Commander.js program "alook" with 6 subcommands.

Global options: `--server <url>`, `--profile <name>`

| Command | File | Purpose |
|---------|------|---------|
| `alook register --token <al_...>` | `commands/register.ts` | Validate token (must start `al_`), fetch user via `/api/me`, fetch workspaces via `/api/workspaces`, save config |
| `alook status` | `commands/status.ts` | Display registration status and workspace info from config |
| `alook agent list [--workspace] [--json]` | `commands/agent.ts` | List agents (table or JSON output) |
| `alook agent create --name --runtime [--workspace]` | `commands/agent.ts` | Create agent via API |
| `alook daemon start [--foreground] [--server]` | `commands/daemon.ts` | Start background daemon |
| `alook daemon status` | `commands/daemon.ts` | Show daemon health URL |
| `alook config show` | `commands/config.ts` | Display current config as JSON |
| `alook config path` | `commands/config.ts` | Show config file path |
| `alook version` | `commands/version.ts` | Read version from package.json |

---

## CLI Library (`src/cli/lib/`)

### APIClient (`lib/client.ts`)

HTTP client for CLI commands (not daemon).

| Method | Purpose |
|--------|---------|
| `getJSON<T>(path)` | GET request with auth headers |
| `postJSON<T>(path, body)` | POST request |
| `deleteJSON<T>(path)` | DELETE request |
| `healthCheck()` | Boolean health check |

Headers set automatically: `Authorization: Bearer <token>`, `X-Workspace-ID: <workspaceId>` (if set).

### Config (`lib/config.ts`)

Config persistence at `~/.alook/config.json` (0o600 permissions).

```typescript
interface CLIConfig {
  token?: string
  server_url?: string
  watched_workspaces?: { id: string; name: string }[]
  default_profile?: string
  profiles?: Record<string, ProfileConfig>
}

interface ProfileConfig {
  token?: string
  server_url?: string
  watched_workspaces?: { id: string; name: string }[]
}
```

Functions: `configPath()`, `loadCLIConfig()`, `loadCLIConfigForProfile(profile?)`, `saveCLIConfig(cfg)`, `saveCLIConfigForProfile(profile?, cfg)`

### Logger (`lib/logger.ts`)

Structured colored logging with timestamps (HH:MM:SS format).

- Levels: debug, info, warn, error, silent
- Env: `ALOOK_LOG_LEVEL` (default: info)
- Respects `NO_COLOR` and `FORCE_COLOR`
- Errors to stderr, rest to stdout

### Output (`lib/output.ts`)

- `printTable(headers, rows)` — aligned table with separators
- `printJSON(data)` — JSON with 2-space indent

### Flags (`lib/flags.ts`)

- `flagOrEnv(cmd, flagName, envKey, fallback)` — resolves flag > env var > fallback

---

## Daemon (`src/cli/daemon/`)

### Main Loop (`daemon/daemon.ts`)

`startDaemon(profile?, serverUrl?)` — the core daemon process:

```
1. Load daemon config + CLI config
2. Register with server: POST /api/daemon/register
   - Detects installed agent CLIs (claude, codex, opencode) via `which`
   - Sends workspace_id, daemon_id, device_name, cli_version, runtimes[]
3. Start health server on port 19514
4. Enter polling loop:
   a. For each registered runtime → claimTask, handleTask
   b. Sleep for pollInterval (default 3s)
5. Heartbeat loop (separate interval, default 15s)
6. On SIGTERM/SIGINT → graceful shutdown (deregister runtimes)
```

**`handleTask(task)`:**
1. Claim task from server
2. Start task (dispatched -> running)
3. Run task (spawn agent backend)
4. Complete or fail task
5. Reconcile agent status

**`runTask(task)`:**
1. Create agent backend based on provider
2. Build prompt from task
3. Create working directory
4. Execute agent session
5. Batch and flush messages to server (batch size 20, flush interval 2s)
6. Return result (status, comment, sessionId, workDir)

### Daemon Client (`daemon/client.ts`)

`DaemonClient` class — HTTP client for all `/api/daemon/*` endpoints:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `register()` | POST `/api/daemon/register` | Register daemon + runtimes |
| `deregister(runtimeIds)` | POST `/api/daemon/deregister` | Set runtimes offline |
| `heartbeat(runtimeId)` | POST `/api/daemon/heartbeat` | Send heartbeat |
| `claimTask(runtimeId)` | POST `/api/daemon/runtimes/{id}/tasks/claim` | Claim next task |
| `startTask(taskId)` | POST `/api/daemon/tasks/{id}/start` | Mark started |
| `completeTask(taskId, body)` | POST `/api/daemon/tasks/{id}/complete` | Mark complete |
| `failTask(taskId, error)` | POST `/api/daemon/tasks/{id}/fail` | Mark failed |
| `reportMessages(taskId, messages)` | POST `/api/daemon/tasks/{id}/messages` | Upload task messages |

### Daemon Config (`daemon/config.ts`)

`DaemonConfig` loaded from environment variables:

| Env Var | Default | Purpose |
|---------|---------|---------|
| `ALOOK_SERVER_URL` | `http://localhost:8080` | API server URL |
| `ALOOK_DAEMON_POLL_INTERVAL` | `3s` | Task polling interval |
| `ALOOK_DAEMON_HEARTBEAT_INTERVAL` | `15s` | Heartbeat interval |
| `ALOOK_AGENT_TIMEOUT` | `2h` | Agent execution timeout |
| `ALOOK_DAEMON_MAX_CONCURRENT_TASKS` | `20` | Max parallel tasks |
| `ALOOK_LOG_LEVEL` | `info` | Log level |

Additional config: `claudePath`, `codexPath`, `opencodePath` (CLI paths), model overrides per provider, `daemonId`, `deviceName`, `runtimeName`, `workspacesRoot`, `keepEnvAfterTask`, `cliVersion`.

Helper: `parseDuration(s)` — parses Go-style duration strings (ns, us, ms, s, m, h).
Helper: `normalizeServerBaseURL()` — converts WS/WSS URLs to HTTP/HTTPS.

### Health Server (`daemon/health.ts`)

HTTP server on `127.0.0.1:19514`.

- `GET /health` → `{ status: "ok", uptime: "Xs", runtimes: N }`
- `setRuntimeCount(n)` method to update runtime count

### Prompt Builder (`daemon/prompt.ts`)

`buildPrompt(task)` — currently passthrough (returns `task.prompt` as-is).

### Types (`daemon/types.ts`)

| Type | Key Fields |
|------|------------|
| `Task` | agent, runtime, workspace, repos, prompt |
| `TaskAgentData` | name, instructions |
| `RepoData` | repository information |
| `TaskResult` | status, comment, sessionId, workDir, branchName |
| `RuntimeInfo` | runtime metadata |
| `AgentMessage` | seq, type (text/thinking/tool-use/tool-result/status/error/log), tool?, content?, input?, output? |
| `AgentResult` | status, output, error, durationMs, sessionId |
| `ExecOptions` | cwd, model, systemPrompt, maxTurns, timeout, resumeSessionId |

Conversion: `fromApiTask(api: TaskApi)` — converts wire format (snake_case) to internal format.

---

## Agent Backends (`daemon/agent/`)

### Interface (`agent/index.ts`)

```typescript
interface AgentSession {
  messages: AsyncIterable<AgentMessage>
  result: Promise<AgentResult>
}

interface AgentBackend {
  name: string
  execute(prompt: string, options: ExecOptions): AgentSession
}
```

Factory: `createBackend(provider, cliPath)` — returns backend for claude/codex/opencode.
Detection: `detectVersion(cliPath)` — runs `<cliPath> --version`.

### Claude Backend (`agent/claude.ts`)

Spawns Claude CLI as subprocess with stream-json output.

**Command:**
```bash
claude -p <prompt> \
  --output-format stream-json \
  --verbose \
  --permission-mode bypassPermissions \
  [--model <model>] \
  [--max-turns <n>] \
  [--append-system-prompt <instructions>] \
  [--resume <sessionId>]
```

**JSON Stream Events:**

| Event Type | Parsed As |
|------------|-----------|
| `assistant` | Text blocks, thinking blocks, tool_use blocks |
| `result` | Final result + session_id |
| `tool_result` | Tool invocation result |
| `system` | Init events with session_id |
| `control_request` | Permission requests (auto-approved via stdin) |

Auto-approves control requests by writing `control_response` JSON to stdin.
Timeout support: kills process on timeout.

### Codex Backend (`agent/codex.ts`)

Spawns Codex CLI with JSON-RPC 2.0 protocol over stdio.

**Command:**
```bash
codex app-server --listen stdio://
```

**JSON-RPC Handshake:**
1. Send `initialize` RPC
2. Send `initialized` notification
3. Send `thread/start` or `thread/resume` RPC
4. Send `turn/start` RPC with prompt

**Notifications Handled:**

| Notification | Parsed As |
|-------------|-----------|
| `turn/started`, `turn/completed` | Turn lifecycle |
| `thread/status/changed` | Thread status |
| `item/started`, `item/completed` | Item execution (commandExecution, fileChange, agentMessage) |

Auto-approves approval requests from server.
Protocol detection: auto-detects legacy vs raw protocol.
Deduplication: prevents duplicate turn_completed events.

### OpenCode Backend (`agent/opencode.ts`)

Spawns OpenCode CLI with JSON stream output.

**Command:**
```bash
opencode run --format json <prompt> \
  [--model <model>] \
  [--prompt <systemPrompt>] \
  [--session <resumeSessionId>]
```

Sets `OPENCODE_PERMISSION` env var to allow all operations.

**JSON Stream Events:**

| Event Type | Parsed As |
|------------|-----------|
| `session` | Session ID |
| `message` | Assistant messages |
| `thinking` | Thinking blocks |
| `tool_call` | Tool invocation |
| `tool_result` | Tool result |
| `error` | Error events |
| `done` / `complete` | Completion with status |

---

## Test Files

```
daemon/agent/__tests__/claude.test.ts
daemon/agent/__tests__/codex.test.ts
daemon/agent/__tests__/index.test.ts
daemon/agent/__tests__/opencode.test.ts
daemon/client.test.ts
daemon/config.test.ts
daemon/daemon.test.ts
daemon/health.test.ts
daemon/prompt.test.ts
lib/config.test.ts
lib/flags.test.ts
lib/logger.test.ts
lib/output.test.ts
```

---

## Development

### Running from monorepo root

In development, the CLI can be executed via Bun from the project root directory without building first:

```bash
# From project root
pnpm cli register --token al_...
pnpm cli status
pnpm cli daemon start --foreground
pnpm cli agent list
```

Root `package.json` scripts:
```json
{
  "scripts": {
    "cli": "bun src/cli/src/index.ts"
  }
}
```

### Dev config directory

In development, the `.alook/` config directory is located at the **project root** instead of `~/.alook/`:

```
alook/                  # project root
├── .alook/
│   └── config.json     # dev config (server URL, token, workspaces)
├── src/
│   ├── cli/
│   ...
```

This keeps dev config isolated from any production config at `~/.alook/` and makes it easy to share dev settings across the team via `.gitignore` rules.

### Production config

In production (built binary), config is at `~/.alook/config.json` as documented in the Config section above.
