# Documentation

Complete guide to using and developing with Adonis EOS — a modern, headless CMS built with AdonisJS, React, and PostgreSQL.

## For Content Editors

Perfect for non-technical users who create and manage content:

- [Editor Quick Start](/docs/quick-start) - Get started with the CMS
- [Creating & Managing Content](/docs/quick-start/content-management) - Posts, pages, and publishing
- [Working with Modules](/docs/quick-start/modules-guide) - Building pages with content blocks
- [Understanding Roles & Permissions](/docs/quick-start/roles-permissions) - Your access level
- [Using the Review System](/docs/quick-start/review-workflow) - Collaboration and approval
- [Managing Media](/docs/quick-start/media) - Uploading and organizing images
- [Translations](/docs/quick-start/translations) - Multi-language content

## For Developers

Technical documentation for developers and system administrators:

### Getting Started
- [Installation & Setup](/docs/getting-started) - Initial configuration
- [Content Management Overview](/docs/getting-started/content-management-overview) - Understanding the content model

### Core Concepts
- [Building Modules](/docs/getting-started/building-modules) - Creating content components
- [URL Patterns & Routing](/docs/getting-started/routing) - Dynamic URL generation
- [Theming System](/docs/getting-started/theming) - Customizing colors and design
- [Internationalization (i18n)](/docs/getting-started/internationalization) - Multi-language content

### Advanced Features
- [API Reference](/docs/getting-started/api-reference) - RESTful endpoints
- [AI Agents](/docs/getting-started/ai-agents) - Automated content workflows
- [Deployment Guide](/docs/getting-started/deployment) - Production deployment strategies

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
