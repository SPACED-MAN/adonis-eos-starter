# Adonis EOS — Modern Headless CMS Starter Kit

A high-performance, SEO-first CMS built with AdonisJS 6, Inertia, React, Tailwind, and PostgreSQL. Content is composed of reusable modules that can be reordered, shared globally, or grouped into module groups for rapid creation.

## 🚀 Quick Start

The fastest way to get started is using our starter kit:

```bash
npm init adonisjs@latest my-cms-project -- --kit=spaced-man/adonis-eos-starter
```

For detailed setup instructions, system requirements, and default account information, please refer to the **[Installation Guide](docs/developers/01-getting-started/01-installation.md)**.

## ✨ Key Features

Adonis EOS is packed with features designed for modern content workflows:

- **Modular Content Engine**: Build pages using reusable modules and custom post types.
- **AI-Native Workflow**: Integrated AI agents for generation, translation, and SEO.
- **Review & Collaboration**: Multi-stage publishing with draft, review, and live states.
- **Internationalization**: First-class multi-locale support for content and routing.
- **Media Pipeline**: Automatic optimization, variants, and dark-mode support.
- **RBAC & Security**: Granular Role-Based Access Control and security hardening.

See the **[Major Features](docs/00-index.md#major-features)** page for a full list and details.

## 📚 Documentation

Complete documentation is available in the `/docs` directory and on the **[Documentation Index](docs/00-index.md)**.

- **[For Editors](docs/editors.md)**: Content management, modules, and workflows.
- **[For Developers](docs/developers.md)**: Architecture, extending the CMS, and API reference.

## 🛠️ Tech Stack

- **Server:** AdonisJS 6 (Lucid ORM, Bouncer RBAC, SSR with Redis caching)
- **Client:** Inertia + React (Admin Panel + Public Site)
- **Styling:** Tailwind CSS + ShadCN UI
- **Rich Text:** Lexical (JSON stored, SSR-rendered to HTML)
- **Database:** PostgreSQL
- **AI Integration:** Model Context Protocol (MCP) support

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

Licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.

---

**Documentation**: [docs/00-index.md](docs/00-index.md) | **Admin Panel**: [/admin](/admin)
