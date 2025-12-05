import { useEffect, useMemo, useState } from 'react'
import { Head, usePage } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ModulePicker } from '../../components/modules/ModulePicker'
import { Globe } from 'lucide-react'

type TemplateModule = { id: string; type: string; default_props: any; order_index: number; locked: boolean; scope?: 'post' | 'global'; global_slug?: string | null }

function getXsrfToken(): string | undefined {
	if (typeof document === 'undefined') return undefined
	const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
	return m ? decodeURIComponent(m[1]) : undefined
}

export default function TemplateEditor() {
	const page = usePage()
	const templateId: string = (page.props as any)?.templateId
	const [templateName, setTemplateName] = useState<string>('')
	const [postType, setPostType] = useState<string>('')
	const [modules, setModules] = useState<TemplateModule[]>([])
	const [draft, setDraft] = useState<TemplateModule[]>([])
	const [dirty, setDirty] = useState<boolean>(false)
	const [registry, setRegistry] = useState<Array<{ type: string; name: string }>>([])
	const [globals, setGlobals] = useState<Array<{ id: string; type: string; globalSlug: string; label?: string | null }>>([])
	const sensors = useSensors(useSensor(PointerSensor))

	useEffect(() => {
		; (async () => {
			// Load all templates to resolve name/post type quickly
			const r = await fetch('/api/templates', { credentials: 'same-origin' })
			const json = await r.json().catch(() => ({}))
			const list: Array<any> = Array.isArray(json?.data) ? json.data : []
			const t = list.find((x) => x.id === templateId)
			if (t) {
				setTemplateName(t.name || '')
				setPostType(t.post_type || '')
			}
			// Load modules for this template
			const mRes = await fetch(`/api/templates/${encodeURIComponent(templateId)}/modules`, { credentials: 'same-origin' })
			const mJson = await mRes.json().catch(() => ({}))
			const loaded: TemplateModule[] = Array.isArray(mJson?.data) ? mJson.data : []
			setModules(loaded)
			setDraft(loaded)
			setDirty(false)
			// Load registry
			const regUrl = t ? `/api/modules/registry?post_type=${encodeURIComponent(t.post_type)}` : '/api/modules/registry'
			const regRes = await fetch(regUrl, { credentials: 'same-origin' })
			const regJson = await regRes.json().catch(() => ({}))
			const regList = Array.isArray(regJson?.data) ? regJson.data : []
			setRegistry(regList.map((m: any) => ({ type: m.type, name: m.name || m.type })))
			// Load globals
			const gRes = await fetch('/api/modules/global', { credentials: 'same-origin' })
			const gJson = await gRes.json().catch(() => ({}))
			const gList: Array<any> = Array.isArray(gJson?.data) ? gJson.data : []
			setGlobals(gList.map((g) => ({ id: g.id, type: g.type, globalSlug: g.globalSlug, label: g.label })))
		})()
	}, [templateId])

	const slugToLabel = useMemo(() => {
		const map = new Map<string, string>()
		globals.forEach((g) => {
			if (g.globalSlug) map.set(g.globalSlug, g.label || g.globalSlug)
		})
		return map
	}, [globals])

	async function addModule(type: string, scope: 'post' | 'global' = 'post', globalSlug?: string | null) {
		const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
		const next: TemplateModule = {
			id: tempId,
			type,
			default_props: {},
			order_index: draft.length,
			locked: false,
			scope,
			global_slug: scope === 'global' ? (globalSlug || null) : null,
		}
		setDraft((prev) => [...prev, next])
		setDirty(true)
	}

	function removeModule(id: string) {
		setDraft((prev) => prev.filter((m) => m.id !== id))
		setDirty(true)
	}

	function toggleLock(id: string, current: boolean) {
		setDraft((prev) => prev.map((m) => (m.id === id ? { ...m, locked: !current } : m)))
		setDirty(true)
	}

	function SortableItem({ id, disabled, children }: { id: string; disabled?: boolean; children: (listeners: any, attributes: any) => React.ReactNode }) {
		const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled: !!disabled })
		const style = { transform: CSS.Transform.toString(transform), transition }
		const attrs = disabled ? {} : attributes
		const ls = disabled ? {} : listeners
		return (
			<div ref={setNodeRef} style={style} {...attrs}>
				{children(ls, attrs)}
			</div>
		)
	}

	const ordered = useMemo(
		() => draft.slice().sort((a, b) => a.order_index - b.order_index),
		[draft]
	)
	const orderedIds = useMemo(() => ordered.map((m) => m.id), [ordered])

	async function onDragEnd(event: DragEndEvent) {
		const { active, over } = event
		if (!over || active.id === over.id) return
		const current = ordered
		const oldIndex = current.findIndex((m) => m.id === active.id)
		const newIndex = current.findIndex((m) => m.id === over.id)
		if (oldIndex === -1 || newIndex === -1) return
		// Prevent dragging locked modules
		if (current[oldIndex]?.locked) return
		const next = current.slice()
		const [moved] = next.splice(oldIndex, 1)
		next.splice(newIndex, 0, moved)
		// Update draft only
		setDraft(next.map((m, idx) => ({ ...m, order_index: idx })))
		setDirty(true)
	}

	async function publishChanges() {
		const baselineById = new Map(modules.map((m) => [m.id, m]))
		const draftById = new Map(draft.map((m) => [m.id, m]))
		// Deletions
		const deletions = modules.filter((m) => !draftById.has(m.id))
		// Creations (temp ids)
		const creations = draft.filter((m) => !baselineById.has(m.id))
		// Updates (order/lock/default_props)
		const updates = draft.filter((m) => {
			const base = baselineById.get(m.id)
			if (!base) return false
			return base.order_index !== m.order_index || base.locked !== m.locked || JSON.stringify(base.default_props || {}) !== JSON.stringify(m.default_props || {})
		})
		// Apply in order: deletions, creations, updates
		// 1) Delete
		await Promise.all(deletions.map((m) =>
			fetch(`/api/templates/modules/${encodeURIComponent(m.id)}`, {
				method: 'DELETE',
				headers: { ...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}) },
				credentials: 'same-origin',
			})
		))
		// 2) Create
		await Promise.all(creations.map((m) =>
			fetch(`/api/templates/${encodeURIComponent(templateId)}/modules`, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
					...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
				},
				credentials: 'same-origin',
				body: JSON.stringify({
					type: m.type,
					defaultProps: m.default_props || {},
					locked: !!m.locked,
					scope: m.scope || 'post',
					globalSlug: m.scope === 'global' ? (m.global_slug || null) : null,
				}),
			})
		))
		// 3) Updates (order/lock/default_props)
		await Promise.all(updates.map((m) =>
			fetch(`/api/templates/modules/${encodeURIComponent(m.id)}`, {
				method: 'PUT',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
					...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
				},
				credentials: 'same-origin',
				body: JSON.stringify({ orderIndex: m.order_index, defaultProps: m.default_props || {}, locked: !!m.locked }),
			})
		))
		// Reload fresh baseline
		const mRes = await fetch(`/api/templates/${encodeURIComponent(templateId)}/modules`, { credentials: 'same-origin' })
		const mJson = await mRes.json().catch(() => ({}))
		const loaded: TemplateModule[] = Array.isArray(mJson?.data) ? mJson.data : []
		setModules(loaded)
		setDraft(loaded)
		setDirty(false)
	}

	function discardChanges() {
		setDraft(modules)
		setDirty(false)
	}

	return (
		<div className="min-h-screen bg-backdrop-medium">
			<Head title={`Edit Template`} />
			<AdminHeader title="Edit Template" />
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<AdminBreadcrumbs items={[{ label: 'Dashboard', href: '/admin' }, { label: 'Templates', href: '/admin/templates' }, { label: templateName || 'Edit' }]} rightLink={{ label: '← Back to Templates', href: '/admin/templates' }} />
				<div className="bg-backdrop-low rounded-lg border border-line-low p-6">
					<div className="flex items-center justify-between mb-4">
						<div>
							<h2 className="text-lg font-semibold text-neutral-high">{templateName || 'Template'}</h2>
							{postType && <p className="text-xs text-neutral-low">{postType}</p>}
						</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								className={`px-3 py-2 text-sm rounded ${dirty ? 'bg-standout text-on-standout' : 'border border-line-low text-neutral-medium'}`}
								onClick={publishChanges}
								disabled={!dirty}
								title={dirty ? 'Publish template changes' : 'No pending changes'}
							>
								{dirty ? 'Publish Changes' : 'Published'}
							</button>
							{dirty && (
								<button
									type="button"
									className="px-3 py-2 text-sm rounded border border-line-low hover:bg-backdrop-medium text-neutral-medium"
									onClick={discardChanges}
								>
									Discard
								</button>
							)}
							<div className="relative">
								<ModulePicker
									postType={postType || ''}
									buttonLabel="Add Module"
									onAdd={async ({ type, scope, globalSlug }) => {
										await addModule(type, scope === 'global' ? 'global' : 'post', globalSlug || null)
									}}
								/>
							</div>
						</div>
					</div>
					{draft.length === 0 ? (
						<div className="text-center py-12 text-neutral-low">No modules yet. Click “Add Module”.</div>
					) : (
						<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
							<SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
								<ul className="space-y-3">
									{ordered.map((m) => (
										<SortableItem key={m.id} id={m.id} disabled={m.locked}>
											{(listeners: any) => (
												<li className="bg-backdrop-low border border-line-low rounded-lg px-4 py-3 flex items-center justify-between">
													<div className="flex items-center gap-3">
														<button
															type="button"
															aria-label="Drag"
															className={`text-neutral-low hover:text-neutral-high ${m.locked ? 'opacity-40 cursor-not-allowed' : 'cursor-grab'}`}
															{...(m.locked ? {} : listeners)}
														>
															⋮⋮
														</button>
														<div>
															<div className="text-sm font-medium text-neutral-high flex items-center gap-1">
																{m.scope === 'global'
																	? (slugToLabel.get(String(m.global_slug || '')) || String(m.global_slug || ''))
																	: (registry.find(r => r.type === m.type)?.name || m.type)
																}
															</div>
															<div className="text-xs text-neutral-low">
																{m.scope === 'global' ? (<>Global · {String(m.global_slug || '')}</>) : m.type} · Order: {m.order_index} {m.locked ? '• Locked' : ''}
															</div>
														</div>
													</div>
													<div className="flex items-center gap-2">
														{m.scope === 'global' && (
															<span
																className="inline-flex items-center rounded border border-line-medium bg-backdrop-low px-2 py-1 text-xs text-neutral-high"
																title="Global module"
																aria-label="Global module"
															>
																<Globe size={14} />
															</span>
														)}
														<button
															className="text-xs px-2 py-1 rounded border border-line-low bg-backdrop-input text-neutral-high hover:bg-backdrop-medium"
															onClick={() => toggleLock(m.id, m.locked)}
															type="button"
														>
															{m.locked ? 'Unlock' : 'Lock'}
														</button>
														<button
															className="text-xs px-2 py-1 rounded border border-line-low bg-backdrop-input text-neutral-high hover:bg-backdrop-medium"
															onClick={() => removeModule(m.id)}
															type="button"
															disabled={m.locked}
														>
															Remove
														</button>
													</div>
												</li>
											)}
										</SortableItem>
									))}
								</ul>
							</SortableContext>
						</DndContext>
					)}
				</div>
			</main>
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<AdminFooter />
			</div>
		</div>
	)
}


