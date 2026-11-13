# syntax=docker/dockerfile:1

# ---- build: compile the static site ----
FROM --platform=$BUILDPLATFORM node:25-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- runtime: nginx serving dist/ as a non-root user on port 8080 ----
FROM nginxinc/nginx-unprivileged:1.28-alpine

# Rendered to /etc/nginx/conf.d/default.conf at startup with envsubst.
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
# Fills SITE_URL into the SEO tags and writes robots.txt / sitemap.xml at startup.
COPY --chmod=755 deploy/site-url.sh /docker-entrypoint.d/40-site-url.sh

# The site files belong to the nginx user so the startup script can fill them in.
COPY --from=build --chown=101:0 /app/dist /usr/share/nginx/html
USER root
RUN chown 101:0 /usr/share/nginx/html
USER 101

# Who may embed the app in an <iframe> (CSP frame-ancestors). Example:
#   FRAME_ANCESTORS="'self' https://yourdomain.com"
ENV FRAME_ANCESTORS="'self'"
# The public address, used for the canonical link, social cards and sitemap. Example:
#   SITE_URL="https://whitenoise.example.com"
ENV SITE_URL=""

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
