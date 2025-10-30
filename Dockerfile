# Bun-based Dockerfile
FROM oven/bun:1-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies (without frozen lockfile since we don't have bun.lockb)
RUN bun install

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Expose port
EXPOSE 8787

# Start the application
CMD ["bun", "run", "src/index.ts"]