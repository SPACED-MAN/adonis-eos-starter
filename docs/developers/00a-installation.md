# Installation

How to set up your Adonis EOS project.

## Quick Start

The fastest way to get started with Adonis EOS is to use our starter kit.

```bash
# Create a new project from the Adonis EOS starter kit
npm init adonisjs@latest my-cms-project -- --kit=spaced-man/adonis-eos-starter
cd my-cms-project

# Configure environment
cp .env.example .env

# Generate APP_KEY (required)
node ace generate:key

# Run migrations
node ace migration:run

# Seed initial data
node ace db:seed

# Start development server
npm run dev
```

## System Requirements

- **Node.js**: 18.0.0 or higher
- **Database**: PostgreSQL (recommended), MySQL, or SQLite
- **Memory**: 1GB minimum (2GB+ recommended for production)

## Manual Installation

If you prefer to clone the repository directly:

1. Clone the repository: `git clone https://github.com/spaced-man/adonis-eos.git`
2. Install dependencies: `npm install`
3. Follow the configuration steps above.

## Default Accounts

After seeding the database (`node ace db:seed`), you can log in with the following default accounts (password for all is `supersecret`):

- **Admin**: `admin@example.com`
- **Editor Admin**: `editoradmin@example.com`
- **Editor**: `editor@example.com`
- **Translator**: `translator@example.com`

## Project Structure

Refer to the [Project Structure](./02-content-management-overview.md) guide for a detailed breakdown of the codebase.

