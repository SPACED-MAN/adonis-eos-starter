import type { TreeNode } from './types'
import { NavItem } from './NavItem'

export function NavBar({ nodes, menuMeta, menuName }: { nodes: TreeNode[]; menuMeta?: Record<string, any> | null; menuName?: string }) {
  return (
    <header className="border-b border-line">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <a href="/" className="text-neutral-high font-semibold">{menuName || 'Site'}</a>
        <nav className="flex items-center gap-6">
          {nodes.map((n) => (
            <NavItem key={n.id} node={n} menuMeta={menuMeta} />
          ))}
        </nav>
      </div>
    </header>
  )
}


