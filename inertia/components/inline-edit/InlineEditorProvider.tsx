import {
  useMemo,
  useState,
  type ReactNode,
  useCallback,
  useEffect,
} from 'react'
import { usePage, router } from '@inertiajs/react'
import { toast } from 'sonner'
import { TokenService } from '../../lib/tokens'
import { bypassUnsavedChanges } from '~/hooks/unsavedChangesState'
import { useUnsavedChanges } from '~/hooks/useUnsavedChanges'
import {
  InlineEditorContext,
  type Mode,
  type ModuleSeed,
  type InlineEditorContextValue
} from './InlineEditorContext'

type DraftPatch = Record<string, any> // path -> value

function getAtPath(obj: any, path: string, fallback?: any) {
  if (!obj) return fallback
  const parts = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
  let cur = obj
  for (const p of parts) {
    if (cur && (Object.prototype.hasOwnProperty.call(cur, p) || (Array.isArray(cur) && p in cur))) {
      cur = cur[p]
    } else {
      return fallback
    }
  }
  return cur === undefined ? fallback : cur
}

function setAtPath(obj: any, path: string, value: any) {
  if (!obj || typeof obj !== 'object') return
  const parts = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    const nextPart = parts[i + 1]
    const isNextNumeric = /^\d+$/.test(nextPart)
    if (!cur[p] || typeof cur[p] !== 'object') {
      cur[p] = isNextNumeric ? [] : {}
    }
    cur = cur[p]
  }
  const lastPart = parts[parts.length - 1]
  cur[lastPart] = value
}

export function InlineEditorProvider({
  children,
  postId,
  modules,
  post,
  translations,
  customFields,
  abVariations = [],
  availableModes: availableModesProp,
}: {
  children: ReactNode
  postId: string
  modules: ModuleSeed[]
  post?: any
  translations?: any[]
  customFields?: Record<string, any>
  abVariations?: Array<{ id: string; variation: string; status: string }>
  availableModes?: {
    hasSource: boolean
    hasReview: boolean
    hasAiReview: boolean
  }
}) {
  const page = usePage()
  const siteSettings = (page.props as any)?.siteSettings || {}
  const permissions: string[] = (page.props as any)?.permissions || []
  const canEdit = permissions.includes('posts.edit')
  const [enabled, setEnabled] = useState(false)
  const [mode, setMode] = useState<Mode>('source')

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (enabled && canEdit) {
      document.body.classList.add('inline-editor-enabled')
    } else {
      document.body.classList.remove('inline-editor-enabled')
    }
  }, [enabled, canEdit])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const v = params.get('view')
      if (v === 'review' || v === 'ai-review' || v === 'source') {
        setMode(v as Mode)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handlePopState = () => {
        const params = new URLSearchParams(window.location.search)
        const v = params.get('view')
        if (v === 'review' || v === 'ai-review' || v === 'source') {
          setMode(v as Mode)
        } else {
          setMode('source')
        }
      }
      window.addEventListener('popstate', handlePopState)
      return () => window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const setModeWithUrl = useCallback((m: Mode) => {
    setMode(m)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (url.searchParams.get('view') !== m) {
        url.searchParams.set('view', m)
        window.history.pushState({}, '', url.toString())
        router.reload()
      }
    }
  }, [])

  const [drafts, setDrafts] = useState<Record<string, DraftPatch>>({})
  const [dirtyModules, setDirtyModules] = useState<Set<string>>(new Set())
  const [showDiffs, setShowDiffs] = useState(false)
  const [localModules, setLocalModules] = useState<ModuleSeed[]>(modules)
  const [isStructuralDirty, setIsStructuralDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingNewModules, setPendingNewModules] = useState<any[]>([])
  const [pendingRemoved, setPendingRemoved] = useState<Set<string>>(new Set())

  useEffect(() => {
    const currentMembership = [...localModules].map(m => m.id).sort().join(',')
    const newMembership = [...modules].map(m => m.id).sort().join(',')
    const membershipChanged = currentMembership !== newMembership
    if (membershipChanged || !isStructuralDirty) {
      setLocalModules(modules)
      setIsStructuralDirty(false)
      setPendingNewModules([])
      setPendingRemoved(new Set())
    }
  }, [modules])

  const moduleMeta = useMemo(() => {
    const map = new Map<string, any>()
    localModules.forEach((m) => map.set(m.id, { scope: m.scope, globalSlug: m.globalSlug, globalLabel: m.globalLabel }))
    return map
  }, [localModules])

  const base = useMemo<Record<string, any>>(() => {
    const out: Record<string, any> = {}
    localModules.forEach((m) => {
      out[m.id] = {
        props: m.props || {},
        sourceProps: m.sourceProps || m.props || {},
        sourceOverrides: m.sourceOverrides || m.overrides || {},
        reviewProps: m.reviewProps || {},
        aiReviewProps: m.aiReviewProps || {},
        overrides: m.overrides || {},
        reviewOverrides: m.reviewOverrides || {},
        aiReviewOverrides: m.aiReviewOverrides || {},
      }
    })
    return out
  }, [localModules])

  const getModeValue = useCallback(
    (moduleId: string, path: string, targetMode: Mode, fallback: any) => {
      const mod = base[moduleId]
      if (!mod) return fallback
      const hasReviewProps = !!(mod.reviewProps && Object.keys(mod.reviewProps).length)
      const hasAiReviewProps = !!(mod.aiReviewProps && Object.keys(mod.aiReviewProps).length)
      const baseProps =
        targetMode === 'source'
          ? mod.sourceProps || mod.props
          : targetMode === 'review'
            ? hasReviewProps
              ? mod.reviewProps
              : mod.sourceProps || mod.props
            : hasAiReviewProps
              ? mod.aiReviewProps
              : mod.sourceProps || mod.props

      const hasReviewOverrides = !!(mod.reviewOverrides && Object.keys(mod.reviewOverrides as any).length > 0)
      const hasAiReviewOverrides = !!(mod.aiReviewOverrides && Object.keys(mod.aiReviewOverrides as any).length > 0)
      const baseOverrides =
        targetMode === 'source'
          ? mod.sourceOverrides || mod.overrides
          : targetMode === 'review'
            ? hasReviewOverrides
              ? mod.reviewOverrides
              : mod.sourceOverrides || mod.overrides
            : hasAiReviewOverrides
              ? mod.aiReviewOverrides
              : mod.sourceOverrides || mod.overrides
      const merged = { ...(baseProps || {}), ...(baseOverrides || {}) }
      return getAtPath(merged, path, fallback)
    },
    [base]
  )

  const getValue = useCallback(
    (moduleId: string, path: string, fallback: any) => {
      const patch = drafts[moduleId] || {}
      if (Object.prototype.hasOwnProperty.call(patch, path)) {
        return patch[path]
      }
      const parentPaths = Object.keys(patch).filter((p) => path.startsWith(p + '.') || path.startsWith(p + '['))
      if (parentPaths.length > 0) {
        parentPaths.sort((a, b) => b.length - a.length)
        const parentPath = parentPaths[0]
        const parentValue = patch[parentPath]
        const relativePath = path.slice(parentPath.length)
        return getAtPath(parentValue, relativePath, fallback)
      }
      let val = getModeValue(moduleId, path, mode, fallback)
      const childPatches = Object.entries(patch).filter(([p]) => p.startsWith(path + '.') || p.startsWith(path + '['))
      if (childPatches.length > 0) {
        try {
          if (val === null || val === undefined) {
            const firstP = childPatches[0][0]
            const remaining = firstP.slice(path.length)
            const isArray = remaining.startsWith('[') || /^\.\d+/.test(remaining)
            val = isArray ? [] : {}
          } else {
            val = JSON.parse(JSON.stringify(val))
          }
          for (const [p, patchVal] of childPatches) {
            const relativePath = p.slice(path.length)
            setAtPath(val, relativePath, patchVal)
          }
        } catch (e) {
          console.warn('Failed to apply child patches to deep value:', e)
        }
      }
      if (!enabled && val && (typeof val === 'string' || typeof val === 'object')) {
        const tokenContext = { post, siteSettings, customFields }
        return TokenService.resolveRecursive(val, tokenContext)
      }
      return val
    },
    [drafts, mode, getModeValue, enabled, post, siteSettings, customFields]
  )

  const isDOMElement = useCallback((val: any): boolean => {
    if (!val || typeof val !== 'object') return false
    if (typeof Element !== 'undefined' && val instanceof Element) return true
    if (typeof HTMLElement !== 'undefined' && val instanceof HTMLElement) return true
    if (val.nodeType !== undefined && typeof val.nodeName === 'string') return true
    for (const k in val) {
      if (k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')) return true
    }
    return false
  }, [])

  const setValue = useCallback(
    (moduleId: string, path: string, value: any) => {
      const meta = moduleMeta.get(moduleId)
      if (meta?.scope === 'static') return
      if (value === null || value === undefined || typeof value !== 'object') {
        setDrafts((prev) => {
          const next = { ...(prev[moduleId] || {}) }
          next[path] = value
          return { ...prev, [moduleId]: next }
        })
        setDirtyModules((prev) => {
          if (prev.has(moduleId)) return prev
          const copy = new Set(prev)
          copy.add(moduleId)
          return copy
        })
        return
      }
      let sanitizedValue: any
      if (isDOMElement(value)) {
        sanitizedValue = (value as any).textContent || (value as any).innerText || (value as any).value || ''
      } else if (value && typeof value === 'object') {
        const preWalkSeen = new WeakSet<object>()
        const cleanDeep = (val: any): any => {
          if (val === null || val === undefined) return val
          if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val
          if (typeof val === 'function') return undefined
          if (isDOMElement(val)) return undefined
          if (typeof val === 'object') {
            if (preWalkSeen.has(val)) return undefined
            preWalkSeen.add(val)
          }
          if (typeof (val as any).toJSON === 'function') {
            try { return cleanDeep((val as any).toJSON()) } catch { }
          }
          if (val instanceof Map) return cleanDeep(Array.from(val.entries()))
          if (val instanceof Set) return cleanDeep(Array.from(val.values()))
          if (Array.isArray(val)) {
            return val.map((item) => cleanDeep(item)).filter((item) => item !== undefined)
          }
          const cleaned: Record<string, any> = {}
          for (const key of Object.keys(val)) {
            if (key.startsWith('__react') || key.startsWith('_react')) continue
            const walked = cleanDeep(val[key])
            if (walked !== undefined) cleaned[key] = walked
          }
          return cleaned
        }
        sanitizedValue = cleanDeep(value)
      } else {
        sanitizedValue = value
      }
      if (sanitizedValue === undefined) return
      setDrafts((prev) => {
        const next = { ...(prev[moduleId] || {}) }
        next[path] = sanitizedValue
        return { ...prev, [moduleId]: next }
      })
      setDirtyModules((prev) => {
        if (prev.has(moduleId)) return prev
        const copy = new Set(prev)
        copy.add(moduleId)
        return copy
      })
    },
    [moduleMeta, isDOMElement]
  )

  const safeJsonClone = useCallback((input: any) => {
    const preWalkSeen = new WeakSet<object>()
    const preWalk = (val: any): any => {
      if (val === null || val === undefined) return val
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val
      if (typeof val === 'function') return undefined
      if (isDOMElement(val)) return undefined
      if (typeof val === 'object') {
        if (preWalkSeen.has(val)) return undefined
        preWalkSeen.add(val)
      }
      if (val && typeof val === 'object' && typeof (val as any).toJSON === 'function') {
        try { return preWalk((val as any).toJSON()) } catch { }
      }
      if (val instanceof Map) return preWalk(Array.from(val.entries()))
      if (val instanceof Set) return preWalk(Array.from(val.values()))
      if (Array.isArray(val)) {
        return val.map((item) => preWalk(item)).filter((item) => item !== undefined)
      }
      const cleaned: Record<string, any> = {}
      for (const key of Object.keys(val)) {
        if (key.startsWith('__react') || key.startsWith('_react')) continue
        const walked = preWalk(val[key])
        if (walked !== undefined) cleaned[key] = walked
      }
      return cleaned
    }
    const stringifySeen = new WeakSet<object>()
    const safeReplacer = (_key: string, val: any): any => {
      if (typeof val === 'function') return undefined
      if (isDOMElement(val)) return undefined
      if (val && typeof val === 'object') {
        if (stringifySeen.has(val)) return undefined
        stringifySeen.add(val)
        const keys = Object.keys(val)
        if (keys.some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'))) return undefined
      }
      return val
    }
    try {
      const cleaned = preWalk(input)
      if (cleaned === undefined) return undefined
      const json = JSON.stringify(cleaned, safeReplacer)
      return json === undefined ? undefined : JSON.parse(json)
    } catch (e) {
      console.error('safeJsonClone error:', e)
      return undefined
    }
  }, [isDOMElement])

  const reorderModules = useCallback((newModules: ModuleSeed[]) => {
    setLocalModules(newModules)
    setIsStructuralDirty(true)
  }, [])

  const addModule = useCallback(
    (payload: { type: string; name?: string; scope: 'post' | 'global'; globalSlug?: string | null }) => {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      const nextOrderIndex = localModules.length
      const newModule: ModuleSeed = {
        id: tempId,
        type: payload.type,
        name: payload.name,
        scope: payload.scope === 'post' ? 'local' : 'global',
        globalSlug: payload.globalSlug || null,
        props: {},
        overrides: null,
      }
      setLocalModules((prev) => [...prev, newModule])
      setPendingNewModules((prev) => [
        ...prev,
        {
          tempId,
          type: payload.type,
          scope: payload.scope === 'post' ? 'local' : 'global',
          globalSlug: payload.globalSlug || null,
          orderIndex: nextOrderIndex,
          props: {},
          overrides: null,
        },
      ])
      setIsStructuralDirty(true)
    },
    [localModules]
  )

  const removeModule = useCallback((moduleId: string) => {
    setLocalModules((prev) => prev.filter((m) => m.id !== moduleId))
    if (!moduleId.startsWith('temp-')) {
      setPendingRemoved((prev) => {
        const next = new Set(prev)
        next.add(moduleId)
        return next
      })
    } else {
      setPendingNewModules((prev) => prev.filter((m) => m.tempId !== moduleId))
    }
    setIsStructuralDirty(true)
  }, [])

  const updateModuleLabel = useCallback((moduleId: string, label: string | null) => {
    setLocalModules((prev) => prev.map((m) => (m.id === moduleId ? { ...m, adminLabel: label } : m)))
    setIsStructuralDirty(true)
  }, [])

  const duplicateModule = useCallback(
    (moduleId: string) => {
      const source = localModules.find((m) => m.id === moduleId)
      if (!source) return
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      const index = localModules.findIndex((m) => m.id === moduleId)
      const cloned: ModuleSeed = {
        ...source,
        id: tempId,
        adminLabel: source.adminLabel ? `${source.adminLabel} (Copy)` : null,
      }
      setLocalModules((prev) => {
        const next = [...prev]
        next.splice(index + 1, 0, cloned)
        return next
      })
      setPendingNewModules((prev) => [
        ...prev,
        {
          tempId,
          type: source.type,
          scope: source.scope === 'global' ? 'global' : 'local',
          globalSlug: source.globalSlug,
          orderIndex: index + 1,
          props: { ...source.props },
          overrides: source.overrides ? { ...source.overrides } : null,
        },
      ])
      setIsStructuralDirty(true)
    },
    [localModules]
  )

  const saveAll = useCallback(
    async (targetMode?: Mode) => {
      if (!enabled || !canEdit) return
      const hasStructuralChanges = isStructuralDirty || pendingNewModules.length > 0 || pendingRemoved.size > 0
      if (dirtyModules.size === 0 && !hasStructuralChanges) return
      setIsSaving(true)
      const saveMode = targetMode || mode
      const xsrf = typeof document !== 'undefined' ? (() => {
        const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
        return m ? decodeURIComponent(m[1]) : undefined
      })() : undefined
      const apiMode = saveMode === 'source' ? 'publish' : (saveMode as any)
      const idMap = new Map<string, string>()
      if (hasStructuralChanges) {
        try {
          for (const pm of pendingNewModules) {
            const res = await fetch(`/api/posts/${postId}/modules`, {
              method: 'POST',
              headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}) },
              credentials: 'same-origin',
              body: JSON.stringify({ moduleType: pm.type, scope: pm.scope, globalSlug: pm.globalSlug, orderIndex: pm.orderIndex, locked: false, props: pm.props || {}, overrides: pm.overrides || null, mode: apiMode }),
            })
            if (res.ok) {
              const json = await res.json().catch(() => ({}))
              const data = json?.data ?? json
              if (data?.postModuleId || data?.id) {
                const realId = String(data.postModuleId || data.id)
                idMap.set(pm.tempId, realId)
              }
            }
          }
          for (const id of Array.from(pendingRemoved)) {
            await fetch(`/api/post-modules/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}) }, credentials: 'same-origin' })
          }
          const modulesWithRealIds = localModules.filter((m) => !pendingRemoved.has(m.id)).map((m) => ({ ...m, id: idMap.get(m.id) || m.id }))
          const updates = modulesWithRealIds.filter((m) => !m.id.startsWith('temp-')).map((m, index) =>
            fetch(`/api/post-modules/${encodeURIComponent(m.id)}`, { method: 'PUT', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}) }, credentials: 'same-origin', body: JSON.stringify({ orderIndex: index, adminLabel: m.adminLabel, mode: apiMode }) })
          )
          await Promise.all(updates)
        } catch (error) {
          console.error('Failed to save structural changes:', error)
          toast.error('Failed to save structural changes')
          setIsSaving(false)
          return
        }
      }
      for (const originalModuleId of Array.from(dirtyModules)) {
        const moduleId = idMap.get(originalModuleId) || originalModuleId
        const patch = drafts[originalModuleId]
        if (!patch || Object.keys(patch).length === 0) continue
        for (const [path, value] of Object.entries(patch)) {
          let finalValue: any
          try {
            const isMediaObject = value && typeof value === 'object' && value.id && value.url && (value.mimeType || value.metadata)
            finalValue = isMediaObject ? value.id : safeJsonClone(value)
          } catch (e) { continue }
          if (finalValue === undefined) continue
          const payload = { path, value: finalValue, mode: saveMode }
          let bodyStr: string
          try {
            const safePayload = safeJsonClone(payload)
            if (!safePayload) continue
            bodyStr = JSON.stringify(safePayload)
          } catch (e) { continue }
          try {
            const res = await fetch(`/api/inline/posts/${postId}/modules/${moduleId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}) }, credentials: 'same-origin', body: bodyStr })
            if (!res.ok) {
              const j = await res.json().catch(() => ({}))
              toast.error(j?.error || 'Failed to save changes')
              return
            }
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to save changes')
            return
          }
        }
      }
      setDrafts({})
      setDirtyModules(new Set())
      setIsStructuralDirty(false)
      setPendingNewModules([])
      setPendingRemoved(new Set())
      setIsSaving(false)
      bypassUnsavedChanges(true)
      router.reload({ preserveScroll: true } as any)
    },
    [enabled, canEdit, isStructuralDirty, pendingNewModules, pendingRemoved, dirtyModules, mode, postId, localModules, drafts, safeJsonClone]
  )

  const saveForReview = useCallback(async () => {
    await saveAll('review')
    bypassUnsavedChanges(true)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('view', 'review')
      router.visit(url.toString(), { preserveScroll: true })
    }
  }, [saveAll])

  const availableModes = useMemo(() => {
    try {
      // If the server provided explicit modes, we use them as the base.
      const base = availableModesProp || {
        hasSource: !!postId,
        hasReview: false,
        hasAiReview: false,
      }

      const canSaveForReview = permissions.includes('posts.review.save')
      const canApproveReview = permissions.includes('posts.review.approve')
      const canApproveAiReview = permissions.includes('posts.ai-review.approve')

      // Local check for modified content in the current localModules set
      const hasReviewModuleContent = (localModules || []).some(
        (m) =>
          (m.reviewProps && Object.keys(m.reviewProps).length > 0) ||
          (m.reviewOverrides && Object.keys(m.reviewOverrides).length > 0) ||
          m.reviewAdded === true
      )
      const hasAiReviewModuleContent = (localModules || []).some(
        (m) =>
          (m.aiReviewProps && Object.keys(m.aiReviewProps).length > 0) ||
          (m.aiReviewOverrides && Object.keys(m.aiReviewOverrides).length > 0) ||
          (m as any).aiReviewAdded === true
      )

      // Check if the server explicitly told us these modes are available
      // We trust availableModesProp if it says true, but we also check locally for staged content.
      const hasReview =
        base.hasReview === true ||
        (((post?.reviewDraft &&
          Object.keys(post.reviewDraft).filter((k) => k !== 'savedAt' && k !== 'savedBy').length >
          0) ||
          hasReviewModuleContent) &&
          (canSaveForReview || canApproveReview))

      const hasAiReview =
        base.hasAiReview === true ||
        (((post?.aiReviewDraft &&
          Object.keys(post.aiReviewDraft).filter((k) => k !== 'savedAt' && k !== 'savedBy').length >
          0) ||
          hasAiReviewModuleContent) &&
          canApproveAiReview)

      const hasSourceModules = (localModules || []).some(
        (m) => !m.reviewAdded && !(m as any).aiReviewAdded
      )
      const hasApprovedFields = !!(
        post?.excerpt ||
        post?.metaTitle ||
        post?.metaDescription ||
        post?.featuredMediaId ||
        (customFields && Object.values(customFields).some((v) => v !== null && v !== ''))
      )

      let hasSource =
        base.hasSource !== false || hasSourceModules || hasApprovedFields || !!post?.id

      // Special case: if it's a new draft with only review content, source might actually be empty
      if (
        hasSource &&
        !hasSourceModules &&
        !hasApprovedFields &&
        (hasReview || hasAiReview) &&
        post?.status === 'draft'
      ) {
        hasSource = false
      }

      return { hasSource, hasReview, hasAiReview }
    } catch (e) {
      console.error('Failed to calculate available modes:', e)
      return availableModesProp || { hasSource: true, hasReview: false, hasAiReview: false }
    }
  }, [localModules, post, customFields, permissions, availableModesProp, postId])

  useEffect(() => {
    if (!availableModes.hasSource && mode === 'source') {
      if (availableModes.hasAiReview) setMode('ai-review')
      else if (availableModes.hasReview) setMode('review')
    }
  }, [availableModes, mode])

  const toggleShowDiffs = useCallback(() => setShowDiffs((v) => !v), [])

  const value = useMemo<InlineEditorContextValue>(
    () => ({
      enabled: enabled && canEdit,
      canEdit,
      postId,
      mode,
      setMode: setModeWithUrl,
      toggle: () => setEnabled((v) => !v),
      getValue,
      getModeValue,
      setValue,
      isGlobalModule: (moduleId: string) => {
        const meta = moduleMeta.get(moduleId)
        if (meta?.scope === 'global' || meta?.scope === 'static' || !!meta?.globalSlug) return true
        return false
      },
      dirtyModules,
      isDirty: dirtyModules.size > 0 || isStructuralDirty || pendingNewModules.length > 0 || pendingRemoved.size > 0,
      saveAll,
      showDiffs,
      toggleShowDiffs,
      abVariations,
      modules: localModules,
      post,
      translations,
      isSaving,
      availableModes,
      reorderModules,
      addModule,
      removeModule,
      updateModuleLabel,
      duplicateModule,
    }),
    [enabled, canEdit, postId, mode, setModeWithUrl, getValue, getModeValue, setValue, moduleMeta, dirtyModules, isStructuralDirty, pendingNewModules, pendingRemoved, saveAll, showDiffs, toggleShowDiffs, abVariations, localModules, post, translations, isSaving, availableModes, reorderModules, addModule, removeModule, updateModuleLabel, duplicateModule]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const state = {
      ...value,
      saveForReview,
      availableModes,
      dirty: value.isDirty // Legacy support for SiteAdminBar
    }
      ; (window as any).__inlineBridge = state
    window.dispatchEvent(new CustomEvent('inline:state', { detail: state }))
  }, [value, saveForReview, availableModes])

  useEffect(() => {
    if (!enabled) {
      setDrafts({})
      setDirtyModules(new Set())
    }
  }, [enabled])

  useUnsavedChanges(value.isDirty)

  console.log('InlineEditorProvider rendering children:', !!children)

  return <InlineEditorContext.Provider value={value}>{children}</InlineEditorContext.Provider>
}
