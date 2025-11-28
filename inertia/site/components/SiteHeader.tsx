import { useEffect, useState } from 'react'
import type { MenuItem, TreeNode } from './menu/types'
import { NavBar } from './menu/NavBar'

function buildTree(items: MenuItem[]): TreeNode[] {
  const idToNode = new Map<string, TreeNode>()
  const roots: TreeNode[] = []
  items.forEach((it) => idToNode.set(it.id, { ...it, children: [] }))
  items.forEach((it) => {
    const node = idToNode.get(it.id)!
    if (it.parentId && idToNode.has(it.parentId)) idToNode.get(it.parentId)!.children.push(node)
    else roots.push(node)
  })
  const sortChildren = (arr: TreeNode[]) => {
    arr.forEach((n) => sortChildren(n.children))
  }
  sortChildren(roots)
  return roots
}

export function SiteHeader() {
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [menuMeta, setMenuMeta] = useState<Record<string, any> | null>(null)
  const [menuName, setMenuName] = useState<string>('Site')
  useEffect(() => {
    ; (async () => {
      try {
        const res = await fetch('/api/menus/by-slug/primary?locale=en', { credentials: 'same-origin' })
        const j = await res.json().catch(() => ({}))
        const items: MenuItem[] = Array.isArray(j?.data?.items) ? j.data.items : []
        setNodes(buildTree(items))
        setMenuMeta((j?.data?.meta as any) ?? null)
        setMenuName(String(j?.data?.name || 'Site'))
      } catch {
        setNodes([])
      }
    })()
  }, [])

  return <NavBar nodes={nodes} menuMeta={menuMeta || undefined} menuName={menuName} />
}


