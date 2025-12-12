import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { renderToStaticMarkup } from 'react-dom/server'
import { MediaPickerModal } from '../../admin/components/media/MediaPickerModal'
import { useInlineEditor } from './InlineEditorContext'
import { LinkField, type LinkFieldValue } from '../forms/LinkField'
import { LexicalEditor } from '../../admin/components/LexicalEditor'
import { FontAwesomeIcon } from '../../site/lib/icons'
import { iconOptions } from '../../admin/components/ui/iconOptions'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '../ui/dialog'
import { EditablePostReference } from './EditablePostReference'

type HandlerCleanup = () => void

type ObjectField = {
	name: string
	type: string
	label: string
	options?: Array<{ label: string; value: any }>
}

type PopoverState = {
	moduleId: string
	path: string
	type: string
	label?: string
	postType?: string
	options?: Array<{ label: string; value: any }>
	multi?: boolean
	fields?: ObjectField[]
}

export function InlineOverlay() {
	const { enabled, canEdit, getValue, getModeValue, setValue, mode, isGlobalModule } = useInlineEditor()
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])
	const [mediaTarget, setMediaTarget] = useState<{ moduleId: string; path: string } | null>(null)
	const [dialogState, setDialogState] = useState<PopoverState | null>(null)
	const [showDiffs, setShowDiffs] = useState(false)

	function resolveModuleId(el: HTMLElement | null): string | undefined {
		if (!el) return undefined
		return (
			el.dataset.inlineModule ||
			(el.closest('[data-inline-module]') as HTMLElement | null)?.dataset.inlineModule
		)
	}
	function isGlobalModuleDom(el: HTMLElement | null, fallbackCheck?: (moduleId: string) => boolean): boolean {
		const mod = el?.closest('[data-inline-module]') as HTMLElement | null
		const moduleId = mod?.dataset.inlineModule
		const domFlag = mod?.dataset.inlineScope === 'global' || !!mod?.dataset.inlineGlobalSlug
		if (domFlag) return true
		if (moduleId && fallbackCheck) return fallbackCheck(moduleId)
		return false
	}

	// Simple word-level diff: returns HTML with spans for insertions/deletions
	function renderWordDiffHtml(base: string, target: string): string {
		const baseWords = base.split(/(\s+)/) // keep spaces as tokens
		const targetWords = target.split(/(\s+)/)
		const out: string[] = []
		let i = 0
		let j = 0
		while (i < baseWords.length || j < targetWords.length) {
			const bw = baseWords[i] ?? ''
			const tw = targetWords[j] ?? ''
			if (bw === tw) {
				out.push(escapeHtml(tw))
				i++
				j++
				continue
			}
			// If next target matches current base, treat target[j] as insertion
			if (bw && targetWords[j + 1] === bw) {
				out.push(`<span class="inline-diff-add">${escapeHtml(tw)}</span>`)
				j++
				continue
			}
			// If next base matches current target, treat base[i] as deletion
			if (tw && baseWords[i + 1] === tw) {
				const display = bw.trim() === '' ? '&nbsp;' : escapeHtml(bw)
				out.push(`<span class="inline-diff-del">${display}</span>`)
				i++
				continue
			}
			// Fallback: replace
			if (tw) out.push(`<span class="inline-diff-add">${escapeHtml(tw)}</span>`)
			if (bw) {
				const display = bw.trim() === '' ? '&nbsp;' : escapeHtml(bw)
				out.push(`<span class="inline-diff-del">${display}</span>`)
			}
			i++
			j++
		}
		return out.join('')
	}

	function escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;')
	}

	// Attach inline editors to elements marked with data-inline-path
	useEffect(() => {
		if (!canEdit || !enabled || typeof document === 'undefined') return

		const cleanups: HandlerCleanup[] = []

		// Global module notice + outline + disable editing
		const moduleNodes = Array.from(
			document.querySelectorAll<HTMLElement>('[data-inline-module]')
		)
		moduleNodes.forEach((modEl) => {
			const moduleId = modEl.dataset.inlineModule
			if (
				!(
					modEl.dataset.inlineScope === 'global' ||
					modEl.dataset.inlineGlobalSlug ||
					(moduleId && isGlobalModule(moduleId))
				)
			)
				return
			modEl.classList.add('inline-global-module')
			const onEnterMod = () => modEl.classList.add('inline-edit-hover')
			const onLeaveMod = () => modEl.classList.remove('inline-edit-hover')
			modEl.addEventListener('mouseenter', onEnterMod)
			modEl.addEventListener('mouseleave', onLeaveMod)
			cleanups.push(() => {
				modEl.removeEventListener('mouseenter', onEnterMod)
				modEl.removeEventListener('mouseleave', onLeaveMod)
				modEl.classList.remove('inline-edit-hover')
				modEl.classList.remove('inline-global-module')
			})
			if (modEl.querySelector('.inline-global-indicator')) return
			const badge = document.createElement('div')
			badge.className =
				'inline-global-indicator mb-3 flex items-center justify-end gap-2 text-xs text-neutral-high bg-backdrop-high border border-line-medium rounded px-3 py-2'
			const labelText =
				modEl.dataset.inlineGlobalLabel || modEl.dataset.inlineGlobalSlug || 'Global module'
			const link = document.createElement('a')
			const slug = modEl.dataset.inlineGlobalSlug
			link.href = `/admin/modules?tab=globals${slug ? `&editSlug=${encodeURIComponent(slug)}` : ''}`
			link.target = '_blank'
			link.rel = 'noopener noreferrer'
			link.className =
				'inline-flex items-center gap-1 text-standout hover:underline font-medium'
			const globeIcon = renderToStaticMarkup(
				<FontAwesomeIcon icon="globe" className="w-4 h-4" />
			)
			link.innerHTML = `${globeIcon}<span>Edit ${labelText}</span>`
			link.title = `Edit ${labelText} (opens in new tab)`
			link.setAttribute('aria-label', `Edit ${labelText} (opens in new tab)`)
			badge.appendChild(link)
			modEl.prepend(badge)
			cleanups.push(() => badge.remove())
		})

		const textNodes = Array.from(
			document.querySelectorAll<HTMLElement>('[data-inline-path][data-inline-type="text"], [data-inline-path]:not([data-inline-type])')
		)

		textNodes.forEach((el) => {
			if (isGlobalModuleDom(el, isGlobalModule)) return
			const path = el.dataset.inlinePath
			const moduleId = resolveModuleId(el)
			if (!path || !moduleId) return
			// Skip text elements that are children of link/select/icon fields (they're part of the parent control)
			if (el.closest('[data-inline-type="link"], [data-inline-type="select"], [data-inline-type="icon"], [data-inline-type="multiselect"]')) {
				return
			}
			const onEnter = () => el.classList.add('inline-edit-hover')
			const onLeave = () => el.classList.remove('inline-edit-hover')
			el.addEventListener('mouseenter', onEnter)
			el.addEventListener('mouseleave', onLeave)
			cleanups.push(() => {
				el.removeEventListener('mouseenter', onEnter)
				el.removeEventListener('mouseleave', onLeave)
				el.classList.remove('inline-edit-hover')
				el.removeAttribute('data-inline-diff-active')
			})

			// set initial text from context (merge props/overrides + drafts)
			const current = getValue(moduleId, path, el.innerText || '')
			const asString = typeof current === 'string' ? current : String(current ?? '')
			const baselineMode = mode === 'review' ? 'approved' : mode === 'ai' ? 'review' : null
			if (showDiffs && baselineMode) {
				const baselineVal = getModeValue(moduleId, path, baselineMode as any, asString)
				const baselineStr =
					typeof baselineVal === 'string' ? baselineVal : String(baselineVal ?? '')
				const diffHtml = renderWordDiffHtml(baselineStr, asString)
				el.innerHTML = diffHtml
				el.contentEditable = 'false'
				el.removeAttribute('data-inline-active')
				el.dataset.inlineDiffActive = '1'
			} else {
				if (el.innerText !== asString) {
					el.innerText = asString
				}
				el.contentEditable = 'true'
				el.removeAttribute('data-inline-diff-active')
			}

			if (enabled) {
				const onInput = () => {
					// keep DOM text only; save on blur/Enter
				}
				const onBlur = () => {
					const next = el.innerText
					setValue(moduleId, path, next)
				}
				const onKeyDown = (e: KeyboardEvent) => {
					if (e.key === 'Enter' && !(e.shiftKey || e.metaKey || e.ctrlKey)) {
						e.preventDefault()
						const next = el.innerText
						setValue(moduleId, path, next)
						el.blur()
					}
					if (e.key === 'Escape') {
						const base = getValue(moduleId, path, el.innerText || '')
						el.innerText = typeof base === 'string' ? base : String(base ?? '')
						el.blur()
					}
				}

				el.contentEditable = 'true'
				el.dataset.inlineActive = '1'
				el.addEventListener('input', onInput)
				el.addEventListener('blur', onBlur)
				el.addEventListener('keydown', onKeyDown)

				cleanups.push(() => {
					el.removeEventListener('input', onInput)
					el.removeEventListener('blur', onBlur)
					el.removeEventListener('keydown', onKeyDown)
					el.removeAttribute('contenteditable')
					el.removeAttribute('data-inline-active')
				})
			} else {
				// ensure not editable when disabled
				el.removeAttribute('contenteditable')
				el.removeAttribute('data-inline-active')
			}
		})

		// Media fields: attach pencil button
		const mediaNodes = Array.from(
			document.querySelectorAll<HTMLElement>('[data-inline-type="media"][data-inline-path]')
		)

		mediaNodes.forEach((el) => {
			if (isGlobalModuleDom(el, isGlobalModule)) return
			const path = el.dataset.inlinePath
			const moduleId = resolveModuleId(el)
			if (!path || !moduleId) return
			const onEnter = () => el.classList.add('inline-edit-hover')
			const onLeave = () => el.classList.remove('inline-edit-hover')
			el.addEventListener('mouseenter', onEnter)
			el.addEventListener('mouseleave', onLeave)
			cleanups.push(() => {
				el.removeEventListener('mouseenter', onEnter)
				el.removeEventListener('mouseleave', onLeave)
				el.classList.remove('inline-edit-hover')
				el.classList.remove('inline-diff-review')
				el.classList.remove('inline-diff-ai')
			})

			// only add pencil when enabled
			if (enabled) {
				if (el.querySelector('.inline-media-pencil')) return
				if (!el.style.position) el.style.position = 'relative'

				const btn = document.createElement('button')
				btn.type = 'button'
				btn.className =
					'inline-media-pencil absolute top-2 right-2 inline-flex items-center justify-center rounded-full bg-backdrop-high/90 border border-line-medium text-neutral-high p-2 shadow hover:bg-backdrop-medium'
				btn.innerHTML =
					'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="w-4 h-4 fill-current"><path d="M410.3 45.25c-16.97-16.97-44.56-16.97-61.53 0L318.6 75.41l118 118l30.17-30.17c16.97-16.97 16.97-44.56 0-61.53L410.3 45.25zM289.4 104.6L65.89 328.1c-6.13 6.13-10.42 13.7-12.62 22L1.055 488.1C-1.238 496.7 6.262 504.2 14.92 501.9l137.9-52.21c8.32-2.2 15.89-6.49 22.02-12.62l223.5-223.5L289.4 104.6z"/></svg>'
				btn.onclick = () => setMediaTarget({ moduleId, path })
				el.appendChild(btn)

				cleanups.push(() => {
					btn.remove()
				})
			} else {
				// remove any existing pencil when disabled
				const btn = el.querySelector('.inline-media-pencil')
				if (btn) btn.remove()
			}
		})

		// Richtext fields (open Lexical dialog)
		const richtextNodes = Array.from(
			document.querySelectorAll<HTMLElement>('[data-inline-type="richtext"][data-inline-path]')
		)
		richtextNodes.forEach((el) => {
			if (isGlobalModuleDom(el, isGlobalModule)) return
			const path = el.dataset.inlinePath
			const moduleId = resolveModuleId(el)
			if (!path || !moduleId) return
			const onEnter = () => el.classList.add('inline-edit-hover')
			const onLeave = () => el.classList.remove('inline-edit-hover')
			el.addEventListener('mouseenter', onEnter)
			el.addEventListener('mouseleave', onLeave)
			cleanups.push(() => {
				el.removeEventListener('mouseenter', onEnter)
				el.removeEventListener('mouseleave', onLeave)
				el.classList.remove('inline-edit-hover')
			})
			const label = el.dataset.inlineLabel
			const handler = (e: Event) => {
				if (!enabled) return
				e.preventDefault()
				e.stopPropagation()
				setDialogState({
					moduleId,
					path,
					type: 'richtext',
					label,
				})
			}
			el.addEventListener('click', handler)
			cleanups.push(() => el.removeEventListener('click', handler))
		})

		// Other field types (click to open popover)
		const otherNodes = Array.from(
			document.querySelectorAll<HTMLElement>(
				'[data-inline-type]:not([data-inline-type="media"]):not([data-inline-type="text"]):not([data-inline-type="richtext"])'
			)
		)
		otherNodes.forEach((el) => {
			if (isGlobalModuleDom(el, isGlobalModule)) return
			const path = el.dataset.inlinePath
			const moduleId = resolveModuleId(el)
			const type = (el.dataset.inlineType || '').toLowerCase()
			if (!path || !moduleId || !type) return
			const onEnter = () => el.classList.add('inline-edit-hover')
			const onLeave = () => el.classList.remove('inline-edit-hover')
			el.addEventListener('mouseenter', onEnter)
			el.addEventListener('mouseleave', onLeave)
			cleanups.push(() => {
				el.removeEventListener('mouseenter', onEnter)
				el.removeEventListener('mouseleave', onLeave)
				el.classList.remove('inline-edit-hover')
			})
			const optionsAttr = el.dataset.inlineOptions
			let options: Array<{ label: string; value: any }> | undefined
			if (optionsAttr) {
				try {
					const parsed = JSON.parse(optionsAttr)
					if (Array.isArray(parsed)) {
						options = parsed.map((o: any) =>
							typeof o === 'object' && o !== null
								? { label: o.label ?? String(o.value ?? o), value: o.value ?? o.label ?? o }
								: { label: String(o), value: o }
						)
					}
				} catch {
					/* ignore */
				}
			}
			// Parse object fields schema
			const fieldsAttr = el.dataset.inlineFields
			let fields: ObjectField[] | undefined
			if (fieldsAttr) {
				try {
					const parsed = JSON.parse(fieldsAttr)
					if (Array.isArray(parsed)) {
						fields = parsed
					}
				} catch {
					/* ignore */
				}
			}
			const postType = el.dataset.inlinePostType
			const multi = el.dataset.inlineMulti === 'true'
			const label = el.dataset.inlineLabel
			const handler = (e: Event) => {
				if (!enabled) return
				e.preventDefault()
				e.stopPropagation() // prevent navigation for anchor tags
				setDialogState({
					moduleId,
					path,
					type,
					label,
					postType,
					options,
					multi,
					fields,
				})
			}
			el.addEventListener('click', handler)
			cleanups.push(() => el.removeEventListener('click', handler))
		})

		return () => {
			cleanups.forEach((fn) => fn())
		}
	}, [enabled, canEdit, getValue, getModeValue, setValue, mode, showDiffs, isGlobalModule])

	// Detach when disabled
	useEffect(() => {
		if (enabled) return
		if (typeof document === 'undefined') return
		const active = Array.from(document.querySelectorAll('[data-inline-active]'))
		active.forEach((el) => {
			el.removeAttribute('contenteditable')
			el.removeAttribute('data-inline-active')
		})
	}, [enabled])

	if (!mounted || !canEdit) return null

	return createPortal(
		<>
			<style>{`
        [data-inline-active="1"],
        [data-inline-path].inline-edit-hover {
          outline: 1px dashed var(--inline-edit-accent, #5c7cfa);
          outline-offset: 2px;
        }
        .inline-global-module.inline-edit-hover {
          outline: 2px solid var(--color-line-inline-input-global, #f97316);
          outline-offset: 6px;
        }
      `}</style>
			{enabled && (
				<div className="fixed bottom-28 right-3 z-1000">
					<div className="relative group">
						<button
							type="button"
							className="inline-flex items-center justify-center rounded-full bg-backdrop-high border border-line-medium text-neutral-high p-2 shadow hover:bg-backdrop-medium"
							onClick={() => setShowDiffs((v) => !v)}
							aria-label="Toggle diff highlights"
						>
							<FontAwesomeIcon icon="highlighter" className="w-4 h-4" />
						</button>
						<div className="absolute bottom-full mb-2 right-0 hidden group-hover:block bg-backdrop-high text-neutral-high text-xs px-2 py-1 rounded border border-line-medium shadow">
							Highlight changes ({mode === 'review' ? 'vs Approved' : mode === 'ai' ? 'vs Review' : 'n/a'})
						</div>
					</div>
				</div>
			)}
			{mediaTarget && (
				<MediaPickerModal
					open
					onOpenChange={(open) => {
						if (!open) setMediaTarget(null)
					}}
					onSelect={(item) => {
						setValue(mediaTarget.moduleId, mediaTarget.path, item.id)
						setMediaTarget(null)
					}}
					allowUpload
					title="Select image"
				/>
			)}
			<Dialog open={enabled && !!dialogState} onOpenChange={(open) => !open && setDialogState(null)}>
				<DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
					{dialogState && (
						<>
							<DialogHeader>
								<DialogTitle>
									{dialogState.label || formatPathLabel(dialogState.path)}
								</DialogTitle>
							</DialogHeader>
							<FieldDialogContent
								pop={dialogState}
								onClose={() => setDialogState(null)}
								getValue={getValue}
								setValue={setValue}
							/>
						</>
					)}
				</DialogContent>
			</Dialog>
		</>,
		document.body
	)
}

type DialogContentProps = {
	pop: {
		moduleId: string
		path: string
		type: string
		label?: string
		postType?: string
		options?: Array<{ label: string; value: any }>
		multi?: boolean
		fields?: ObjectField[]
	}
	onClose: () => void
	getValue: (moduleId: string, path: string, fallback: any) => any
	setValue: (moduleId: string, path: string, value: any) => void
}


// Helper to format camelCase path to Title Case with spaces
function formatPathLabel(path: string): string {
	// Get last segment of path (e.g., "primaryCta" from "module.primaryCta")
	const lastPart = path.split('.').pop() || path
	// Insert space before capital letters and capitalize first letter
	return lastPart
		.replace(/([A-Z])/g, ' $1')
		.replace(/^./, (str) => str.toUpperCase())
		.trim()
}

function FieldDialogContent({ pop, onClose, getValue, setValue }: DialogContentProps) {
	const { moduleId, path, type, options, multi, fields } = pop
	const [draft, setDraft] = useState<any>(() => {
		const current = getValue(moduleId, path, null)
		if (multi && Array.isArray(current)) return current
		if (type === 'object' && (!current || typeof current !== 'object')) return {}
		return current
	})

	const commit = (value: any) => {
		setValue(moduleId, path, value)
		onClose()
	}

	const renderControl = () => {
		switch (type) {
			case 'richtext': {
				return (
					<div className="space-y-3">
						<LexicalEditor
							value={draft ?? ''}
							onChange={(val) => setDraft(val)}
							placeholder="Start typing…"
							editorKey={`${moduleId}-${path}-richtext`}
						/>
						<button
							className="w-full mt-2 bg-standout text-on-standout px-3 py-1.5 rounded font-medium"
							onClick={() => commit(draft)}
						>
							Save
						</button>
					</div>
				)
			}
			case 'post-reference': {
				return (
					<div className="space-y-3">
						<EditablePostReference
							moduleId={moduleId}
							path={path}
							multiple={multi}
							postType={pop.postType}
							label={pop.label || 'Select posts'}
						/>
					</div>
				)
			}
			case 'link': {
				return (
					<div className="space-y-3">
						<LinkField
							label="Destination"
							value={draft}
							onChange={(val: LinkFieldValue) => setDraft(val)}
						/>
						<button
							className="w-full mt-2 bg-standout text-on-standout px-3 py-1.5 rounded font-medium"
							onClick={() => commit(draft)}
						>
							Save Link
						</button>
					</div>
				)
			}
			case 'select':
			case 'icon': {
				const opts = type === 'icon' ? iconOptions : options || []
				if (type === 'icon') {
					return (
						<div className="space-y-3">
							<div className="grid grid-cols-4 gap-2 max-h-64 overflow-auto">
								{opts.map((o: any) => {
									const val = o.name ?? o.value
									const icon = o.icon ?? val
									return (
										<button
											key={val}
											type="button"
											className={`p-3 border rounded-lg hover:bg-backdrop-medium flex flex-col items-center gap-1 ${draft === val ? 'border-standout bg-standout/10' : 'border-line-low'
												}`}
											onClick={() => setDraft(val)}
											title={o.label}
										>
											<FontAwesomeIcon icon={icon as any} className="w-5 h-5" />
											<span className="text-[11px] text-neutral-low truncate w-full text-center">
												{o.label}
											</span>
										</button>
									)
								})}
							</div>
							<button
								className="w-full mt-1 bg-standout text-on-standout px-3 py-1 rounded"
								onClick={() => commit(draft || '')}
							>
								Save
							</button>
						</div>
					)
				}
				return (
					<div className="space-y-2">
						<label className="block text-xs text-neutral-medium">Select</label>
						<select
							className="w-full border border-line-medium rounded px-2 py-1 bg-backdrop-high text-neutral-high"
							value={draft ?? ''}
							onChange={(e) => setDraft(e.target.value)}
						>
							<option value="">--</option>
							{opts.map((o: any) => {
								const val = o.value ?? o.name
								return (
									<option key={val} value={val}>
										{o.label}
									</option>
								)
							})}
						</select>
						<button
							className="w-full mt-2 bg-standout text-on-standout px-3 py-1 rounded"
							onClick={() => commit(draft || '')}
						>
							Save
						</button>
					</div>
				)
			}
			case 'textarea': {
				return (
					<div className="space-y-2">
						<label className="block text-xs text-neutral-medium">Text</label>
						<textarea
							className="w-full border border-line-medium rounded px-2 py-1.5 bg-backdrop-high text-neutral-high text-sm min-h-[120px] resize-vertical"
							value={draft ?? ''}
							onChange={(e) => setDraft(e.target.value)}
						/>
						<button
							className="w-full mt-2 bg-standout text-on-standout px-3 py-1 rounded"
							onClick={() => commit(draft ?? '')}
						>
							Save
						</button>
					</div>
				)
			}
			case 'repeater-text': {
				const asArray: string[] = Array.isArray(draft)
					? draft
					: typeof draft === 'string'
						? draft.split('\n').filter(Boolean)
						: []
				return (
					<div className="space-y-2">
						<label className="block text-xs text-neutral-medium">Items (one per line)</label>
						<textarea
							className="w-full border border-line-medium rounded px-2 py-1.5 bg-backdrop-high text-neutral-high text-sm min-h-[140px] resize-vertical"
							value={asArray.join('\n')}
							onChange={(e) => setDraft(e.target.value.split('\n'))}
						/>
						<button
							className="w-full mt-2 bg-standout text-on-standout px-3 py-1 rounded"
							onClick={() => commit(asArray)}
						>
							Save
						</button>
					</div>
				)
			}
			case 'multiselect': {
				const opts = options || []
				const current: any[] = Array.isArray(draft) ? draft : []
				return (
					<div className="space-y-2">
						<div className="text-xs text-neutral-medium">Select options</div>
						<div className="space-y-1 max-h-48 overflow-auto">
							{opts.map((o) => {
								const checked = current.includes(o.value)
								return (
									<label key={o.value} className="flex items-center gap-2 text-sm text-neutral-high">
										<input
											type="checkbox"
											checked={checked}
											onChange={() => {
												const next = checked
													? current.filter((v) => v !== o.value)
													: [...current, o.value]
												setDraft(next)
											}}
										/>
										{o.label}
									</label>
								)
							})}
						</div>
						<button
							className="w-full mt-2 bg-standout text-on-standout px-3 py-1 rounded"
							onClick={() => commit(current)}
						>
							Save
						</button>
					</div>
				)
			}
			case 'number':
			case 'slider': {
				return (
					<div className="space-y-2">
						<label className="block text-xs text-neutral-medium">Value</label>
						<input
							type="number"
							className="w-full border border-line-medium rounded px-2 py-1 bg-backdrop-high text-neutral-high"
							value={draft ?? ''}
							onChange={(e) => setDraft(e.target.value === '' ? null : Number(e.target.value))}
						/>
						<button
							className="w-full mt-2 bg-standout text-on-standout px-3 py-1 rounded"
							onClick={() => commit(draft === '' ? null : draft)}
						>
							Save
						</button>
					</div>
				)
			}
			case 'boolean': {
				const checked = !!draft
				return (
					<div className="space-y-2">
						<label className="flex items-center gap-2 text-sm text-neutral-high">
							<input
								type="checkbox"
								checked={checked}
								onChange={(e) => setDraft(e.target.checked)}
							/>
							Toggle
						</label>
						<button
							className="w-full mt-2 bg-standout text-on-standout px-3 py-1 rounded"
							onClick={() => commit(!!draft)}
						>
							Save
						</button>
					</div>
				)
			}
			case 'date': {
				return (
					<div className="space-y-2">
						<label className="block text-xs text-neutral-medium">Date</label>
						<input
							type="date"
							className="w-full border border-line-medium rounded px-2 py-1 bg-backdrop-high text-neutral-high"
							value={draft ?? ''}
							onChange={(e) => setDraft(e.target.value || null)}
						/>
						<button
							className="w-full mt-2 bg-standout text-on-standout px-3 py-1 rounded"
							onClick={() => commit(draft || null)}
						>
							Save
						</button>
					</div>
				)
			}
			case 'object': {
				if (!fields || fields.length === 0) {
					return (
						<div className="text-xs text-neutral-medium">No fields defined for this object</div>
					)
				}
				const obj = draft && typeof draft === 'object' ? draft : {}
				const updateField = (fieldName: string, value: any) => {
					setDraft((prev: any) => ({ ...(prev || {}), [fieldName]: value }))
				}
				return (
					<div className="space-y-4">
						{fields.map((field) => {
							const fieldValue = obj[field.name]
							switch (field.type) {
								case 'text':
								case 'textarea':
									return (
										<div key={field.name} className="space-y-1">
											<label className="block text-xs font-medium text-neutral-medium">
												{field.label}
											</label>
											{field.type === 'textarea' ? (
												<textarea
													className="w-full border border-line-medium rounded px-2 py-1.5 bg-backdrop-high text-neutral-high text-sm resize-none"
													rows={3}
													value={fieldValue ?? ''}
													onChange={(e) => updateField(field.name, e.target.value)}
												/>
											) : (
												<input
													type="text"
													className="w-full border border-line-medium rounded px-2 py-1.5 bg-backdrop-high text-neutral-high text-sm"
													value={fieldValue ?? ''}
													onChange={(e) => updateField(field.name, e.target.value)}
												/>
											)}
										</div>
									)
								case 'link':
									return (
										<div key={field.name} className="space-y-1">
											<LinkField
												label={field.label}
												value={fieldValue}
												onChange={(val) => updateField(field.name, val)}
											/>
										</div>
									)
								case 'richtext':
									return (
										<div key={field.name} className="space-y-2">
											<label className="block text-xs font-medium text-neutral-medium">
												{field.label}
											</label>
											<div className="border border-line-medium rounded bg-backdrop-high p-2">
												<LexicalEditor
													value={fieldValue ?? ''}
													onChange={(val) => updateField(field.name, val)}
													placeholder="Start typing…"
													editorKey={`${moduleId}-${path}-${field.name}`}
												/>
											</div>
										</div>
									)
								case 'select':
									return (
										<div key={field.name} className="space-y-1">
											<label className="block text-xs font-medium text-neutral-medium">
												{field.label}
											</label>
											<select
												className="w-full border border-line-medium rounded px-2 py-1.5 bg-backdrop-high text-neutral-high text-sm"
												value={fieldValue ?? ''}
												onChange={(e) => updateField(field.name, e.target.value)}
											>
												<option value="">--</option>
												{(field.options || []).map((o) => (
													<option key={o.value} value={o.value}>
														{o.label}
													</option>
												))}
											</select>
										</div>
									)
								case 'repeater-text': {
									const arr: string[] = Array.isArray(fieldValue)
										? fieldValue
										: typeof fieldValue === 'string'
											? fieldValue.split('\n').filter(Boolean)
											: []
									const updateItem = (i: number, val: string) => {
										const next = [...arr]
										next[i] = val
										updateField(field.name, next)
									}
									const removeItem = (i: number) => {
										const next = arr.filter((_, idx) => idx !== i)
										updateField(field.name, next)
									}
									const moveItem = (i: number, dir: -1 | 1) => {
										const j = i + dir
										if (j < 0 || j >= arr.length) return
										const next = [...arr]
										const tmp = next[i]
										next[i] = next[j]
										next[j] = tmp
										updateField(field.name, next)
									}
									const addItem = () => {
										updateField(field.name, [...arr, ''])
									}
									return (
										<div key={field.name} className="space-y-2">
											<label className="block text-xs font-medium text-neutral-medium">
												{field.label}
											</label>
											<div className="space-y-2">
												{arr.map((val, i) => (
													<div key={i} className="flex items-center gap-2">
														<input
															type="text"
															className="flex-1 border border-line-medium rounded px-2 py-1.5 bg-backdrop-high text-neutral-high text-sm"
															value={val}
															onChange={(e) => updateItem(i, e.target.value)}
														/>
														<div className="flex gap-1">
															<button
																type="button"
																className="px-2 py-1 text-xs border border-line-medium rounded bg-backdrop-high hover:bg-backdrop-medium"
																onClick={() => moveItem(i, -1)}
																aria-label="Move up"
															>
																↑
															</button>
															<button
																type="button"
																className="px-2 py-1 text-xs border border-line-medium rounded bg-backdrop-high hover:bg-backdrop-medium"
																onClick={() => moveItem(i, 1)}
																aria-label="Move down"
															>
																↓
															</button>
															<button
																type="button"
																className="px-2 py-1 text-xs border border-line-medium rounded bg-backdrop-high hover:bg-backdrop-medium text-danger"
																onClick={() => removeItem(i)}
																aria-label="Remove"
															>
																×
															</button>
														</div>
													</div>
												))}
												<button
													type="button"
													className="px-3 py-1.5 text-xs rounded border border-line-medium bg-backdrop-high hover:bg-backdrop-medium"
													onClick={addItem}
												>
													Add item
												</button>
											</div>
										</div>
									)
								}
								case 'number':
									return (
										<div key={field.name} className="space-y-1">
											<label className="block text-xs font-medium text-neutral-medium">
												{field.label}
											</label>
											<input
												type="number"
												className="w-full border border-line-medium rounded px-2 py-1.5 bg-backdrop-high text-neutral-high text-sm"
												value={fieldValue ?? ''}
												onChange={(e) =>
													updateField(field.name, e.target.value === '' ? null : Number(e.target.value))
												}
											/>
										</div>
									)
								case 'boolean':
									return (
										<div key={field.name} className="space-y-1">
											<label className="flex items-center gap-2 text-sm text-neutral-high">
												<input
													type="checkbox"
													checked={!!fieldValue}
													onChange={(e) => updateField(field.name, e.target.checked)}
												/>
												{field.label}
											</label>
										</div>
									)
								default:
									return (
										<div key={field.name} className="text-xs text-neutral-low">
											Unsupported field type: {field.type}
										</div>
									)
							}
						})}
						<button
							className="w-full mt-2 bg-standout text-on-standout px-3 py-1.5 rounded font-medium"
							onClick={() => commit(obj)}
						>
							Save
						</button>
					</div>
				)
			}
			default:
				return (
					<div className="space-y-2">
						<div className="text-xs text-neutral-medium">Unsupported inline field type: {type}</div>
						<button
							className="w-full mt-2 bg-backdrop-high text-neutral-high px-3 py-1 rounded border border-line-medium"
							onClick={onClose}
						>
							Close
						</button>
					</div>
				)
		}
	}

	return <div className="mt-4">{renderControl()}</div>
}


