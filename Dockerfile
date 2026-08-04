FROM node:22-slim AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

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
ENV PYTHON_VENV_PATH=/app/extraction/.venv/bin/python
ENV EXTRACTION_DIR=/app/extraction

RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip python3-venv && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY --from=builder --chown=nextjs:nodejs /app/extraction ./extraction
RUN python3 -m venv extraction/.venv && \
    extraction/.venv/bin/pip install --no-cache-dir -r extraction/requirements.txt && \
    chown -R nextjs:nodejs extraction/.venv

USER nextjs
EXPOSE 8007

CMD ["node", "server.js"]
