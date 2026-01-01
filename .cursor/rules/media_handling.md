# Media Handling Guidelines

## Overview

The project uses a sophisticated media library that supports automatic optimization (WebP), responsive variants, and **light/dark mode versions** for a single asset. To ensure these features work across the entire application, follow these rules.

## Module Schema Definitions

### 1. Store as ID, Not URL
When defining a `media` field in a module's `fieldSchema`, **always** use `storeAs: 'id'`.

```typescript
// ✅ CORRECT: Stores the UUID. Allows the system to resolve variants and dark mode.
{
  slug: 'image',
  type: 'media',
  label: 'Hero Image',
  config: { storeAs: 'id' }
}

// ❌ INCORRECT: Stores only the URL string. Breaks dark mode and optimization.
{
  slug: 'image',
  type: 'media',
  label: 'Hero Image'
}
```

### 2. Resolution Flow
1.  **Database**: Stores only the media asset UUID.
2.  **Backend**: `PostRenderingService` automatically detects these IDs and resolves them into full `MediaObject` structures before sending data to the frontend.
3.  **Frontend**: Receives a rich object containing `url`, `metadata` (with variants and `darkSourceUrl`), and `mimeType`.

## Frontend Rendering

### 1. Use Shared Components
Never manually build `<img>` tags for media library assets. Use `MediaRenderer` or the `useMediaUrl` hook.

```tsx
// ✅ CORRECT: Automatically handles light/dark mode and optimization
import { MediaRenderer } from './MediaRenderer'

<MediaRenderer 
  image={props.image} 
  variant="wide" 
  className="object-cover" 
/>

// ✅ CORRECT: For background-image or custom logic
import { useMediaUrl } from '~/utils/useMediaUrl'

const url = useMediaUrl(props.image, 'hero')
<div style={{ backgroundImage: `url(${url})` }} />
```

### 2. Light/Dark Mode Logic
The system automatically picks the dark mode version if:
-   The user is in dark mode (detected via `ThemeContext`).
-   The media asset has a variant or source URL marked as "dark" in its metadata.

## Admin & Inline Editing

### 1. Conditional Visibility (showIf)
When fields should only appear based on another field's value (e.g., show "Background Image" only if "Media" theme is selected):

-   **Admin Panel**: The `ModuleEditorPanel` uses a `latestDraft` reference to evaluate `showIf` conditions immediately. Always ensure `onChange` handlers update this reference.
-   **Inline Editor**: Group related conditional fields using `data-inline-type="background"` to provide a unified editing experience.

### 2. Media Preview
If you are building a custom admin field, use `MediaThumb`. It is "UUID-aware" and will automatically fetch the necessary metadata to show a preview (including dark mode) if it receives a raw ID.

## Common Pitfalls

-   **UUID vs URL**: If `useMediaUrl` receives a raw UUID string instead of a resolved object, it returns `null` to prevent broken image links. If you see missing images, check if the backend resolved the ID.
-   **Direct Metadata Access**: Do not rely on `image.metadata.darkSourceUrl` directly. Always use `useMediaUrl` or `pickMediaVariantUrl` as they handle the complex fallback logic (e.g., checking for `-dark` variants first).
-   **Optimization**: Always specify a `variant` (e.g., `thumb`, `wide`) to ensure the browser loads the optimized WebP version rather than the original 10MB upload.

