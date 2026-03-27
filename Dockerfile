# ---------- client deps ----------
FROM node:22-bookworm AS client-deps
WORKDIR /app/app/client
COPY app/client/package.json ./
RUN npm install --no-audit --no-fund

# ---------- server deps ----------
FROM node:22-bookworm AS server-deps
WORKDIR /app/app/server
RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*
COPY app/server/package.json ./
RUN npm install --no-audit --no-fund

# ---------- build ----------
FROM node:22-bookworm AS builder
WORKDIR /app
COPY --from=client-deps /app/app/client/node_modules /app/app/client/node_modules
COPY --from=server-deps /app/app/server/node_modules /app/app/server/node_modules
COPY . .
RUN npm run build --prefix /app/app/server && \
    npm run build --prefix /app/app/client

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*
COPY app/server/package.json /app/server/package.json
RUN npm install --omit=dev --no-audit --no-fund --prefix /app/server && \
    npm cache clean --force
COPY --from=builder /app/app/server/dist /app/server/dist
COPY --from=builder /app/app/client/dist /app/client/dist
RUN groupadd --system appgroup && useradd --system --gid appgroup --create-home appuser && \
  mkdir -p /data && chown -R appuser:appgroup /app /data
USER appuser
EXPOSE 3000
CMD ["node", "/app/server/dist/index.js"]
