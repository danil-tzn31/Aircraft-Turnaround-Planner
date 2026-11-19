# deps: install packages (npm >= 11.20 so allowScripts is honoured)
FROM node:26-slim AS deps
WORKDIR /app
RUN npm install -g npm@11.20.0
# the postinstall script runs prisma generate, so it needs the schema and config
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma7.config.ts ./
RUN npm ci

# build: generate the Prisma client, then build the app
FROM node:26-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# the build prerenders pages from the database; the URL is only set for this command
ARG DATABASE_URL
RUN DATABASE_URL="$DATABASE_URL" npm run build

# runner: standalone server only, no dev dependencies
FROM node:26-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
