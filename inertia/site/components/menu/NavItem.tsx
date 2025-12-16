import type { TreeNode } from './types'
import { MenuItemLink } from './MenuItemLink'
import { MegaMenuPanel } from './MegaMenuPanel'

export function NavItem({
  node,
  menuMeta,
}: {
  node: TreeNode
  menuMeta?: Record<string, any> | null
}) {
  const hasSection = node.children.some((c) => c.kind === 'section')
  return (
    <div className="group relative">
      <MenuItemLink item={node} />
      {node.children.length > 0 && (
        <div className="absolute left-0 top-full mt-2 hidden group-hover:block">
          {hasSection ? (
            <MegaMenuPanel parent={node} menuMeta={menuMeta} />
          ) : (
            <div className="rounded-md border border-line-low bg-backdrop-input shadow-md p-4 min-w-[320px]">
              <div className="grid grid-cols-1 gap-2">
                {node.children.map((c) => (
                  <MenuItemLink key={c.id} item={c} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
