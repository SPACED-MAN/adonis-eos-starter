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
| `REDIS_PORT` | Port for your Redis instance (default `6379`). |
| `REDIS_PASSWORD` | Optional password for Redis authentication. |
| `STORAGE_DRIVER` | Set to `r2` for Cloudflare R2 or `s3` for Amazon S3. |
| `R2_ACCOUNT_ID` | Your Cloudflare Account ID. |
| `R2_ENDPOINT` | The S3-compatible endpoint for R2 (e.g., `https://<id>.r2.cloudflarestorage.com`). |
| `R2_ACCESS_KEY_ID` | R2 API Access Key ID. |
| `R2_SECRET_ACCESS_KEY` | R2 API Secret Access Key. |
| `R2_BUCKET` | The name of your R2 bucket. |
| `R2_PUBLIC_BASE_URL` | The public URL of your R2 bucket. |
| `SMTP_*` | Credentials for your email provider (for notifications). |

## 3. Database & Initial Data

### Migrations
Run your migrations on the production server to set up the schema. The `--force` flag is required in production.

```bash
node ace migration:run --force
```

### Initial Data Seeding
Adonis EOS follows a convention for first-time production launches using a `production-export.json` file. This is useful for seeding initial site settings, default roles, and basic pages.

1. Place your exported site data at `database/seed_data/production-export.json`.
2. Run the production seeder:

```bash
node ace db:seed --files production_import_seeder
```

> **Note:** The production seeder will automatically abort if it detects existing data in key tables (users, posts, etc.) to prevent accidental data loss.

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

## 4. Services

### Redis
Redis is strongly recommended for production environments. It is used for:
- **Server-Side Rendering (SSR) Caching**: Drastically improves performance by caching rendered pages.
- **Session Management**: Shared sessions across multiple application instances.
- **Rate Limiting**: Accurate tracking of request rates.

Ensure `REDIS_CACHE_ENABLED=true` is set in your environment variables to enable the caching layer.

### Persistent Storage
Since Adonis EOS handles heavy media uploads, you **must** use persistent storage. Default local storage is ephemeral on many cloud platforms.

- **Recommended**: Use **Cloudflare R2** (or S3-compatible). Set `STORAGE_DRIVER=r2` and provide your bucket credentials.
- **Local Alternative**: Use a **Persistent Volume** if your host supports it and set `STORAGE_LOCAL_ROOT` to that mount point.

## 5. Health Checks

Adonis EOS includes a built-in health check endpoint for load balancers and uptime monitoring:

- **Endpoint**: `/health`
- **Response**: Returns a `200 OK` with JSON indicating status, uptime, and timestamp.

## 6. Process Management (PM2)

Use a process manager like **PM2** to keep your application running in the background and restart it if it crashes. A pre-configured `ecosystem.config.js` is included in the project root.

### Start your app
```bash
pm2 start ecosystem.config.js
```

## 7. Automated Deployment (GitHub Actions)

Adonis EOS includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) for automated deployments to a VPS (like Hetzner, DigitalOcean, or Linode) upon pushing to the `main` branch.

### Prerequisites
1. **GitHub Secrets**: Add the following secrets to your repository:
   - `HOST`: Your server's IP address.
   - `USERNAME`: Your SSH username (e.g., `root`).
   - `SSH_PRIVATE_KEY`: Your private SSH key.
2. **Environment File**: Ensure a `.env` file exists on the server at `/var/www/adonis-eos/.env` (or your configured path).

### Workflow Overview
The workflow performs the following steps:
- Checks out the code.
- Installs dependencies and runs the build.
- Syncs the `build` folder, `package.json`, and `ecosystem.config.js` to the server.
- Runs production migrations.
- Restarts the application via PM2.

## 8. Serving Static Assets

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
