FROM node:24-slim

RUN npm install -g pnpm@latest

WORKDIR /app

# Copy workspace config files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Copy shared lib packages
COPY lib/ ./lib/

# Copy the api-server artifact
COPY artifacts/api-server/ ./artifacts/api-server/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Build libs then the api-server
RUN pnpm run typecheck:libs || true
RUN pnpm --filter @workspace/api-server run build

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
