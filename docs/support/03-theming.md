# Theming

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

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [CSS Custom Properties (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)
- Full theming guide: `THEMING.md` in repository root



