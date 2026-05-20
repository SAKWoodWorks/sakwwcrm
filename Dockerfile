FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Run
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8007

# Python for extraction pipeline (spawned by /api/gdrive webhook)
RUN apk add --no-cache python3 py3-pip
COPY extraction/requirements.txt ./extraction/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r extraction/requirements.txt

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --chown=nextjs:nodejs extraction ./extraction

USER nextjs
EXPOSE 8007

CMD ["node", "server.js"]
