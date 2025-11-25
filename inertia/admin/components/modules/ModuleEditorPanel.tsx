import { useEffect, useMemo, useRef, useState } from 'react'
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

function isPlainObject(value: unknown): value is Record<string, any> {
	return !!value && typeof value === 'object' && !Array.isArray(value)
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
	const formRef = useRef<HTMLFormElement | null>(null)

	useEffect(() => {
		if (!open || !moduleItem) return
		setDraft(mergeProps(moduleItem.props || {}, moduleItem.overrides || null))
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

	// Note: We rely on Pointer-only DnD in the parent. Avoid global key interception to not break typing.

	if (!open || !moduleItem) return null

	function setByPath(obj: Record<string, any>, pathStr: string, value: any) {
		const parts = pathStr.split('.')
		let target = obj
		for (let i = 0; i < parts.length - 1; i++) {
			const p = parts[i]
			if (!isPlainObject(target[p])) target[p] = {}
			target = target[p]
		}
		target[parts[parts.length - 1]] = value
	}

	// removed unused trySave (we now save on explicit action buttons)

	function FieldPrimitive({
		path,
		field,
		value,
		rootId,
	}: {
		path: string[]
		field: FieldSchema
		value: any
		rootId: string
	}) {
		const name = path.join('.')
		const label = (field as any).label || path[path.length - 1]
		const type = (field as any).type as string
		if (type === 'richtext') {
			const hiddenRef = useRef<HTMLInputElement | null>(null)
			return (
				<FormField>
					<FormLabel>{label}</FormLabel>
					<LexicalEditor
						editorKey={`${rootId}:${name}`}
						value={value}
						onChange={(json) => {
							if (hiddenRef.current) {
								try {
									hiddenRef.current.value = JSON.stringify(json)
								} catch {
									// ignore
								}
							}
						}}
					/>
					<input
						type="hidden"
						name={name}
						ref={hiddenRef}
						data-json="1"
						defaultValue={value ? JSON.stringify(value) : ''}
					/>
				</FormField>
			)
		}
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
					<FormLabel>{label}</FormLabel>
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
					<FormLabel>{label}</FormLabel>
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
					<FormLabel>{label}</FormLabel>
					<Textarea name={name} defaultValue={value ?? ''} />
				</FormField>
			)
		}
    if (type === 'media') {
      const storeAsId = (field as any).storeAs === 'id' || (field as any).store === 'id'
      const [open, setOpen] = useState(false)
      const [media, setMedia] = useState<Array<{ id: string; url: string; originalFilename: string }>>([])
      const [loading, setLoading] = useState(false)
      useEffect(() => {
        if (!open) return
        let alive = true
        ;(async () => {
          try {
            setLoading(true)
            const res = await fetch('/api/media?limit=100', { credentials: 'same-origin' })
            const j = await res.json().catch(() => ({}))
            const list: Array<{ id: string; url: string; originalFilename: string }> = Array.isArray(j?.data) ? j.data : []
            if (alive) setMedia(list)
          } finally {
            if (alive) setLoading(false)
          }
        })()
        return () => { alive = false }
      }, [open])
      const hiddenRef = useRef<HTMLInputElement | null>(null)
      const displayRef = useRef<HTMLInputElement | null>(null)
      return (
        <FormField>
          <FormLabel>{label}</FormLabel>
          <div className="flex items-center gap-2">
            {storeAsId ? (
              <>
                <Input type="text" defaultValue={typeof value === 'string' ? value : ''} readOnly className="opacity-80" ref={displayRef} />
                <input type="hidden" name={name} defaultValue={typeof value === 'string' ? value : ''} ref={hiddenRef} />
              </>
            ) : (
              <Input type="text" name={name} defaultValue={value ?? ''} ref={displayRef} placeholder={(field as any).placeholder || 'https://...'} />
            )}
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <button type="button" className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium text-neutral-medium">Choose</button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px]">
                <div className="text-sm mb-2">{loading ? 'Loading…' : 'Select an item'}</div>
                <div className="grid grid-cols-3 gap-2 max-h-64 overflow-auto">
                  {media.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      className="border border-line rounded overflow-hidden hover:bg-backdrop-medium"
                      onClick={() => {
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
                        // persist into draft so any re-render keeps the chosen value
                        try {
                          const next = JSON.parse(JSON.stringify(draft))
                          setByPath(next, name, storeAsId ? m.id : m.url)
                          setDraft(next)
                        } catch {}
                        setOpen(false)
                      }}
                    >
                      <div className="aspect-video bg-backdrop-medium">
                        <img src={m.url} alt={m.originalFilename} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-1 text-[10px] text-neutral-medium truncate">{storeAsId ? m.id : m.originalFilename}</div>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </FormField>
      )
    }
		if (type === 'number') {
			return (
				<FormField>
					<FormLabel>{label}</FormLabel>
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
			const hiddenRef = useRef<HTMLInputElement | null>(null)
			useEffect(() => {
				if (hiddenRef.current) {
					hiddenRef.current.value = allowMultiple ? JSON.stringify(vals) : (vals[0] ?? '')
				}
			}, [vals, allowMultiple])
			useEffect(() => {
				let alive = true
				;(async () => {
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
			return (
				<FormField>
					<FormLabel>{label}</FormLabel>
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
							<div className="max-h-64 overflow-auto space-y-2">
								{options.length === 0 ? (
									<div className="text-xs text-neutral-low">No posts available.</div>
								) : options.map((opt) => {
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
								})}
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
		if (type === 'select' || type === 'multiselect') {
			const [dynamicOptions, setDynamicOptions] = useState<Array<{ label: string; value: string }>>(
				Array.isArray((field as any).options) ? ((field as any).options as any) : []
			)
			const optionsSource = (field as any).optionsSource as string | undefined
			useEffect(() => {
				let alive = true
				;(async () => {
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
				// eslint-disable-next-line react-hooks/exhaustive-deps
			}, [optionsSource])
			const options = dynamicOptions
			const isMulti = type === 'multiselect'
			if (!isMulti) {
				const initial = typeof value === 'string' ? value : ''
				const hiddenRef = useRef<HTMLInputElement | null>(null)
				return (
					<FormField>
						<FormLabel>{label}</FormLabel>
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
						<FormLabel>{label}</FormLabel>
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
				<FormLabel>{label}</FormLabel>
				<Input type="text" name={name} placeholder={(field as any).placeholder || ''} defaultValue={value ?? ''} />
			</FormField>
		)
	}

	function FieldBySchema({
		path,
		field,
		value,
		rootId,
	}: {
		path: string[]
		field: FieldSchema
		value: any
		rootId: string
	}) {
		const type = (field as any).type as string
		const name = path.join('.')
		const label = (field as any).label || path[path.length - 1]
		if (type === 'object' && Array.isArray((field as any).fields)) {
			return (
				<fieldset className="border border-line rounded-lg p-3">
					<legend className="px-1 text-xs font-medium text-neutral-low">{label}</legend>
					<div className="grid grid-cols-1 gap-4">
						{((field as any).fields as FieldSchema[]).map((f) => (
							<FieldBySchema
								key={`${name}.${(f as any).name}`}
								path={[...path, (f as any).name]}
								field={f}
								value={value ? value[(f as any).name] : undefined}
								rootId={rootId}
							/>
						))}
					</div>
				</fieldset>
			)
		}
		if (type === 'repeater') {
			const items: any[] = Array.isArray(value) ? value : []
			const itemSchema: FieldSchema | undefined = (field as any).item
			return (
				<fieldset className="border border-line rounded-lg p-3">
					<legend className="px-1 text-xs font-medium text-neutral-low">{label}</legend>
					<div className="space-y-3">
						{items.length === 0 && (
							<p className="text-xs text-neutral-low">No items. Click “Add Item”.</p>
						)}
						{items.map((it, idx) => (
							<div key={`${name}.${idx}`} className="border border-line rounded p-3 space-y-2">
								<div className="flex items-center justify-between">
									<div className="text-xs text-neutral-low">Item {idx + 1}</div>
									<div className="flex items-center gap-2">
										<button
											type="button"
											className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium text-neutral-medium"
											onMouseDown={(e) => e.preventDefault()}
											onClick={() => {
												const scroller = formRef.current
												const prevScrollTop = scroller ? scroller.scrollTop : 0
												const next = JSON.parse(JSON.stringify(draft))
												const arr = Array.isArray(value) ? [...value] : []
												arr.splice(idx, 1)
												setByPath(next, name, arr)
												setDraft(next)
												requestAnimationFrame(() => {
													if (scroller) scroller.scrollTop = prevScrollTop
												})
											}}
										>
											Remove
										</button>
										<button
											type="button"
											className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium text-neutral-medium"
											onMouseDown={(e) => e.preventDefault()}
											onClick={() => {
												if (idx === 0) return
												const scroller = formRef.current
												const prevScrollTop = scroller ? scroller.scrollTop : 0
												const next = JSON.parse(JSON.stringify(draft))
												const arr = Array.isArray(value) ? [...value] : []
												const [moved] = arr.splice(idx, 1)
												arr.splice(idx - 1, 0, moved)
												setByPath(next, name, arr)
												setDraft(next)
												requestAnimationFrame(() => {
													if (scroller) scroller.scrollTop = prevScrollTop
												})
											}}
										>
											Up
										</button>
										<button
											type="button"
											className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium text-neutral-medium"
											onMouseDown={(e) => e.preventDefault()}
											onClick={() => {
												if (idx >= items.length - 1) return
												const scroller = formRef.current
												const prevScrollTop = scroller ? scroller.scrollTop : 0
												const next = JSON.parse(JSON.stringify(draft))
												const arr = Array.isArray(value) ? [...value] : []
												const [moved] = arr.splice(idx, 1)
												arr.splice(idx + 1, 0, moved)
												setByPath(next, name, arr)
												setDraft(next)
												requestAnimationFrame(() => {
													if (scroller) scroller.scrollTop = prevScrollTop
												})
											}}
										>
											Down
										</button>
									</div>
								</div>
								{itemSchema ? (
									<FieldBySchema
										path={[...path, String(idx)]}
										field={{ ...itemSchema, name: String(idx) } as any}
										value={it}
										rootId={rootId}
									/>
								) : (
									<FieldPrimitive
										path={[...path, String(idx)]}
										field={{ name: String(idx), type: 'text' } as any}
										value={it}
										rootId={rootId}
									/>
								)}
							</div>
						))}
						<button
							type="button"
							className="px-3 py-1 text-xs border border-line rounded hover:bg-backdrop-medium text-neutral-medium"
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => {
								const scroller = formRef.current
								const prevScrollTop = scroller ? scroller.scrollTop : 0
								const next = JSON.parse(JSON.stringify(draft))
								const arr = Array.isArray(value) ? [...value] : []
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
								setByPath(next, name, arr)
								setDraft(next)
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
		return <FieldPrimitive path={path} field={field} value={value} rootId={rootId} />
	}

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
				className="absolute right-0 top-0 h-full w-full max-w-2xl bg-backdrop-low border-l border-line shadow-xl flex flex-col"
				role="dialog"
				aria-modal="true"
			>
				<div className="px-5 py-4 border-b border-line flex items-center justify-between">
					<h3 className="text-sm font-semibold text-neutral-high">
						Edit Module — {moduleItem.type}
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
							<FieldBySchema
								key={(f as any).name}
								path={[(f as any).name]}
								field={f}
								value={draft ? draft[(f as any).name] : undefined}
								rootId={moduleItem.id}
							/>
						))
					) : Object.keys(draft).length === 0 ? (
						<p className="text-sm text-neutral-low">No editable fields.</p>
					) : (
						Object.keys(draft).map((key) => {
							const rawVal = draft[key]
							// Heuristic: always treat 'content' as rich text (Lexical), parsing string if needed
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
										<LexicalEditor
											editorKey={`${moduleItem.id}:${key}`}
											value={initial}
											onChange={(json) => {
												// Update hidden alongside local draft for preview
												const hidden = (formRef.current?.querySelector(`input[type=\"hidden\"][name=\"${key}\"]`) as HTMLInputElement) || null
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
								<FieldPrimitive
									key={key}
									path={[key]}
									field={{ name: key, type: typeof val === 'number' ? 'number' : typeof val === 'boolean' ? 'boolean' : 'text' } as any}
									value={val}
									rootId={moduleItem.id}
								/>
							)
						})
					)}
				</form>
				<div className="px-5 py-4 border-t border-line flex items-center justify-end gap-3">
					<button
						type="button"
						className="px-4 py-2 text-sm border border-line rounded-lg hover:bg-backdrop-medium text-neutral-medium"
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


