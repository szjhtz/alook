# Alook

A stripped-down AI agent task execution platform. Chat with AI agents (Claude Code, Codex, OpenCode) through a web UI, powered by a local daemon that manages agent runtimes.

## Architecture

```
Browser → Next.js (port 3000, API routes + frontend) → PostgreSQL
                              ↑
                        Daemon (polls for tasks, runs agent CLIs)
```

| Package | Description |
|---------|-------------|
| `src/web` | Next.js App Router — frontend pages + API routes, Drizzle ORM |
| `src/cli` | Commander.js CLI + daemon that spawns agent subprocesses |
| `src/shared` | Shared types and constants (`@alook/shared`) |

## Quick Start

```bash
make setup    # Install deps, start Postgres, run migrations
make start    # Start Next.js dev server (port 3000)
make daemon   # In another terminal — registers runtimes, polls for tasks
```

Dev OTP code: `888888`

## Commands

```bash
make setup          # First-time setup
make start          # Next.js dev server
make stop           # Kill dev server
make daemon         # Start local daemon
make build          # Build web + CLI
make test           # Run tests (vitest)
make typecheck      # TypeScript check
make check          # CI gate: typecheck + build + test
make migrate-up     # Push Drizzle schema
make db-up          # Start Postgres container
make db-down        # Stop Postgres container
```

## CLI

```bash
make cli ARGS="register --token <machine-token>"
make cli ARGS="status"
make cli ARGS="agent list"
make cli ARGS="config show"
make cli ARGS="daemon start --foreground"
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://...localhost:5432/alook` | PostgreSQL connection |
| `JWT_SECRET` | `alook-dev-secret-change-in-production` | JWT signing key |
| `APP_ENV` | — | Set `production` for real emails |
| `RESEND_API_KEY` | — | Resend key; unset = OTP logged to console |

## How It Works

1. Daemon detects installed agent CLIs (`claude`, `codex`, `opencode`) and registers runtimes with the server
2. Create an agent in the UI and link it to a runtime
3. Send a message in a conversation — server enqueues a task
4. Daemon claims the task, runs the agent CLI, streams results back
5. Frontend polls for progress and displays output in real-time
