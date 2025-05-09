FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user for better security
RUN addgroup -g 1000 bambi && \
    adduser -u 1000 -G bambi -s /bin/sh -D bambi && \
    chown -R bambi:bambi /usr/src/app

# Switch to non-root user
USER bambi

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Command to run the application
CMD ["node", "server.js"]