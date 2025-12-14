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

type Mode = 'source' | 'review' | 'ai-review'
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
	getModeValue: (moduleId: string, path: string, mode: Mode, fallback: any) => any
	setValue: (moduleId: string, path: string, value: any) => void
	isGlobalModule: (moduleId: string) => boolean
	dirtyModules: Set<string>
	saveAll: () => Promise<void>
	showDiffs: boolean
	toggleShowDiffs: () => void
}

const InlineEditorContext = createContext<InlineEditorContextValue>({
	enabled: false,
	canEdit: false,
	toggle: () => { },
	postId: undefined,
	mode: 'source',
	setMode: () => { },
	getValue: (_m, _p, f) => f,
	getModeValue: (_m, _p, _mode, f) => f,
	setValue: () => { },
	isGlobalModule: () => false,
	dirtyModules: new Set(),
	saveAll: async () => { },
	showDiffs: false,
	toggleShowDiffs: () => { },
})

type ModuleSeed = {
	id: string
	scope?: 'local' | 'global' | 'static'
	globalSlug?: string | null
	globalLabel?: string | null
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
	const [mode, setMode] = useState<Mode>('source')
	const [drafts, setDrafts] = useState<Record<string, DraftPatch>>({})
	const [dirtyModules, setDirtyModules] = useState<Set<string>>(new Set())
	const [showDiffs, setShowDiffs] = useState(false)
	const moduleMeta = useMemo(() => {
		const map = new Map<string, { scope?: 'local' | 'global' | 'static'; globalSlug?: string | null; globalLabel?: string | null }>()
		modules.forEach((m) => map.set(m.id, { scope: m.scope, globalSlug: m.globalSlug, globalLabel: m.globalLabel }))
		return map
	}, [modules])

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

	const getModeValue = useCallback(
		(moduleId: string, path: string, targetMode: Mode, fallback: any) => {
			const mod = base[moduleId]
			if (!mod) return fallback
			const hasReviewProps = !!(mod.reviewProps && Object.keys(mod.reviewProps).length)
			const hasAiReviewProps = !!(mod.aiReviewProps && Object.keys(mod.aiReviewProps).length)
			const baseProps =
				targetMode === 'source'
					? mod.props
					: targetMode === 'review'
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
				targetMode === 'source'
					? mod.overrides
					: targetMode === 'review'
						? hasReviewOverrides
							? mod.reviewOverrides
							: mod.overrides
						: hasAiReviewOverrides
							? mod.aiReviewOverrides
							: mod.overrides
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
			return getModeValue(moduleId, path, mode, fallback)
		},
		[drafts, mode, getModeValue]
	)

	// Helper to check if a value is a DOM element (including React-wrapped via __reactFiber$... keys)
	const isDOMElement = useCallback((val: any): boolean => {
		if (!val || typeof val !== 'object') return false

		// Native DOM checks (browser)
		try {
			if (typeof Element !== 'undefined' && val instanceof Element) return true
			if (typeof HTMLElement !== 'undefined' && val instanceof HTMLElement) return true
		} catch {
			// ignore (cross-realm / server)
		}

		// DOM-ish shape checks
		if (val.nodeType !== undefined && val.nodeName !== undefined) return true
		if (val.tagName !== undefined && val.textContent !== undefined) return true
		if (typeof (val as any).addEventListener === 'function' && typeof (val as any).removeEventListener === 'function') {
			return true
		}

		// React fiber markers are suffixed (e.g. "__reactFiber$abc123")
		try {
			const props = Object.getOwnPropertyNames(val)
			if (props.some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'))) {
				return true
			}
		} catch {
			// ignore
		}

		return false
	}, [])

	const setValue = useCallback((moduleId: string, path: string, value: any) => {
		const meta = moduleMeta.get(moduleId)
		if (meta?.scope === 'global' || meta?.scope === 'static' || meta?.globalSlug) {
			// Global/static modules are view-only in inline editor
			return
		}
		// Fallback: if DOM marks this module as global/static, block
		if (typeof document !== 'undefined') {
			const el = document.querySelector<HTMLElement>(`[data-inline-module="${moduleId}"]`)
			if (el) {
				const scope = el.dataset.inlineScope
				const slug = el.dataset.inlineGlobalSlug
				if (scope === 'global' || scope === 'static' || slug) return
			}
		}
		// Aggressively sanitize value BEFORE storing in drafts to prevent DOM elements
		// and circular refs from ever entering state
		let sanitizedValue: any
		if (isDOMElement(value)) {
			// Direct DOM element - extract text content
			sanitizedValue = (value as any).textContent || (value as any).innerText || (value as any).value || ''
		} else if (value && typeof value === 'object') {
			// For any object, do a deep clean to remove DOM nodes and circular refs
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
				// Handle toJSON (Lexical editor state)
				if (typeof (val as any).toJSON === 'function') {
					try {
						return cleanDeep((val as any).toJSON())
					} catch {
						// fall through
					}
				}
				if (val instanceof Map) return cleanDeep(Array.from(val.entries()))
				if (val instanceof Set) return cleanDeep(Array.from(val.values()))
				if (Array.isArray(val)) {
					return val.map((item) => cleanDeep(item)).filter((item) => item !== undefined)
				}
				// Object - clean all keys, skip React internals
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

		if (sanitizedValue === undefined) return // Don't store undefined values

		setDrafts((prev) => {
			const next = { ...(prev[moduleId] || {}) }
			next[path] = sanitizedValue
			return { ...prev, [moduleId]: next }
		})
		setDirtyModules((prev) => {
			const copy = new Set(prev)
			copy.add(moduleId)
			return copy
		})
	}, [moduleMeta, isDOMElement])

	// Safely convert arbitrary values into JSON-serializable data (handles DOM nodes, circular refs, functions,
	// Maps/Sets, Dates, and objects with toJSON such as Lexical editor state).
	// Uses a two-phase approach: pre-walk + safe stringify with replacer.
	const safeJsonClone = useCallback(
		(input: any) => {
			// Phase 1: Pre-walk to build a clean structure
			const preWalkSeen = new WeakSet<object>()

			const preWalk = (val: any): any => {
				// Primitives pass through
				if (val === null || val === undefined) return val
				if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val

				// Drop functions
				if (typeof val === 'function') return undefined

				// Drop DOM elements (including React-wrapped DOM)
				if (isDOMElement(val)) return undefined

				// Guard against objects (circular refs)
				if (typeof val === 'object') {
					if (preWalkSeen.has(val)) return undefined // Drop circular refs entirely
					preWalkSeen.add(val)
				}

				// Prefer toJSON when available (Lexical EditorState, Dates, etc.)
				if (val && typeof val === 'object' && typeof (val as any).toJSON === 'function') {
					try {
						const jsonified = (val as any).toJSON()
						return preWalk(jsonified)
					} catch {
						// fall through
					}
				}

				// Convert Map/Set
				if (val instanceof Map) return preWalk(Array.from(val.entries()))
				if (val instanceof Set) return preWalk(Array.from(val.values()))

				// Arrays - filter out undefined
				if (Array.isArray(val)) {
					return val.map((item) => preWalk(item)).filter((item) => item !== undefined)
				}

				// Objects (including non-plain objects) - walk all own enumerable properties
				const cleaned: Record<string, any> = {}
				for (const key of Object.keys(val)) {
					// Skip React internal properties
					if (key.startsWith('__react') || key.startsWith('_react')) continue
					const walked = preWalk(val[key])
					if (walked !== undefined) cleaned[key] = walked
				}
				return cleaned
			}

			// Phase 2: Stringify with a safety-net replacer
			const stringifySeen = new WeakSet<object>()
			const safeReplacer = (_key: string, val: any): any => {
				if (typeof val === 'function') return undefined
				if (isDOMElement(val)) return undefined
				if (val && typeof val === 'object') {
					if (stringifySeen.has(val)) return undefined // Drop circular
					stringifySeen.add(val)
					// Check for React internal keys on any object we encounter
					const keys = Object.keys(val)
					if (keys.some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'))) {
						return undefined
					}
				}
				return val
			}

			try {
				const cleaned = preWalk(input)
				if (cleaned === undefined) return undefined
				// Stringify with safe replacer, then parse back to get plain data
				const json = JSON.stringify(cleaned, safeReplacer)
				return json === undefined ? undefined : JSON.parse(json)
			} catch (e) {
				console.error('safeJsonClone error:', e)
				return undefined
			}
		},
		[isDOMElement]
	)

	// Deep scan to find and remove DOM elements at any depth
	const deepRemoveDOMElements = useCallback((val: any, visited = new WeakSet(), depth = 0): any => {
		// Prevent infinite recursion
		if (depth > 20) return null
		
		if (val === null || val === undefined) return val
		if (typeof val !== 'object') return val
		
		// Check for circular references
		if (visited.has(val)) return '[Circular Reference]'
		visited.add(val)
		
		// Check if it's a DOM element
		if (isDOMElement(val)) {
			return null // Remove DOM elements
		}
		
		if (Array.isArray(val)) {
			return val
				.map((item) => deepRemoveDOMElements(item, visited, depth + 1))
				.filter((item) => item !== null)
		}
		
		if (val.constructor === Object) {
			const cleaned: Record<string, any> = {}
			for (const [key, v] of Object.entries(val)) {
				if (isDOMElement(v)) {
					continue // Skip DOM elements
				}
				const cleanedV = deepRemoveDOMElements(v, visited, depth + 1)
				if (cleanedV !== null) {
					cleaned[key] = cleanedV
				}
			}
			return cleaned
		}
		
		return val
	}, [isDOMElement])

	// Helper to sanitize values before JSON serialization (recursively removes DOM elements)
	const sanitizeValue = useCallback((val: any, visited = new WeakSet()): any => {
		// Handle null/undefined
		if (val === null || val === undefined) return val
		
		// Handle primitives
		if (typeof val !== 'object') return val
		
		// Check for circular references
		if (visited.has(val)) {
			return '[Circular Reference]'
		}
		
		// Check for DOM elements first (before adding to visited)
		if (isDOMElement(val)) {
			return (val as any).textContent || (val as any).innerText || (val as any).value || ''
		}
		
		// Add to visited set to detect circular references
		visited.add(val)
		
		try {
			// Handle arrays
			if (Array.isArray(val)) {
				return val.map((item) => sanitizeValue(item, visited))
			}
			
			// Handle plain objects - recursively sanitize all properties
			if (val.constructor === Object) {
				const sanitized: Record<string, any> = {}
				for (const [key, v] of Object.entries(val)) {
					// Skip DOM elements entirely
					if (isDOMElement(v)) {
						console.warn(`Skipping DOM element at key: ${key}`)
						continue
					}
					
					// Recursively check nested objects for DOM elements
					let sanitizedV = sanitizeValue(v, visited)
					
					// Double-check: if the sanitized value still contains DOM elements, try to extract
					if (sanitizedV && typeof sanitizedV === 'object' && sanitizedV.constructor === Object) {
						try {
							JSON.stringify(sanitizedV)
						} catch {
							// Still has issues, try to extract only serializable parts
							const extracted: any = {}
							for (const [k, nestedV] of Object.entries(sanitizedV)) {
								if (!isDOMElement(nestedV)) {
									try {
										JSON.stringify(nestedV)
										extracted[k] = nestedV
									} catch {
										// Skip this nested property
									}
								}
							}
							sanitizedV = extracted
						}
					}
					
					sanitized[key] = sanitizedV
				}
				return sanitized
			}
			
			// For other objects (Date, RegExp, etc.), try to serialize
			// But first check if it contains DOM elements
			if (typeof val === 'object') {
				// Try to convert to plain object representation
				try {
					const testStringify = JSON.stringify(val)
					return JSON.parse(testStringify)
				} catch {
					// If it fails, try to extract useful info
					if (val instanceof Date) return val.toISOString()
					if (val instanceof RegExp) return val.toString()
					return String(val)
				}
			}
			
			return val
		} finally {
			// Note: We don't remove from visited here to keep the WeakSet small
			// WeakSet will automatically clean up when objects are GC'd
		}
	}, [isDOMElement])

	const saveAll = useCallback(async (targetMode?: Mode) => {
		if (!enabled || !canEdit || dirtyModules.size === 0) return
		const saveMode = targetMode || mode
		const xsrf =
			typeof document !== 'undefined'
				? (() => {
					const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
					return m ? decodeURIComponent(m[1]) : undefined
				})()
				: undefined

		for (const moduleId of Array.from(dirtyModules)) {
			const patch = drafts[moduleId]
			if (!patch || Object.keys(patch).length === 0) continue
			const entries = Object.entries(patch)
			for (const [path, value] of entries) {
				let finalValue: any
				try {
					finalValue = safeJsonClone(value)
				} catch (e) {
					console.error('Failed to JSON-clone inline value, skipping:', { path, value }, e)
					continue
				}
				// If we couldn't produce a usable JSON payload, skip
				if (finalValue === undefined) continue
				
				// Build body with extra safety - use safeJsonClone on entire payload
				const payload = { path, value: finalValue, mode: saveMode }
				console.log('[InlineEditor] Saving field', { moduleId, path, saveMode, finalValueType: typeof finalValue })
				let bodyStr: string
				try {
					const safePayload = safeJsonClone(payload)
					if (!safePayload) {
						console.error('Failed to serialize payload, skipping:', { path })
						continue
					}
					bodyStr = JSON.stringify(safePayload)
				} catch (e) {
					console.error('JSON.stringify failed for payload, skipping:', { path }, e)
					continue
				}

				try {
					const res = await fetch(`/api/inline/posts/${postId}/modules/${moduleId}`, {
						method: 'PATCH',
						headers: {
							'Content-Type': 'application/json',
							...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}),
						},
						credentials: 'same-origin',
						body: bodyStr,
					})
					if (!res.ok) {
						const j = await res.json().catch(() => ({}))
						// eslint-disable-next-line no-alert
						alert(j?.error || 'Failed to save changes')
						return
					}
				} catch (error) {
					console.error('Failed to save inline edit:', error)
					// eslint-disable-next-line no-alert
					alert(error instanceof Error ? error.message : 'Failed to save changes (invalid data)')
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
						saveMode === 'source'
							? 'props'
							: saveMode === 'review'
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
					cur[parts[parts.length - 1]!] = finalValue
						; (clone as any)[target] = nextObj
					return { ...prev, [moduleId]: clone }
				})
			}
		}
		// on success, clear drafts/dirties
		setDrafts({})
		setDirtyModules(new Set())
	}, [canEdit, dirtyModules, drafts, enabled, mode, postId, safeJsonClone])

	const saveForReview = useCallback(async () => {
		await saveAll('review')
	}, [saveAll])

	// Determine which modes are available based on module data
	const availableModes = useMemo(() => {
		const hasSource = modules.length > 0 // Source always exists if there are modules
		let hasReview = false
		let hasAiReview = false
		for (const m of modules) {
			if (m.reviewProps && Object.keys(m.reviewProps).length > 0) hasReview = true
			if (m.reviewOverrides && Object.keys(m.reviewOverrides).length > 0) hasReview = true
			if (m.aiReviewProps && Object.keys(m.aiReviewProps).length > 0) hasAiReview = true
			if (m.aiReviewOverrides && Object.keys(m.aiReviewOverrides).length > 0) hasAiReview = true
		}
		return { hasSource, hasReview, hasAiReview }
	}, [modules])

	const toggleShowDiffs = useCallback(() => setShowDiffs((v) => !v), [])

	const value = useMemo<InlineEditorContextValue>(
		() => ({
			enabled: enabled && canEdit,
			canEdit,
			postId,
			mode,
			setMode,
			toggle: () => setEnabled((v) => !v),
			getValue,
			getModeValue,
			setValue,
			isGlobalModule: (moduleId: string) => {
				const meta = moduleMeta.get(moduleId)
				if (meta?.scope === 'global' || meta?.scope === 'static' || !!meta?.globalSlug) return true
				if (typeof document !== 'undefined') {
					const el = document.querySelector<HTMLElement>(`[data-inline-module="${moduleId}"]`)
					const scope = el?.dataset.inlineScope
					const slug = el?.dataset.inlineGlobalSlug
					if (scope === 'global' || scope === 'static' || slug) return true
				}
				return false
			},
			dirtyModules,
			saveAll,
			showDiffs,
			toggleShowDiffs,
		}),
		[enabled, canEdit, postId, mode, getValue, getModeValue, setValue, moduleMeta, dirtyModules, saveAll, showDiffs, toggleShowDiffs]
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
			saveForReview,
			availableModes,
			showDiffs: value.showDiffs,
			toggleShowDiffs: value.toggleShowDiffs,
		})
	}, [value.enabled, value.canEdit, value.mode, value.toggle, value.setMode, value.saveAll, dirtyModules, saveForReview, availableModes, value.showDiffs, value.toggleShowDiffs])

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
	saveForReview: () => Promise<void>
	availableModes: { hasSource: boolean; hasReview: boolean; hasAiReview: boolean }
	showDiffs: boolean
	toggleShowDiffs: () => void
}) {
	if (typeof window === 'undefined') return
		; (window as any).__inlineBridge = state
	const evt = new CustomEvent('inline:state', { detail: state })
	window.dispatchEvent(evt)
}
