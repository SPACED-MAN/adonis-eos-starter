# UI & Component Guidelines

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