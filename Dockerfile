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
