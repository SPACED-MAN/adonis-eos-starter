---
description: Separation of Concerns - Post Types and URL Patterns
globs: []
alwaysApply: true
---

# Separation of Concerns

## Post Type Specific Logic

**NEVER** include post-type-specific logic directly in general-purpose controllers.

### ❌ Bad - Hardcoded post-type logic in controller
```typescript
// app/controllers/posts/posts_view_controller.ts
if (post.type === 'support') {
  // support-specific logic here
  additionalProps.supportNav = [...];
}
if (post.type === 'blog') {
  // blog-specific logic here
}
```

### ✅ Good - Delegate to service layer
```typescript
// app/controllers/posts/posts_view_controller.ts
const additionalProps = await postTypeViewService.getAdditionalProps(post)

// app/services/post_type_view_service.ts
async getAdditionalProps(post: Post) {
  switch (post.type) {
    case 'support': return await this.getSupportProps(post)
    case 'blog': return await this.getBlogProps(post)
    default: return {}
  }
}
```

**Rationale:** Controllers should remain generic. Type-specific logic belongs in dedicated services or the post type definitions themselves.

**Exception:** The only acceptable post-type checks in controllers are for data integrity rules that apply universally (e.g., `profile` posts having unique author constraints).

## URL Pattern Handling

**NEVER** hardcode URL patterns in controllers, services, or seeders.

### ❌ Bad - Hardcoded URLs
```typescript
const url = `/support/${slug}`
const url = `/blog/${slug}`
const link = { href: '/support/getting-started' }
```

### ✅ Good - Use URL pattern service
```typescript
const url = await urlPatternService.buildPostPath(postType, slug, locale, createdAt)
const url = await urlPatternService.buildPostPathForPost(postId)
```

**Rationale:** URL patterns are configurable via:
1. Post type definitions (`app/post_types/*.ts`)
2. URL Patterns admin interface
3. Database (`url_patterns` table)

Hardcoding URLs bypasses this system and creates maintenance issues.

**Where patterns are defined:**
- **Source of truth:** `app/post_types/*.ts` - `urlPatterns` property
- **Runtime storage:** `url_patterns` database table
- **Access layer:** `app/services/url_pattern_service.ts`

## Implementation Checklist

When adding post-type-specific features:
- [ ] Create a method in `post_type_view_service.ts` for additional props
- [ ] Use `urlPatternService.buildPostPath()` for all URL generation
- [ ] Define URL patterns in `app/post_types/*.ts`, not inline
- [ ] Keep controllers generic - delegate type-specific logic
- [ ] Document any unavoidable exceptions (data integrity rules)

## Related Rules
- See `.cursor/rules/dry.md` for reusability principles
- See `.cursor/rules/conventions.md` for service layer patterns

