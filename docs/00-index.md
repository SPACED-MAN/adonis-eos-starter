# Documentation

Complete guide to using and developing with Adonis EOS — a modern, headless CMS built with AdonisJS, React, and PostgreSQL.

## For Content Editors

Perfect for non-technical users who create and manage content:

- [Editor Quick Start](/docs/editors/quick-start) - Get started with the CMS
- [Creating & Managing Content](/docs/editors/content-management) - Posts, pages, and publishing
- [Working with Modules](/docs/editors/modules) - Building pages with content blocks
- [Understanding Roles & Permissions](/docs/editors/roles-permissions) - Your access level
- [Using the Review System](/docs/editors/review-workflow) - Collaboration and approval
- [Managing Media](/docs/editors/media) - Uploading and organizing images
- [Translations](/docs/editors/translations) - Multi-language content

## For Developers

Technical documentation for developers and system administrators:

### Getting Started
- [Installation & Setup](/docs/developers/getting-started) - Initial configuration
- [Project Structure](/docs/developers/project-structure) - Understanding the codebase
- [Configuration](/docs/developers/configuration) - Environment and settings

### Core Concepts
- [Post Types](/docs/developers/post-types) - Defining custom content types
- [Building Modules](/docs/developers/building-modules) - Creating content components
- [URL Patterns & Routing](/docs/developers/routing) - Dynamic URL generation
- [Theming System](/docs/developers/theming) - Customizing colors and design

### Advanced Features
- [API Reference](/docs/developers/api-reference) - RESTful endpoints
- [AI Agents](/docs/developers/ai-agents) - Automated content workflows
- [Forms & Submissions](/docs/developers/forms) - Frontend form handling
- [Webhooks](/docs/developers/webhooks) - Event-driven integrations
- [Import/Export](/docs/developers/import-export) - Content portability

### Architecture
- [Database Schema](/docs/developers/database-schema) - Tables and relationships
- [Services & Actions](/docs/developers/services) - Business logic organization
- [RBAC System](/docs/developers/rbac) - Role-based access control
- [Performance & Caching](/docs/developers/performance) - Optimization strategies

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
