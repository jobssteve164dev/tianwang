FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci --workspace client
COPY client ./client
ENV GENERATE_SOURCEMAP=false
RUN npm run client:build

FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci --workspace server --omit=dev

FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293
WORKDIR /app/server
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules /app/node_modules
COPY --from=dependencies /app/server/node_modules ./node_modules
COPY --from=frontend /app/client/build /app/client/build
COPY server/package.json ./package.json
COPY server/src ./src
COPY server/migrations ./migrations
COPY --chmod=755 docker/production/database-migrate /app/deploy/database-migrate
RUN mkdir -p logs uploads reports keys data/evidence downloads && chown -R node:node logs uploads reports keys data downloads
USER node
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=12 CMD node -e "fetch('http://127.0.0.1:8000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/index.js"]
