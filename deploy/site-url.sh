#!/bin/sh
# Runs at container start (nginx's /docker-entrypoint.d). Fills the site's public
# address into the SEO tags and writes robots.txt and sitemap.xml from SITE_URL,
# e.g. SITE_URL=https://whitenoise.example.com
set -eu

html=/usr/share/nginx/html
url="${SITE_URL:-}"
url="${url%/}"

if [ -n "$url" ]; then
  sed -i "s|__SITE_URL__|$url|g" "$html/index.html"
  printf 'User-agent: *\nAllow: /\nDisallow: /lab/\n\nSitemap: %s/sitemap.xml\n' "$url" > "$html/robots.txt"
  cat > "$html/sitemap.xml" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>$url/</loc>
    <changefreq>monthly</changefreq>
  </url>
</urlset>
EOF
  echo "site-url: using $url"
else
  # Without a public address, drop the tags that need an absolute URL.
  sed -i '/__SITE_URL__/d' "$html/index.html"
  printf 'User-agent: *\nAllow: /\nDisallow: /lab/\n' > "$html/robots.txt"
  rm -f "$html/sitemap.xml"
  echo "site-url: SITE_URL not set; canonical, Open Graph URL and sitemap left out"
fi
