import type { MenuItem } from './types'

export function MenuItemLink({ item, className }: { item: MenuItem; className?: string }) {
  const href = item.type === 'custom' ? (item.customUrl || '#') : (item.postId ? `/posts/${item.postId}` : '#')
  return (
    <a
      href={href}
      target={item.target || undefined}
      rel={item.rel || undefined}
      className={className || 'text-sm text-neutral-high hover:text-standout'}
    >
      {item.label}
    </a>
  )
}


