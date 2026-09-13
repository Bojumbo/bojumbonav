# -----------------------------------------------------------------------------
# Stage 1: Build — Node.js 20 Alpine
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files first for better layer caching
COPY package.json package-lock.json ./

# Install all dependencies
RUN npm ci

# Copy full source
COPY . .

# Build production bundle
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Serve — Nginx Alpine
# -----------------------------------------------------------------------------
FROM nginx:stable-alpine AS production

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built SPA from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Healthcheck using explicit IPv4 127.0.0.1
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 CMD wget -q --spider http://127.0.0.1:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
