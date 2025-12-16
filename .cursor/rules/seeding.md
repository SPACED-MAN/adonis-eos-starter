---
description: Database Seeding Best Practices
globs:
  - 'database/seeders/**/*.ts'
alwaysApply: false
---

# Database Seeding Best Practices

## Core Principle

**Seeders MUST use the same code paths as the application, not bypass them with direct database inserts.**

## Why This Matters

Direct database inserts bypass:

- ✅ Schema validation (modules, custom fields)
- ✅ Business logic (profile uniqueness, role checks)
- ✅ Relationships and constraints
- ✅ Hooks and lifecycle events
- ✅ URL pattern generation
- ✅ Default value population

**Result:** Seeders create invalid data that breaks in production.

## The Right Way

### ❌ Bad: Direct Database Inserts

```typescript
// DON'T DO THIS
await db.table('posts').insert({
  id: randomUUID(),
  title: 'Home',
  slug: 'home',
  type: 'page',
  // ... directly inserting
})

await db.table('module_instances').insert({
  id: randomUUID(),
  type: 'hero-with-callout',
  props: {
    primaryCta: {
      text: 'Click me', // ❌ Schema expects 'label', not 'text'
      url: '#',
    },
    secondaryCta: {}, // ❌ This property doesn't exist in schema
  },
})
```

**Problems:**

- Bypasses module schema validation
- Props don't match module expectations
- No validation of required fields
- Creates tech debt and bugs

### ✅ Good: Use Actions and Services

```typescript
import CreatePost from '#actions/posts/create_post'

export default class extends BaseSeeder {
  async run() {
    const admin = await db.from('users').where('email', 'admin@example.com').first()

    // Create post using the action (same as UI/API)
    const post = await CreatePost.handle({
      type: 'page',
      locale: 'en',
      slug: 'home',
      title: 'Home',
      status: 'published',
      metaTitle: 'My Homepage',
      userId: admin.id,
    })

    // Now add modules - still direct inserts for now, but at least
    // the post creation follows the proper path
    // TODO: Create UpdateModules action for proper module management
  }
}
```

**Benefits:**

- ✅ Uses same validation as production
- ✅ Respects business rules
- ✅ Generates proper URLs
- ✅ Easier to maintain

## Module Seeding

### Module Creation

Module creation uses `AddModuleToPost` action - same as the `POST /api/posts/:id/modules` endpoint:

```typescript
import AddModuleToPost from '#actions/posts/add_module_to_post'

// Add module using the same action as the API endpoint
await AddModuleToPost.handle({
  postId: post.id,
  moduleType: 'hero',
  scope: 'local', // 'local', 'global', or 'static'
  props: {
    title: 'Welcome', // ✅ Matches schema
    subtitle: 'To our site', // ✅ Matches schema
    // Module props are validated against schema automatically
  },
  orderIndex: 0, // Optional, auto-calculated if omitted
})
```

**Benefits:**

- ✅ Module type validation (must be registered)
- ✅ Schema validation (props must match module schema)
- ✅ Post type validation (module must be allowed for post type)
- ✅ Scope validation (global modules require globalSlug)
- ✅ Auto-calculates order_index if not provided
- ✅ Uses transactions for data integrity

## Templates: The Ideal Solution

**Best practice**: Define content as templates, then create posts from templates.

```typescript
// 1. Create template (one time, maybe in migration)
const template = await db
  .table('templates')
  .insert({
    name: 'homepage-default',
    post_type: 'page',
    // ...
  })
  .returning('*')

// 2. Add modules to template
await db.table('module_group_modules').insert([
  {
    module_group_id: template.id,
    type: 'hero',
    order_index: 0,
    default_props: { title: 'Welcome', subtitle: 'To our site' },
  },
  // ...
])

// 3. In seeder, create post from template
const post = await CreatePost.handle({
  type: 'page',
  slug: 'home',
  title: 'Home',
  templateId: template.id, // 🎯 Post gets modules from template
  userId: admin.id,
})
```

**Benefits:**

- Templates are reusable
- Schema validation happens once
- Easy to update all posts using a template
- Matches how admins create content

## JSON Export/Import

The system has JSON export functionality. Future consideration: use exported JSON as seed data source.

```typescript
// Export a post with modules
const exported = await PostSerializerService.exportPost(postId)

// In seeder, import it
const imported = await PostSerializerService.importPost(exported, {
  userId: admin.id,
  newSlug: 'home', // Override slug
})
```

## AI Agent Compatibility

Seeders should use the same endpoints/actions that AI agents use:

```typescript
// AI agents call: POST /api/posts
// Seeders should call: CreatePost.handle()

// AI agents call: PATCH /api/posts/:id/modules
// Seeders should call: UpdateModules.handle()
```

**This ensures:**

- AI agents and seeders create identical data
- No "seeder-only" bugs
- Validation is consistent

## Current Implementation ✅

### Posts: `CreatePost` Action

- All post creation uses `CreatePost.handle()`
- API endpoint: `POST /api/posts`
- Validates business rules, generates proper URLs
- Same code path as UI/API/AI agents

### Modules: `AddModuleToPost` Action

- All module creation uses `AddModuleToPost.handle()`
- API endpoint: `POST /api/posts/:id/modules`
- Validates module type, schema, post type compatibility
- Same code path as UI/API/AI agents

### Future Enhancements

- Template-based seeding (define templates, create posts from them)
- JSON import/export for complex content structures
- Bulk operations for large-scale seeding

## Checklist for New Seeders

- [ ] **MUST** use `CreatePost.handle()` for post creation
- [ ] **MUST** use `AddModuleToPost.handle()` for module creation
- [ ] **MUST NOT** use direct database inserts for posts or modules
- [ ] **MUST NOT** hardcode URLs (use `urlPatternService` if needed)
- [ ] Module props will be automatically validated against schema
- [ ] Consider using templates for reusability
- [ ] Test that seeded data works identical to UI-created data

**Actions Available:**

- `CreatePost.handle()` - POST /api/posts
- `AddModuleToPost.handle()` - POST /api/posts/:id/modules
- More in `app/actions/posts/*`

## Related Rules

- See `.cursor/rules/separation-of-concerns.md` for URL pattern handling
- See `.cursor/rules/dry.md` for avoiding duplication
- See `.cursor/rules/modules.md` for module development

---

**Remember:** If the UI can't create it, the seeder shouldn't either.
