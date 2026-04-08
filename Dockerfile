# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY src/shared/package.json src/shared/
COPY src/web/package.json src/web/

RUN pnpm install --frozen-lockfile

COPY src/shared/ src/shared/
COPY src/web/ src/web/

RUN cd src/web && pnpm build

# Stage 2: Runtime
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/src/web/.next/standalone ./
COPY --from=builder /app/src/web/.next/static src/web/.next/static
COPY --from=builder /app/src/web/public src/web/public

EXPOSE 3000

ENTRYPOINT ["node", "src/web/server.js"]
