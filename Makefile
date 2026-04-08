.PHONY: setup start stop build test typecheck check daemon cli migrate-up migrate-down db-up db-down

setup: ## First-time setup
	pnpm install
	docker compose up -d postgres
	@echo "Waiting for PostgreSQL to be ready..."
	@until docker compose exec postgres pg_isready -U postgres > /dev/null 2>&1; do sleep 1; done
	cd src/web && pnpm drizzle-kit push

start: ## Start everything (DB + schema + Next.js dev server)
	-lsof -ti:3000 | xargs kill 2>/dev/null
	docker compose up -d postgres
	@echo "Waiting for PostgreSQL to be ready..."
	@until docker compose exec postgres pg_isready -U postgres > /dev/null 2>&1; do sleep 1; done
	cd src/web && pnpm drizzle-kit push
	cd src/web && exec pnpm dev

stop: ## Kill dev server
	-lsof -ti:3000 | xargs kill 2>/dev/null

build: ## Build Next.js + CLI
	cd src/web && pnpm build
	cd src/cli && pnpm build

test: ## Run Vitest
	pnpm vitest run

typecheck: ## TypeScript type check
	pnpm tsc --noEmit -p src/web/tsconfig.json
	pnpm tsc --noEmit -p src/cli/tsconfig.json

check: typecheck build test ## CI gate

daemon: ## Start local daemon
	cd src/cli && pnpm tsx src/index.ts daemon start --foreground

cli: ## Run CLI commands (e.g. make cli ARGS="agent list")
	cd src/cli && pnpm tsx src/index.ts $(ARGS)

migrate-up: ## Run Drizzle migrations
	cd src/web && pnpm drizzle-kit push

migrate-down: ## Generate migration SQL
	cd src/web && pnpm drizzle-kit drop

db-up: ## Start PostgreSQL container
	docker compose up -d postgres

db-down: ## Stop PostgreSQL container and remove volumes
	docker compose down -v postgres
