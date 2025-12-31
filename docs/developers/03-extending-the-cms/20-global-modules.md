# Global Modules

Global Modules are reusable content blocks that can be shared across multiple pages. When you update a Global Module, the changes are reflected everywhere it is used.

---

## 1. Local vs. Global vs. Static

Adonis EOS modules operate in three scopes:

| Scope | Description | Storage |
| :--- | :--- | :--- |
| **Local** (Default) | Unique to a single post. | Props stored in `post_modules.props`. |
| **Global** | Shared across multiple posts. Managed in the Admin UI. | Props stored in `module_instances.props`. |
| **Static** | Global modules with a fixed, machine-readable `global_slug`. | Same as Global, but typically used for site-wide elements like headers/footers. |

## 2. Developer Workflow

### Creating a Global Module

1.  **In the Admin UI**: Navigate to **Modules > Global Modules** and click **Create Global Module**.
2.  **Define Type & Slug**: Select the module type (e.g., `hero`, `prose`) and provide a unique `global_slug`.
3.  **Set Initial Props**: Configure the default content for this global instance.

### Using Global Modules in Posts

When building a page in the editor, you can:
- **Add a Global Module**: Choose from existing global instances.
- **Convert to Global**: Take a local module and "promote" it to a Global Module so it can be reused on other pages.

---

## 3. Implementation Details

### Database Schema

- **`module_instances`**: Stores the canonical definition and props for global/static modules.
- **`post_modules`**: Connects a post to a `module_instance`.
  - For **Local** modules, `module_id` is null and `props` contains the data.
  - For **Global/Static** modules, `module_id` points to `module_instances.id`.

### Overrides

Even when using a Global Module, a specific post can **override** certain props. These are stored in `post_modules.overrides`. This allows you to have a shared layout (Global) with post-specific content (Overrides).

---

## 4. Static Modules

Static modules are a special subset of Global modules used for "hardcoded" site elements that still need to be editable by non-technical users.

**Example: Footer Contact Info**
1. Create a Global Module of type `prose` with the slug `site-footer`.
2. In your frontend code, you can fetch this specific module by its slug:
   `GET /api/modules/static?q=site-footer`

This pattern ensures that developers can rely on a consistent slug in their code while editors maintain control over the content.

---

## 5. Usage & Safety

- **Usage Counts**: The Admin UI shows how many posts reference a specific Global Module.
- **Deletion Protection**: A Global Module cannot be deleted if it is currently referenced by any post.
- **Review Workflow**: Updates to Global Modules also support the [Review Workflow](../../developers/06-operations-and-security/11-review-workflow.md), ensuring changes are staged before going live site-wide.

