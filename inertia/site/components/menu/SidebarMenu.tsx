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
					className={`block py-2 rounded text-sm transition-colors ${isCurrent
						? 'bg-standout text-on-standout font-medium'
						: 'text-neutral-medium hover:bg-backdrop-medium hover:text-neutral-high'
						}`}
					style={{ paddingLeft: `${paddingLeft}px` }}
				>
					{node.label}
				</Link>
				{hasChildren && (
					<div>
						{node.children.map((child) => renderItem(child, depth + 1))}
					</div>
				)}
			</div>
		)
	}

	return (
		<nav className="sticky top-8 border border-line rounded-lg p-4 bg-backdrop-low">
			<div className="space-y-1">
				{nodes.map((node) => renderItem(node, 0))}
			</div>
		</nav>
	)
}

