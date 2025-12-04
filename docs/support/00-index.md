# Support Documentation

Complete guide to using and developing with Adonis EOS.

## Quick Links

### Getting Started
- [Getting Started](/support/getting-started) - Installation, setup, and overview
- [Content Management](/support/content-management) - Creating and managing content

### For Developers
- [API Reference](/support/api-reference) - RESTful API endpoints and usage
- [Building Modules](/support/building-modules) - Create custom content modules
- [Theming](/support/theming) - Customize colors, fonts, and design

### Features
- [Internationalization](/support/internationalization) - Multi-language support
- [Roles & Permissions](/support/roles-permissions) - User access control

### For Content Editors
- [Content Management](/support/content-management) - Complete editor guide
- [Roles & Permissions](/support/roles-permissions) - Understanding your access level

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

## System Architecture

```
Frontend (React/Inertia)
    ↕ HTTP/Inertia Protocol
Backend (AdonisJS)
    ↕ Lucid ORM
Database (PostgreSQL)
```

## Development Workflow

1. **Migrations** - Define database schema
2. **Seeders** - Populate initial data
3. **Modules** - Create content components
4. **Roles** - Define user permissions
5. **Agents** - Integrate AI services
6. **Deploy** - Ship to production

## Need Help?

- Read the relevant guide from the menu
- Check the API reference for technical details
- Review existing modules for examples
- Contact your system administrator

---

**Version**: 1.0.0  
**Last Updated**: December 2025



