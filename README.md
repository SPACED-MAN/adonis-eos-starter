# Adonis EOS — Modern Headless CMS

A high-performance, SEO-first CMS built with AdonisJS 6, Inertia, React, Tailwind, and PostgreSQL. Content is composed of reusable modules that can be reordered, shared globally, or grouped into module groups for rapid creation.

## 🚀 Tech Stack

- **Server:** AdonisJS 6 (Lucid ORM, Bouncer RBAC, SSR with Redis caching)
- **Client:** Inertia + React (Admin Panel + Public Site)
- **Styling:** Tailwind CSS + ShadCN UI (Dark/Light mode)
- **Forms:** ShadCN + Zod validation
- **Rich Text:** Lexical (JSON stored, SSR-rendered to HTML)
- **Database:** PostgreSQL
- **Drag & Drop:** dnd-kit

## ⚡ Getting Started

### For Content Editors

If you're new to using the CMS, start here:

👉 **[For Editors](/docs/for-editors)** - Learn how to create and manage content

**Editor Documentation:**
- [Content Management](/docs/for-editors/content-management) - Creating and editing posts
- [Working with Modules](/docs/for-editors/modules-guide) - Understanding content blocks
- [Review Workflow](/docs/for-editors/review-workflow) - Collaboration and approval
- [Managing Media](/docs/for-editors/media) - Uploading and organizing images
- [Translations](/docs/for-editors/translations) - Multi-language content
- [Roles & Permissions](/docs/for-editors/roles-permissions) - Understanding your access level

### For Developers

**Quick Installation:**

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Run migrations and seed data
node ace migration:run
node ace db:seed

# Start development server
npm run dev
```

Visit `http://localhost:3333/admin` and log in with `admin@example.com` / `password`

👉 **[For Developers](/docs/for-developers)** - Complete setup and configuration

**Developer Documentation:**
- [API Reference](/docs/for-developers/api-reference) - RESTful endpoints
- [Building Modules](/docs/for-developers/building-modules) - Creating custom content components
- [Content Management Overview](/docs/for-developers/content-management-overview) - Understanding the content model
- [Theming System](/docs/for-developers/theming) - Customizing design and colors
- [URL Patterns & Routing](/docs/for-developers/routing) - Dynamic URL generation
- [AI Agents](/docs/for-developers/ai-agents) - Automated workflows and integrations
- [Internationalization](/docs/for-developers/internationalization) - i18n implementation
- [Deployment Guide](/docs/for-developers/deployment) - Production setup and best practices

## 📁 Project Structure

```
inertia/
├── admin/              # Admin Panel (content management)
├── site/               # Public Site (visitor-facing)
├── modules/            # Shared content modules
└── components/         # Shared React components

app/
├── controllers/        # Route handlers
├── models/            # Database models
├── services/          # Business logic
├── modules/           # CMS module definitions
├── roles/             # RBAC role definitions
├── agents/            # AI agent definitions
└── post_types/        # Post type configurations

database/
├── migrations/        # Database schema
└── seeders/          # Seed data
```

## ✨ Core Features

### 📝 Modular Content System
Build pages with drag-and-drop modules. Each module is self-contained, reusable, and configurable with schema-driven field types.

### 👥 Role-Based Access Control
Four default roles with granular permissions:
- **Administrator** - Full system access
- **Editor Admin** - Content management + publishing
- **Editor** - Content creation (review before publish)
- **Translator** - Translation-focused access

### 🌍 Multi-Language Support
Full internationalization with locale-specific content, URLs, and menus. Translation workflow with review system.

### 🖼️ Advanced Media Management
Upload images with automatic variant generation, dark mode support, and optimization.

### 🤖 AI Agent System
Extensible agent framework for content enhancement, SEO optimization, automated workflows, and n8n integration.

### 📋 Review Workflow
Three-tier system: **Approved** → **AI Review** → **Review** → **Approved**
- Collaborative editing
- AI-suggested improvements
- Manual review and approval
- Full revision history

### 🔗 Webhooks & Integrations
Event-driven webhooks for post lifecycle events, media uploads, form submissions, and user actions.

### 📊 Forms & Submissions
Code-first form definitions with frontend rendering, validation, submission storage, and webhook integration.

### 🎨 Theming System
Centralized theme configuration with separate admin and site themes, automatic dark/light mode, and Tailwind integration.

## 🔐 Security & Performance

- **Rate Limiting:** Redis-based with sliding window (configurable per endpoint)
- **CSRF Protection:** Automatic token validation
- **Input Validation:** Vine validators on all endpoints
- **RBAC Enforcement:** Server-side permission checks
- **Webhook Signatures:** HMAC-SHA256 verification
- **SSR with Redis Caching:** Fast page loads and SEO optimization
- **Database Connection Pooling:** Optimized connections
- **Strategic Indexes:** 15+ optimized queries for performance

## 🛠️ Development

For detailed development workflows, testing strategies, and advanced topics, see the **[Developer Documentation](/docs/for-developers)**.

**Quick Commands:**
```bash
node ace test              # Run all tests
node ace make:module hero  # Create custom module
node ace make:agent seo    # Create AI agent
```

## 📦 Deployment

For production deployment guides, environment configuration, and hosting recommendations, see the **[Deployment Guide](/docs/for-developers/deployment)**.

**Quick Deploy:**
```bash
node ace migration:run --force
npm run build
node ace serve --watch
```

## 🤝 Contributing

This is currently a private project. Contribution guidelines will be published when the project reaches beta.

## 📄 License

Proprietary - All rights reserved

---

## 🏆 Version History

### Version 1.0.0 (Pre-Beta) - December 2025

**Current Status:** Feature-complete for 1.0, undergoing final testing and documentation before beta release.

**Major Features Completed:**
- ✅ Complete modular content system with 19+ built-in modules
- ✅ RBAC with 4 default roles and 60+ granular permissions
- ✅ Three-tier review workflow (Approved, AI Review, Review)
- ✅ Multi-language support with translation workflows
- ✅ AI agent system with external webhook integration (n8n)
- ✅ Advanced media management with dark mode variants
- ✅ Import/Export (canonical JSON format)
- ✅ Revision history with configurable retention
- ✅ Preview links with time-based expiration
- ✅ Webhooks for event-driven integrations
- ✅ Forms system with submissions and webhook triggers
- ✅ Scheduled publishing with in-process scheduler
- ✅ SSR with Redis caching for performance
- ✅ Centralized theming system
- ✅ Soft deletes with data recovery
- ✅ Activity logging and audit trail
- ✅ Rate limiting and security hardening
- ✅ Comprehensive test infrastructure

**Known Limitations:**
- Internal AI agents not yet implemented (external webhooks only)
- Advanced analytics dashboard planned for future release
- Multi-tenant support planned for enterprise version

---

**Built with ❤️ using AdonisJS**

**Documentation:** [/docs](/docs) | **Admin Panel:** [/admin](/admin)
