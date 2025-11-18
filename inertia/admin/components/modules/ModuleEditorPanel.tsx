import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'

export interface ModuleListItem {
	id: string
	type: string
	scope: string
	props: Record<string, any>
	overrides: Record<string, any> | null
	locked: boolean
	orderIndex: number
}

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
	const formRef = useRef<HTMLFormElement | null>(null)

	useEffect(() => {
		if (!open || !moduleItem) return
		setDraft(mergeProps(moduleItem.props || {}, moduleItem.overrides || null))
	// Only reinitialize when the selection changes, not on object identity churn
	}, [open, moduleItem?.id])

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

	const trySave = async () => {
		const base = moduleItem.props || {}
		// Build edited object from current form values (avoid re-renders while typing)
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
				} else {
					setByPath(edited, name, (el as HTMLInputElement).value)
				}
			})
		}
		const overrides = diffOverrides(base, edited)
		await onSave(overrides, edited)
		toast.success('Module updated')
		onClose()
	}

	function Field({
		path,
		label,
		value,
		onChange,
		rootId,
	}: {
		path: string[]
		label: string
		value: any
		onChange: (next: any) => void
		rootId: string
	}) {
		// Basic widget selection
		if (typeof value === 'string') {
			return (
				<div>
					<label className="block text-sm font-medium text-neutral-medium mb-1">{label}</label>
					<input
						type="text"
						className="w-full px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high focus:ring-2 ring-standout"
						key={`${rootId}:${path.join('.')}`}
						name={path.join('.')}
						defaultValue={value}
						onChange={() => {}}
					/>
				</div>
			)
		}
		if (typeof value === 'number') {
			return (
				<div>
					<label className="block text-sm font-medium text-neutral-medium mb-1">{label}</label>
					<input
						type="number"
						className="w-full px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high focus:ring-2 ring-standout"
						key={`${rootId}:${path.join('.')}`}
						name={path.join('.')}
						defaultValue={value}
						onChange={() => {}}
					/>
				</div>
			)
		}
		if (typeof value === 'boolean') {
			return (
				<div className="flex items-center gap-2">
					<input
						id={label}
						type="checkbox"
						className="h-4 w-4 border-border rounded"
						key={`${rootId}:${path.join('.')}`}
						name={path.join('.')}
						defaultChecked={value}
						onChange={() => {}}
					/>
					<label htmlFor={label} className="text-sm text-neutral-high">{label}</label>
				</div>
			)
		}
		if (isPlainObject(value)) {
			return (
				<fieldset className="border border-line rounded-lg p-3">
					<legend className="px-1 text-xs font-medium text-neutral-low">{label}</legend>
					<div className="grid grid-cols-1 gap-4">
						{Object.keys(value).map((key) => {
							const nextPath = [...path, key]
							const childVal = value[key]
							return (
								<Field
									key={nextPath.join('.')}
									path={nextPath}
									label={key}
									value={childVal}
									rootId={rootId}
									onChange={() => {}}
								/>
							)
						})}
					</div>
				</fieldset>
			)
		}
		// Arrays and unknowns fallback to read-only JSON for now
		return (
			<div>
				<label className="block text-sm font-medium text-neutral-medium mb-1">{label}</label>
				<pre className="w-full px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high font-mono text-xs overflow-auto">
					{JSON.stringify(value, null, 2)}
				</pre>
				<p className="text-xs text-neutral-low mt-1">Editing arrays is not yet supported.</p>
			</div>
		)
	}

	return createPortal(
		<div
			className="fixed inset-0 z-40"
			onMouseDown={(e) => {
				// prevent outside dnd or other handlers from stealing focus
				e.stopPropagation()
			}}
		>
			<div className="absolute inset-0 bg-black/40" onClick={onClose} />
			<div
				className="absolute right-0 top-0 h-full w-full max-w-2xl bg-backdrop-low border-l border-line shadow-xl flex flex-col"
				role="dialog"
				aria-modal="true"
			>
				<div className="px-5 py-4 border-b border-line flex items-center justify-between">
					<h3 className="text-sm font-semibold text-neutral-high">
						Edit Module — {moduleItem.type}
					</h3>
					<button
						type="button"
						className="text-neutral-low hover:text-neutral-high"
						onClick={onClose}
					>
						Close
					</button>
				</div>
				<form ref={formRef} className="p-5 grid grid-cols-1 gap-5 overflow-auto">
					{Object.keys(draft).length === 0 ? (
						<p className="text-sm text-neutral-low">No editable fields.</p>
					) : (
						Object.keys(draft).map((key) => (
							<Field
								key={key}
								path={[key]}
								label={key}
								value={draft[key]}
								rootId={moduleItem.id}
								onChange={() => {}}
							/>
						))
					)}
				</form>
				<div className="px-5 py-4 border-t border-line flex items-center justify-end gap-3">
					<button
						type="button"
						className="px-4 py-2 text-sm border border-line rounded-lg hover:bg-backdrop-medium text-neutral-medium"
						onClick={onClose}
						disabled={processing}
					>
						Cancel
					</button>
					<button
						type="button"
						className="px-4 py-2 text-sm rounded-md bg-standout text-on-standout disabled:opacity-50"
						onClick={(e) => {
							e.preventDefault()
							e.stopPropagation()
							trySave()
						}}
						disabled={processing}
					>
						Save
					</button>
				</div>
			</div>
		</div>,
		document.body
	)
}


