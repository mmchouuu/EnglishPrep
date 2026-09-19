# SPA Routing & Production Deployment Guide

This document specifies the required SPA rewrite configuration for deploying the Aptis Practice App on various hosting platforms. Since React Router DOM manages client-side deep-links (e.g. `/reading/part-4?mode=topic&topic=healthy-lifestyles`), all HTTP GET requests to non-static file assets must be rewritten to serve `index.html`.

---

## 1. Netlify

Create a `public/_redirects` file (or append to existing):

```text
/*    /index.html   200
```

Alternatively, specify in `netlify.toml`:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## 2. Vercel

Create a `vercel.json` file in the project root directory:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## 3. Nginx

Inside your server block configuration for the site:

```nginx
server {
    listen 80;
    server_name aptis.yourdomain.com;
    root /var/www/aptis-practice/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 4. Apache (.htaccess)

Create a `.htaccess` file inside the web root directory (`public` or `dist`):

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

---

## 5. Vite Development Server (Built-in)

The Vite development server (`npm run dev`) automatically handles SPA history fallback for all local routes during development.
