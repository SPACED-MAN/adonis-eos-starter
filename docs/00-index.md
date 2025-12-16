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

## For Developers

Technical documentation for developers and system administrators:

### Getting Started

- [Installation & Setup](developers/00-getting-started.md) - Initial configuration
- [Content Management Overview](developers/01-content-management-overview.md) - Understanding the content model

### Core Concepts

- [Theming System](developers/02-theming.md) - Customizing colors and design
- [Building Modules](developers/03-building-modules.md) - Creating content components
- [SEO & Routing](developers/06-seo-and-routing.md) - URL patterns, redirects, sitemap, and SEO
- [Internationalization (i18n)](developers/07-internationalization.md) - Multi-language content

### Advanced Features

- [API Reference](developers/04-api-reference.md) - RESTful endpoints
- [AI Agents](developers/09-ai-agents.md) - AI-powered content enhancement
- [Workflows](developers/10-workflows.md) - Event-driven automation and webhook integrations
- [MCP (Model Context Protocol)](developers/10-mcp.md) - Connect external AI tools (Cursor, n8n) to CMS context + safe write tools
- [Deployment Guide](developers/19-deployment.md) - Production deployment strategies
- [Update Philosophy](developers/20-update-philosophy.md) - How to approach upgrades and maintenance
- [Export/Import](developers/12-export-import.md) - Database export/import pipeline (dev seeding + production promotion)
- [CLI Commands](developers/21-cli-commands.md) - Code-first makers (post types, modules, roles, menus, taxonomies)

<!-- Coming Soon:
- Post Types - Defining custom content types
- Forms & Submissions - Frontend form handling
- Webhooks - Event-driven integrations
- Import/Export - Content portability
- Database Schema - Tables and relationships
- Services & Actions - Business logic organization
- RBAC System - Role-based access control
- Performance & Caching - Optimization strategies
-->

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
# Install and setup
npm install
cp .env.example .env
node ace migration:run
node ace db:seed

# Start development
npm run dev
```

Visit `/admin` and log in with `admin@example.com` / `password`

## Support & Resources

- **GitHub**: [View source code](#)
- **Issues**: [Report bugs](#)
- **Documentation**: You're reading it!

---

**Version**: 1.0.0 (Pre-Beta)
**Last Updated**: December 2025
