# Content Management Overview

Learn how to create, organize, and manage content in Adonis EOS. This section covers posts, modules, module groups, custom fields, and taxonomies.

## Overview

Adonis EOS uses a flexible content management system built around:

- **Posts**: The core content unit (pages, blog posts, profiles, etc.)
- **Modules**: Reusable content blocks that make up posts
- **Module Groups**: Pre-configured module layouts for rapid post creation
- **Custom Fields**: Post-type-specific metadata fields
- **Taxonomies**: Code-first category/tag systems that constrain and organize posts by type

## Key Concepts

### Post Types

Post types define different kinds of content with specific configurations:
- Blog posts
- Pages  
- Support documentation
- Profiles
- Testimonials
- Companies

Each post type can have:
- Custom URL patterns
- Allowed modules
- Custom fields
- Hierarchical structure (optional)

### Module System

Modules are the building blocks of content. They can be:
- **Local**: Specific to one post
- **Global**: Reusable across multiple posts
- **Locked**: Editable but cannot be removed (when seeded from module groups)

### Taxonomies (Categories/Tags)

- **Code-first**: Define taxonomies in `app/taxonomies/*.ts` with `slug`, `name`, `hierarchical`, `freeTagging`, and optional `maxSelections`.
- **Scoping**: Post types opt-in via their config `taxonomies: ['lipsum', ...]`; only opted types see them in the editor.
- **Hierarchy**: If `hierarchical` is true, terms can be nested and reordered; otherwise, the list is flat.
- **Free-tagging**: If enabled, editors can create new terms inline while editing a post.
- **Selection limits**: `maxSelections` can cap how many terms a post can select (or unlimited).

### Content Workflow

1. Create a post (optionally from a module group)
2. Add and configure modules
3. Set metadata (title, SEO, custom fields)
4. Save for review (optional)
5. Publish

## Related Topics

- Content Management (detailed guide)
- Building Modules
- Roles & Permissions

## Next Steps

Explore the detailed Content Management guide to learn about creating posts, managing modules, and using module groups effectively.


