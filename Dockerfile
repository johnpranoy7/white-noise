# syntax=docker/dockerfile:1

# ---- build: compile the static site ----
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- runtime: nginx serving dist/ as a non-root user on port 8080 ----
FROM nginxinc/nginx-unprivileged:1.28-alpine

# Rendered to /etc/nginx/conf.d/default.conf at startup with envsubst.
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Who may embed the app in an <iframe> (CSP frame-ancestors). Example:
#   FRAME_ANCESTORS="'self' https://yourdomain.com"
ENV FRAME_ANCESTORS="'self'"

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
