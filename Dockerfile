# Multi-stage Dockerfile for sshMON honeypot
# Optimized for security and minimal image size

# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci --only=production

# Stage 2: Runtime
FROM node:20-alpine

LABEL maintainer="sshMON Project"
LABEL description="SSH Honeypot with Threat Intelligence"
LABEL version="2.0.0"

# Install runtime dependencies
RUN apk add --no-cache \
    tini \
    curl \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 honeypot && \
    adduser -D -u 1001 -G honeypot honeypot

WORKDIR /app

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY --chown=honeypot:honeypot fakeServer ./fakeServer
COPY --chown=honeypot:honeypot package.json ./
COPY --chown=honeypot:honeypot .env.example ./.env.example

# Create necessary directories
RUN mkdir -p /logs /keys /cache && \
    chown -R honeypot:honeypot /logs /keys /cache

# Generate SSH host key on first run
COPY --chown=honeypot:honeypot scripts ./scripts
RUN chmod +x scripts/*.js || true

# Switch to non-root user
USER honeypot

# Expose SSH port
EXPOSE 22

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD nc -z localhost 22 || exit 1

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start the honeypot
CMD ["node", "fakeServer/fakeSSH.js"]
