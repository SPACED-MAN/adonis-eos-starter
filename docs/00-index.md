# Documentation

Complete guide to using and developing with Adonis EOS — a modern, headless CMS built with AdonisJS, React, and PostgreSQL.

## For Content Editors

Perfect for non-technical users who create and manage content:

- [For Editors](/docs/for-editors) - Get started with the CMS
- [Creating & Managing Content](/docs/for-editors/content-management) - Posts, pages, and publishing
- [Working with Modules](/docs/for-editors/modules-guide) - Building pages with content blocks
- [Understanding Roles & Permissions](/docs/for-editors/roles-permissions) - Your access level
- [Using the Review System](/docs/for-editors/review-workflow) - Collaboration and approval
- [Managing Media](/docs/for-editors/media) - Uploading and organizing images
- [Translations](/docs/for-editors/translations) - Multi-language content

## For Developers

Technical documentation for developers and system administrators:

### Getting Started
- [Installation & Setup](/docs/for-developers) - Initial configuration
- [Content Management Overview](/docs/for-developers/content-management-overview) - Understanding the content model

### Core Concepts
- [Theming System](/docs/for-developers/theming) - Customizing colors and design
- [Building Modules](/docs/for-developers/building-modules) - Creating content components
- [SEO & Routing](/docs/for-developers/seo-and-routing) - URL patterns, redirects, sitemap, and SEO
- [Internationalization (i18n)](/docs/for-developers/internationalization) - Multi-language content

### Advanced Features
- [API Reference](/docs/for-developers/api-reference) - RESTful endpoints
- [AI Agents](/docs/for-developers/ai-agents) - Automated content workflows
- [MCP (Model Context Protocol)](/docs/for-developers/mcp) - Connect external AI agents (Cursor, n8n) to CMS context + safe write tools
- [Deployment Guide](/docs/for-developers/deployment) - Production deployment strategies
 - [Update Philosophy](/docs/for-developers/update-philosophy) - How to approach upgrades and maintenance
- [Export/Import](/docs/for-developers/export-import) - Database export/import pipeline (dev seeding + production promotion)
- [CLI Commands](/docs/for-developers/cli-commands) - Code-first makers (post types, modules, roles, menus, taxonomies)

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
