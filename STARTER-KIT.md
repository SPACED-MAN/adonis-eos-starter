# Adonis EOS Starter Kit Guide

This guide will help you get started with the Adonis EOS CMS starter kit, a turnkey solution for building modern, SEO-first content management systems.

## What's Included

This starter kit provides a complete, production-ready CMS with:

- ✅ **Modular Content System** - Drag-and-drop page building with reusable modules
- ✅ **Role-Based Access Control** - 4 default roles with 60+ granular permissions
- ✅ **Multi-Language Support** - Full i18n with locale-specific URLs and content
- ✅ **Review Workflow** - Three-tier system (Source → AI Review → Review → Published)
- ✅ **AI Agent System** - Extensible framework for content enhancement and automation
- ✅ **Advanced Media Management** - Image optimization, variants, and dark mode support
- ✅ **Forms & Submissions** - Code-first form definitions with webhook integration
- ✅ **Webhooks** - Event-driven integrations for post lifecycle events
- ✅ **SEO Optimization** - SSR, structured data, canonical URLs, hreflang tags
- ✅ **Performance** - Redis caching, connection pooling, strategic database indexes
- ✅ **19+ Built-in Modules** - Hero, Prose, Gallery, Testimonials, and more

## Installation

### Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 12+ (running and accessible)
- **Redis** 6+ (for caching and rate limiting)

### Step 1: Create New Project

```bash
npm init adonisjs@latest my-cms-project -- --kit=spaced-man/adonis-eos-starter
cd my-cms-project
```

### Step 2: Install Dependencies

Dependencies are automatically installed, but if needed:

```bash
npm install
```

### Step 3: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Generate a secure APP_KEY
node ace generate:key
```

### Step 4: Configure Database & Redis

Edit `.env` and set your database and Redis credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_DATABASE=adonis_eos

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### Step 5: Run Migrations & Seed Data

```bash
# Create all database tables
node ace migration:run

# Seed default users and example content
node ace db:seed
```

This creates:
- 4 default user accounts (admin, editor_admin, editor, translator)
- 1 AI agent user (for MCP operations)
- Example post types, modules, and content

### Step 6: Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3333/admin` and log in with:
- **Email:** `admin@example.com`
- **Password:** `supersecret`

> **⚠️ Important:** Change these default passwords immediately!

## Default User Accounts

After seeding, you'll have these accounts:

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| Administrator | `admin@example.com` | `supersecret` | Full system access |
| Editor Admin | `editoradmin@example.com` | `supersecret` | Content management + publishing |
| Editor | `editor@example.com` | `supersecret` | Content creation (requires review) |
| Translator | `translator@example.com` | `supersecret` | Translation-focused access |
| AI Agent | `ai@example.com` | `supersecret` | System operations (MCP) |

## Project Structure

```
my-cms-project/
├── app/
│   ├── controllers/      # API route handlers
│   ├── models/          # Database models
│   ├── services/        # Business logic
│   ├── modules/         # CMS module definitions (19+ modules)
│   ├── roles/           # RBAC role definitions
│   ├── agents/          # AI agent definitions
│   └── post_types/      # Post type configurations
├── inertia/
│   ├── admin/           # Admin panel (React + Inertia)
│   ├── site/            # Public site (React + Inertia)
│   ├── modules/         # Shared module renderers
│   └── components/      # Shared React components
├── database/
│   ├── migrations/      # Database schema (30+ migrations)
│   └── seeders/         # Seed data
├── config/              # Configuration files
└── start/               # Application bootstrap
```

## Customization Guide

### Creating Custom Modules

```bash
node ace make:module my-module
```

This creates:
- Module definition in `app/modules/my_module.ts`
- Admin editor in `inertia/modules/my-module/Editor.tsx`
- Site renderer in `inertia/modules/my-module/Renderer.tsx`

### Creating Custom Post Types

```bash
node ace make:post-type product
```

This creates a post type configuration in `app/post_types/product.ts`.

### Creating AI Agents

```bash
node ace make:agent my-agent
```

This creates an agent definition in `app/agents/my_agent.ts`.

### Customizing Themes

Edit `config/cms.ts` to customize:
- Admin theme colors
- Site theme colors
- Dark/light mode settings

### Adding Custom Fields

Custom fields are defined in `app/fields/`. See existing field types for examples:
- `app/fields/text.ts`
- `app/fields/media.ts`
- `app/fields/richtext.ts`

## Environment Variables

### Required Variables

```env
APP_KEY=                    # Generated with: node ace generate:key
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_DATABASE=adonis_eos
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Optional CMS Configuration

See `.env.example` for all available options, including:
- Revision history limits
- Media upload settings
- Cache TTLs
- Rate limiting
- Webhook configuration
- Scheduler intervals

## Common Workflows

### Creating a New Page

1. Go to `/admin/posts`
2. Click "Create New Post"
3. Select post type (e.g., "Page")
4. Enter title and slug
5. Add modules using the drag-and-drop interface
6. Configure each module's properties
7. Save as draft or publish

### Setting Up Multi-Language Content

1. Configure locales in `.env`:
   ```env
   DEFAULT_LOCALE=en
   SUPPORTED_LOCALES=en,es,fr
   ```

2. Create a post in the default locale
3. Click "Create Translation" to add translations
4. URLs automatically include locale prefix (e.g., `/es/blog/post-slug`)

### Using Module Groups (Templates)

1. Go to `/admin/module-groups`
2. Create a new module group for a post type
3. Add modules with default props
4. When creating a post, select the module group to auto-populate modules

### Setting Up Webhooks

1. Enable webhooks in `.env`:
   ```env
   CMS_WEBHOOKS_ENABLED=true
   CMS_WEBHOOK_SECRET=your-secret-key
   ```

2. Configure webhook endpoints in the admin panel
3. Webhooks fire on: post publish, post update, media upload, form submission

## Production Deployment

### Build for Production

```bash
# Run migrations (force in production)
node ace migration:run --force

# Build frontend assets
npm run build

# Start production server
node ace serve --watch
```

### Environment Setup

1. Set `NODE_ENV=production`
2. Use strong `APP_KEY` (generate with `node ace generate:key`)
3. Configure production database and Redis
4. Set up proper file storage (consider S3 for media)
5. Configure CDN for static assets
6. Set up SSL/TLS certificates
7. Configure proper rate limits

### Security Checklist

- [ ] Change all default passwords
- [ ] Use strong `APP_KEY`
- [ ] Set `CMS_WEBHOOK_SECRET` for webhook signing
- [ ] Configure proper CORS settings
- [ ] Set up rate limiting appropriate for your traffic
- [ ] Enable HTTPS
- [ ] Review and restrict file upload types
- [ ] Configure proper database user permissions
- [ ] Set up regular backups

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
node ace db:query "SELECT 1"

# Check migration status
node ace migration:status
```

### Redis Connection Issues

```bash
# Test Redis connection
redis-cli ping
```

### Module Not Rendering

1. Check browser console for errors
2. Verify module is registered in `start/modules.ts`
3. Check module schema in `app/modules/[module-name].ts`
4. Verify renderer exists in `inertia/modules/[module-name]/Renderer.tsx`

### Permission Errors

1. Verify user role in database
2. Check role permissions in `app/roles/`
3. Review Bouncer policies in `app/policies/`

## Getting Help

- **Documentation:** See `/docs` directory for detailed guides
- **Issues:** Report bugs on GitHub
- **Community:** Join AdonisJS Discord for support

## Next Steps

1. **Customize Branding:** Update site name, logo, and colors
2. **Create Content:** Add your first pages and posts
3. **Configure SEO:** Set up meta tags, sitemaps, and structured data
4. **Set Up Webhooks:** Connect to external services (n8n, Zapier, etc.)
5. **Customize Modules:** Create modules specific to your needs
6. **Deploy:** Follow production deployment guide

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.

