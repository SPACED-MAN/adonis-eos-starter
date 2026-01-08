# Deployment

Deploying Adonis EOS is similar to deploying any standard Node.js application. You need a server running **Node.js >= 20.6** and a PostgreSQL database.

This guide provides the path of least resistance to getting your project running in a production environment.

## 1. Create a Production Build

The first step is to compile your TypeScript code and frontend assets (React/Inertia) into a production-ready format.

```bash
node ace build
```

The compiled output is written to the `./build` directory. **From this point forward, the `build` folder is the root of your application.** For ESM aliases to resolve correctly, you should change into the `build` directory before running commands.

## 2. Configure Environment Variables

In production, you should never use a local `.env` file committed to version control. Instead:

- **Platform-managed**: If using a cloud platform (e.g. DigitalOcean App Platform, Heroku), use their dashboard to set environment variables.
- **Server-based**: Place a secure `.env` file in a protected directory (e.g., `/etc/secrets/.env`) and point your app to it using `ENV_PATH`.

### Essential Production Variables

| Variable                     | Description                                                                                         |
| :--------------------------- | :-------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                   | Must be set to `production`.                                                                        |
| `APP_KEY`                    | Generate a fresh one with `node ace generate:key`.                                                  |
| `HOST`                       | Set to `0.0.0.0` to bind to all network interfaces.                                                 |
| `PORT`                       | The port your app will listen on (default `3333`).                                                  |
| `LOG_LEVEL`                  | Logging verbosity (e.g., `info` or `error`).                                                        |
| `SESSION_DRIVER`             | Set to `cookie` for production persistence.                                                         |
| `DB_*`                       | Your production PostgreSQL credentials.                                                             |
| `DB_SSL`                     | Set to `true` for managed databases (e.g. Neon).                                                    |
| `DB_SSL_REJECT_UNAUTHORIZED` | Set to `false` if your provider uses self-signed certs.                                             |
| `REDIS_HOST`                 | Required if using Redis for caching or sessions.                                                    |
| `REDIS_PORT`                 | Port for your Redis instance (default `6379`).                                                      |
| `REDIS_PASSWORD`             | Optional password for Redis authentication.                                                         |
| `STORAGE_DRIVER`             | Set to `r2` for Cloudflare R2 or `s3` for Amazon S3.                                                |
| `R2_ACCOUNT_ID`              | Your Cloudflare Account ID.                                                                         |
| `R2_ENDPOINT`                | The S3-compatible endpoint for R2 (e.g., `https://<id>.r2.cloudflarestorage.com`).                  |
| `R2_ACCESS_KEY_ID`           | R2 API Access Key ID.                                                                               |
| `R2_SECRET_ACCESS_KEY`       | R2 API Secret Access Key.                                                                           |
| `R2_BUCKET`                  | The name of your R2 bucket.                                                                         |
| `R2_PUBLIC_BASE_URL`         | The public URL of your R2 bucket.                                                                   |
| `SMTP_*`                     | Credentials for your email provider (for notifications).                                            |
| `CORS_ORIGINS`               | Comma-separated list of allowed origins (e.g., `https://example.com`). Required in production. |

## 3. Database & Initial Data

### Migrations

Run your migrations on the production server.

**Crucial:** Always run production commands from within the `build` folder. This ensures that ESM aliases (like `#models/*` or `#services/*`) resolve correctly to the compiled JavaScript files rather than the TypeScript source.

```bash
cd build
node ace migration:run --force
```

### Initial Data Seeding

Adonis EOS follows a convention for first-time production launches using a `production-export.json` file.

1. Ensure `database/seed_data/**/*` is included in the `metaFiles` array of your `adonisrc.ts`.
2. Place your exported site data at `database/seed_data/production-export.json`.
3. Run the production seeder from the `build` folder:

```bash
cd build
node ace db:seed --files ./database/seeders/production_import_seeder.js
```

> **Note:** The seeder includes a safety check that allows up to 10 existing users (to account for system users created on boot) but will abort if it detects existing posts or menus to prevent data loss.

## 4. Common Production Pitfalls

### ESM Alias Resolution (`ERR_MODULE_NOT_FOUND`)

If you see errors stating that a module starting with `#` cannot be found, it is almost always because the command is being run from the project root instead of the `build` folder. In production, the `package.json` inside the `build` folder contains the correct mappings for compiled code.

### Top-Level Await

If your build fails with a "Top-level await" error during SSR bundling, ensure your `vite.config.ts` has `build.target` set to `esnext`.

### Database SSL

Most managed cloud databases require SSL. If migrations fail to connect, ensure `DB_SSL=true` and `DB_SSL_REJECT_UNAUTHORIZED=false` are set.

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

#### Migrating Local Media to R2

If you have been using local storage during development and want to migrate your media to Cloudflare R2 for production:

1.  **Preparation**: Ensure you have a local copy of all files in `public/uploads`.
2.  **Configuration**: Ensure `STORAGE_DRIVER=r2` and all `R2_*` variables are set in your production environment.
3.  **Public Networking**: Managed databases usually provide both internal and public hostnames. Since you are migrating local files to a production database, you **must use the Public Hostname/Port** and ensure SSL is enabled.
4.  **Migration**: Run the migration command locally, providing your production database and R2 credentials. This will upload local files to R2 and update the production database records.

```bash
# Example: Running migration locally against a production database
DB_HOST=your-public-db-host.com \
DB_PORT=your-public-port \
DB_USER=your-user \
DB_PASSWORD=your-password \
DB_DATABASE=your-db-name \
DB_SSL=true \
DB_SSL_REJECT_UNAUTHORIZED=false \
STORAGE_DRIVER=r2 \
R2_ACCOUNT_ID=your-id \
R2_ACCESS_KEY_ID=your-key \
R2_SECRET_ACCESS_KEY=your-secret \
R2_BUCKET=your-bucket \
R2_PUBLIC_BASE_URL=https://media.yourdomain.com \
node ace migrate:media:r2 --dry-run
```

**Note:** Do not use platform-specific CLIs (like `railway run`) for this migration if they inject internal hostnames, as they will prevent your local machine from connecting to the database. Provide the public credentials directly as environment variables instead.

## 5. Health Checks

Adonis EOS includes a built-in health check endpoint for load balancers and uptime monitoring:

- **Endpoint**: `/health`
- **Response**: Returns a `200 OK` with JSON indicating status, uptime, and timestamp.

## 6. Process Management (PM2)

Use a process manager like **PM2** to keep your application running in the background and restart it if it crashes. A pre-configured `ecosystem.config.cjs` is included in the project root.

### Start your app

```bash
# Recommended: Ensure you are in the build directory for ESM resolution
cd build && pm2 start ../ecosystem.config.cjs
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
- Syncs the `build` folder, `package.json`, and `ecosystem.config.cjs` to the server.
- Runs production migrations (via `cd build && node ace ...`).
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
