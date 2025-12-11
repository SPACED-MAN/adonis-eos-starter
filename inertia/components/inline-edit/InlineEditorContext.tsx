import {
	createContext,
	useContext,
	useMemo,
	useState,
	type ReactNode,
	useCallback,
	useEffect,
} from 'react'
import { usePage } from '@inertiajs/react'

type Mode = 'approved' | 'review' | 'ai'
type DraftPatch = Record<string, any> // path -> value

function getAtPath(obj: any, path: string, fallback?: any) {
	if (!obj) return fallback
	const parts = path.split('.').filter(Boolean)
	let cur = obj
	for (const p of parts) {
		if (cur && Object.prototype.hasOwnProperty.call(cur, p)) {
			cur = cur[p]
		} else {
			return fallback
		}
	}
	return cur === undefined ? fallback : cur
}

type InlineEditorContextValue = {
	enabled: boolean
	canEdit: boolean
	toggle: () => void
	postId?: string
	mode: Mode
	setMode: (m: Mode) => void
	getValue: (moduleId: string, path: string, fallback: any) => any
	setValue: (moduleId: string, path: string, value: any) => void
	dirtyModules: Set<string>
	saveAll: () => Promise<void>
}

const InlineEditorContext = createContext<InlineEditorContextValue>({
	enabled: false,
	canEdit: false,
	toggle: () => { },
	postId: undefined,
	mode: 'approved',
	setMode: () => { },
	getValue: (_m, _p, f) => f,
	setValue: () => { },
	dirtyModules: new Set(),
	saveAll: async () => { },
})

type ModuleSeed = {
	id: string
	props: Record<string, any>
	reviewProps?: Record<string, any>
	aiReviewProps?: Record<string, any>
	overrides?: Record<string, any>
	reviewOverrides?: Record<string, any>
	aiReviewOverrides?: Record<string, any>
}

export function InlineEditorProvider({
	children,
	postId,
	modules,
}: {
	children: ReactNode
	postId: string
	modules: ModuleSeed[]
}) {
	const page = usePage()
	const permissions: string[] = (page.props as any)?.permissions || []
	const canEdit = permissions.includes('posts.edit')
	const [enabled, setEnabled] = useState(false)
	const [mode, setMode] = useState<Mode>('approved')
	const [drafts, setDrafts] = useState<Record<string, DraftPatch>>({})
	const [dirtyModules, setDirtyModules] = useState<Set<string>>(new Set())

	// seed lookup for original props/overrides across modes
	const [base, setBase] = useState<Record<
		string,
		{
			props: Record<string, any>
			reviewProps?: Record<string, any>
			aiReviewProps?: Record<string, any>
			overrides?: Record<string, any>
			reviewOverrides?: Record<string, any>
			aiReviewOverrides?: Record<string, any>
		}
	>>(() => {
		const out: Record<string, any> = {}
		modules.forEach((m) => {
			out[m.id] = {
				props: m.props || {},
				reviewProps: m.reviewProps || {},
				aiReviewProps: m.aiReviewProps || {},
				overrides: m.overrides || {},
				reviewOverrides: m.reviewOverrides || {},
				aiReviewOverrides: m.aiReviewOverrides || {},
			}
		})
		return out
	})

	const getValue = useCallback(
		(moduleId: string, path: string, fallback: any) => {
			const patch = drafts[moduleId] || {}
			if (Object.prototype.hasOwnProperty.call(patch, path)) {
				return patch[path]
			}
			const mod = base[moduleId]
			if (!mod) return fallback
			const hasReviewProps = !!(mod.reviewProps && Object.keys(mod.reviewProps).length)
			const hasAiReviewProps = !!(mod.aiReviewProps && Object.keys(mod.aiReviewProps).length)
			const baseProps =
				mode === 'approved'
					? mod.props
					: mode === 'review'
						? hasReviewProps
							? mod.reviewProps
							: mod.props
						: hasAiReviewProps
							? mod.aiReviewProps
							: mod.props

			const hasReviewOverrides =
				!!(mod.reviewOverrides && Object.keys(mod.reviewOverrides as any).length > 0)
			const hasAiReviewOverrides =
				!!(mod.aiReviewOverrides && Object.keys(mod.aiReviewOverrides as any).length > 0)
			const baseOverrides =
				mode === 'approved'
					? mod.overrides
					: mode === 'review'
						? hasReviewOverrides
							? mod.reviewOverrides
							: mod.overrides
						: hasAiReviewOverrides
							? mod.aiReviewOverrides
							: mod.overrides
			const merged = { ...(baseProps || {}), ...(baseOverrides || {}) }
			return getAtPath(merged, path, fallback)
		},
		[drafts, base, mode]
	)

	const setValue = useCallback((moduleId: string, path: string, value: any) => {
		setDrafts((prev) => {
			const next = { ...(prev[moduleId] || {}) }
			next[path] = value
			return { ...prev, [moduleId]: next }
		})
		setDirtyModules((prev) => {
			const copy = new Set(prev)
			copy.add(moduleId)
			return copy
		})
	}, [])

	const saveAll = useCallback(async () => {
		if (!enabled || !canEdit || dirtyModules.size === 0) return
		const xsrf =
			typeof document !== 'undefined'
				? (() => {
					const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
					return m ? decodeURIComponent(m[1]) : undefined
				})()
				: undefined

		for (const moduleId of Array.from(dirtyModules)) {
			const patch = drafts[moduleId]
			if (!patch) continue
			const entries = Object.entries(patch)
			for (const [path, value] of entries) {
				const res = await fetch(`/api/inline/posts/${postId}/modules/${moduleId}`, {
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json',
						...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}),
					},
					credentials: 'same-origin',
					body: JSON.stringify({ path, value, mode }),
				})
				if (!res.ok) {
					const j = await res.json().catch(() => ({}))
					// eslint-disable-next-line no-alert
					alert(j?.error || 'Failed to save changes')
					return
				}
				// Apply to base cache so UI reflects without refresh
				setBase((prev) => {
					const mod = prev[moduleId] || {
						props: {},
						reviewProps: {},
						aiReviewProps: {},
						overrides: {},
						reviewOverrides: {},
						aiReviewOverrides: {},
					}
					const clone = { ...mod }
					const target =
						mode === 'approved'
							? 'props'
							: mode === 'review'
								? 'reviewProps'
								: 'aiReviewProps'
					const baseTarget = (clone as any)[target]
					const nextObj =
						baseTarget && typeof baseTarget === 'object'
							? { ...baseTarget }
							: {}
					const parts = path.split('.').filter(Boolean)
					let cur = nextObj
					for (let i = 0; i < parts.length - 1; i++) {
						const p = parts[i]!
						if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {}
						cur = cur[p]
					}
					cur[parts[parts.length - 1]!] = value
						; (clone as any)[target] = nextObj
					return { ...prev, [moduleId]: clone }
				})
			}
		}
		// on success, clear drafts/dirties
		setDrafts({})
		setDirtyModules(new Set())
	}, [canEdit, dirtyModules, drafts, enabled, mode, postId])

	const value = useMemo<InlineEditorContextValue>(
		() => ({
			enabled: enabled && canEdit,
			canEdit,
			postId,
			mode,
			setMode,
			toggle: () => setEnabled((v) => !v),
			getValue,
			setValue,
			dirtyModules,
			saveAll,
		}),
		[enabled, canEdit, postId, mode, getValue, setValue, dirtyModules, saveAll]
	)

	// publish bridge state for SiteAdminBar
	useEffect(() => {
		publishInlineBridge({
			enabled: value.enabled,
			canEdit: value.canEdit,
			mode: value.mode,
			toggle: value.toggle,
			setMode: value.setMode,
			dirty: dirtyModules.size > 0,
			saveAll: value.saveAll,
		})
	}, [value.enabled, value.canEdit, value.mode, value.toggle, value.setMode, value.saveAll, dirtyModules])

	// Clear drafts when disabling
	useEffect(() => {
		if (!enabled) {
			setDrafts({})
			setDirtyModules(new Set())
		}
	}, [enabled])

	return <InlineEditorContext.Provider value={value}>{children}</InlineEditorContext.Provider>
}

export function useInlineEditor() {
	return useContext(InlineEditorContext)
}

export function useInlineValue(moduleId: string | undefined, path: string, fallback: any) {
	const ctx = useInlineEditor()
	if (!moduleId) return fallback
	return ctx.getValue(moduleId, path, fallback)
}

export function InlineEditToggle() {
	// Controls now rendered via SiteAdminBar to avoid overlap; keep hook available.
	return null
}

// Bridge the inline editor controls to global window so SiteAdminBar can control them
function publishInlineBridge(state: {
	enabled: boolean
	canEdit: boolean
	mode: Mode
	toggle: () => void
	setMode: (m: Mode) => void
	dirty: boolean
	saveAll: () => Promise<void>
}) {
	if (typeof window === 'undefined') return
		; (window as any).__inlineBridge = state
	const evt = new CustomEvent('inline:state', { detail: state })
	window.dispatchEvent(evt)
}
