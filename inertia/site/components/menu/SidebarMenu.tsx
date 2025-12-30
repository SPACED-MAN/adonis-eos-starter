import { Link } from '@inertiajs/react'
import { useState, useEffect, useMemo } from 'react'
import type { TreeNode } from './types'
import { FontAwesomeIcon } from '../../lib/icons'

interface SidebarMenuProps {
  nodes: TreeNode[]
  currentPageId?: string
  title?: string
}

/**
 * Renders a vertical sidebar menu with hierarchical items
 * Used for documentation navigation, etc.
 * Supports collapsible parent sections.
 */
export function SidebarMenu({ nodes = [], currentPageId, title }: SidebarMenuProps) {
  // Track which nodes are expanded
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({})

  const traverseNodes = useMemo(() => {
    const parentMap: Record<string, string> = {}
    const nodesWithChildren = new Set<string>()

    const traverse = (items: TreeNode[], parentId?: string) => {
      items.forEach((item) => {
        if (parentId) {
          parentMap[item.id] = parentId
        }
        if (item.children && item.children.length > 0) {
          nodesWithChildren.add(item.id)
          traverse(item.children, item.id)
        }
      })
    }

    traverse(nodes)

    return {
      getParentIds: (childId: string): string[] => {
        const parents: string[] = []
        let current = childId
        while (parentMap[current]) {
          parents.push(parentMap[current])
          current = parentMap[current]
        }
        return parents
      },
      hasChildren: (id: string) => nodesWithChildren.has(id),
    }
  }, [nodes])

  // Automatically expand parents of the current page (and the page itself if it's a parent) on load
  useEffect(() => {
    if (currentPageId) {
      const parents = traverseNodes.getParentIds(currentPageId)
      setExpandedNodes((prev) => {
        const next = { ...prev }
        parents.forEach((id) => {
          next[id] = true
        })
        // Also expand the current page if it's a parent section
        if (traverseNodes.hasChildren(currentPageId)) {
          next[currentPageId] = true
        }
        return next
      })
    }
  }, [currentPageId, traverseNodes])

  const toggleExpand = (e: React.MouseEvent | undefined, nodeId: string) => {
    if (e) {
      // Don't stop propagation for the link click, only for the dedicated button
      // But we do want to prevent default if it was just the button
      if ((e.target as HTMLElement).closest('button')) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }))
  }

  if (!Array.isArray(nodes) || nodes.length === 0) {
    return null
  }

  const renderItem = (node: TreeNode, depth: number = 0): React.ReactNode => {
    const isCurrent = node.id === currentPageId
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = expandedNodes[node.id] || false

    return (
      <div key={node.id} className="w-full">
        <div className="flex items-center gap-1">
          <Link
            href={node.customUrl || node.url || '#'}
            className={`flex-1 py-1.5 px-3 rounded text-sm transition-colors flex items-center min-h-[32px] ${isCurrent
                ? 'bg-standout-medium text-on-high font-medium'
                : 'text-neutral-high hover:bg-backdrop-medium'
              }`}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
          >
            <span className="truncate">{node.label}</span>
          </Link>

          {hasChildren && (
            <button
              onClick={(e) => toggleExpand(e, node.id)}
              className={`flex shrink-0 items-center justify-center w-8 h-8 rounded hover:bg-backdrop-medium transition-colors ${isExpanded ? 'text-standout-medium' : 'text-neutral-medium'
                }`}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <FontAwesomeIcon
                icon={isExpanded ? 'chevron-down' : 'chevron-right'}
                className="text-[10px]"
              />
            </button>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-0.5">
            {node.children.map((child) => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <nav className="border border-line-low rounded-lg p-1.5 bg-backdrop-low lg:sticky lg:top-8">
      {title && (
        <div className="px-3 py-2 mb-1.5 text-[10px] font-bold text-neutral-medium uppercase tracking-widest border-b border-line-low/50">
          {title}
        </div>
      )}
      <div className="space-y-0.5">{nodes.map((node) => renderItem(node, 0))}</div>
    </nav>
  )
}
