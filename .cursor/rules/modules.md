# Module Development Guide

## Philosophy & Architecture

### What is a Module?

A **module** is a self-contained, reusable content component that can be added to posts. Think of them as "content blocks" or "page builders blocks" that editors can compose together to create rich pages.

**Examples:**

- Hero sections with CTAs
- Text/prose content (Lexical rich text)
- Image galleries
- Video embeds
- Testimonial carousels
- Call-to-action blocks
- FAQ accordions

### Why Modules Are NOT Models

**Modules are behavior classes, not data models.**

| Aspect  | Models                           | Modules                                              |
| ------- | -------------------------------- | ---------------------------------------------------- |
| Purpose | Data persistence & relationships | Rendering logic & validation                         |
| Storage | Direct database tables           | No direct table (data in `post_modules.props` JSONB) |
| Pattern | Active Record                    | Strategy Pattern / Registry Pattern                  |
| Changes | Require migrations               | Just update code                                     |
| Testing | Database queries                 | Pure logic tests                                     |

**Key Insight:** Modules define _how to render and validate content_, while `post_modules` stores _what content to render_.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Module System                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐          ┌──────────────┐                 │
│  │ BaseModule   │          │  Module      │                 │
│  │ (abstract)   │◄─────────│  Registry    │                 │
│  └──────────────┘          └──────────────┘                 │
│        △                          │                          │
│        │                          │ registers                │
│        │                          ▼                          │
│  ┌─────┴──────┐           ┌──────────────┐                 │
│  │ HeroModule │           │ ProseModule  │                 │
│  └────────────┘           └──────────────┘                 │
│                                                               │
│  Data Storage:                                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ post_modules table                                    │   │
│  │ ├─ id (UUID)                                          │   │
│  │ ├─ post_id (FK → posts)                              │   │
│  │ ├─ module_type (string) ───► "hero", "prose"        │   │
│  │ └─ props (JSONB) ──────────► Actual content data    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Why This Design?

**1. Flexibility**

- Add new modules without DB migrations
- Module logic versioning is independent of data
- Easy to A/B test different rendering strategies

**2. Separation of Concerns**

- Data (props) stored in database
- Behavior (rendering) in code
- Configuration (schema) in module class

**3. Extensibility**

- Third-party packages can provide modules
- Modules can be swapped/replaced
- Easy to test in isolation

**4. Performance**

- Module code is cached in memory
- Props stored efficiently in JSONB
- SSR rendering is fast

### UI Philosophy: Editorial Content Only

Our module UI intentionally focuses on content that provides value to editors:

- Only expose fields for **editorial content** (text, copy, image uploads, media URLs, structured data).
- **Never expose raw class fields** (e.g., “Background Classes”, arbitrary Tailwind strings) or low-level design controls like padding, margin, spacing, or colors.
- Visual design, layout, spacing, and color tokens **must be defined in code** (modules + components), not configured per-instance in the editor.
- If a visual variant is truly needed, prefer **semantic switches** (e.g., `layout: 'stacked' | 'inline'`) over free-form style controls.
- When in doubt, treat anything that looks like styling as **code-exclusive**, and anything that looks like copy as **editor-facing**.

This keeps content consistent, prevents design drift, and aligns with the editorial vs. design separation the project expects.

### Media Usage in Modules

- **Always resolve media from the media library**, never hardcode CDN URLs or static paths in modules.
- **When rendering images on the frontend**, always request an appropriate size/variant (e.g., `thumb`, `hero`, `wide`) for performance.
- Variant selection logic should use a shared helper (e.g., a `pickMediaVariantUrl`-style function) that:
  - Prefers a requested size if available.
  - Falls back to the next-best size (usually the next-largest) when the exact size is missing.
  - Is aware of light vs dark image variants so dark mode uses dark images when present.
- Do **not** reimplement media-variant selection per module; reuse the shared helper for consistency and better caching.

---

## Creating a New Module

### Quick Start

```bash
node ace make:module VideoEmbed
```

This generates `app/modules/video_embed_module.ts` with:

- Complete class structure
- TypeScript interfaces
- Method stubs with documentation
- TODO comments guiding implementation

### File Structure

**Location:** `app/modules/`

**Naming Convention:**

- File: `{name}_module.ts` (snake_case)
- Class: `{Name}Module` (PascalCase)
- Type: `{name}` (kebab-case for API)

**Examples:**

- `hero_module.ts` → `HeroModule` → type: `"hero"`
- `video_embed_module.ts` → `VideoEmbedModule` → type: `"video-embed"`
- `testimonial_carousel_module.ts` → `TestimonialCarouselModule` → type: `"testimonial-carousel"`

### Implementation Checklist

After generating a module, implement:

- [ ] **Props Interface** - Define the data shape
- [ ] **Config** - Set metadata (name, category, allowed post types)
- [ ] **Schema** - Add validation rules
- [ ] **renderHtml()** - Implement SSR rendering
- [ ] **generateJsonLd()** - Add structured data (if applicable)
- [ ] **Register** - Add to `start/modules.ts`
- [ ] **Tests** - Create unit tests in `tests/unit/modules/`

---

## Detailed Implementation Guide

### 1. Props Interface

Define the shape of data your module accepts.

**Support i18n:**

```typescript
interface HeroProps extends ModuleProps {
  title: string | Record<string, string> // "Hello" or { en: "Hello", es: "Hola" }
  subtitle?: string | Record<string, string>
  image?: string // Non-localized
  ctaButtons?: Array<{
    label: string | Record<string, string>
    url: string
    style: 'primary' | 'secondary'
  }>
}
```

**BaseModule handles:**

- Localization (extracts current locale value automatically)
- Prop merging (global + local overrides)
- Validation against schema

### 2. Module Configuration

```typescript
get config(): ModuleConfig {
  return {
    type: 'video-embed',              // Unique identifier
    version: '1.0.0',                 // For breaking changes
    name: 'Video Embed',              // Display name
    description: 'Embed videos...',   // User-facing description
    category: 'media',                // content|media|layout|data|interactive
    icon: 'play-circle',              // Icon identifier for UI
    allowedPostTypes: ['page', 'blog'], // Restrict usage
  }
}
```

**Categories:**

- `content` - Text, headings, prose
- `media` - Images, videos, audio
- `layout` - Grids, columns, spacers
- `data` - Forms, charts, tables
- `interactive` - Accordions, tabs, modals

### 3. Schema Definition

Use JSON Schema-like syntax for validation:

```typescript
get schema() {
  return {
    videoUrl: {
      type: 'string',
      required: true,
      pattern: '^https://(www\.)?(youtube\.com|vimeo\.com)',
    },
    title: {
      type: 'string',
      required: false,
    },
    autoplay: {
      type: 'boolean',
      default: false,
    },
    aspectRatio: {
      type: 'string',
      enum: ['16:9', '4:3', '1:1'],
      default: '16:9',
    },
  }
}
```

**Validation happens automatically** when modules are added/updated via API.

### 4. SSR Rendering

Implement `renderHtml()` to generate HTML:

```typescript
protected renderHtml(props: VideoEmbedProps, context: ModuleContext): string {
  const { videoUrl, title, aspectRatio = '16:9' } = props
  const embedUrl = this.getEmbedUrl(videoUrl)

  return `
    <div class="video-embed aspect-${aspectRatio}">
      ${title ? `<h3>${title}</h3>` : ''}
      <iframe
        src="${embedUrl}"
        frameborder="0"
        allowfullscreen
        loading="lazy"
      ></iframe>
    </div>
  `
}

private getEmbedUrl(url: string): string {
  // Transform YouTube/Vimeo URLs to embed format
  // ...
}
```

**Context provides:**

- `context.locale` - Current locale
- `context.post` - Parent post model
- `context.environment` - 'production' | 'development'

**Best Practices:**

- Sanitize user input (title, captions, etc.)
- Use semantic HTML
- Add accessibility attributes
- Include loading="lazy" for performance
- Use Tailwind classes for styling

### 5. JSON-LD Generation

Return structured data for SEO:

```typescript
protected generateJsonLd(
  props: VideoEmbedProps,
  context: ModuleContext
): Record<string, any> | null {
  if (!props.videoUrl) return null

  return {
    '@type': 'VideoObject',
    name: props.title || 'Video',
    embedUrl: this.getEmbedUrl(props.videoUrl),
    uploadDate: context.post.createdAt.toISO(),
    thumbnail: props.thumbnail || null,
  }
}
```

**Return `null`** if the module doesn't represent structured data.

---

## Registration

### Manual Registration

Add to `start/modules.ts`:

```typescript
import { ModuleRegistry } from '#services/module_registry'
import HeroModule from '#modules/hero_module'
import ProseModule from '#modules/prose_module'
import VideoEmbedModule from '#modules/video_embed_module'

// Register all modules
ModuleRegistry.register(HeroModule)
ModuleRegistry.register(ProseModule)
ModuleRegistry.register(VideoEmbedModule)
```

**This file is preloaded** on app startup (see `adonisrc.ts`).

### Verification

Check registration:

```bash
curl http://localhost:3333/api/modules/registry
```

---

## Testing

### Unit Test Template

Create `tests/unit/modules/video_embed_module.spec.ts`:

```typescript
import { test } from '@japa/runner'
import VideoEmbedModule from '#modules/video_embed_module'

test.group('Video Embed Module', () => {
  test('should have correct configuration', ({ assert }) => {
    const module = new VideoEmbedModule()
    const config = module.config

    assert.equal(config.type, 'video-embed')
    assert.equal(config.name, 'Video Embed')
    assert.equal(config.category, 'media')
  })

  test('should render YouTube embed', ({ assert }) => {
    const module = new VideoEmbedModule()
    const html = module.render(
      { videoUrl: 'https://youtube.com/watch?v=abc123' },
      { locale: 'en', post: null as any, environment: 'production' }
    )

    assert.include(html, 'iframe')
    assert.include(html, 'youtube.com/embed/abc123')
  })

  test('should validate required fields', ({ assert }) => {
    const module = new VideoEmbedModule()
    const isValid = module.validate({})

    assert.isFalse(isValid)
  })

  test('should localize title', ({ assert }) => {
    const module = new VideoEmbedModule()
    const html = module.render(
      {
        videoUrl: 'https://youtube.com/watch?v=abc',
        title: { en: 'Watch This', es: 'Mira Esto' },
      },
      { locale: 'es', post: null as any, environment: 'production' }
    )

    assert.include(html, 'Mira Esto')
    assert.notInclude(html, 'Watch This')
  })
})
```

**Run tests:**

```bash
node ace test tests/unit/modules/video_embed_module.spec.ts
```

---

## Common Patterns

### Pattern 1: Conditional Rendering

```typescript
protected renderHtml(props: CtaProps, context: ModuleContext): string {
  const { title, buttons = [] } = props

  if (buttons.length === 0) {
    return `<div class="cta-empty">No buttons configured</div>`
  }

  return `
    <div class="cta">
      ${title ? `<h2>${title}</h2>` : ''}
      <div class="cta-buttons">
        ${buttons.map(btn => this.renderButton(btn)).join('')}
      </div>
    </div>
  `
}

private renderButton(button: CtaButton): string {
  return `
    <a href="${button.url}" class="btn btn-${button.style}">
      ${button.label}
    </a>
  `
}
```

### Pattern 2: Complex Localization

```typescript
protected renderHtml(props: TestimonialProps, context: ModuleContext): string {
  // BaseModule.localizeValue() handles nested localization
  const quote = this.localizeValue(props.quote, context.locale)
  const author = this.localizeValue(props.author, context.locale)
  const company = this.localizeValue(props.company, context.locale)

  return `
    <blockquote class="testimonial">
      <p>"${quote}"</p>
      <cite>
        <strong>${author}</strong>
        ${company ? ` — ${company}` : ''}
      </cite>
    </blockquote>
  `
}
```

### Pattern 3: Nested Components

```typescript
interface AccordionProps extends ModuleProps {
  items: Array<{
    title: string | Record<string, string>
    content: string | Record<string, string>
    expanded?: boolean
  }>
}

protected renderHtml(props: AccordionProps, context: ModuleContext): string {
  return `
    <div class="accordion">
      ${props.items.map((item, idx) => this.renderItem(item, idx, context)).join('')}
    </div>
  `
}

private renderItem(
  item: AccordionProps['items'][0],
  index: number,
  context: ModuleContext
): string {
  const title = this.localizeValue(item.title, context.locale)
  const content = this.localizeValue(item.content, context.locale)
  const isExpanded = item.expanded ?? false

  return `
    <details ${isExpanded ? 'open' : ''}>
      <summary>${title}</summary>
      <div class="accordion-content">${content}</div>
    </details>
  `
}
```

---

## API Usage

### Get Module Registry

```bash
GET /api/modules/registry
```

**Response:**

```json
[
  {
    "type": "hero",
    "version": "1.0.0",
    "name": "Hero",
    "description": "Hero section with title, subtitle, and CTAs",
    "category": "content",
    "icon": "layout-hero",
    "allowedPostTypes": ["page", "blog"]
  },
  { ... }
]
```

### Get Module Schema

```bash
GET /api/modules/hero/schema
```

**Response:**

```json
{
  "type": "hero",
  "schema": {
    "title": { "type": "string", "required": true },
    "subtitle": { "type": "string", "required": false },
    "ctaButtons": { "type": "array", "required": false }
  }
}
```

### Add Module to Post

```bash
POST /api/posts/:postId/modules
Content-Type: application/json

{
  "moduleType": "hero",
  "scope": "local",
  "props": {
    "title": { "en": "Welcome", "es": "Bienvenido" },
    "subtitle": "Get started today"
  }
}
```

---

## Troubleshooting

### Module Not Appearing in Registry

**Check:**

1. Module is imported in `start/modules.ts`
2. `ModuleRegistry.register()` is called
3. No errors in terminal on app start
4. Module class extends `BaseModule`

### Validation Failing

**Debug:**

```typescript
const module = new HeroModule()
console.log(module.schema) // Check schema definition
console.log(module.validate(props)) // See validation result
```

### Props Not Localizing

**Ensure:**

1. Props use `string | Record<string, string>` type
2. You're calling `this.localizeValue()` or using `this.applyLocale()`
3. Locale is valid (check `config/i18n.ts`)

### SSR Output Not Showing

**Check:**

1. `renderHtml()` returns valid HTML string
2. No exceptions thrown during rendering
3. Module is attached to post via `post_modules` table
4. Using `ModuleRenderer.renderModule()` or `ModuleRenderer.renderPost()`

---

## Best Practices

### Do ✅

- **Keep modules focused** - One module, one purpose
- **Use semantic HTML** - `<article>`, `<section>`, `<figure>`, etc.
- **Support i18n** - Use `string | Record<string, string>` for text
- **Validate props** - Define comprehensive schemas
- **Write tests** - Unit test all rendering logic
- **Document props** - Use TSDoc comments
- **Handle missing data** - Graceful fallbacks for optional props

### Don't ❌

- **Don't query database** - Modules should be stateless
- **Don't use external services** - Keep SSR fast
- **Don't assume locale** - Always use `context.locale`
- **Don't inject services** - Pass data via props
- **Don't hardcode content** - Make it configurable
- **Don't skip validation** - Always define schema
- **Don't forget JSON-LD** - Add structured data when applicable

---

## Related Guidelines

- [Testing Guide](.cursor/rules/testing.md) - Testing strategies
- [Conventions](.cursor/rules/conventions.md) - Code style
- [Actions](.cursor/rules/actions.md) - Business logic patterns

---

## Quick Reference

**Commands:**

```bash
node ace make:module ModuleName         # Create module
node ace test tests/unit/modules/       # Run module tests
node ace list                           # See all commands
```

**Key Files:**

- `app/modules/` - Module definitions
- `app/types/module_types.ts` - Type definitions
- `app/services/module_registry.ts` - Registry service
- `app/services/module_renderer.ts` - Rendering service
- `start/modules.ts` - Module registration

**Key Concepts:**

- **Module** = Rendering logic + validation
- **Props** = Data stored in `post_modules.props` (JSONB)
- **Registry** = Central module discovery
- **SSR** = Server-side HTML generation
- **i18n** = Automatic locale-aware rendering
