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

### Required Environment Variables

```env
# Application
NODE_ENV=production
PORT=3333
HOST=0.0.0.0
APP_KEY=<generate with: node ace generate:key>
APP_NAME=Adonis EOS

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_user
DB_PASSWORD=your_secure_password
DB_DATABASE=adonis_eos

# Session
SESSION_DRIVER=cookie

# Redis (recommended for production)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Cache
CACHE_DRIVER=redis  # or 'database' if Redis not available

# Security
CSRF_ENABLED=true

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_STORE=redis  # or 'memory'
```

### Generate Secure Keys

```bash
# Generate APP_KEY
node ace generate:key

# Generate webhook secret
openssl rand -hex 32
```

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

1) Copy your curated export to `database/seed_data/production-export.json` in your deploy artifact.
2) Ensure the DB is empty and migrations are applied.
3) Run:

```bash
NODE_ENV=production node ace db:seed --files database/seeders/production_import_seeder --force
```

4) Verify admin access and content in the UI.

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
  apps: [{
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
  }],
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

**Related:** [Getting Started](/docs/for-developers) | [Configuration](/docs/for-developers/configuration)

