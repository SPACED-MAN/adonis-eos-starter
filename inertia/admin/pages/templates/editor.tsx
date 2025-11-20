import { useEffect, useMemo, useState } from 'react'
import { Head, usePage } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type TemplateModule = { id: string; type: string; default_props: any; order_index: number; locked: boolean }

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
	const [registry, setRegistry] = useState<Array<{ type: string; name: string }>>([])
	const sensors = useSensors(useSensor(PointerSensor))

	useEffect(() => {
		;(async () => {
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
			setModules(Array.isArray(mJson?.data) ? mJson.data : [])
			// Load registry
			const regUrl = t ? `/api/modules/registry?post_type=${encodeURIComponent(t.post_type)}` : '/api/modules/registry'
			const regRes = await fetch(regUrl, { credentials: 'same-origin' })
			const regJson = await regRes.json().catch(() => ({}))
			const regList = Array.isArray(regJson?.data) ? regJson.data : []
			setRegistry(regList.map((m: any) => ({ type: m.type, name: m.name || m.type })))
		})()
	}, [templateId])

	async function addModule(type: string) {
		const res = await fetch(`/api/templates/${encodeURIComponent(templateId)}/modules`, {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
			},
			credentials: 'same-origin',
			body: JSON.stringify({ type }),
		})
		if (res.ok) {
			const mRes = await fetch(`/api/templates/${encodeURIComponent(templateId)}/modules`, { credentials: 'same-origin' })
			const mJson = await mRes.json().catch(() => ({}))
			setModules(Array.isArray(mJson?.data) ? mJson.data : [])
		} else {
			alert('Failed to add module')
		}
	}

	async function removeModule(id: string) {
		const res = await fetch(`/api/templates/modules/${encodeURIComponent(id)}`, {
			method: 'DELETE',
			headers: {
				...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
			},
			credentials: 'same-origin',
		})
		if (res.status === 204) {
			setModules((prev) => prev.filter((m) => m.id !== id))
		} else {
			alert('Failed to remove module')
		}
	}

	function SortableItem({ id, children }: { id: string; children: (listeners: any) => React.ReactNode }) {
		const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
		const style = { transform: CSS.Transform.toString(transform), transition }
		return (
			<div ref={setNodeRef} style={style} {...attributes}>
				{children(listeners)}
			</div>
		)
	}

	const ordered = useMemo(
		() => modules.slice().sort((a, b) => a.order_index - b.order_index),
		[modules]
	)
	const orderedIds = useMemo(() => ordered.map((m) => m.id), [ordered])

	async function onDragEnd(event: DragEndEvent) {
		const { active, over } = event
		if (!over || active.id === over.id) return
		const current = ordered
		const oldIndex = current.findIndex((m) => m.id === active.id)
		const newIndex = current.findIndex((m) => m.id === over.id)
		if (oldIndex === -1 || newIndex === -1) return
		const next = current.slice()
		const [moved] = next.splice(oldIndex, 1)
		next.splice(newIndex, 0, moved)
		// Persist order
		await Promise.all(
			next.map((m, idx) => {
				if (m.order_index === idx) return Promise.resolve()
				return fetch(`/api/templates/modules/${encodeURIComponent(m.id)}`, {
					method: 'PUT',
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
						...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
					},
					credentials: 'same-origin',
					body: JSON.stringify({ orderIndex: idx }),
				})
			})
		)
		// Update state
		setModules(next.map((m, idx) => ({ ...m, order_index: idx })))
	}

	return (
		<div className="min-h-screen bg-backdrop-low">
			<Head title={`Edit Template`} />
			<AdminHeader title="Edit Template" />
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<AdminBreadcrumbs items={[{ label: 'Dashboard', href: '/admin' }, { label: 'Templates', href: '/admin/templates' }, { label: templateName || 'Edit' }]} rightLink={{ label: '← Back to Templates', href: '/admin/templates' }} />
				<div className="bg-backdrop-low rounded-lg border border-line p-6">
					<div className="flex items-center justify-between mb-4">
						<div>
							<h2 className="text-lg font-semibold text-neutral-high">{templateName || 'Template'}</h2>
							{postType && <p className="text-xs text-neutral-low">{postType}</p>}
						</div>
						<div className="relative">
							<button
								className="px-3 py-2 text-sm rounded border border-line hover:bg-backdrop-medium text-neutral-medium"
								onClick={async (e) => {
									const menu = (e.currentTarget.nextSibling as HTMLElement)
									if (menu) menu.classList.toggle('hidden')
								}}
								type="button"
							>
								Add Module
							</button>
							<div className="absolute right-0 mt-2 w-[28rem] max-h-[24rem] overflow-auto rounded-lg border border-line bg-backdrop-low shadow-lg z-20 hidden">
								<div className="sticky top-0 bg-backdrop-low border-b border-line px-3 py-2 text-sm font-medium">
									Available Modules
								</div>
								<div className="divide-y divide-line">
									{registry.length === 0 && (
										<div className="px-4 py-6 text-neutral-low text-sm">No modules available</div>
									)}
									{registry.map((m) => (
										<div key={m.type} className="px-3 py-3 hover:bg-backdrop-medium flex items-start justify-between gap-3">
											<div>
												<div className="text-sm font-medium text-neutral-high">{m.name || m.type}</div>
												<div className="text-xs text-neutral-low mt-1">{m.type}</div>
											</div>
											<button
												type="button"
												onClick={() => addModule(m.type)}
												className="shrink-0 inline-flex items-center rounded border border-line bg-backdrop-low px-2.5 py-1.5 text-xs text-neutral-high hover:bg-backdrop-medium"
											>
												Add
											</button>
										</div>
									))}
								</div>
							</div>
						</div>
					</div>
					{modules.length === 0 ? (
						<div className="text-center py-12 text-neutral-low">No modules yet. Click “Add Module”.</div>
					) : (
						<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
							<SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
								<ul className="space-y-3">
									{ordered.map((m) => (
										<SortableItem key={m.id} id={m.id}>
											{(listeners: any) => (
												<li className="bg-backdrop-low border border-line rounded-lg px-4 py-3 flex items-center justify-between">
													<div className="flex items-center gap-3">
														<button
															type="button"
															aria-label="Drag"
															className="cursor-grab text-neutral-low hover:text-neutral-high"
															{...listeners}
														>
															⋮⋮
														</button>
														<div>
															<div className="text-sm font-medium text-neutral-high">{m.type}</div>
															<div className="text-xs text-neutral-low">Order: {m.order_index}</div>
														</div>
													</div>
													<div className="flex items-center gap-2">
														<button
															className="text-xs px-2 py-1 rounded border border-line bg-backdrop-low text-neutral-high hover:bg-backdrop-medium"
															onClick={() => removeModule(m.id)}
															type="button"
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


