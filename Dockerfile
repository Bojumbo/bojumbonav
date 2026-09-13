# -----------------------------------------------------------------------------
# Stage 1: Build — Node.js 20 Alpine
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files first for better layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy full source
COPY . .

# Build production bundle
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Serve — Nginx Alpine (minimal attack surface)
# -----------------------------------------------------------------------------
FROM nginx:stable-alpine AS production

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built SPA from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port (Cloudflare tunnel > this port)
EXPOSE 80

# Healthcheck: nginx responds with 200 on root
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 `
  CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
