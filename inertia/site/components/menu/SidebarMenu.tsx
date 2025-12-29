import { Link } from '@inertiajs/react'
import type { TreeNode } from './types'

interface SidebarMenuProps {
  nodes: TreeNode[]
  currentPageId?: string
  title?: string
}

/**
 * Renders a vertical sidebar menu with hierarchical items
 * Used for documentation navigation, etc.
 */
export function SidebarMenu({ nodes = [], currentPageId, title }: SidebarMenuProps) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return null
  }

  const renderItem = (node: TreeNode, depth: number = 0): React.ReactNode => {
    const paddingLeft = 12 + depth * 16
    const isCurrent = node.id === currentPageId
    const hasChildren = node.children && node.children.length > 0

    return (
      <div key={node.id}>
        <Link
          href={node.customUrl || node.url || '#'}
          className={`block py-3 px-3 rounded text-xs transition-colors min-h-[48px] flex items-center ${
            isCurrent
              ? 'bg-standout-medium text-on-high font-medium'
              : 'text-neutral-high hover:bg-backdrop-medium'
          }`}
          style={{ paddingLeft: `${paddingLeft}px` }}
        >
          {node.label}
        </Link>
        {hasChildren && <div>{node.children.map((child) => renderItem(child, depth + 1))}</div>}
      </div>
    )
  }

  return (
    <nav className="border border-line-low rounded-lg p-4 bg-backdrop-low lg:top-8">
      <div className="space-y-1">{nodes.map((node) => renderItem(node, 0))}</div>
    </nav>
  )
}
