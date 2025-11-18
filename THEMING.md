# 🎨 Theme System - Quick Start

## What Is It?

A centralized design system that lets you customize all colors across the admin panel and public site with minimal configuration. Changes apply automatically to all components including Sonner, forms, cards, etc.

## How To Customize

**Edit `config/theme.ts`:**

```typescript
export const themeConfig = {
  admin: {
    primary: {
      light: 'indigo',   // 👈 Change to 'blue', 'violet', 'emerald', etc.
      dark: 'indigo',
    },
    background: {
      light: 'slate',    // 👈 Change to 'gray', 'zinc', 'stone', etc.
      dark: 'slate',
    },
    neutral: {
      light: 'slate',    // 👈 For text/borders
      dark: 'slate',
    },
  },
  site: {
    primary: {
      light: 'violet',   // 👈 Different from admin!
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

## What Gets Themed?

✅ All admin pages (dashboard, post editor, etc.)
✅ All site pages (homepage, post views, etc.)
✅ Sonner toast notifications
✅ All form components
✅ Cards, modals, dialogs
✅ Buttons and links
✅ Borders and dividers
✅ Automatically adapts to light/dark mode

## Using In Components

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

## Testing

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

## How It Works

1. **Theme Detection** - URL-based automatic detection:
   - `/admin/*` → Admin theme (indigo + slate)
   - Everything else → Site theme (violet + stone)

2. **CSS Variables** - Themes defined in `inertia/css/app.css`:
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

3. **Tailwind Integration** - Use the named color tokens:
   - `bg-standout`, `text-on-standout`
   - `text-neutral-{low|medium|high}`
   - `bg-backdrop-{low|medium|high}`
   - `border-border`

## Current Theme

**Admin:** Professional, clean (Indigo + Slate)
**Site:** Brand-focused, elegant (Violet + Stone)

Both support automatic light/dark mode and can be changed instantly by editing one file!

---

**Full Documentation:** See `.cursor/rules/theming.md`



