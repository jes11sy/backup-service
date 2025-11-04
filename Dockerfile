# Stage 1: Build
FROM node:20-alpine AS builder

# Установить postgresql-client для pg_dump/pg_restore и openssl для Prisma
RUN apk add --no-cache postgresql-client openssl1.1-compat

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

# Установить postgresql-client для pg_dump/pg_restore и openssl для Prisma
RUN apk add --no-cache postgresql-client gzip openssl1.1-compat

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production && npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Create backup directory
RUN mkdir -p /tmp/backups && chmod 777 /tmp/backups

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001
USER nestjs

EXPOSE 5009

CMD ["node", "dist/main"]

