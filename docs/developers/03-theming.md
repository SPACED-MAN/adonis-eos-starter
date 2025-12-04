# Theming System

A centralized design system that lets you customize all colors across the admin panel and public site with minimal configuration. Changes apply automatically to all components including Sonner toasts, forms, cards, and more.

## Quick Start

### Customizing Colors

Edit `config/theme.ts`:

```typescript
export const themeConfig = {
  admin: {
    primary: {
      light: 'indigo',   // Change to 'blue', 'violet', 'emerald', etc.
      dark: 'indigo',
    },
    background: {
      light: 'slate',    // Change to 'gray', 'zinc', 'stone', etc.
      dark: 'slate',
    },
    neutral: {
      light: 'slate',    // For text/borders
      dark: 'slate',
    },
  },
  site: {
    primary: {
      light: 'violet',   // Different from admin!
      dark: 'violet',
    },
    background: {
      light: 'stone',
      dark: 'stone',
    },
    neutral: {
      light: 'stone',
      dark: 'stone',
    },
  },
}
```

**Available Colors:**
`slate`, `gray`, `zinc`, `neutral`, `stone`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `emerald`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`, `fuchsia`, `pink`, `rose`

### What Gets Themed?

✅ All admin pages (dashboard, post editor, etc.)
✅ All site pages (homepage, post views, etc.)
✅ Sonner toast notifications
✅ All form components
✅ Cards, modals, dialogs
✅ Buttons and links
✅ Borders and dividers
✅ Automatically adapts to light/dark mode

## How It Works

### 1. Theme Detection

URL-based automatic detection:
- `/admin/*` → Admin theme (indigo + slate by default)
- Everything else → Site theme (violet + stone by default)

### 2. CSS Variables

Themes defined in `inertia/css/app.css`:

```css
[data-theme="admin"] {
  --color-standout: var(--color-indigo-600);
  --color-neutral-high: var(--color-slate-900);
  --color-backdrop-low: var(--color-slate-50);
}

[data-theme="site"] {
  --color-standout: var(--color-violet-600);
  --color-neutral-high: var(--color-stone-900);
  --color-backdrop-low: var(--color-stone-50);
}
```

### 3. Tailwind Integration

Use the named color tokens:
- `bg-standout`, `text-on-standout`
- `text-neutral-{low|medium|high}`
- `bg-backdrop-{low|medium|high}`
- `border-line`

Adonis EOS uses a design token system built on Tailwind CSS for consistent, customizable theming.

## Design System

The theme is defined in `inertia/css/app.css` using CSS custom properties.

### Color Tokens

#### Semantic Colors

```css
--backdrop-low      /* Light backgrounds */
--backdrop-medium   /* Medium backgrounds */
--backdrop-high     /* Elevated surfaces */
--line             /* Borders and dividers */

--neutral-low      /* Subtle text */
--neutral-medium   /* Body text */
--neutral-high     /* Headings */

--standout         /* Primary actions */
--on-standout      /* Text on standout */

--accent           /* Secondary actions */
--on-accent        /* Text on accent */
```

#### Usage

These tokens are available as Tailwind classes:

```jsx
<div className="bg-backdrop-low border-line">
  <h1 className="text-neutral-high">Heading</h1>
  <p className="text-neutral-medium">Body text</p>
  <button className="bg-standout text-on-standout">
    Action
  </button>
</div>
```

### Dark Mode

Dark mode is automatically handled via CSS custom properties. The system adapts based on `prefers-color-scheme`.

#### Media Variants

Images can have separate dark mode versions:

```bash
# Upload base image
demo-logo.png

# Generate dark variant (automatically tinted)
POST /api/media/:id/variants { "theme": "dark" }

# Override with custom dark image
POST /api/media/:id/override { "theme": "dark", file: ... }
```

Configure dark mode adjustments:

```env
# .env
MEDIA_DARK_BRIGHTNESS=0.8  # 0-1, lower = darker
MEDIA_DARK_SATURATION=0.7  # 0-1, lower = desaturated
```

### Typography

Font configuration in `tailwind.config.ts`:

```js
theme: {
  extend: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      serif: ['Georgia', 'serif'],
      mono: ['Monaco', 'monospace']
    }
  }
}
```

Use in components:

```jsx
<h1 className="font-sans">Sans-serif heading</h1>
<blockquote className="font-serif">Serif quote</blockquote>
<code className="font-mono">Monospace code</code>
```

### Spacing

Consistent spacing scale:

- `p-2` - 0.5rem (8px)
- `p-4` - 1rem (16px)
- `p-6` - 1.5rem (24px)
- `p-8` - 2rem (32px)
- `p-12` - 3rem (48px)

### Breakpoints

Responsive design breakpoints:

- `sm:` - 640px (mobile)
- `md:` - 768px (tablet)
- `lg:` - 1024px (desktop)
- `xl:` - 1280px (large desktop)
- `2xl:` - 1536px (extra large)

## Customizing Themes

### 1. Update CSS Variables

Edit `inertia/css/app.css`:

```css
:root {
  --standout: 220 90% 56%;  /* HSL values */
  --on-standout: 0 0% 100%;
}

@media (prefers-color-scheme: dark) {
  :root {
    --standout: 220 85% 65%;
    --on-standout: 220 20% 10%;
  }
}
```

### 2. Extend Tailwind Config

Add custom utilities in `tailwind.config.ts`:

```js
theme: {
  extend: {
    colors: {
      brand: {
        primary: 'hsl(var(--standout))',
        secondary: 'hsl(var(--accent))'
      }
    }
  }
}
```

### 3. Module Background Options

Modules support background customization:

```json
{
  "props": {
    "backgroundColor": "bg-backdrop-medium"
  }
}
```

Available options:
- `bg-backdrop-low` (default)
- `bg-backdrop-medium`
- `bg-backdrop-high`
- `bg-transparent`

## Logo Management

Upload light and dark logos in `/admin/settings`:

- **Light Logo**: Used in light mode
- **Dark Logo**: Used in dark mode

Logos are automatically swapped based on theme.

## Best Practices

1. **Use semantic tokens** instead of hardcoded colors
2. **Test both themes** when building custom components
3. **Provide fallbacks** for older browsers
4. **Optimize images** for both light and dark modes
5. **Maintain contrast** for accessibility (WCAG AA)

## Using Themes in Components

```tsx
// ✅ DO: Use the simplified tokens (Tailwind color names backed by CSS vars)
<div className="bg-backdrop-low border border-line rounded">
  <h1 className="text-neutral-high">Title</h1>
  <p className="text-neutral-low">Description</p>
  <button className="bg-standout text-on-standout rounded px-3 py-2">
    Click Me
  </button>
</div>

// ❌ DON'T: Hardcode specific colors or numbered classes
<div className="bg-slate-50 text-slate-900">
  <button className="bg-indigo-600">Click</button>
</div>
```

## Testing Themes

```bash
# 1. View admin theme
http://localhost:3333/admin

# 2. View site theme  
http://localhost:3333/

# 3. Toggle dark mode (browser console)
localStorage.setItem('theme-mode', 'dark')
location.reload()

localStorage.setItem('theme-mode', 'light')
location.reload()
```

## Current Default Theme

**Admin:** Professional, clean (Indigo + Slate)
**Site:** Brand-focused, elegant (Violet + Stone)

Both support automatic light/dark mode and can be changed instantly by editing one file!

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [CSS Custom Properties (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)
- Advanced theming rules: `.cursor/rules/theming.md`



