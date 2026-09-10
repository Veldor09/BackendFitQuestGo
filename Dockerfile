# ---- Dev image: hot-reload for local work ----
FROM node:22-slim AS dev
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN corepack prepare pnpm@11.6.0 --activate
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
CMD ["pnpm", "run", "start:dev"]

# ---- Build stage ----
FROM node:22-slim AS builder
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN corepack prepare pnpm@11.6.0 --activate
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm run build

# ---- Production runtime ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
