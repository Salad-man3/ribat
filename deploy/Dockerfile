FROM node:20-alpine
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/quran-data/package.json packages/quran-data/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @ribat/shared build \
  && pnpm --filter web build \
  && pnpm --filter api exec prisma generate \
  && pnpm --filter api build
ENV NODE_ENV=production
ENV SERVE_WEB=true
ENV WEB_DIST_PATH=/repo/apps/web/dist
WORKDIR /repo/apps/api
EXPOSE 3000
ENTRYPOINT ["sh", "/repo/deploy/docker-entrypoint.sh"]
