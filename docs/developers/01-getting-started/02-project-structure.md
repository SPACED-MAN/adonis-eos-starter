# Project Structure

A detailed look at the Adonis EOS folder structure and organization.

Adonis EOS follows a modular, domain-driven structure that extends the standard AdonisJS patterns. Most of the business logic and CMS configuration lives within the `app/` directory.

## Core Directories

### `app/`
The heart of the application.

- **`actions/`**: Atomic, reusable business logic units (e.g., `CreatePost`, `UpdatePostModule`). These are called by controllers and agents.
- **`agents/`**: AI agent definitions. This is where you configure how your CMS interacts with LLMs.
- **`controllers/`**: Standard AdonisJS controllers handling HTTP requests for both the Admin UI and the site frontend.
- **`fields/`**: Custom field type definitions. Each file here defines how a field (like `richtext`, `media`, or `post_reference`) is validated and rendered in the admin.
- **`forms/`**: Code-first form definitions for the site's form builder.
- **`helpers/`**: Shared utility functions for i18n, rendering, and data transformation.
- **`middleware/`**: HTTP middleware for authentication, locale detection, rate limiting, and redirects.
- **`models/`**: Lucid ORM models representing the database schema (Posts, Modules, Media, etc.).
- **`modules/`**: CMS module definitions. Each file defines the schema, default props, and AI guidance for a content block.
- **`post_types/`**: Code-first post type configurations. Each file defines labels, UI behavior, custom fields, and SEO defaults using the `PostTypeConfig` interface.
- **`roles/`**: RBAC (Role-Based Access Control) definitions.
- **`services/`**: Long-lived singleton services handling registries, serialization, preview tokens, and more.
- **`taxonomies/`**: Code-first taxonomy definitions for categories and tags.
- **`workflows/`**: Automation workflow definitions triggered by system events.

### `inertia/`
Contains the React frontend application.

- **`admin/`**: The complete CMS Admin interface.
- **`site/`**: The default frontend website implementation.
- **`modules/`**: React components corresponding to the backend module definitions.
- **`components/`**: Shared UI components used across the admin and site.

### `database/`
- **`migrations/`**: Schema definitions for PostgreSQL.
- **`seeders/`**: Initial data setup, including the documentation seeder.

### `docs/`
Markdown-based documentation (which you are reading now!) that is automatically seeded into the database.

### `start/`
Bootstrapping logic for AdonisJS, including the registration of post types, modules, and roles.

### `commands/`
Custom Ace CLI commands for operations, scaffolding, and MCP integration.

## Key Files

- **`adonisrc.ts`**: Main workspace configuration.
- **`package.json`**: Dependencies and scripts.
- **`tailwind.config.js`**: Design system configuration.
- **`vite.config.ts`**: Build tool configuration for React/Inertia.

