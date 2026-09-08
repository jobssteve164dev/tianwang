FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci --workspace client
COPY client ./client
ENV GENERATE_SOURCEMAP=false
RUN npm run client:build

FROM nginx:alpine@sha256:72ba65eb42c10344912a84ff42408db7d34f2feb642204570ab8fc5ffd29f1d3
COPY --from=builder /app/client/build /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/nginx.conf
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --retries=6 CMD wget -q -O /dev/null http://127.0.0.1:8080/health
CMD ["nginx", "-g", "daemon off;"]
