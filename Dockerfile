# Stage 1: build the static site with Vite.
FROM node:22-alpine AS build
WORKDIR /app

# Install deps first so this layer is cached until package*.json changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: serve dist/ with nginx. The "unprivileged" image runs as a
# non-root user and listens on 8080 instead of 80.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080

# Lets TrueNAS (and `docker ps`/`docker inspect`) show real container
# health instead of just "running" — wget is busybox-provided on Alpine,
# no extra package needed.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
