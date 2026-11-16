# CastFlow web（Cloud Run）。worker 不在這裡：它留在本機 Mac（mlx-whisper 需要 Apple Silicon）。
# 建置：docker build -t castflow-web .
# 執行：容器聽 $PORT（Cloud Run 預設 8080），環境變數見 .env.example

FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/package.json
RUN npm ci

FROM node:24-slim AS build
WORKDIR /app
# workspace 依賴可能被 hoist 到根目錄，也可能留在 packages/engine：整包帶過來
COPY --from=deps /app ./
COPY . .
# NEXT_PUBLIC_* 會在建置時內嵌進前端，必須以 build arg 傳入
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_TELEMETRY_DISABLED=1
RUN npx next build

FROM node:24-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 8080
CMD ["node", "server.js"]
