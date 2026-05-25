FROM node:24-slim

RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace config files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Copy all packages (needed for workspace resolution)
COPY lib/ ./lib/
COPY scripts/ ./scripts/
COPY artifacts/api-server/ ./artifacts/api-server/

# --shamefully-hoist ensures all packages land in root node_modules
# so Node can find externalized packages (discord.js etc.) at runtime
RUN pnpm install --no-frozen-lockfile --config.dangerouslyAllowAllBuilds=true --shamefully-hoist

# Build the api-server
RUN pnpm --filter @workspace/api-server run build

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
