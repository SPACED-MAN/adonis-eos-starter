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
  const [primaryNodes, setPrimaryNodes] = useState<TreeNode[]>([])
  const [supportNodes, setSupportNodes] = useState<TreeNode[]>([])
  const [menuMeta, setMenuMeta] = useState<Record<string, any> | null>(null)
  const [siteTitle, setSiteTitle] = useState<string>('')
  const [logoLightUrl, setLogoLightUrl] = useState<string | null>(null)
  const [logoDarkUrl, setLogoDarkUrl] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        // Primary menu
        const res = await fetch('/api/menus/by-slug/primary?locale=en', { credentials: 'same-origin' })
        const j = await res.json().catch(() => ({}))
        const items: MenuItem[] = Array.isArray(j?.data?.items) ? j.data.items : []
        setPrimaryNodes(buildTree(items))
        setMenuMeta((j?.data?.meta as any) ?? null)
      } catch {
        setPrimaryNodes([])
      }
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        // Optional Support menu
        const res = await fetch('/api/menus/by-slug/support?locale=en', { credentials: 'same-origin' })
        if (!res.ok) return
        const j = await res.json().catch(() => ({}))
        const items: MenuItem[] = Array.isArray(j?.data?.items) ? j.data.items : []
        setSupportNodes(buildTree(items))
      } catch {
        setSupportNodes([])
      }
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/site-settings', { credentials: 'same-origin' })
        const j = await res.json().catch(() => ({}))
        const data: any = j?.data || j
        if (data?.siteTitle) {
          setSiteTitle(String(data.siteTitle))
        }
        const logoLightId: string | null = data?.logoLightMediaId || null
        const logoDarkId: string | null = data?.logoDarkMediaId || null

        const loadLogo = async (id: string | null) => {
          if (!id) return null
          try {
            const res = await fetch(`/api/media/${encodeURIComponent(id)}`, { credentials: 'same-origin' })
            const m = await res.json().catch(() => ({}))
            return m?.data?.url || null
          } catch {
            return null
          }
        }

        if (logoLightId) {
          loadLogo(logoLightId).then((url) => {
            if (url) setLogoLightUrl(url)
          })
        }
        if (logoDarkId) {
          loadLogo(logoDarkId).then((url) => {
            if (url) setLogoDarkUrl(url)
          })
        }
      } catch {
        // ignore
      }
    })()
  }, [])

  return (
    <NavBar
      primaryNodes={primaryNodes}
      supportNodes={supportNodes}
      menuMeta={menuMeta || undefined}
      menuName={siteTitle}
      logoLightUrl={logoLightUrl || undefined}
      logoDarkUrl={logoDarkUrl || undefined}
    />
  )
}


