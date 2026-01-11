import { createContext, useContext, useMemo } from 'react'

export type Mode = 'source' | 'review' | 'ai-review'

export type ModuleSeed = {
  id: string
  type: string
  name?: string
  scope?: 'local' | 'global' | 'static'
  globalSlug?: string | null
  globalLabel?: string | null
  adminLabel?: string | null
  props: Record<string, any>
  sourceProps?: Record<string, any>
  sourceOverrides?: Record<string, any>
  reviewProps?: Record<string, any>
  aiReviewProps?: Record<string, any>
  overrides?: Record<string, any> | null
  reviewOverrides?: Record<string, any> | null
  aiReviewOverrides?: Record<string, any> | null
  reviewAdded?: boolean
  aiReviewAdded?: boolean
}

export type InlineEditorContextValue = {
  enabled: boolean
  canEdit: boolean
  toggle: () => void
  postId?: string
  mode: Mode
  setMode: (m: Mode) => void
  getValue: (moduleId: string, path: string, fallback: any) => any
  getModeValue: (moduleId: string, path: string, mode: Mode, fallback: any) => any
  setValue: (moduleId: string, path: string, value: any) => void
  isGlobalModule: (moduleId: string) => boolean
  dirtyModules: Set<string>
  isDirty: boolean
  saveAll: () => Promise<void>
  showDiffs: boolean
  toggleShowDiffs: () => void
  abVariations: Array<{ id: string; variation: string; status: string }>
  modules: ModuleSeed[]
  post?: any
  translations?: any[]
  isSaving: boolean
  availableModes?: { hasSource: boolean; hasReview: boolean; hasAiReview: boolean }
  reorderModules: (newModules: ModuleSeed[]) => void
  addModule: (payload: {
    type: string
    name?: string
    scope: 'post' | 'global'
    globalSlug?: string | null
  }) => void
  removeModule: (moduleId: string) => void
  updateModuleLabel: (moduleId: string, label: string | null) => void
  duplicateModule: (moduleId: string) => void
}

export const InlineEditorContext = createContext<InlineEditorContextValue | null>(null)

export function useInlineEditor() {
  return useContext(InlineEditorContext)
}

/**
 * A lightweight provider for guest users that just renders children
 * and provides static access to modules without any editing logic.
 */
export function StaticInlineEditorProvider({
  children,
  modules,
  postId,
  post,
  translations,
  availableModes,
  abVariations = [],
}: {
  children: React.ReactNode
  modules: ModuleSeed[]
  postId?: string
  post?: any
  translations?: any[]
  availableModes?: { hasSource: boolean; hasReview: boolean; hasAiReview: boolean }
  abVariations?: Array<{ id: string; variation: string; status: string }>
}) {
  const value: InlineEditorContextValue = {
    enabled: false,
    canEdit: false,
    toggle: () => { },
    postId,
    mode: 'source',
    setMode: () => { },
    getValue: (_m: string, _p: string, fallback: any) => fallback,
    getModeValue: (_m: string, _p: string, _mode: Mode, fallback: any) => fallback,
    setValue: () => { },
    isGlobalModule: () => false,
    dirtyModules: new Set(),
    isDirty: false,
    saveAll: async () => { },
    showDiffs: false,
    toggleShowDiffs: () => { },
    abVariations: abVariations || [],
    modules: modules || [],
    post,
    translations,
    isSaving: false,
    availableModes: availableModes || { hasSource: true, hasReview: false, hasAiReview: false },
    reorderModules: () => { },
    addModule: () => { },
    removeModule: () => { },
    updateModuleLabel: () => { },
    duplicateModule: () => { },
  }

  return <InlineEditorContext.Provider value={value}>{children}</InlineEditorContext.Provider>
}

export function useInlineValue(moduleId: string | undefined, path: string, fallback: any) {
  const ctx = useContext(InlineEditorContext)
  if (!ctx || !moduleId) return fallback
  return ctx.getValue(moduleId, path, fallback)
}

/**
 * Returns field value, enabled state, and common data-inline props.
 */
export function useInlineField(moduleId: string | undefined, path: string, fallback: any, options: { label?: string; type?: string } = {}) {
  const ctx = useContext(InlineEditorContext)
  const value = (ctx && moduleId) ? ctx.getValue(moduleId, path, fallback) : fallback
  const label = options.label || path
  const type = options.type || 'text'

  return {
    value,
    enabled: ctx?.enabled || false,
    show: !!value || (ctx?.enabled || false),
    props: (ctx?.enabled) ? {
      'data-inline-path': path,
      'data-inline-type': type,
      'data-inline-label': label,
    } as any : {}
  }
}
