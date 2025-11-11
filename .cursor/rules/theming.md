# Theming & Design System

## Overview

The project uses a centralized theming system with CSS custom properties and Tailwind. This allows minimal configuration to change the entire color palette for both admin and site contexts.

**Key Features:**
- ✅ Separate themes for Admin Panel and Public Site
- ✅ Automatic dark/light mode support
- ✅ All colors configurable via Tailwind color names
- ✅ Zero runtime overhead (all CSS variables)
- ✅ Follows industry best practices (ShadCN approach)

## Quick Start

### Changing Theme Colors

**File:** `config/theme.ts`

```typescript
export const themeConfig = {
  admin: {
    primary: {
      light: 'indigo',  // Change this!
      dark: 'indigo',
    },
    background: {
      light: 'slate',   // Change this!
      dark: 'slate',
    },
    // ...
  },
  site: {
    primary: {
      light: 'violet',  // Change this!
      dark: 'violet',
    },
    // ...
  },
}
```

**Available Colors:**
- `slate`, `gray`, `zinc`, `neutral`, `stone`
- `red`, `orange`, `amber`, `yellow`
- `lime`, `green`, `emerald`, `teal`, `cyan`
- `sky`, `blue`, `indigo`, `violet`, `purple`
- `fuchsia`, `pink`, `rose`

After changing colors, update the CSS variables in `inertia/css/app.css` to match.

## Using Theme Tokens in Components

### ✅ DO: Use Semantic Tokens

```tsx
// Background colors
<div className="bg-white dark:bg-bg-800" />
<div className="bg-bg-50 dark:bg-bg-900" />

// Text colors
<p className="text-neutral-900 dark:text-neutral-50" />
<p className="text-neutral-600 dark:text-neutral-400" />

// Borders
<div className="border border-neutral-200 dark:border-neutral-700" />

// Primary/Brand colors
<button className="bg-primary-600 hover:bg-primary-700 text-white" />
<div className="text-primary-600 dark:text-primary-400" />

// Semantic colors
<div className="text-success" />  // Green
<div className="text-error" />    // Red
<div className="text-warning" />  // Amber
<div className="text-info" />     // Blue
```

### ❌ DON'T: Hardcode Specific Colors

```tsx
// ❌ Bad: Hardcoded slate colors
<div className="bg-slate-50 text-slate-900" />

// ❌ Bad: Won't adapt to theme changes
<div className="bg-indigo-600" />

// ❌ Bad: Not context-aware
<div className="bg-gray-100" />
```

## Theme Token Reference

### Background Tokens
- `bg-50`, `bg-100`, `bg-200` - Light backgrounds (cards, panels)
- `bg-800`, `bg-900`, `bg-950` - Dark backgrounds
- Use with `dark:` modifier for dark mode

### Neutral Tokens (Text & Borders)
- `neutral-50` to `neutral-950` - Full scale
- Common patterns:
  - Body text: `text-neutral-900 dark:text-neutral-50`
  - Muted text: `text-neutral-600 dark:text-neutral-400`
  - Borders: `border-neutral-200 dark:border-neutral-700`

### Primary Tokens (Brand Colors)
- `primary-50` to `primary-950` - Full scale
- Use for CTAs, links, active states
- Example: `bg-primary-600 hover:bg-primary-700`

### Semantic Tokens
- `success` - Green (emerald-500)
- `error` - Red (red-500)
- `warning` - Amber (amber-500)
- `info` - Blue (blue-500)

## How It Works

### 1. CSS Variables
Theme colors are defined in `inertia/css/app.css`:

```css
[data-theme="admin"] {
  --color-primary-600: var(--color-indigo-600);
  --color-neutral-900: var(--color-slate-900);
  /* ... */
}

[data-theme="site"] {
  --color-primary-600: var(--color-violet-600);
  --color-neutral-900: var(--color-stone-900);
  /* ... */
}
```

### 2. Automatic Theme Detection
The `data-theme` attribute is automatically applied based on URL:
- `/admin/*` → `data-theme="admin"`
- Everything else → `data-theme="site"`

This happens in `resources/views/inertia_layout.edge` before page render.

### 3. Dark Mode
Dark mode is controlled by:
1. User preference (stored in `localStorage.theme-mode`)
2. System preference (if no user preference set)

The `.dark` class is added to `<html>` element automatically.

## Examples

### Button Component

```tsx
// Primary button
<button className="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white">
  Save
</button>

// Secondary button
<button className="bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-50">
  Cancel
</button>
```

### Card Component

```tsx
<div className="bg-white dark:bg-bg-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6">
  <h3 className="text-neutral-900 dark:text-neutral-50 font-semibold">
    Card Title
  </h3>
  <p className="text-neutral-600 dark:text-neutral-400 mt-2">
    Card description
  </p>
</div>
```

### Alert Component

```tsx
// Success alert
<div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-50">
  Success message
</div>

// Error alert
<div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-50">
  Error message
</div>
```

## Migration Guide

### Converting Existing Components

If you have existing components using hardcoded colors:

```tsx
// ❌ Before
<div className="bg-slate-50 text-slate-900 border-slate-200">

// ✅ After
<div className="bg-bg-50 dark:bg-bg-900 text-neutral-900 dark:text-neutral-50 border-neutral-200 dark:border-neutral-700">
```

### Common Patterns

| Old Pattern | New Pattern |
|------------|-------------|
| `bg-slate-50` | `bg-bg-50 dark:bg-bg-900` |
| `bg-slate-900` | `bg-bg-900 dark:bg-bg-50` |
| `text-slate-900` | `text-neutral-900 dark:text-neutral-50` |
| `text-slate-600` | `text-neutral-600 dark:text-neutral-400` |
| `border-slate-200` | `border-neutral-200 dark:border-neutral-700` |
| `bg-indigo-600` | `bg-primary-600` |

## Testing Themes

### Test Light/Dark Mode

```bash
# In browser console:
# Switch to dark mode
localStorage.setItem('theme-mode', 'dark')
location.reload()

# Switch to light mode
localStorage.setItem('theme-mode', 'light')
location.reload()

# Use system preference
localStorage.removeItem('theme-mode')
location.reload()
```

### Test Admin vs Site Theme

```bash
# View admin theme
http://localhost:3333/admin

# View site theme
http://localhost:3333/
```

You should see different colors automatically applied!

## Best Practices

1. **Always use semantic tokens** - Never hardcode specific color names
2. **Always include dark mode variant** - Use `dark:` modifier on all color classes
3. **Test both contexts** - Check your components in both admin and site
4. **Test both modes** - Verify light and dark modes work correctly
5. **Follow Tailwind conventions** - Use Tailwind's responsive/state modifiers

## Related Files

- `config/theme.ts` - Theme configuration (edit this to change colors)
- `inertia/css/app.css` - CSS variable definitions (regenerate after config changes)
- `resources/views/inertia_layout.edge` - Theme detection script
- `.cursor/rules/ui-components.md` - UI component guidelines



