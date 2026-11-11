# Stage 1: Build stage
FROM node:22 AS builder

WORKDIR /app

# Copy root and workspace package files
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# Install all dependencies including devDependencies
RUN npm install --no-audit --no-fund

# Copy client and server source trees
COPY client/ ./client/
COPY server/ ./server/

# Build client SPA and server TypeScript
RUN npm run build

# Remove development dependencies, retaining only production modules
RUN npm prune --omit=dev --no-audit --no-fund

# Stage 2: Runtime stage
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000
ENV CLIENT_DIST_DIR=/app/client/dist

# Copy workspace package manifests
COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled artifacts
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Set ownership to official non-root node user
RUN chown -R node:node /app

# Run as non-root user
USER node

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 10000) + '/api/v1/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

WORKDIR /app/server

CMD ["node", "dist/index.js"]
