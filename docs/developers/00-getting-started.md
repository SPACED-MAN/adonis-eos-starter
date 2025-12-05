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

- Node.js 20.x or higher
- PostgreSQL 14+ (or MySQL 8+)
- npm or yarn package manager

## Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd adonis-eos

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Run migrations
node ace migration:run

# Seed initial data
node ace db:seed

# Start development server
npm run dev
```

## Default Accounts

After seeding, you'll have these accounts:

- **Admin**: `admin@example.com` / `password`
- **Editor Admin**: `editoradmin@example.com` / `password`
- **Editor**: `editor@example.com` / `password`
- **Translator**: `translator@example.com` / `password`

## Project Structure

```
adonis-eos/
├── app/                    # Backend application code
│   ├── controllers/        # Route handlers
│   ├── models/            # Database models
│   ├── services/          # Business logic
│   ├── modules/           # CMS module definitions
│   ├── roles/             # RBAC role definitions
│   └── agents/            # AI agent definitions
├── inertia/               # Frontend React code
│   ├── pages/             # Page components
│   ├── components/        # Reusable components
│   └── modules/           # Frontend module components
├── database/
│   ├── migrations/        # Database schema
│   └── seeders/          # Seed data
├── docs/                  # Documentation
└── public/               # Static assets
```

## Next Steps

- [API Reference](/docs/api-reference) - Learn about available endpoints
- [Building Modules](/docs/building-modules) - Create custom content modules
- [Theming](/docs/theming) - Customize the design system
- [Content Management](/docs/content-management) - Managing posts and pages



