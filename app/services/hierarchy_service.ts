import db from '@adonisjs/lucid/services/db'

/**
 * Hierarchy Service
 * 
 * Provides DRY utilities for working with hierarchical data (posts, menus)
 * Handles ordering by order_index and parent-child relationships
 */

export interface HierarchicalItem {
	id: string
	parentId: string | null
	orderIndex: number
	[key: string]: any
}

export interface TreeNode<T extends HierarchicalItem> {
	item: T
	children: TreeNode<T>[]
	depth: number
}

class HierarchyService {
	/**
	 * Build a tree structure from flat hierarchical items
	 * @param items - Flat array of items with id, parentId, orderIndex
	 * @returns Array of root-level tree nodes
	 */
	buildTree<T extends HierarchicalItem>(items: T[]): TreeNode<T>[] {
		// Create a map for quick lookups
		const itemMap = new Map<string, TreeNode<T>>()
		const roots: TreeNode<T>[] = []

		// Initialize all nodes
		for (const item of items) {
			itemMap.set(item.id, {
				item,
				children: [],
				depth: 0,
			})
		}

		// Build parent-child relationships and calculate depth
		for (const item of items) {
			const node = itemMap.get(item.id)!

			if (!item.parentId) {
				// Root node
				roots.push(node)
			} else {
				// Child node
				const parent = itemMap.get(item.parentId)
				if (parent) {
					parent.children.push(node)
					node.depth = parent.depth + 1
				} else {
					// Parent not found, treat as root
					roots.push(node)
				}
			}
		}

		// Sort children by orderIndex at each level
		const sortChildren = (nodes: TreeNode<T>[]) => {
			nodes.sort((a, b) => a.item.orderIndex - b.item.orderIndex)
			for (const node of nodes) {
				if (node.children.length > 0) {
					sortChildren(node.children)
				}
			}
		}

		sortChildren(roots)
		return roots
	}

	/**
	 * Flatten a tree structure into an ordered array
	 * @param tree - Tree nodes
	 * @returns Flat array in hierarchical order
	 */
	flattenTree<T extends HierarchicalItem>(tree: TreeNode<T>[]): T[] {
		const result: T[] = []

		const traverse = (nodes: TreeNode<T>[]) => {
			for (const node of nodes) {
				result.push(node.item)
				if (node.children.length > 0) {
					traverse(node.children)
				}
			}
		}

		traverse(tree)
		return result
	}

	/**
	 * Get posts in hierarchical order
	 * @param options - Query options
	 * @returns Ordered array of posts
	 */
	async getPostsHierarchical(options: {
		type: string
		locale: string
		status?: string
		fields?: string[]
	}): Promise<any[]> {
		const { type, locale, status = 'published', fields = ['*'] } = options

		const query = db
			.from('posts')
			.select(fields)
			.where('type', type)
			.where('locale', locale)
			.where('status', status)
			.orderBy('order_index', 'asc')

		const posts = await query

		// Map to HierarchicalItem interface
		const items: HierarchicalItem[] = posts.map((p) => ({
			...p,
			id: p.id,
			parentId: p.parent_id,
			orderIndex: p.order_index || 0,
		}))

		// Build tree and flatten
		const tree = this.buildTree(items)
		return this.flattenTree(tree)
	}

	/**
	 * Get menu items in hierarchical order
	 * @param menuId - Menu ID
	 * @returns Ordered array of menu items
	 */
	async getMenuItemsHierarchical(menuId: string): Promise<any[]> {
		const items = await db
			.from('menu_items')
			.where('menu_id', menuId)
			.orderBy('order_index', 'asc')

		// Map to HierarchicalItem interface
		const hierarchicalItems: HierarchicalItem[] = items.map((item) => ({
			...item,
			id: item.id,
			parentId: item.parent_id,
			orderIndex: item.order_index || 0,
		}))

		// Build tree and flatten
		const tree = this.buildTree(hierarchicalItems)
		return this.flattenTree(tree)
	}

	/**
	 * Get tree depth for a hierarchical structure
	 * @param items - Flat array of hierarchical items
	 * @returns Maximum depth
	 */
	getMaxDepth<T extends HierarchicalItem>(items: T[]): number {
		const tree = this.buildTree(items)

		let maxDepth = 0
		const traverse = (nodes: TreeNode<T>[]) => {
			for (const node of nodes) {
				if (node.depth > maxDepth) {
					maxDepth = node.depth
				}
				if (node.children.length > 0) {
					traverse(node.children)
				}
			}
		}

		traverse(tree)
		return maxDepth
	}
}

const hierarchyService = new HierarchyService()
export default hierarchyService



