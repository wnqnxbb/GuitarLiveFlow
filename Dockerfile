# ---- 构建阶段 ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
# better-sqlite3 通常有预编译包；没有时需要这些工具现场编译
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- 运行阶段 ----
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV CLIENT_DIST=/app/client/dist
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/seed ./seed
VOLUME ["/data"]
EXPOSE 3000
WORKDIR /app/server
CMD ["node", "dist/server/src/index.js"]
