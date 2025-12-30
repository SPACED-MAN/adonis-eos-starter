# Deployment

Deploying Adonis EOS is similar to deploying any standard Node.js application. You need a server running **Node.js >= 20.6** and a PostgreSQL database.

This guide provides the path of least resistance to getting your project running in a production environment.

## 1. Create a Production Build

The first step is to compile your TypeScript code and frontend assets (React/Inertia) into a production-ready format.

```bash
node ace build
```

The compiled output is written to the `./build` directory. **From this point forward, the `build` folder is the root of your application.**

## 2. Configure Environment Variables

In production, you should never use a local `.env` file committed to version control. Instead:

- **Platform-managed**: If using a service like DigitalOcean App Platform, Heroku, or Vercel, use their dashboard to set environment variables.
- **Server-based**: Place a secure `.env` file in a protected directory (e.g., `/etc/secrets/.env`) and point your app to it using `ENV_PATH`:

```bash
ENV_PATH=/etc/secrets/.env node build/bin/server.js
```

### Essential Production Variables

| Variable | Description |
| :--- | :--- |
| `NODE_ENV` | Must be set to `production`. |
| `APP_KEY` | Generate a fresh one with `node ace generate:key`. |
| `HOST` | Set to `0.0.0.0` to bind to all network interfaces. |
| `PORT` | The port your app will listen on (default `3333`). |
| `DB_*` | Your production PostgreSQL credentials. |
| `REDIS_HOST` | Required if using Redis for caching or sessions. |

## 3. Database Migrations

Run your migrations on the production server to set up the schema. The `--force` flag is required in production.

```bash
node ace migration:run --force
```

### ⚠️ Safety: Disable Rollbacks
Rolling back in production is dangerous. We recommend disabling it in `config/database.ts`:

```typescript
// config/database.ts
{
  pg: {
    client: 'pg',
    migrations: {
      disableRollbacksInProduction: true,
    }
  }
}
```

## 4. Persistent Storage

Since Adonis EOS handles heavy media uploads, you **must** use persistent storage. Default local storage is ephemeral on many cloud platforms (Heroku, DigitalOcean Apps).

- **Recommended**: Use **Cloudflare R2** or **Amazon S3**. Set `STORAGE_DRIVER=r2` and provide your bucket credentials.
- **Alternative**: Use a **Persistent Volume** if your host supports it (e.g., DigitalOcean Droplet + Block Storage) and set `STORAGE_LOCAL_ROOT` to that mount point.

## 5. Process Management (PM2)

Use a process manager like **PM2** to keep your application running in the background and restart it if it crashes.

### Create `ecosystem.config.js`

```javascript
module.exports = {
  apps: [{
    name: 'adonis-eos',
    script: './build/bin/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    env: {
      NODE_ENV: 'production',
    }
  }]
}
```

### Start your app
```bash
pm2 start ecosystem.config.js
```

## 6. Serving Static Assets

For the best performance, offload the task of serving static assets (images, CSS, JS) to a **Reverse Proxy** (Nginx) or a **CDN**.

### Nginx Example
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3333;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Serve static assets directly via Nginx
    location ~ \.(jpg|png|css|js|gif|ico|woff|woff2) {
        root /var/www/adonis-eos/build/public;
        add_header Cache-Control "public, max-age=31536000";
    }
}
```

---

**Related:** [Installation](./01-installation.md) | [Update Philosophy](./04-update-philosophy.md)
