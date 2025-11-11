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
// ✅ DO: Use semantic tokens
<div className="bg-white dark:bg-bg-800 border border-neutral-200 dark:border-neutral-700">
  <h1 className="text-neutral-900 dark:text-neutral-50">Title</h1>
  <p className="text-neutral-600 dark:text-neutral-400">Description</p>
  <button className="bg-primary-600 hover:bg-primary-700 text-white">
    Click Me
  </button>
</div>

// ❌ DON'T: Hardcode specific colors
<div className="bg-slate-50 text-slate-900">  // Won't adapt to theme changes
  <button className="bg-indigo-600">Click</button>  // Won't work on site
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
     --color-primary-600: var(--color-indigo-600);
   }
   
   [data-theme="site"] {
     --color-primary-600: var(--color-violet-600);
   }
   ```

3. **Tailwind Integration** - Use semantic tokens in your classes:
   - `bg-primary-*` → Theme's primary color
   - `bg-bg-*` → Theme's background colors
   - `text-neutral-*` → Theme's text/border colors

## Current Theme

**Admin:** Professional, clean (Indigo + Slate)
**Site:** Brand-focused, elegant (Violet + Stone)

Both support automatic light/dark mode and can be changed instantly by editing one file!

---

**Full Documentation:** See `.cursor/rules/theming.md`



