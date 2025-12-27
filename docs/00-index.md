# Documentation

Complete guide to using and developing with Adonis EOS — a modern, headless CMS built with AdonisJS, React, and PostgreSQL.

## For Content Editors

Perfect for non-technical users who create and manage content:

- [For Editors](editors/00-quick-start.md) - Get started with the CMS
- [Creating & Managing Content](editors/01-content-management.md) - Posts, pages, and publishing
- [Working with Modules](editors/06-modules-guide.md) - Building pages with content blocks
- [Understanding Roles & Permissions](editors/02-roles-permissions.md) - Your access level
- [Using the Review System](editors/03-review-workflow.md) - Collaboration and approval
- [Managing Media](editors/04-media.md) - Uploading and organizing images
- [Translations](editors/05-translations.md) - Multi-language content
- [SEO & Analytics](editors/07-seo-and-ab-testing.md) - Optimizing for search, behavior tracking, and conversion
- [Providing Feedback](editors/08-feedback.md) - Collaborative review and bug tracking

## For Developers

Technical documentation for developers and system administrators:

### Getting Started

- [Installation & Setup](developers/00-getting-started.md) - Initial configuration
- [Content Management Overview](developers/01-content-management-overview.md) - Understanding the content model

### Core Concepts

- [Theming System](developers/02-theming.md) - Customizing colors and design
- [Building Modules](developers/03-building-modules.md) - Creating content components
- [SEO, Routing & Analytics](developers/06-seo-and-routing.md) - URL patterns, redirects, sitemap, SEO, and native analytics
- [Internationalization (i18n)](developers/07-internationalization.md) - Multi-language content

### Advanced Features

- [API Reference](developers/04-api-reference.md) - RESTful endpoints
- [AI Agents](developers/09-ai-agents.md) - AI-powered content enhancement
- [Automation & Integrations](developers/05-automation-and-integrations.md) - Workflows and Webhooks
- [MCP (Model Context Protocol)](developers/10-mcp.md) - Connect external AI tools (Cursor, n8n) to CMS context
- [Advanced Customization](developers/22-advanced-customization.md) - Override pages and Template tokens
- [User Interaction](developers/24-user-interaction.md) - Forms and Email configuration
- [Deployment Guide](developers/19-deployment.md) - Production deployment strategies
- [Update Philosophy](developers/20-update-philosophy.md) - How to approach upgrades and maintenance
- [CLI & Operations](developers/12-cli-and-operations.md) - Artifact scaffolding and Database pipeline
- [Architecture: Services & Actions](developers/25-services-and-actions.md) - Business logic organization
- [Global Modules](developers/23-global-modules.md) - Reusable content blocks across pages
- [Analytics](developers/21-analytics.md) - Native behavior tracking and heatmaps

## What is Adonis EOS?

Adonis EOS is a modern, headless CMS that combines:

- **AdonisJS** - Robust Node.js backend framework
- **React + Inertia.js** - Modern frontend with SSR
- **PostgreSQL** - Reliable, powerful database
- **Tailwind CSS** - Utility-first styling

## Core Features

### Modular Content System

Build pages with reusable components. Each module is self-contained and configurable.

### Role-Based Access Control

Four default roles with granular permissions:

- **Administrator** - Full system access
- **Editor Admin** - Content management + publishing
- **Editor** - Content creation (review before publish)
- **Translator** - Translation-focused access

### Multi-Language Support

Create content in multiple languages with locale-specific URLs, menus, and translations.

### Advanced Media Management

Upload images with automatic variant generation, dark mode support, and optimization.

### AI Integration

Extensible agent system for content enhancement, SEO optimization, and automated workflows.

## Quick Start

```bash
# If you haven't created a project yet (recommended):
npm init adonisjs@latest my-cms-project -- --kit=spaced-man/adonis-eos-starter
cd my-cms-project

# If you're already inside a project, ensure deps are installed:
# npm install

# Configure environment
cp .env.example .env
node ace generate:key
node ace migration:run
node ace db:seed

# Start development
npm run dev
```

Visit `/admin` and log in with `admin@example.com` / `supersecret`

## Support & Resources

- **GitHub**: [View source code](#)
- **Issues**: [Report bugs](#)
- **Documentation**: You're reading it!

---

**Version**: 1.0.0 (Pre-Beta)
**Last Updated**: December 2025
