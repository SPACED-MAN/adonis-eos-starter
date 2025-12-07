import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { LexicalEditor } from '../LexicalEditor'
import { Popover, PopoverTrigger, PopoverContent } from '~/components/ui/popover'
import { Checkbox } from '~/components/ui/checkbox'
import { Slider } from '~/components/ui/slider'
import { Calendar } from '~/components/ui/calendar'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from '~/components/ui/select'
import { FormField, FormLabel } from '~/components/forms/field'
import { LinkField, type LinkFieldValue } from '~/components/forms/LinkField'
import { MediaPickerModal } from '../media/MediaPickerModal'
import { pickMediaVariantUrl, type MediaVariant } from '../../../lib/media'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faArrowRight,
	faBullhorn,
	faScaleBalanced,
	faGear,
	faCoins,
	faPenRuler,
	faDiagramProject,
	faCircleQuestion,
	faQuoteLeft,
	faCheck,
	faChevronDown,
	faCube,
	faLanguage,
	faUsers,
	faCodeBranch,
	faPalette,
	faBolt,
} from '@fortawesome/free-solid-svg-icons'

export interface ModuleListItem {
	id: string
	type: string
	scope: string
	props: Record<string, any>
	overrides: Record<string, any> | null
	locked: boolean
	orderIndex: number
}

type FieldSchema =
	| {
		name: string
		label?: string
		type:
		| 'text'
		| 'textarea'
		| 'number'
		| 'select'
		| 'multiselect'
		| 'boolean'
		| 'date'
		| 'url'
		| 'media'
		| 'object'
		| 'repeater'
		| 'slider'
		| 'icon'
		required?: boolean
		placeholder?: string
		options?: Array<{ label: string; value: string }>
		fields?: FieldSchema[] // for object
		item?: FieldSchema // for repeater
		// slider configuration (optional)
		min?: number
		max?: number
		step?: number
		unit?: string
	}
	| { name: string;[key: string]: any }

type EditorFieldCtx = {
	latestDraft: React.MutableRefObject<Record<string, any>>
	setDraft: React.Dispatch<React.SetStateAction<Record<string, any>>>
	fieldComponents: Record<string, any>
	supportedFieldTypes: Set<string>
	pascalFromType: (t: string) => string
	setByPath: (obj: Record<string, any>, path: string, value: any) => void
	getLabel: (path: string[], field: FieldSchema) => string
	syncFormToDraft: () => Record<string, any>
	getByPath: (obj: Record<string, any>, path: string) => any
	formRef: React.RefObject<HTMLFormElement | null>
}

function setByPath(obj: Record<string, any>, pathStr: string, value: any) {
	const parts = pathStr.split('.')
	let target: any = obj

	for (let i = 0; i < parts.length - 1; i++) {
		const key = parts[i]
		const nextKey = parts[i + 1]
		const nextIsIndex = /^\d+$/.test(nextKey)

		if (Array.isArray(target[key])) {
			target = target[key]
			continue
		}

		if (!Object.prototype.hasOwnProperty.call(target, key) || (!isPlainObject(target[key]) && !Array.isArray(target[key]))) {
			target[key] = nextIsIndex ? [] : {}
		}

		target = target[key]
	}

	const last = parts[parts.length - 1]
	if (Array.isArray(target) && /^\d+$/.test(last)) {
		target[Number(last)] = value
	} else {
		target[last] = value
	}
}

function getByPath(obj: Record<string, any>, pathStr: string): any {
	const parts = pathStr.split('.')
	let target: any = obj
	for (const part of parts) {
		if (target === null || target === undefined) return undefined
		target = target[part]
	}
	return target
}

function humanizeKey(raw: string): string {
	if (!raw) return ''
	let s = String(raw)
	s = s.replace(/[_-]+/g, ' ')
	s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
	s = s.trim()
	if (!s) return ''
	const words = s.split(/\s+/).map((w) => {
		const lower = w.toLowerCase()
		if (lower === 'cta') return 'CTA'
		if (lower === 'id') return 'ID'
		return lower.charAt(0).toUpperCase() + lower.slice(1)
	})
	return words.join(' ')
}

function getLabel(path: string[], field: FieldSchema): string {
	const explicit = (field as any).label
	if (explicit) return explicit as string
	const key = path[path.length - 1] || ''
	return humanizeKey(key)
}

function isPlainObject(value: unknown): value is Record<string, any> {
	return !!value && typeof value === 'object' && !Array.isArray(value)
}

function useIsDarkMode() {
	const [isDark, setIsDark] = useState(false)

	useEffect(() => {
		// Initial check
		setIsDark(document.documentElement.classList.contains('dark'))

		// Watch for changes
		const observer = new MutationObserver(() => {
			setIsDark(document.documentElement.classList.contains('dark'))
		})
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class'],
		})
		return () => observer.disconnect()
	}, [])

	return isDark
}

function mergeProps(base: Record<string, any>, overrides: Record<string, any> | null): Record<string, any> {
	if (!overrides) return base
	const result: Record<string, any> = { ...base }
	for (const key of Object.keys(overrides)) {
		const overrideVal = overrides[key]
		const baseVal = base[key]
		if (isPlainObject(overrideVal) && isPlainObject(baseVal)) {
			result[key] = mergeProps(baseVal, overrideVal)
		} else {
			result[key] = overrideVal
		}
	}
	return result
}

function diffOverrides(base: Record<string, any>, edited: Record<string, any>): Record<string, any> | null {
	const out: Record<string, any> = {}
	let changed = false
	for (const key of new Set([...Object.keys(base), ...Object.keys(edited)])) {
		const b = base[key]
		const e = edited[key]
		if (isPlainObject(b) && isPlainObject(e)) {
			const child = diffOverrides(b, e)
			if (child && Object.keys(child).length) {
				out[key] = child
				changed = true
			}
		} else if (Array.isArray(b) || Array.isArray(e)) {
			// Array editing not supported yet; if changed, store entire array
			if (JSON.stringify(b) !== JSON.stringify(e)) {
				out[key] = e
				changed = true
			}
		} else if (b !== e) {
			out[key] = e
			changed = true
		}
	}
	return changed ? out : null
}

export function ModuleEditorPanel({
	open,
	moduleItem,
	onClose,
	onSave,
	processing = false,
}: {
	open: boolean
	moduleItem: ModuleListItem | null
	onClose: () => void
	onSave: (overrides: Record<string, any> | null, edited: Record<string, any>) => Promise<void> | void
	processing?: boolean
}) {
	const merged = useMemo(
		() => (moduleItem ? mergeProps(moduleItem.props || {}, moduleItem.overrides || null) : {}),
		[moduleItem]
	)
	const [draft, setDraft] = useState<Record<string, any>>(merged)
	const [schema, setSchema] = useState<FieldSchema[] | null>(null)
	const [moduleLabel, setModuleLabel] = useState<string | null>(null)
	const formRef = useRef<HTMLFormElement | null>(null)

	const fieldComponents = useMemo(() => {
		const modules = import.meta.glob('../../fields/*.tsx', { eager: true }) as Record<
			string,
			{ default: any }
		>
		const map: Record<string, any> = {}
		Object.entries(modules).forEach(([p, mod]) => {
			const nm = p.split('/').pop()?.replace(/\.\w+$/, '')
			if (nm && mod?.default) map[nm] = mod.default
		})
		return map
	}, [])

	const pascalFromType = (t: string) =>
		t
			.split(/[-_]/g)
			.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
			.join('')

	const supportedFieldTypes = useMemo(
		() =>
			new Set([
				'text',
				'textarea',
				'number',
				'select',
				'multiselect',
				'boolean',
				'url',
				'link',
				'file',
				'taxonomy',
				'form-reference',
				'post-reference',
				'richtext',
				'slider',
			]),
		[]
	)

	const latestDraft = useRef(draft)
	useEffect(() => {
		latestDraft.current = draft
	}, [draft])

	const syncFormToDraft = useCallback((): Record<string, any> => {
		const edited = JSON.parse(JSON.stringify(latestDraft.current))
		const form = formRef.current
		if (form) {
			const elements = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input[name], textarea[name], select[name]')
			elements.forEach((el) => {
				const name = el.getAttribute('name')!
				if ((el as HTMLInputElement).type === 'checkbox') {
					setByPath(edited, name, (el as HTMLInputElement).checked)
				} else if ((el as HTMLInputElement).type === 'number') {
					const val = (el as HTMLInputElement).value
					setByPath(edited, name, val === '' ? 0 : Number(val))
				} else if ((el as HTMLInputElement).dataset && (el as HTMLInputElement).dataset.json === '1') {
					const val = (el as HTMLInputElement).value
					try {
						setByPath(edited, name, val ? JSON.parse(val) : null)
					} catch {
						setByPath(edited, name, val)
					}
				} else if ((el as HTMLInputElement).dataset && (el as HTMLInputElement).dataset.bool === '1') {
					const val = (el as HTMLInputElement).value
					setByPath(edited, name, val === 'true')
				} else if ((el as HTMLInputElement).dataset && (el as HTMLInputElement).dataset.number === '1') {
					const val = (el as HTMLInputElement).value
					setByPath(edited, name, val === '' ? 0 : Number(val))
				} else if ((el as HTMLSelectElement).multiple) {
					const vals = Array.from((el as HTMLSelectElement).selectedOptions).map((o) => o.value)
					setByPath(edited, name, vals)
				} else {
					setByPath(edited, name, (el as HTMLInputElement).value)
				}
			})
		}
		return edited
	}, [])

	useEffect(() => {
		if (!open || !moduleItem) return
		setDraft(mergeProps(moduleItem.props || {}, moduleItem.overrides || null))
		setModuleLabel(null)
		// Only reinitialize when the selection changes, not on object identity churn
	}, [open, moduleItem?.id])

	// Load module schema (if available)
	useEffect(() => {
		let alive = true
			; (async () => {
				if (!open || !moduleItem) return
				try {
					const res = await fetch(`/api/modules/${encodeURIComponent(moduleItem.type)}/schema`, {
						credentials: 'same-origin',
					})
					const json = await res.json().catch(() => null)
					const ps =
						json?.data?.propsSchema ||
						json?.propsSchema ||
						(json?.data?.schema ? json?.data?.schema?.propsSchema : null) ||
						null
					const friendlyName: string | null =
						(json?.data && (json.data.name as string | undefined)) ||
						(json && (json.name as string | undefined)) ||
						null
					if (alive) {
						setModuleLabel(friendlyName || moduleItem.type)
					}
					if (ps && typeof ps === 'object') {
						const fields: FieldSchema[] = Object.keys(ps).map((k) => {
							const def = (ps as any)[k] || {}
							return { name: k, ...(def || {}) }
						})
						if (alive) setSchema(fields)
					} else {
						if (alive) setSchema(null)
					}
				} catch {
					if (alive) setSchema(null)
				}
			})()
		return () => {
			alive = false
		}
	}, [open, moduleItem?.type])

	const ctx = useMemo(
		() => ({
			latestDraft,
			setDraft,
			fieldComponents,
			supportedFieldTypes,
			pascalFromType,
			setByPath,
			getLabel,
			syncFormToDraft,
			getByPath,
			formRef,
		}),
		[setDraft, fieldComponents, supportedFieldTypes, pascalFromType, syncFormToDraft]
	)

	// Note: We rely on Pointer-only DnD in the parent. Avoid global key interception to not break typing.
	if (!open || !moduleItem) return null

	return createPortal(
		<div
			className="fixed inset-0 z-40"
			onMouseDown={(e) => {
				// prevent outside dnd or other handlers from stealing focus
				e.stopPropagation()
			}}
		>
			<div className="absolute inset-0 bg-black/40" onClick={async () => {
				// Apply changes to parent as pending and close
				await (async () => {
					const base = moduleItem.props || {}
					const edited = JSON.parse(JSON.stringify(merged))
					const form = formRef.current
					if (form) {
						const elements = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input[name], textarea[name], select[name]')
						elements.forEach((el) => {
							const name = el.getAttribute('name')!
							if ((el as HTMLInputElement).type === 'checkbox') {
								setByPath(edited, name, (el as HTMLInputElement).checked)
							} else if ((el as HTMLInputElement).type === 'number') {
								const val = (el as HTMLInputElement).value
								setByPath(edited, name, val === '' ? 0 : Number(val))
							} else if ((el as HTMLInputElement).dataset && (el as HTMLInputElement).dataset.json === '1') {
								const val = (el as HTMLInputElement).value
								try {
									setByPath(edited, name, val ? JSON.parse(val) : null)
								} catch {
									setByPath(edited, name, val)
								}
							} else if ((el as HTMLSelectElement).multiple) {
								const vals = Array.from((el as HTMLSelectElement).selectedOptions).map((o) => o.value)
								setByPath(edited, name, vals)
							} else {
								setByPath(edited, name, (el as HTMLInputElement).value)
							}
						})
					}
					const overrides = diffOverrides(base, edited)
					await onSave(overrides, edited)
				})()
				onClose()
			}} />
			<div
				className="absolute right-0 top-0 h-full w-full max-w-2xl bg-backdrop-low border-l border-line-low shadow-xl flex flex-col"
				role="dialog"
				aria-modal="true"
			>
				<div className="px-5 py-4 border-b border-line-low flex items-center justify-between">
					<h3 className="text-sm font-semibold text-neutral-high">
						Edit Module — {moduleLabel || moduleItem.type}
					</h3>
					<button type="button" className="text-neutral-low hover:text-neutral-high" onClick={async () => {
						const base = moduleItem.props || {}
						const edited = JSON.parse(JSON.stringify(merged))
						const form = formRef.current
						if (form) {
							const elements = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input[name], textarea[name], select[name]')
							elements.forEach((el) => {
								const name = el.getAttribute('name')!
								if ((el as HTMLInputElement).type === 'checkbox') {
									setByPath(edited, name, (el as HTMLInputElement).checked)
								} else if ((el as HTMLInputElement).type === 'number') {
									const val = (el as HTMLInputElement).value
									setByPath(edited, name, val === '' ? 0 : Number(val))
								} else if ((el as HTMLInputElement).dataset && (el as HTMLInputElement).dataset.json === '1') {
									const val = (el as HTMLInputElement).value
									try {
										setByPath(edited, name, val ? JSON.parse(val) : null)
									} catch {
										setByPath(edited, name, val)
									}
								} else if ((el as HTMLInputElement).dataset && (el as HTMLInputElement).dataset.bool === '1') {
									const val = (el as HTMLInputElement).value
									setByPath(edited, name, val === 'true')
								} else if ((el as HTMLInputElement).dataset && (el as HTMLInputElement).dataset.number === '1') {
									const val = (el as HTMLInputElement).value
									setByPath(edited, name, val === '' ? 0 : Number(val))
								} else if ((el as HTMLSelectElement).multiple) {
									const vals = Array.from((el as HTMLSelectElement).selectedOptions).map((o) => o.value)
									setByPath(edited, name, vals)
								} else {
									setByPath(edited, name, (el as HTMLInputElement).value)
								}
							})
						}
						const overrides = diffOverrides(base, edited)
						await onSave(overrides, edited)
						onClose()
					}}>
						Close
					</button>
				</div>
				<form
					ref={formRef}
					className="p-5 grid grid-cols-1 gap-5 overflow-auto"
					onSubmit={(e) => {
						e.preventDefault()
					}}
				>
					{schema && schema.length > 0 ? (
						schema.map((f) => (
							<FieldBySchemaInternal
								key={(f as any).name}
								path={[(f as any).name]}
								field={f}
								value={draft ? draft[(f as any).name] : undefined}
								rootId={moduleItem.id}
								ctx={ctx}
							/>
						))
					) : Object.keys(draft).length === 0 ? (
						<p className="text-sm text-neutral-low">No editable fields.</p>
					) : (
						Object.keys(draft).map((key) => {
							const rawVal = draft[key]
							// Heuristic: always treat 'content' as rich text
							if (key === 'content') {
								let initial: any = undefined
								if (isPlainObject(rawVal)) {
									initial = rawVal
								} else if (typeof rawVal === 'string') {
									try {
										const parsed = JSON.parse(rawVal)
										initial = parsed
									} catch {
										initial = undefined
									}
								}
								return (
									<div key={key}>
										<label className="block text-sm font-medium text-neutral-medium mb-1">{key}</label>
										{(fieldComponents as Record<string, any>)['RichtextField'] ? (
											(fieldComponents as Record<string, any>)['RichtextField']({
												editorKey: `${moduleItem.id}:${key}`,
												value: initial,
												onChange: (json: any) => {
													const hidden = (formRef.current?.querySelector(
														`input[type="hidden"][name="${key}"]`
													) as HTMLInputElement) || null
													if (hidden) {
														try {
															hidden.value = JSON.stringify(json)
														} catch {
															/* ignore */
														}
													}
													const next = JSON.parse(JSON.stringify(draft))
													setByPath(next, key, json)
													setDraft(next)
												},
											})
										) : (
											<LexicalEditor
												editorKey={`${moduleItem.id}:${key}`}
												value={initial}
												onChange={(json) => {
													const hidden = (formRef.current?.querySelector(
														`input[type="hidden"][name="${key}"]`
													) as HTMLInputElement) || null
													if (hidden) {
														try {
															hidden.value = JSON.stringify(json)
														} catch {
															/* ignore */
														}
													}
													const next = JSON.parse(JSON.stringify(draft))
													setByPath(next, key, json)
													setDraft(next)
												}}
											/>
										)}
										<input
											type="hidden"
											name={key}
											data-json="1"
											defaultValue={isPlainObject(rawVal) ? JSON.stringify(rawVal) : (typeof rawVal === 'string' ? rawVal : '')}
										/>
									</div>
								)
							}
							const val = rawVal
							if (isPlainObject(val) || Array.isArray(val)) {
								return (
									<div key={key}>
										<label className="block text-sm font-medium text-neutral-medium mb-1">{key}</label>
										<textarea
											className="w-full px-3 py-2 min-h-[140px] border border-border rounded-lg bg-backdrop-low text-neutral-high font-mono text-xs focus:ring-1 ring-ring focus:border-transparent"
											defaultValue={JSON.stringify(val, null, 2)}
											onBlur={(e) => {
												try {
													const parsed = JSON.parse(e.target.value || 'null')
													const next = JSON.parse(JSON.stringify(draft))
													setByPath(next, key, parsed)
													setDraft(next)
												} catch {
													toast.error('Invalid JSON')
												}
											}}
										/>
										<p className="text-xs text-neutral-low mt-1">Edit JSON directly.</p>
									</div>
								)
							}
							return (
								<FieldPrimitiveInternal
									key={key}
									path={[key]}
									field={{ name: key, type: typeof val === 'number' ? 'number' : typeof val === 'boolean' ? 'boolean' : 'text' } as any}
									value={val}
									rootId={moduleItem.id}
									ctx={ctx}
								/>
							)
						})
					)}
				</form>
				<div className="px-5 py-4 border-t border-line-low flex items-center justify-end gap-3">
					<button
						type="button"
						className="px-4 py-2 text-sm border border-line-medium rounded-lg hover:bg-backdrop-medium text-neutral-medium"
						onClick={async () => {
							const base = moduleItem.props || {}
							const edited = JSON.parse(JSON.stringify(merged))
							const form = formRef.current
							if (form) {
								const elements = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input[name], textarea[name], select[name]')
								elements.forEach((el) => {
									const name = el.getAttribute('name')!
									if ((el as HTMLInputElement).type === 'checkbox') {
										setByPath(edited, name, (el as HTMLInputElement).checked)
									} else if ((el as HTMLInputElement).type === 'number') {
										const val = (el as HTMLInputElement).value
										setByPath(edited, name, val === '' ? 0 : Number(val))
									} else if ((el as HTMLInputElement).dataset && (el as HTMLInputElement).dataset.json === '1') {
										const val = (el as HTMLInputElement).value
										try {
											setByPath(edited, name, val ? JSON.parse(val) : null)
										} catch {
											setByPath(edited, name, val)
										}
									} else if ((el as HTMLInputElement).dataset && (el as HTMLInputElement).dataset.bool === '1') {
										const val = (el as HTMLInputElement).value
										setByPath(edited, name, val === 'true')
									} else if ((el as HTMLInputElement).dataset && (el as HTMLInputElement).dataset.number === '1') {
										const val = (el as HTMLInputElement).value
										setByPath(edited, name, val === '' ? 0 : Number(val))
									} else if ((el as HTMLSelectElement).multiple) {
										const vals = Array.from((el as HTMLSelectElement).selectedOptions).map((o) => o.value)
										setByPath(edited, name, vals)
									} else {
										setByPath(edited, name, (el as HTMLInputElement).value)
									}
								})
							}
							const overrides = diffOverrides(base, edited)
							await onSave(overrides, edited)
							onClose()
						}}
						disabled={processing}
					>
						Done
					</button>
				</div>
			</div>
		</div>,
		document.body
	)
}

function FieldPrimitiveInternal({
	path,
	field,
	value,
	rootId,
	ctx,
}: {
	path: string[]
	field: FieldSchema
	value: any
	rootId: string
	ctx: EditorFieldCtx
}) {
	const name = path.join('.')
	const hideLabel = (field as any).hideLabel === true
	const label = hideLabel ? '' : ctx.getLabel(path, field)
	const type = (field as any).type as string

	const maybeRenderComponent = () => {
		const compName = `${ctx.pascalFromType(type)}Field`
		const Renderer = (ctx.fieldComponents as Record<string, any>)[compName]
		if (!Renderer || !ctx.supportedFieldTypes.has(type)) return null

		const hiddenRef = useRef<HTMLInputElement | null>(null)
		const cfg = field as any
		const handleChange = (val: any) => {
			try {
				const next = JSON.parse(JSON.stringify(ctx.latestDraft.current))
				ctx.setByPath(next, name, val)
				ctx.setDraft(next)
			} catch { }
			if (hiddenRef.current) {
				if (val === null || val === undefined) hiddenRef.current.value = ''
				else if (typeof val === 'object') hiddenRef.current.value = JSON.stringify(val)
				else hiddenRef.current.value = String(val)
				hiddenRef.current.dispatchEvent(new Event('input', { bubbles: true }))
				hiddenRef.current.dispatchEvent(new Event('change', { bubbles: true }))
			}
		}

		const props: Record<string, any> = {
			value: value ?? null,
			onChange: handleChange,
			...cfg,
		}
		if (type === 'richtext') props.editorKey = `${rootId}:${name}`
		if (type === 'select') props.options = Array.isArray(cfg.options) ? cfg.options : []
		if (type === 'multiselect') {
			props.options = Array.isArray(cfg.options) ? cfg.options : []
			props.multiple = true
		}
		if (type === 'taxonomy') props.taxonomySlug = cfg.taxonomySlug

		return (
			<FormField>
				{!hideLabel && <FormLabel>{label}</FormLabel>}
				<Renderer {...props} />
				<input
					ref={hiddenRef}
					type="hidden"
					name={name}
					defaultValue={
						value === null || value === undefined
							? ''
							: typeof value === 'object'
								? JSON.stringify(value)
								: String(value)
					}
				/>
			</FormField>
		)
	}

	const rendered = maybeRenderComponent()
	if (rendered) return rendered
	if (type === 'date') {
		const initial = typeof value === 'string' ? value : ''
		const initialDate = initial ? new Date(initial) : null
		const [selected, setSelected] = useState<Date | null>(initialDate)
		const hiddenRef = useRef<HTMLInputElement | null>(null)
		function formatDate(d: Date | null) {
			if (!d) return ''
			const y = d.getFullYear()
			const m = String(d.getMonth() + 1).padStart(2, '0')
			const da = String(d.getDate()).padStart(2, '0')
			return `${y}-${m}-${da}`
		}
		return (
			<FormField>
				{!hideLabel && <FormLabel>{label}</FormLabel>}
				<Popover>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="w-full text-left px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high hover:bg-backdrop-medium"
						>
							{selected ? formatDate(selected) : 'Pick a date'}
						</button>
					</PopoverTrigger>
					<PopoverContent>
						<Calendar
							mode="single"
							selected={selected || undefined}
							onSelect={(d: Date | undefined) => {
								const val = d || null
								setSelected(val)
								if (hiddenRef.current) {
									hiddenRef.current.value = formatDate(val)
								}
							}}
						/>
					</PopoverContent>
				</Popover>
				<input type="hidden" ref={hiddenRef} name={name} defaultValue={initial} />
			</FormField>
		)
	}
	if (type === 'slider') {
		const min = (field as any).min ?? 0
		const max = (field as any).max ?? 100
		const step = (field as any).step ?? 1
		const unit = (field as any).unit ?? ''
		const current = typeof value === 'number' ? value : min
		const [val, setVal] = useState<number>(current)
		const hiddenRef = useRef<HTMLInputElement | null>(null)
		return (
			<FormField>
				{!hideLabel && <FormLabel>{label}</FormLabel>}
				<Slider
					defaultValue={[current]}
					min={min}
					max={max}
					step={step}
					onValueChange={(v) => {
						const n = Array.isArray(v) ? (v[0] ?? min) : min
						setVal(n)
						if (hiddenRef.current) hiddenRef.current.value = String(n)
					}}
				/>
				<div className="mt-1 text-xs text-neutral-medium">
					{val}{unit} (min {min}, max {max}, step {step})
				</div>
				<input type="hidden" name={name} ref={hiddenRef} defaultValue={String(current)} data-number="1" />
			</FormField>
		)
	}
	if (type === 'textarea') {
		return (
			<FormField>
				{!hideLabel && <FormLabel>{label}</FormLabel>}
				<Textarea name={name} defaultValue={value ?? ''} />
			</FormField>
		)
	}
	if (type === 'media') {
		type ModalMediaItem = { id: string; url: string; originalFilename?: string; alt?: string | null }
		const storeAsId = (field as any).storeAs === 'id' || (field as any).store === 'id'
		const [modalOpen, setModalOpen] = useState(false)
		const hiddenRef = useRef<HTMLInputElement | null>(null)
		const displayRef = useRef<HTMLInputElement | null>(null)
		const currentVal = typeof value === 'string' ? value : ''
		const [preview, setPreview] = useState<ModalMediaItem | null>(null)
		const [mediaData, setMediaData] = useState<{
			baseUrl: string
			variants: MediaVariant[]
			darkSourceUrl?: string
		} | null>(null)
		const isDark = useIsDarkMode()

		// Load preview for existing value
		useEffect(() => {
			let alive = true
				; (async () => {
					try {
						if (storeAsId) {
							if (!currentVal) {
								if (alive) {
									setPreview(null)
									setMediaData(null)
								}
								return
							}
							const res = await fetch(`/api/media/${encodeURIComponent(currentVal)}`, { credentials: 'same-origin' })
							const j = await res.json().catch(() => ({}))
							if (!j?.data) {
								if (alive) {
									setPreview(null)
									setMediaData(null)
								}
								return
							}
							const item: ModalMediaItem = {
								id: j.data.id,
								url: j.data.url,
								originalFilename: j.data.originalFilename,
								alt: j.data.alt
							}
							const meta = j.data.metadata || {}
							const variants: MediaVariant[] = Array.isArray(meta?.variants) ? meta.variants : []
							const darkSourceUrl = typeof meta.darkSourceUrl === 'string' ? meta.darkSourceUrl : undefined
							if (alive) {
								setPreview(item)
								setMediaData({ baseUrl: j.data.url, variants, darkSourceUrl })
							}
						} else {
							// If storing URL directly, best-effort preview
							if (typeof value === 'string' && value) {
								if (alive) {
									setPreview({ id: '', url: value, originalFilename: value, alt: null })
									setMediaData(null)
								}
							} else {
								if (alive) {
									setPreview(null)
									setMediaData(null)
								}
							}
						}
					} catch {
						if (alive) {
							setPreview(null)
							setMediaData(null)
						}
					}
				})()
			return () => { alive = false }
			// re-evaluate when selection changes
		}, [storeAsId, currentVal, value])

		// Compute the display URL based on theme
		const displayUrl = useMemo(() => {
			if (!preview) return null
			if (!mediaData) return preview.url
			return pickMediaVariantUrl(mediaData.baseUrl, mediaData.variants, 'thumb', {
				darkSourceUrl: mediaData.darkSourceUrl,
			})
		}, [preview, mediaData, isDark])

		function applySelection(m: ModalMediaItem) {
			if (storeAsId) {
				if (hiddenRef.current) {
					hiddenRef.current.value = m.id
					hiddenRef.current.dispatchEvent(new Event('input', { bubbles: true }))
					hiddenRef.current.dispatchEvent(new Event('change', { bubbles: true }))
				}
				if (displayRef.current) displayRef.current.value = m.id
			} else {
				if (displayRef.current) {
					displayRef.current.value = m.url
					displayRef.current.dispatchEvent(new Event('input', { bubbles: true }))
					displayRef.current.dispatchEvent(new Event('change', { bubbles: true }))
				}
			}
			try {
				const next = JSON.parse(JSON.stringify(ctx.latestDraft.current))
				ctx.setByPath(next, name, storeAsId ? m.id : m.url)
				ctx.setDraft(next)
			} catch { }
			setPreview(m)
			// Clear mediaData so it re-fetches on next render cycle
			setMediaData(null)
		}

		function clearSelection() {
			if (storeAsId) {
				if (hiddenRef.current) {
					hiddenRef.current.value = ''
					hiddenRef.current.dispatchEvent(new Event('input', { bubbles: true }))
					hiddenRef.current.dispatchEvent(new Event('change', { bubbles: true }))
				}
				if (displayRef.current) displayRef.current.value = ''
			} else {
				if (displayRef.current) {
					displayRef.current.value = ''
					displayRef.current.dispatchEvent(new Event('input', { bubbles: true }))
					displayRef.current.dispatchEvent(new Event('change', { bubbles: true }))
				}
			}
			try {
				const next = JSON.parse(JSON.stringify(ctx.latestDraft.current))
				ctx.setByPath(next, name, '')
				ctx.setDraft(next)
			} catch { }
			setPreview(null)
			setMediaData(null)
		}
		return (
			<FormField>
				{!hideLabel && <FormLabel>{label}</FormLabel>}
				<div className="flex items-start gap-3">
					<div className="min-w-[72px]">
						{displayUrl ? (
							<div className="w-[72px] h-[72px] border border-line-medium rounded overflow-hidden bg-backdrop-medium">
								<img src={displayUrl} alt={preview?.alt || preview?.originalFilename || ''} className="w-full h-full object-cover" key={`${displayUrl}-${isDark}`} />
							</div>
						) : (
							<div className="w-[72px] h-[72px] border border-dashed border-line-high rounded flex items-center justify-center text-[10px] text-neutral-medium">
								No image
							</div>
						)}
					</div>
					<div className="flex-1">
						{storeAsId ? (
							<>
								<input type="hidden" name={name} defaultValue={currentVal} ref={hiddenRef} />
								<input type="text" defaultValue={currentVal} ref={displayRef} className="hidden" readOnly />
							</>
						) : (
							<Input type="text" name={name} defaultValue={value ?? ''} ref={displayRef} placeholder={(field as any).placeholder || 'https://...'} />
						)}
						<div className="mt-2 flex items-center gap-2">
							<button
								type="button"
								className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
								onClick={() => setModalOpen(true)}
							>
								{preview ? 'Change' : 'Choose'}
							</button>
							{preview && (
								<button
									type="button"
									className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
									onClick={clearSelection}
								>
									Clear
								</button>
							)}
							{preview && (
								<div className="text-[11px] text-neutral-low truncate max-w-[240px]">
									{(preview.alt || preview.originalFilename || '').toString()}
								</div>
							)}
						</div>
					</div>
					<MediaPickerModal
						open={modalOpen}
						onOpenChange={setModalOpen}
						initialSelectedId={storeAsId ? (currentVal || undefined) : undefined}
						onSelect={(m) => {
							applySelection(m as ModalMediaItem)
						}}
					/>
				</div>
			</FormField>
		)
	}
	if (type === 'icon') {
		// Icon picker - shows available Fort Awesome icons
		const iconMap: Record<string, any> = {
			'arrow-right': faArrowRight,
			'bullhorn': faBullhorn,
			'scale-balanced': faScaleBalanced,
			'gear': faGear,
			'coins': faCoins,
			'pen-ruler': faPenRuler,
			'diagram-project': faDiagramProject,
			'circle-question': faCircleQuestion,
			'quote-left': faQuoteLeft,
			'check': faCheck,
			'chevron-down': faChevronDown,
			'cube': faCube,
			'language': faLanguage,
			'users': faUsers,
			'code-branch': faCodeBranch,
			'palette': faPalette,
			'bolt': faBolt,
		}

		const availableIcons = [
			{ name: 'arrow-right', label: 'Arrow Right', icon: faArrowRight },
			{ name: 'bullhorn', label: 'Bullhorn', icon: faBullhorn },
			{ name: 'scale-balanced', label: 'Scale Balanced', icon: faScaleBalanced },
			{ name: 'gear', label: 'Gear', icon: faGear },
			{ name: 'coins', label: 'Coins', icon: faCoins },
			{ name: 'pen-ruler', label: 'Pen Ruler', icon: faPenRuler },
			{ name: 'diagram-project', label: 'Diagram Project', icon: faDiagramProject },
			{ name: 'circle-question', label: 'Circle Question', icon: faCircleQuestion },
			{ name: 'quote-left', label: 'Quote Left', icon: faQuoteLeft },
			{ name: 'check', label: 'Check', icon: faCheck },
			{ name: 'chevron-down', label: 'Chevron Down', icon: faChevronDown },
			{ name: 'cube', label: 'Cube', icon: faCube },
			{ name: 'language', label: 'Language', icon: faLanguage },
			{ name: 'users', label: 'Users', icon: faUsers },
			{ name: 'code-branch', label: 'Code Branch', icon: faCodeBranch },
			{ name: 'palette', label: 'Palette', icon: faPalette },
			{ name: 'bolt', label: 'Bolt', icon: faBolt },
		]

		const initial = typeof value === 'string' ? value : ''
		const [selectedIcon, setSelectedIcon] = useState<string>(initial)
		const [pickerOpen, setPickerOpen] = useState(false)
		const hiddenRef = useRef<HTMLInputElement | null>(null)

		return (
			<FormField>
				{!hideLabel && <FormLabel>{label}</FormLabel>}
				<Popover open={pickerOpen} onOpenChange={setPickerOpen}>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="w-full text-left px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high hover:bg-backdrop-medium flex items-center gap-2"
						>
							{selectedIcon && iconMap[selectedIcon] ? (
								<>
									<FontAwesomeIcon icon={iconMap[selectedIcon]} className="w-4 h-4" />
									<span>{selectedIcon}</span>
								</>
							) : (
								<span className="text-neutral-low">Select an icon</span>
							)}
						</button>
					</PopoverTrigger>
					<PopoverContent className="w-96">
						<div className="grid grid-cols-4 gap-2 max-h-96 overflow-auto">
							{availableIcons.map((iconItem) => (
								<button
									key={iconItem.name}
									type="button"
									className={`p-3 border rounded-lg hover:bg-backdrop-medium flex flex-col items-center gap-1 ${selectedIcon === iconItem.name ? 'border-standout bg-standout/10' : 'border-line-low'
										}`}
									onClick={() => {
										setSelectedIcon(iconItem.name)
										if (hiddenRef.current) {
											hiddenRef.current.value = iconItem.name
											hiddenRef.current.dispatchEvent(new Event('input', { bubbles: true }))
											hiddenRef.current.dispatchEvent(new Event('change', { bubbles: true }))
										}
										try {
											const next = JSON.parse(JSON.stringify(ctx.latestDraft.current))
											ctx.setByPath(next, name, iconItem.name)
											ctx.setDraft(next)
										} catch { }
										setPickerOpen(false)
									}}
									title={iconItem.label}
								>
									<FontAwesomeIcon icon={iconItem.icon} className="w-6 h-6" />
									<span className="text-[10px] text-neutral-low truncate w-full text-center">
										{iconItem.label}
									</span>
								</button>
							))}
						</div>
					</PopoverContent>
				</Popover>
				<input type="hidden" name={name} ref={hiddenRef} defaultValue={initial} />
			</FormField>
		)
	}
	if (type === 'number') {
		return (
			<FormField>
				{!hideLabel && <FormLabel>{label}</FormLabel>}
				<Input type="number" name={name} defaultValue={value ?? 0} />
			</FormField>
		)
	}
	if (type === 'post-reference') {
		// Dynamic multi-select of posts (optionally limited to post types)
		const allowedTypes: string[] = Array.isArray((field as any).postTypes) ? (field as any).postTypes : []
		const allowMultiple = (field as any).allowMultiple !== false
		const [options, setOptions] = useState<Array<{ label: string; value: string }>>([])
		const initialVals: string[] = Array.isArray(value) ? value : (value ? [String(value)] : [])
		const [vals, setVals] = useState<string[]>(initialVals)
		const [query, setQuery] = useState('')
		const hiddenRef = useRef<HTMLInputElement | null>(null)

		useEffect(() => {
			if (hiddenRef.current) {
				hiddenRef.current.value = allowMultiple ? JSON.stringify(vals) : (vals[0] ?? '')
			}
		}, [vals, allowMultiple])

		useEffect(() => {
			let alive = true
				; (async () => {
					try {
						const params = new URLSearchParams()
						params.set('status', 'published')
						params.set('limit', '100')
						params.set('sortBy', 'published_at')
						params.set('sortOrder', 'desc')
						if (allowedTypes.length > 0) {
							params.set('types', allowedTypes.join(','))
						}
						const r = await fetch(`/api/posts?${params.toString()}`, { credentials: 'same-origin' })
						const j = await r.json().catch(() => ({}))
						const list: Array<{ id: string; title: string }> = Array.isArray(j?.data) ? j.data : []
						if (!alive) return
						setOptions(list.map((p) => ({ label: p.title || p.id, value: p.id })))
					} catch {
						if (!alive) return
						setOptions([])
					}
				})()
			return () => {
				alive = false
			}
		}, [allowedTypes.join(',')])

		const filteredOptions =
			query.trim().length === 0
				? options
				: options.filter((opt) => opt.label.toLowerCase().includes(query.toLowerCase()))

		return (
			<FormField>
				{!hideLabel && <FormLabel>{label}</FormLabel>}
				<Popover>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="w-full text-left px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high hover:bg-backdrop-medium"
						>
							{vals.length === 0 ? 'Select posts' : `${vals.length} selected`}
						</button>
					</PopoverTrigger>
					<PopoverContent className="w-80">
						<div className="space-y-2">
							<Input
								type="text"
								placeholder="Search posts…"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								className="h-8 text-xs"
							/>
							<div className="max-h-64 overflow-auto space-y-2">
								{filteredOptions.length === 0 ? (
									<div className="text-xs text-neutral-low">No posts found.</div>
								) : (
									filteredOptions.map((opt) => {
										const checked = vals.includes(opt.value)
										return (
											<label key={opt.value} className="flex items-center gap-2">
												<Checkbox
													checked={checked}
													onCheckedChange={(c) => {
														setVals((prev) => {
															if (allowMultiple) {
																const next = new Set(prev)
																if (c) next.add(opt.value)
																else next.delete(opt.value)
																return Array.from(next)
															}
															return c ? [opt.value] : []
														})
													}}
												/>
												<span className="text-sm">{opt.label}</span>
											</label>
										)
									})
								)}
							</div>
						</div>
					</PopoverContent>
				</Popover>
				<input
					type="hidden"
					name={name}
					ref={hiddenRef}
					defaultValue={allowMultiple ? JSON.stringify(initialVals) : (initialVals[0] ?? '')}
					data-json={allowMultiple ? '1' : undefined}
				/>
			</FormField>
		)
	}
	if (type === 'form-reference') {
		const [options, setOptions] = useState<Array<{ label: string; value: string }>>([])
		const initial = typeof value === 'string' ? value : ''
		const [current, setCurrent] = useState<string>(initial)
		const hiddenRef = useRef<HTMLInputElement | null>(null)

		useEffect(() => {
			let alive = true
				; (async () => {
					try {
						const res = await fetch('/api/forms-definitions', { credentials: 'same-origin' })
						const j = await res.json().catch(() => ({}))
						if (!alive) return
						const list: Array<any> = Array.isArray(j?.data) ? j.data : []
						setOptions(
							list.map((f) => ({
								value: String(f.slug),
								label: f.title ? String(f.title) : String(f.slug),
							}))
						)
					} catch {
						if (!alive) setOptions([])
					}
				})()
			return () => {
				alive = false
			}
		}, [])

		useEffect(() => {
			if (hiddenRef.current) {
				hiddenRef.current.value = current || ''
			}
		}, [current])

		return (
			<FormField>
				{!hideLabel && <FormLabel>{label}</FormLabel>}
				<Select
					defaultValue={initial || undefined}
					onValueChange={(val) => {
						setCurrent(val)
					}}
				>
					<SelectTrigger>
						<SelectValue placeholder="Select a form" />
					</SelectTrigger>
					<SelectContent>
						{options.map((opt) => (
							<SelectItem key={opt.value} value={opt.value}>
								{opt.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<input type="hidden" name={name} defaultValue={initial} ref={hiddenRef} />
			</FormField>
		)
	}
	if (type === 'select' || type === 'multiselect') {
		const [dynamicOptions, setDynamicOptions] = useState<Array<{ label: string; value: string }>>(
			Array.isArray((field as any).options) ? ((field as any).options as any) : []
		)
		const optionsSource = (field as any).optionsSource as string | undefined
		useEffect(() => {
			let alive = true
				; (async () => {
					try {
						// Only fetch when we have a known source and no static options
						if (dynamicOptions.length > 0) return
						if (optionsSource === 'post-types') {
							const r = await fetch('/api/post-types', { credentials: 'same-origin' })
							const j = await r.json().catch(() => ({}))
							const list: string[] = Array.isArray(j?.data) ? j.data : []
							if (!alive) return
							setDynamicOptions(list.map((t) => ({ label: t, value: t })))
						}
					} catch {
						/* ignore */
					}
				})()
			return () => {
				alive = false
			}
		}, [optionsSource, dynamicOptions.length])
		const options = dynamicOptions
		const isMulti = type === 'multiselect'
		if (!isMulti) {
			const initial = typeof value === 'string' ? value : ''
			const hiddenRef = useRef<HTMLInputElement | null>(null)
			return (
				<FormField>
					{!hideLabel && <FormLabel>{label}</FormLabel>}
					<Select
						defaultValue={initial || undefined}
						onValueChange={(val) => {
							if (hiddenRef.current) hiddenRef.current.value = val ?? ''
						}}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select an option" />
						</SelectTrigger>
						<SelectContent>
							{options.map((opt: any) => (
								<SelectItem key={opt.value} value={opt.value}>
									{opt.label ?? opt.value}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<input type="hidden" name={name} defaultValue={initial} ref={hiddenRef} />
				</FormField>
			)
		} else {
			const initial: string[] = Array.isArray(value) ? value : []
			const [vals, setVals] = useState<string[]>(initial)
			const hiddenRef = useRef<HTMLInputElement | null>(null)
			useEffect(() => {
				if (hiddenRef.current) hiddenRef.current.value = JSON.stringify(vals)
			}, [vals])
			return (
				<FormField>
					{!hideLabel && <FormLabel>{label}</FormLabel>}
					<Popover>
						<PopoverTrigger asChild>
							<button
								type="button"
								className="w-full text-left px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high hover:bg-backdrop-medium"
							>
								{vals.length === 0 ? 'Select options' : `${vals.length} selected`}
							</button>
						</PopoverTrigger>
						<PopoverContent className="w-64">
							<div className="space-y-2">
								{options.map((opt: any) => {
									const checked = vals.includes(opt.value)
									return (
										<label key={opt.value} className="flex items-center gap-2">
											<Checkbox
												checked={checked}
												onCheckedChange={(c) => {
													setVals((prev) => {
														const next = new Set(prev)
														if (c) next.add(opt.value)
														else next.delete(opt.value)
														return Array.from(next)
													})
												}}
											/>
											<span className="text-sm">{opt.label ?? opt.value}</span>
										</label>
									)
								})}
							</div>
						</PopoverContent>
					</Popover>
					<input type="hidden" name={name} defaultValue={JSON.stringify(initial)} ref={hiddenRef} data-json="1" />
				</FormField>
			)
		}
	}
	if (type === 'link') {
		const initial: LinkFieldValue = (value as any) ?? null
		const hiddenRef = useRef<HTMLInputElement | null>(null)
		useEffect(() => {
			if (!hiddenRef.current) return
			if (!initial) {
				hiddenRef.current.value = ''
			} else {
				hiddenRef.current.value = JSON.stringify(initial)
			}
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [])
		return (
			<>
				<LinkField
					label={label}
					value={value}
					onChange={(val: LinkFieldValue) => {
						if (hiddenRef.current) {
							hiddenRef.current.value = val ? JSON.stringify(val) : ''
						}
					}}
				/>
				<input
					type="hidden"
					name={name}
					defaultValue={initial ? JSON.stringify(initial) : ''}
					ref={hiddenRef}
					data-json="1"
				/>
			</>
		)
	}
	if (type === 'boolean') {
		return (
			<div className="flex items-center gap-2">
				<Checkbox
					defaultChecked={!!value}
					onCheckedChange={(checked) => {
						const hidden = document.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`)
						if (hidden) hidden.value = checked ? 'true' : 'false'
					}}
					id={`${rootId}:${name}`}
				/>
				<label htmlFor={`${rootId}:${name}`} className="text-sm text-neutral-high">
					{label}
				</label>
				<input type="hidden" name={name} defaultValue={!!value ? 'true' : 'false'} data-bool="1" />
			</div>
		)
	}
	// text, url, media fallback to text input
	return (
		<FormField>
			{!hideLabel && <FormLabel>{label}</FormLabel>}
			<Input type="text" name={name} placeholder={(field as any).placeholder || ''} defaultValue={value ?? ''} />
		</FormField>
	)
}

function FieldBySchemaInternal({
	path,
	field,
	value,
	rootId,
	ctx,
}: {
	path: string[]
	field: FieldSchema
	value: any
	rootId: string
	ctx: EditorFieldCtx
}) {
	const type = (field as any).type as string
	const name = path.join('.')
	const label = ctx.getLabel(path, field)
	if (type === 'object') {
		// Support both `fields: FieldSchema[]` and `properties: { [key]: schema }`
		const rawFields: any = (field as any).fields
		let objectFields: FieldSchema[] | null = null

		if (Array.isArray(rawFields)) {
			objectFields = rawFields as FieldSchema[]
		} else if ((field as any).properties && typeof (field as any).properties === 'object') {
			const props = (field as any).properties as Record<string, any>
			objectFields = Object.keys(props).map((propName) => {
				const def = props[propName] || {}
				return { name: propName, ...(def as any) } as FieldSchema
			})
		}

		if (objectFields && objectFields.length > 0) {
			return (
				<fieldset className="border border-line-low rounded-lg p-3">
					<legend className="px-1 text-xs font-medium text-neutral-low">{label}</legend>
					<div className="grid grid-cols-1 gap-4">
						{objectFields.map((f) => (
							<FieldBySchemaInternal
								key={`${name}.${(f as any).name}`}
								path={[...path, (f as any).name]}
								field={f}
								value={value ? value[(f as any).name] : undefined}
								rootId={rootId}
								ctx={ctx}
							/>
						))}
					</div>
				</fieldset>
			)
		}
	}
	if (type === 'repeater' || type === 'array') {
		const items: any[] = Array.isArray(value) ? value : []
		const rawItemSchema: FieldSchema | undefined = (field as any).item
		const rawItemsDef: any = (field as any).items

		let itemSchema: FieldSchema | undefined = rawItemSchema

		// Support "array + items.properties" shape from backend by mapping to a repeater item schema
		if (!itemSchema && rawItemsDef) {
			const itemsType = (rawItemsDef as any).type
			const props = (rawItemsDef as any).properties
			if (itemsType === 'object' && props && typeof props === 'object') {
				const fields: FieldSchema[] = Object.keys(props).map((propName) => {
					const def = (props as any)[propName] || {}
					return { name: propName, ...(def || {}) }
				})
				itemSchema = { name: 'item', type: 'object', fields } as any
			} else {
				itemSchema = { name: 'item', ...(rawItemsDef || {}) } as any
			}
		}
		return (
			<fieldset className="border border-line-low rounded-lg p-3">
				<legend className="px-1 text-xs font-medium text-neutral-low">{label}</legend>
				<div className="space-y-3">
					{items.length === 0 && (
						<p className="text-xs text-neutral-low">No items. Click “Add Item”.</p>
					)}
					{items.map((it, idx) => (
						<div key={`${name}.${idx}`} className="border border-line-low rounded p-3 space-y-2">
							<div className="flex items-center justify-end gap-2">
								<button
									type="button"
									className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => {
										const scroller = ctx.formRef.current
										const prevScrollTop = scroller ? scroller.scrollTop : 0
										const next = ctx.syncFormToDraft()
										const currentValue = ctx.getByPath(next, name)
										const arr = Array.isArray(currentValue) ? [...currentValue] : []
										arr.splice(idx, 1)
										ctx.setByPath(next, name, arr)
										ctx.setDraft(next)
										requestAnimationFrame(() => {
											if (scroller) scroller.scrollTop = prevScrollTop
										})
									}}
								>
									Remove
								</button>
								<button
									type="button"
									className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => {
										if (idx === 0) return
										const scroller = ctx.formRef.current
										const prevScrollTop = scroller ? scroller.scrollTop : 0
										const next = ctx.syncFormToDraft()
										const currentValue = ctx.getByPath(next, name)
										const arr = Array.isArray(currentValue) ? [...currentValue] : []
										const [moved] = arr.splice(idx, 1)
										arr.splice(idx - 1, 0, moved)
										ctx.setByPath(next, name, arr)
										ctx.setDraft(next)
										requestAnimationFrame(() => {
											if (scroller) scroller.scrollTop = prevScrollTop
										})
									}}
								>
									Up
								</button>
								<button
									type="button"
									className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => {
										if (idx >= items.length - 1) return
										const scroller = ctx.formRef.current
										const prevScrollTop = scroller ? scroller.scrollTop : 0
										const next = ctx.syncFormToDraft()
										const currentValue = ctx.getByPath(next, name)
										const arr = Array.isArray(currentValue) ? [...currentValue] : []
										const [moved] = arr.splice(idx, 1)
										arr.splice(idx + 1, 0, moved)
										ctx.setByPath(next, name, arr)
										ctx.setDraft(next)
										requestAnimationFrame(() => {
											if (scroller) scroller.scrollTop = prevScrollTop
										})
									}}
								>
									Down
								</button>
							</div>
							{itemSchema ? (
								<>
									{(itemSchema as any).type === 'object' &&
										Array.isArray((itemSchema as any).fields) ? (
										<>
											{((itemSchema as any).fields as FieldSchema[]).map((f) => (
												<FieldBySchemaInternal
													key={`${name}.${idx}.${(f as any).name}`}
													path={[...path, String(idx), (f as any).name]}
													field={f}
													value={it ? it[(f as any).name] : undefined}
													rootId={rootId}
													ctx={ctx}
												/>
											))}
										</>
									) : (
										<FieldBySchemaInternal
											path={[...path, String(idx)]}
											field={{ ...itemSchema, name: String(idx), hideLabel: true } as any}
											value={it}
											rootId={rootId}
											ctx={ctx}
										/>
									)}
								</>
							) : (
								<FieldPrimitiveInternal
									path={[...path, String(idx)]}
									field={{ name: String(idx), type: 'text', hideLabel: true } as any}
									value={it}
									rootId={rootId}
									ctx={ctx}
								/>
							)}
						</div>
					))}
					<button
						type="button"
						className="px-3 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => {
							const scroller = ctx.formRef.current
							const prevScrollTop = scroller ? scroller.scrollTop : 0
							const next = ctx.syncFormToDraft()
							const currentValue = ctx.getByPath(next, name)
							const arr = Array.isArray(currentValue) ? [...currentValue] : []
							// Create an empty item based on schema
							let empty: any = ''
							if (itemSchema) {
								const t = (itemSchema as any).type
								if (t === 'object' && Array.isArray((itemSchema as any).fields)) {
									empty = {}
										; (itemSchema as any).fields.forEach((f: any) => {
											empty[f.name] =
												f.type === 'number' ? 0 : f.type === 'boolean' ? false : ''
										})
								} else if (t === 'number') {
									empty = 0
								} else if (t === 'boolean') {
									empty = false
								} else if (t === 'multiselect') {
									empty = []
								} else {
									empty = ''
								}
							}
							arr.push(empty)
							ctx.setByPath(next, name, arr)
							ctx.setDraft(next)
							requestAnimationFrame(() => {
								if (scroller) scroller.scrollTop = prevScrollTop
							})
						}}
					>
						Add Item
					</button>
				</div>
			</fieldset>
		)
	}
	// primitive field types
	return <FieldPrimitiveInternal path={path} field={field} value={value} rootId={rootId} ctx={ctx} />
}
