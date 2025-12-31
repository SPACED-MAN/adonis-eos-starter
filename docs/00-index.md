# Documentation

Complete guide to using and developing with Adonis EOS — a modern, headless CMS built with AdonisJS, React, and PostgreSQL.

## For Content Editors

- [Basics](editors/01-basics.md) - Fundamentals of content management
- [Collaboration](editors/02-collaboration.md) - Teamwork and review workflows
- [Management](editors/03-management.md) - Media, translations, and SEO

## For Developers

- [Getting Started](developers/01-getting-started.md) - Installation and project setup
- [Architecture](developers/02-architecture.md) - Core principles and business logic
- [Extending the CMS](developers/03-extending-the-cms.md) - Theming and custom modules
- [Automation & AI](developers/04-automation-and-ai.md) - Workflows and AI agents
- [Content & Data](developers/05-content-and-data.md) - Taxonomies, menus, and fields
- [Operations & Security](developers/06-operations-and-security.md) - CLI tools and access control

## What is Adonis EOS?

Adonis EOS is a modern, headless CMS that combines:

- **AdonisJS** - Robust Node.js backend framework
- **React + Inertia.js** - Modern frontend with SSR
- **PostgreSQL** - Reliable, powerful database
- **Tailwind CSS** - Utility-first styling

## Quick Start

```bash
npm init adonisjs@latest my-cms-project -- --kit=spaced-man/adonis-eos-starter
cd my-cms-project
cp .env.example .env
node ace generate:key
node ace migration:run
node ace db:seed
npm run dev
```

Visit `/admin` and log in with `admin@example.com` / `supersecret`
(Note: You **must** change these default passwords immediately after login and prior to deployment)

---

**Version**: 1.2.0
**Last Updated**: December 2025
