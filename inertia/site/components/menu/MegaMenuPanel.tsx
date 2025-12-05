import type { TreeNode } from './types'
import { MenuItemLink } from './MenuItemLink'

export function MegaMenuPanel({ parent, menuMeta }: { parent: TreeNode; menuMeta?: Record<string, any> | null }) {
  return (
    <div className="rounded-md border border-line-low bg-backdrop-input shadow-md p-5 w-[800px]">
      {(menuMeta?.tagline || (menuMeta?.ctaText && menuMeta?.ctaUrl)) && (
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-neutral-medium">{menuMeta?.tagline || ''}</div>
          {menuMeta?.ctaText && menuMeta?.ctaUrl && (
            <a href={String(menuMeta.ctaUrl)} className="px-3 py-1.5 text-xs rounded bg-standout text-on-standout">
              {String(menuMeta.ctaText)}
            </a>
          )}
        </div>
      )}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          {parent.children.filter((c) => c.kind === 'section').map((sec) => (
            <div key={sec.id}>
              <div className="text-xs text-neutral-medium font-semibold mb-2">{sec.label}</div>
              <div className="grid grid-cols-2 gap-2">
                {sec.children.map((gc) => (
                  <MenuItemLink key={gc.id} item={gc} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="col-span-1">
          <div className="text-xs text-neutral-medium font-semibold mb-2">Quick links</div>
          <div className="grid gap-2">
            {parent.children.filter((c) => c.kind !== 'section').map((c) => (
              <MenuItemLink key={c.id} item={c} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}


