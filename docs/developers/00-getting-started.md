# Getting Started with Adonis EOS

Welcome to **Adonis EOS**, a modern headless CMS built with AdonisJS and React.

## What is Adonis EOS?

Adonis EOS is a full-featured content management system designed for developers who need flexibility, performance, and modern tooling. It combines the power of AdonisJS on the backend with React/Inertia.js on the frontend.

## Key Features

- **Modular Content System**: Build pages with reusable, customizable modules
- **Multi-language Support**: Full internationalization with locale-specific content
- **Role-Based Access Control**: Granular permissions for different user roles
- **Media Management**: Advanced image handling with variants and dark mode support
- **Post Types**: Flexible content types (pages, blog posts, profiles, companies)
- **AI Integration**: Extensible AI agent system for content enhancement
- **Form Builder**: Create custom forms with submissions tracking
- **Menu Management**: Dynamic navigation menus with nested items
- **Preview System**: Secure draft sharing with token-based previews
- **Webhooks**: Automated notifications for content changes

## Prerequisites

Before working with Adonis EOS, you should have a solid understanding of:

### MVC Architecture

Adonis EOS follows the Model-View-Controller (MVC) pattern. Familiarity with MVC concepts will help you understand how the application is structured:

- **Models**: Represent your database tables and handle data logic
- **Views**: Handle the presentation layer (React components via Inertia.js)
- **Controllers**: Process requests and coordinate between models and views

### AdonisJS Fundamentals

Adonis EOS is built on **AdonisJS 6**. We recommend reviewing the following topics in the [AdonisJS documentation](https://docs.adonisjs.com):

- Routing and Controllers
- Lucid ORM (database queries and models)
- Validation
- Middleware and Guards
- Inertia.js integration

### Frontend Technologies

- **React**: For building UI components
- **Inertia.js**: For bridging the backend and frontend
- **TypeScript**: For type safety
- **Tailwind CSS**: For styling

## System Requirements

- Node.js 18+ (recommended: latest LTS)
- PostgreSQL 14+ (or MySQL 8+)
- npm or yarn package manager

## Installation

```bash
# Recommended: create a new project from the Adonis EOS starter kit
npm init adonisjs@latest my-cms-project -- --kit=spaced-man/adonis-eos-starter
cd my-cms-project

# If you cloned instead of using the starter kit, install deps:
# npm install

# Configure environment
cp .env.example .env

# Generate APP_KEY (required)
node ace generate:key

# Run migrations
node ace migration:run

# Seed initial data
node ace db:seed

# Start development server
npm run dev
```

## Default Accounts

After seeding, you'll have these accounts:

- **Admin**: `admin@example.com` / `supersecret`
- **Editor Admin**: `editoradmin@example.com` / `supersecret`
- **Editor**: `editor@example.com` / `supersecret`
- **Translator**: `translator@example.com` / `supersecret`

## Project Structure

```
adonis-eos/
├── app/                    # Backend application code
│   ├── actions/            # Business actions (CreatePost, UpdatePostModule, translations, etc.)
│   ├── agents/             # AI agent definitions (webhook + internal)
│   ├── controllers/        # Route handlers (admin + public)
│   ├── dtos/               # Typed payload/response objects (e.g. agent payload)
│   ├── fields/             # Custom field types (admin rendering + validation)
│   ├── forms/              # Code-first form definitions (seed + admin)
│   ├── helpers/            # Shared helpers (i18n, lexical rendering, reference resolution)
│   ├── mcp/                # Project-specific MCP configuration (layout roles, seed mapping)
│   ├── menus/              # Code-first menu definitions (seed + admin)
│   ├── middleware/         # HTTP middleware (auth, locale, rate limit, redirects, etc.)
│   ├── models/             # Lucid models (posts, modules, media, taxonomies, etc.)
│   ├── modules/            # CMS module definitions (schema/defaults/rendering mode)
│   ├── post_types/         # Code-first post type definitions (page, blog, docs, etc.)
│   ├── roles/              # RBAC role definitions
│   ├── services/           # Core services (registries, serializers, preview, revisions, etc.)
│   ├── site/               # Site-wide config + site-level custom fields
│   ├── taxonomies/         # Code-first taxonomy definitions
│   ├── types/              # Shared TypeScript types
│   └── validators/         # Request validators
├── inertia/               # Frontend React code
│   ├── pages/             # Page components
│   ├── components/        # Reusable components
│   └── modules/           # Frontend module components
├── database/
│   ├── migrations/        # Database schema
│   └── seeders/          # Seed data
├── docs/                  # Documentation
├── start/                 # App boot files (auto-register post types/modules/agents/roles/etc.)
├── commands/              # Ace commands (including MCP + dump context)
└── public/               # Static assets
```

## Next Steps

- [Content Management Overview](01-content-management-overview.md) - Understanding the content model
- [Theming](02-theming.md) - Customize the design system
- [Building Modules](03-building-modules.md) - Create custom content modules
- [API Reference](04-api-reference.md) - Learn about available endpoints
- [MCP (Model Context Protocol)](10-mcp.md) - Connect external AI tools (Cursor, n8n) to CMS context + safe write tools
- [Content Management](../editors/01-content-management.md) - Managing posts and pages
- [CLI Commands](21-cli-commands.md) - Scaffold post types, modules, roles, menus, taxonomies
- [Email Configuration](25-email-configuration.md) - Setup SMTP/Resend for password resets and notifications
