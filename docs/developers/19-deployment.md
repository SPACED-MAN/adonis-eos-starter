# Deployment Guide

Complete guide to deploying Adonis EOS to production environments.

## Pre-Deployment Checklist

Before deploying to production:

- [ ] Configure all environment variables
- [ ] Set up PostgreSQL database
- [ ] Configure Redis (optional but recommended)
- [ ] Set secure `APP_KEY`
- [ ] Configure domain and SSL/TLS
- [ ] Set up process manager (PM2, systemd)
- [ ] Configure reverse proxy (Nginx, Caddy)
- [ ] Set up monitoring and logging
- [ ] Configure backups

## Environment Configuration

### Environment File Convention

**Development:**

- Use `.env` file in the project root
- This file is git-ignored and contains your local development settings
- Never commit `.env` to version control

**Production:**

- Set environment variables through your hosting platform's configuration (e.g., DigitalOcean App Platform, Heroku config vars, AWS Parameter Store)
- Or use a `.env` file on the server (ensure it's not in the repository and has proper file permissions)
- Platform-specific: Many platforms (Heroku, Railway, etc.) prefer environment variables set through their UI/CLI

**Best Practice:**

- Keep a `.env.example` file (committed to git) as a template with all available variables and documentation
- Each developer clones the repo, copies `.env.example` to `.env`, and fills in their local values
- Production environments should set variables through their platform's secure configuration system

**Note:** A complete `.env.example` template file is maintained in the repository root. Copy it to `.env` and fill in your values.

### Required Environment Variables

These variables **must** be set for the application to run:

```env
# Core Application
NODE_ENV=production                    # 'development', 'production', or 'test'
PORT=3333                              # Port the server listens on
HOST=0.0.0.0                          # Host to bind to (use 0.0.0.0 for production)
APP_KEY=<generate with: node ace generate:key>  # Encryption key (REQUIRED - see below)
LOG_LEVEL=info                        # Logging level: 'trace', 'debug', 'info', 'warn', 'error', 'fatal'

# Database (PostgreSQL)
DB_HOST=localhost                     # Database host
DB_PORT=5432                          # Database port
DB_USER=your_user                     # Database username
DB_PASSWORD=your_secure_password      # Database password (optional but recommended)
DB_DATABASE=adonis_eos                # Database name

# Session
SESSION_DRIVER=cookie                  # 'cookie' or 'memory' (use 'cookie' for production)

# Redis (recommended for production caching and sessions)
REDIS_HOST=localhost                  # Redis host
REDIS_PORT=6379                       # Redis port
REDIS_PASSWORD=                       # Redis password (optional)
```

### Optional Environment Variables

These have sensible defaults but can be customized:

```env
# Application Metadata
APP_NAME=Adonis EOS                   # Application name (used in logs)
TZ=UTC                                # Timezone (defaults to UTC)

# Admin Path Configuration
ADMIN_PATH_PREFIX=admin               # Admin URL prefix (default: 'admin'). Change to obfuscate admin routes (e.g., 'blah' makes /admin/* become /blah/*)

# Database Pool Configuration
DB_POOL_MIN=2                         # Minimum pool connections (default: 2)
DB_POOL_MAX=10                        # Maximum pool connections (default: 10)
DB_DEBUG=false                        # Enable SQL query debugging (default: false)

# Database TLS (recommended for production)
DB_SSL=true                           # Enable TLS for Postgres connections (default: false)
DB_SSL_REJECT_UNAUTHORIZED=true       # Verify server certificate (default: true)
DB_SSL_CA=                            # Optional CA bundle contents (PEM string)
DB_SSL_ALLOW_INSECURE=false           # Escape hatch: allow non-TLS DB in production (NOT recommended)

# Internationalization (i18n)
DEFAULT_LOCALE=en                     # Default locale code (default: 'en')
SUPPORTED_LOCALES=en,es,fr            # Comma-separated list of supported locales (default: 'en')

# CMS Configuration
CMS_REVISIONS_LIMIT=20                # Maximum revisions to keep per post (0 = unlimited, default: 20)
CMS_REVISIONS_AUTO_PRUNE=true         # Auto-delete old revisions on save (default: true)
CMS_PREVIEW_EXPIRATION_HOURS=24       # Preview link expiration in hours (default: 24)
CMS_PREVIEW_SECRET=                   # Preview token secret (defaults to APP_KEY)
CMS_WEBHOOK_SECRET=                  # Webhook signing secret (recommended if webhooks enabled)
CMS_WEBHOOK_ALLOWED_HOSTS=           # Optional: comma-separated hostname allowlist for outbound webhooks
CORS_ORIGINS=                        # REQUIRED in production (comma-separated) when CORS is enabled
CMS_SOFT_DELETE_ENABLED=true          # Enable soft deletes for posts (default: true)
CMS_SOFT_DELETE_RETENTION_DAYS=30     # Days to retain soft-deleted posts (default: 30)

# Media Configuration
MEDIA_UPLOAD_DIR=uploads              # Upload directory relative to public/ (default: 'uploads')
MEDIA_MAX_FILE_SIZE=10485760          # Max file size in bytes (default: 10MB)
MEDIA_ALLOWED_TYPES=image/jpeg,image/png,image/gif,image/webp,image/avif,application/pdf
MEDIA_DERIVATIVES=thumb:200x200_crop,small:400x,medium:800x,large:1600x
MEDIA_ADMIN_THUMBNAIL_VARIANT=thumb   # Variant name for admin thumbnails
MEDIA_ADMIN_MODAL_VARIANT=large       # Variant name for admin modal preview
MEDIA_WEBP_QUALITY=82                 # WebP quality (1-100, default: 82)
MEDIA_DARK_BRIGHTNESS=0.6             # Dark mode image brightness (0.1-2.0, default: 0.6)
MEDIA_DARK_SATURATION=0.75            # Dark mode image saturation (0-2.0, default: 0.75)

# Storage Configuration
STORAGE_DRIVER=local                  # 'local' or 'r2' (default: 'local')
# Cloudflare R2 (required when STORAGE_DRIVER=r2)
R2_ACCOUNT_ID=                        # Cloudflare R2 account ID
R2_ENDPOINT=                          # R2 endpoint URL (auto-generated if account ID provided)
R2_BUCKET=                            # R2 bucket name
R2_ACCESS_KEY_ID=                     # R2 access key ID
R2_SECRET_ACCESS_KEY=                 # R2 secret access key
R2_PUBLIC_BASE_URL=                   # Optional CDN/custom domain base URL for R2 assets

# Cache Configuration
CMS_SSR_CACHE_TTL=3600                # SSR cache TTL in seconds (default: 3600)
CMS_PUBLIC_MAX_AGE=60                 # Public cache max-age in seconds (default: 60)
CMS_CDN_MAX_AGE=3600                  # CDN cache max-age in seconds (default: 3600)
CMS_SWR=604800                        # Stale-while-revalidate duration in seconds (default: 604800)

# Rate Limiting
CMS_RATE_LIMIT_REQUESTS=100           # Default requests per window (default: 100)
CMS_RATE_LIMIT_WINDOW=60              # Default window duration in seconds (default: 60)
CMS_RATE_LIMIT_AUTH_REQUESTS=5        # Auth endpoint requests per window (default: 5)
CMS_RATE_LIMIT_AUTH_WINDOW=60         # Auth endpoint window duration (default: 60)
CMS_RATE_LIMIT_API_REQUESTS=120       # API endpoint requests per window (default: 120)
CMS_RATE_LIMIT_API_WINDOW=60          # API endpoint window duration (default: 60)

# Webhooks
CMS_WEBHOOKS_ENABLED=false            # Enable webhook dispatching (default: false)
CMS_WEBHOOK_TIMEOUT=5000              # Webhook timeout in milliseconds (default: 5000)
CMS_WEBHOOK_MAX_RETRIES=3             # Maximum retry attempts (default: 3)
CMS_WEBHOOK_SECRET=                   # Secret for signing webhook payloads

# Scheduler
CMS_SCHEDULER_DEV_INTERVAL=30         # Scheduler check interval in seconds (dev, default: 30)
CMS_SCHEDULER_PROD_INTERVAL=60        # Scheduler check interval in seconds (prod, default: 60)
SCHEDULER_DISABLED=0                  # Set to '1' to disable scheduler (default: 0)

# Protected Content Access
# Used as fallback when site settings fields are not configured
PROTECTED_ACCESS_USERNAME=            # Default username for password-protected posts
PROTECTED_ACCESS_PASSWORD=            # Default password for password-protected posts

# MCP (Model Context Protocol)
MCP_SYSTEM_USER_ID=                   # User ID for MCP system operations (should match ai@example.com user)
```

**Note on Variable Access:**
Most variables are accessed through AdonisJS's `env` service (defined in `start/env.ts`), which provides validation and type safety. Some variables (like `STORAGE_DRIVER`, `R2_*`, `MEDIA_WEBP_QUALITY`, `MEDIA_DARK_*`, `PROTECTED_ACCESS_*`, `SCHEDULER_DISABLED`, `MCP_SYSTEM_USER_ID`) are currently accessed directly via `process.env`. This is fine for optional variables with defaults, but for consistency, consider migrating them to the `env` service in the future.

### Generate Secure Keys

```bash
# Generate APP_KEY (REQUIRED)
node ace generate:key

# Generate webhook secret (if using webhooks)
openssl rand -hex 32

# Generate preview secret (optional, defaults to APP_KEY)
openssl rand -hex 32
```

### Environment File Location

The `.env` file should be placed in the **project root directory** (same level as `package.json`, `adonisrc.ts`, etc.).

**Development:**

```bash
# In your project root
/path/to/adonis-eos/.env
```

**Production:**

- Platform-managed: Set variables through your hosting platform's environment variable configuration (recommended)
- Server-based: Place `.env` in the project root on your server
- Ensure the file has restrictive permissions: `chmod 600 .env`

**Important Security Notes:**

- Never commit `.env` to version control (it's in `.gitignore`)
- Use `.env.example` as a template for documentation
- In production, prefer platform environment variables over `.env` files when possible
- Rotate secrets regularly, especially `APP_KEY` and password hashes

## Database Setup

### Run Migrations

```bash
# Production migration (requires confirmation)
node ace migration:run --force
```

### Seed Initial Data

```bash
# Seed users, roles, and initial content
node ace db:seed --force
```

**Important:** Change the default admin password immediately after first login!

## Launch (initial production content)

Production seeding uses the same JSON import pipeline as the admin UI.

### Before you launch

- **Export curated content**: create `database/seed_data/production-export.json` from your staging or prep environment (Admin → Database Export, include IDs).
- **Safety**: the production import seeder should only run on a **fresh/empty** database to avoid clobbering live data.
- **Run migrations**: `node ace migration:run --force` on the target environment.

### Seed production with the curated export

Use the production import seeder (see `database/seeders/production_import_seeder.ts`):

1. Copy your curated export to `database/seed_data/production-export.json` in your deploy artifact.
2. Ensure the DB is empty and migrations are applied.
3. Run:

```bash
NODE_ENV=production node ace db:seed --files database/seeders/production_import_seeder --force
```

4. Verify admin access and content in the UI.

### Updating launch content close to go-live

- Re-export from staging, replace `production-export.json`, and re-run the seeder on a fresh database.
- If the database is not empty, the seeder will stop; drop/recreate (or truncate) before re-running.

### Development parity

- Development imports `database/seed_data/development-export.json` when `NODE_ENV=development` / `APP_ENV=development`.

## Build for Production

### 1. Install Dependencies

```bash
npm ci --omit=dev
```

### 2. Build Frontend Assets

```bash
npm run build
```

This compiles:

- React components (admin + site)
- Tailwind CSS
- TypeScript

Output is written to `build/` directory.

### 3. Verify Build

```bash
# Check build output
ls -la build/
```

## Process Management

### Option 1: PM2 (Recommended)

#### Install PM2

```bash
npm install -g pm2
```

#### Create Ecosystem File

Create `ecosystem.config.cjs`:

```javascript
module.exports = {
  apps: [
    {
      name: 'adonis-eos',
      script: './build/bin/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3333,
      },
    },
  ],
}
```

#### Start Application

```bash
# Start
pm2 start ecosystem.config.cjs

# Save process list
pm2 save

# Setup startup script
pm2 startup
```

#### Monitoring

```bash
# View logs
pm2 logs adonis-eos

# Monitor
pm2 monit

# Restart
pm2 restart adonis-eos

# Stop
pm2 stop adonis-eos
```

### Option 2: systemd

#### Create Service File

`/etc/systemd/system/adonis-eos.service`:

```ini
[Unit]
Description=Adonis EOS
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/adonis-eos
Environment=NODE_ENV=production
ExecStart=/usr/bin/node build/bin/server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable adonis-eos

# Start service
sudo systemctl start adonis-eos

# Check status
sudo systemctl status adonis-eos

# View logs
sudo journalctl -u adonis-eos -f
```

## Reverse Proxy

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:3333;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Static assets
    location /assets/ {
        alias /var/www/adonis-eos/public/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    client_max_body_size 50M;
}
```

### Caddy Configuration

```
yourdomain.com {
    reverse_proxy localhost:3333 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    encode gzip

    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "no-referrer-when-downgrade"
    }

    file_server /assets/* {
        root /var/www/adonis-eos/public
    }
}
```

## Platform-Specific Deployment

### DigitalOcean App Platform

1. Connect your repository
2. Configure build command: `npm run build`
3. Configure run command: `node build/bin/server.js`
4. Add PostgreSQL database
5. Add Redis (optional)
6. Configure environment variables
7. Deploy!

### Heroku

```bash
# Add buildpack
heroku buildpacks:add heroku/nodejs

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Add Redis
heroku addons:create heroku-redis:mini

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set APP_KEY=$(openssl rand -hex 32)

# Deploy
git push heroku main

# Run migrations
heroku run node ace migration:run --force

# Seed database
heroku run node ace db:seed --force
```

### AWS (EC2)

1. Launch EC2 instance (Ubuntu 22.04 LTS recommended)
2. Install Node.js 20+
3. Install PostgreSQL and Redis
4. Clone repository
5. Configure environment
6. Set up systemd or PM2
7. Configure Nginx reverse proxy
8. Set up SSL with Let's Encrypt
9. Configure backups and monitoring

### Docker

Coming soon - Docker and Docker Compose configurations.

## Database Backups

### PostgreSQL Backup

```bash
# Create backup
pg_dump -U username -d adonis_eos -F c -f backup_$(date +%Y%m%d_%H%M%S).dump

# Restore backup
pg_restore -U username -d adonis_eos -c backup_20250101_120000.dump
```

### Automated Backups

```bash
# Add to crontab
0 2 * * * /path/to/backup_script.sh
```

Example backup script:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/adonis-eos"
mkdir -p $BACKUP_DIR

# Database backup
pg_dump -U dbuser -d adonis_eos -F c -f $BACKUP_DIR/db_$DATE.dump

# Media files backup
tar -czf $BACKUP_DIR/media_$DATE.tar.gz /var/www/adonis-eos/public/uploads

# Keep only last 30 days
find $BACKUP_DIR -name "*.dump" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

## Monitoring & Logging

### Application Logs

```bash
# PM2 logs
pm2 logs adonis-eos

# systemd logs
journalctl -u adonis-eos -f
```

### Health Checks

Add health check endpoint for monitoring:

```bash
# Check application health
curl https://yourdomain.com/health
```

### Monitoring Tools

Recommended monitoring solutions:

- **PM2 Plus** - Application monitoring
- **Sentry** - Error tracking
- **New Relic** - Performance monitoring
- **Datadog** - Infrastructure monitoring
- **LogRocket** - Session replay and debugging

## Security Hardening

### Firewall Configuration

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### SSL/TLS with Let's Encrypt

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Database Security

- Use strong passwords
- Limit database access to localhost
- Enable SSL connections
- Regular security updates

## Troubleshooting

### Application Won't Start

```bash
# Check logs
pm2 logs adonis-eos

# Check environment
node ace env:check

# Verify database connection
psql -U username -d adonis_eos -c "SELECT 1"
```

### Performance Issues

- Enable Redis caching
- Check database query performance
- Review server resources (CPU, RAM)
- Enable HTTP/2
- Optimize images and assets

### Memory Leaks

```bash
# Monitor memory
pm2 monit

# Set max memory restart
pm2 restart adonis-eos --max-memory-restart 1G
```

## Scaling Considerations

### Horizontal Scaling

- Use PM2 cluster mode
- Load balance with Nginx
- Shared Redis for sessions
- Centralized media storage (S3, etc.)

### Database Optimization

- Connection pooling (configured in `config/database.ts`)
- Read replicas for heavy traffic
- Regular VACUUM and ANALYZE

### CDN for Assets

Configure CDN for `/assets` and `/uploads`:

- CloudFlare
- AWS CloudFront
- DigitalOcean Spaces CDN

## Post-Deployment

After deployment:

1. ✅ Verify all pages load
2. ✅ Test admin login
3. ✅ Create test post
4. ✅ Upload test media
5. ✅ Check email delivery (if configured)
6. ✅ Verify webhooks (if configured)
7. ✅ Change default admin password
8. ✅ Remove test accounts
9. ✅ Configure monitoring alerts
10. ✅ Document deployment procedure

---

**Related:** [Getting Started](00-getting-started.md)
