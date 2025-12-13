# Building Modules

Modules are the building blocks of content in Adonis EOS. Each module is a reusable component with configurable properties.

## Module Architecture

A module consists of:
1. **Backend Definition** (`app/modules/*.ts`) – schema, configuration, and rendering mode
2. **Frontend Component** (`inertia/modules/*.tsx`) – the UI component (static or React)
3. **Registration** (`start/modules.ts`) – register with the module registry

## Creating a Module

### 1. Generate Boilerplate

```bash
node ace make:module hero-banner
```

This creates:
- `app/modules/hero_banner.ts`
- `inertia/modules/hero-banner.tsx`

### 2. Define Backend Schema & Rendering Mode

Edit `app/modules/hero_banner.ts`:

```typescript
import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

export default class HeroBannerModule extends BaseModule {
  /**
   * Rendering mode:
   * - 'static' (default in BaseModule): pure SSR, no client-side hydration
   * - 'react': SSR + hydration for interactive components
   *
   * Hero banners usually have interactive CTAs and richer behavior,
   * so we opt this module into React rendering explicitly.
   */
  getRenderingMode() {
    return 'react' as const
  }

  getConfig(): ModuleConfig {
    return {
      type: 'hero-banner',
      name: 'Hero Banner',
      description: 'Large hero with image background',
      icon: 'image',
      allowedScopes: ['local', 'global'],
      lockable: true,

      propsSchema: {
        title: {
          type: 'string',
          required: true,
          description: 'Heading text',
          translatable: true,
        },
        subtitle: {
          type: 'textarea',
          required: false,
          description: 'Subheading',
          translatable: true,
        },
        backgroundImage: {
          type: 'media',
          required: false,
          description: 'Background image',
        },
        ctaButton: {
          type: 'object',
          required: false,
          description: 'Call-to-action',
          properties: {
            label: { type: 'string', translatable: true },
            url: { type: 'link' },
          },
        },
      },

      defaultProps: {
        title: 'Welcome',
        subtitle: 'Build amazing content',
        backgroundColor: 'bg-backdrop-low',
      },

      allowedPostTypes: ['page', 'blog'],
    }
  }
}
```

### 3. Build Frontend Component (Single `{type}.tsx` Convention)

The frontend component file **always** matches the module `type`:

- `type: 'hero-banner'` → `inertia/modules/hero-banner.tsx`
- `type: 'prose'` → `inertia/modules/prose.tsx`

We no longer use `-static` suffixes. Whether a module is static or React is controlled entirely by `getRenderingMode()` on the backend.

Edit `inertia/modules/hero-banner.tsx`:

```tsx
interface HeroBannerProps {
  title: string
  subtitle?: string | null
  backgroundImage?: { url: string } | null
  ctaButton?: { label: string; url: string } | null
  backgroundColor?: string
}

export default function HeroBanner({
  title,
  subtitle,
  backgroundImage,
  ctaButton,
  backgroundColor = 'bg-backdrop-low',
}: HeroBannerProps) {
  return (
    <section 
      className={`relative ${backgroundColor} py-24`}
      data-module="hero-banner"
    >
      {backgroundImage && (
        <img 
          src={backgroundImage.url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
      )}
      
      <div className="relative max-w-7xl mx-auto px-4 text-center">
        <h1 className="text-5xl font-bold text-neutral-high mb-4">
          {title}
        </h1>
        
        {subtitle && (
          <p className="text-xl text-neutral-medium mb-8">
            {subtitle}
          </p>
        )}
        
        {ctaButton && (
          <a 
            href={ctaButton.url}
            className="inline-block px-6 py-3 bg-standout text-on-standout rounded-lg hover:bg-standout/90"
          >
            {ctaButton.label}
          </a>
        )}
      </div>
    </section>
  )
}
```

### 4. Registration & Auto-Discovery

#### Frontend auto-discovery (no manual mapping)

Module components in `inertia/modules/*.tsx` are auto-discovered using `import.meta.glob`. As long as you:

- Export a default component from `inertia/modules/{type}.tsx`
- Use the same `type` value in your backend module config

…the system will find and render your component automatically. You **do not** need to touch `inertia/modules/index.ts`.

#### Backend registration

Update `start/modules.ts`:

```typescript
import HeroBannerModule from '#modules/hero_banner'

moduleRegistry.register(new HeroBannerModule())
```

### 5. Restart Server

```bash
# Stop server (Ctrl+C)
npm run dev
```

Your module is now available in the admin!

## Property Types

### Basic Types

```typescript
{
  title: { type: 'string', required: true },
  description: { type: 'textarea', required: false },
  count: { type: 'number', required: false },
  isActive: { type: 'boolean', required: false },
}
```

## Module Groups (Layout Templates)

Module Groups are reusable “page templates” that help editors start from a consistent layout.

### Key files

- Admin controller: `app/controllers/module_groups_controller.ts`
- Models: `app/models/module_group.ts`, `app/models/module_group_module.ts`
- Tables: `module_groups`, `module_group_modules`

### Concepts

- A **module group** contains an ordered list of module types and default props.
- When used to create a post, the system can:
  - create modules in the correct order
  - mark some modules as locked (cannot be removed)

### Developer workflow

- Add/modify allowed modules by updating module definitions and post type config.
- Use the admin UI to curate “starter layouts” for editors.
- When adding new modules, consider updating common module groups.

### Media Type

```typescript
{
  image: {
    type: 'media',
    required: false,
    description: 'Feature image',
  }
}
```

Access in component:

```tsx
{image && <img src={image.url} alt={image.alt_text} />}
```

### Link Type

```typescript
{
  ctaUrl: {
    type: 'link',
    required: false,
  }
}
```

Links can point to:
- External URLs
- Internal posts (by slug)
- Anchors (#section)

### Object Type (Nested)

```typescript
{
  button: {
    type: 'object',
    properties: {
      label: { type: 'string', translatable: true },
      url: { type: 'link' },
      style: { 
        type: 'select',
        options: ['primary', 'secondary', 'outline']
      },
    },
  }
}
```

### Array Type (Repeatable)

```typescript
{
  features: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        icon: { type: 'string' },
        title: { type: 'string', translatable: true },
        description: { type: 'textarea', translatable: true },
      },
    },
  }
}
```

Access in component:

```tsx
{features?.map((feature, i) => (
  <div key={i}>
    <h3>{feature.title}</h3>
    <p>{feature.description}</p>
  </div>
))}
```

## Module Scopes

- **local**: Module is instance-specific to a post
- **global**: Module is reusable across multiple posts

## Advanced Features

### Translatable Props

Mark props as translatable for i18n support:

```typescript
{
  title: {
    type: 'string',
    translatable: true,  // Content varies by locale
  }
}
```

### Post Type Restrictions

Limit module to specific post types:

```typescript
{
  allowedPostTypes: ['blog', 'page'],  // Only for blogs and pages
}
```

### Lockable Modules

Prevent accidental deletion:

```typescript
{
  lockable: true,  // Users can lock critical modules
}
```

## Best Practices

1. **Use semantic HTML** - `<section>`, `<article>`, `<nav>`
2. **Add data attributes** - `data-module="hero-banner"` for testing
3. **Support dark mode** - Use theme tokens
4. **Responsive design** - Mobile-first approach
5. **Accessibility** - ARIA labels, keyboard navigation
6. **Default props** - Provide sensible defaults
7. **Validation** - Mark required fields

## Testing Modules

Test your module in the admin:

1. Go to `/admin/posts`
2. Create or edit a post
3. Click "Add Module"
4. Select your new module
5. Configure props and preview

## Examples

See existing modules in `app/modules/` and `inertia/modules/` for reference implementations.



