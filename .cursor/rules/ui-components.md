# UI & Component Guidelines

## Notifications

### Always Use Sonner for Toasts
**Official Docs:** https://sonner.emilkowal.ski/

- ✅ Use `toast.success()` for successful operations
- ✅ Use `toast.error()` for errors and validation failures
- ✅ Use `toast.info()` for informational messages
- ✅ Use `toast.warning()` for warnings
- ✅ Use `toast.promise()` for async operations
- ✅ Use `toast()` with options for rich toasts (description, actions)
- ❌ Don't use alert() or console.log() for user notifications
- ❌ Don't create custom toast components

**Examples:**
```tsx
import { toast } from 'sonner'

// Basic toast
toast('Event has been created')

// Success/Error/Info/Warning
toast.success('Post updated successfully')
toast.error('Failed to update post')
toast.info('New updates available')
toast.warning('Unsaved changes')

// With description
toast('Post published', {
  description: 'Your post is now visible to everyone',
})

// With action button
toast('Post deleted', {
  action: {
    label: 'Undo',
    onClick: () => console.log('Undo'),
  },
})

// Promise-based (auto loading/success/error)
toast.promise(
  updatePost(id, data),
  {
    loading: 'Saving...',
    success: 'Post saved!',
    error: 'Failed to save post',
  }
)

// With Inertia forms
put('/api/posts/1', {
  onSuccess: () => toast.success('Post updated'),
  onError: (errors) => toast.error(Object.values(errors)[0]),
})
```

**Features Enabled:**
- ✅ Rich colors (colored backgrounds for success/error/etc.)
- ✅ Close button (manual dismissal)
- ✅ Auto-dismiss after ~4 seconds
- ✅ Dark mode support
- ✅ Position: bottom-right
- ✅ Custom icons (via Lucide React)

**Setup:** The `<Toaster />` component is already added to the admin app layout (`inertia/admin/app.tsx`). No additional setup needed.

## Styling

### Always Use Tailwind CSS
- ✅ Use Tailwind utility classes for all styling
- ✅ Leverage Tailwind's responsive modifiers (sm:, md:, lg:, etc.)
- ✅ Use Tailwind's color palette and spacing system
- ✅ Use ShadCN UI for form and UI primitives where appropriate
- ✅ Use Tailwind's `class` strategy for dark/light mode toggling (persist per user)
- ❌ Don't write custom CSS unless absolutely necessary
- ❌ Don't use inline styles or styled-components

**Example:**
```tsx
// ✅ Good: Tailwind classes
<div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
  <h2 className="text-2xl font-bold text-gray-900 mb-4">Title</h2>
</div>

// ❌ Bad: Inline styles or custom CSS
<div style={{ backgroundColor: 'white', padding: '24px' }}>
  <h2 className="custom-heading">Title</h2>
</div>
```

## Import Aliases (if configured)

Use TypeScript path aliases for clean imports when available. Do not assume any specific alias (like `~/`). If aliases are not configured yet, use relative imports.

```tsx
// ✅ Good: Clean alias (example with 'src' alias)
import Button from 'src/components/ui/Button'

// ❌ Bad: Relative paths
import Button from '../../../components/ui/Button'
```