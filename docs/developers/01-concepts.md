# Concepts

Core architecture and design principles of Adonis EOS.

Understanding these concepts will help you build more effectively with Adonis EOS.

## Modular Architecture

Adonis EOS is built on the principle of **modular content**. Instead of rigid page templates, content is constructed using reusable modules.

- **Post Types**: Define the structure and behavior of different content categories (e.g., Pages, Blog Posts).
- **Modules**: Individual building blocks (e.g., Hero, Prose, Gallery) that editors can arrange to build pages.
- **Fields**: The data entry points within modules, supporting everything from simple text to complex relational selectors.

## The Content Pipeline

1. **Schema Definition**: Developers define modules and post types in code.
2. **Editor Input**: Content editors use the Admin UI to populate these structures.
3. **Storage**: Data is stored as structured JSON/Lexical format in the database.
4. **Rendering**: The site frontend (React) renders the modules using appropriate components.

## AI-Native Workflow

Adonis EOS is designed for an AI-enhanced future.

- **AI Agents**: Specialized agents that can review, translate, or enhance content.
- **MCP (Model Context Protocol)**: Exposes CMS context to external AI tools like Cursor or LLMs, allowing them to understand your project structure and even perform safe writes.

## Internationalization (i18n)

I18n is a first-class citizen in Adonis EOS. All content can be translated, and the CMS handles locale-specific routing, metadata, and media variants out of the box.

## Security & RBAC

A robust Role-Based Access Control system ensures that users only have the permissions they need. From granular field-level permissions to site-wide administration, security is built into the core.

