import { useEffect, useMemo, useState } from 'react'
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogTitle,
	AlertDialogCancel,
	AlertDialogAction,
} from '~/components/ui/alert-dialog'
import { Input } from '~/components/ui/input'
import { pickMediaVariantUrl, type MediaVariant } from '../../../lib/media'

type MediaItem = {
	id: string
	url: string
	originalFilename?: string
	alt?: string | null
	metadata?: {
		variants?: MediaVariant[]
		darkSourceUrl?: string
	} | null
}

function getXsrf(): string | undefined {
	if (typeof document === 'undefined') return undefined
	const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
	return m ? decodeURIComponent(m[1]) : undefined
}

export function MediaPickerModal({
	open,
	onOpenChange,
	onSelect,
	initialSelectedId,
	allowUpload = true,
	title = 'Select Media',
}: {
	open: boolean
	onOpenChange: (v: boolean) => void
	onSelect: (item: MediaItem) => void
	initialSelectedId?: string | null
	allowUpload?: boolean
	title?: string
}) {
	const [tab, setTab] = useState<'library' | 'upload'>('library')
	const [items, setItems] = useState<MediaItem[]>([])
	const [loading, setLoading] = useState(false)
	const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId || null)
	const [file, setFile] = useState<File | null>(null)
	const [uploading, setUploading] = useState(false)

	useEffect(() => {
		setSelectedId(initialSelectedId || null)
	}, [initialSelectedId, open])

	useEffect(() => {
		if (!open) return
		let alive = true
			; (async () => {
				try {
					setLoading(true)
					const res = await fetch('/api/media?limit=100', { credentials: 'same-origin' })
					const j = await res.json().catch(() => ({}))
					const list: MediaItem[] = Array.isArray(j?.data) ? j.data : []
					if (alive) setItems(list)
				} finally {
					if (alive) setLoading(false)
				}
			})()
		return () => {
			alive = false
		}
	}, [open])

	const selected = useMemo(() => items.find((i) => i.id === selectedId) || null, [items, selectedId])

	async function handleUpload() {
		if (!file) return
		const form = new FormData()
		form.append('file', file)
		try {
			setUploading(true)
			const res = await fetch('/api/media', {
				method: 'POST',
				body: form,
				credentials: 'same-origin',
				headers: {
					...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
				},
			})
			const j = await res.json().catch(() => ({}))
			if (!res.ok) {
				throw new Error(j?.error || 'Upload failed')
			}
			const item: MediaItem | undefined = j?.data
			if (item?.id) {
				// refresh list, select new item, and switch to library tab
				setItems((prev) => [item, ...prev])
				setSelectedId(item.id)
				setTab('library')
			}
		} catch (e: any) {
			// eslint-disable-next-line no-alert
			alert(e?.message || 'Upload failed')
		} finally {
			setUploading(false)
		}
	}

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent className="max-w-4xl">
				<AlertDialogTitle>{title}</AlertDialogTitle>
				<AlertDialogDescription>
					Choose an existing media item or upload a new one.
				</AlertDialogDescription>
				<div className="mt-2">
					{allowUpload && (
						<div className="mb-3 flex items-center gap-2">
							<button
								type="button"
								className={`px-3 py-1.5 text-xs rounded ${tab === 'library' ? 'bg-backdrop-medium' : 'bg-backdrop-low'} border border-line-medium`}
								onClick={() => setTab('library')}
							>
								Library
							</button>
							<button
								type="button"
								className={`px-3 py-1.5 text-xs rounded ${tab === 'upload' ? 'bg-backdrop-medium' : 'bg-backdrop-low'} border border-line-medium`}
								onClick={() => setTab('upload')}
							>
								Upload
							</button>
						</div>
					)}

					{tab === 'library' && (
						<div className="space-y-2">
							<div className="text-sm text-neutral-medium">{loading ? 'Loading…' : `Items: ${items.length}`}</div>
							<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[60vh] overflow-auto p-1 border border-line-low rounded">
								{items.map((m) => (
									<button
										key={m.id}
										type="button"
										onClick={() => setSelectedId(m.id)}
										onDoubleClick={() => {
											onSelect(m)
											onOpenChange(false)
										}}
										className={`group border rounded overflow-hidden ${selectedId === m.id ? 'border-standout' : 'border-line-low'} bg-backdrop-low`}
										title={m.originalFilename || m.id}
									>
										<div className="aspect-square">
											{(() => {
												const baseUrl = m.url
												const meta = (m as any).metadata || {}
												const variants: MediaVariant[] = Array.isArray(meta?.variants)
													? (meta.variants as MediaVariant[])
													: []
												const darkSourceUrl =
													typeof meta.darkSourceUrl === 'string'
														? (meta.darkSourceUrl as string)
														: undefined
												const thumbUrl = pickMediaVariantUrl(baseUrl, variants, 'thumb', {
													darkSourceUrl,
												})
												return (
													<img
														src={thumbUrl}
														alt={m.originalFilename || ''}
														className="w-full h-full object-cover"
													/>
												)
											})()}
										</div>
										<div className="p-1 text-[10px] text-neutral-medium truncate">
											{m.alt || m.originalFilename || m.id}
										</div>
									</button>
								))}
							</div>
						</div>
					)}

					{allowUpload && tab === 'upload' && (
						<div className="space-y-3">
							<div className="text-sm text-neutral-medium">Choose a file to upload</div>
							<Input
								type="file"
								accept="image/*"
								onChange={(e) => {
									const f = e.currentTarget.files?.[0] || null
									setFile(f)
								}}
							/>
							<div>
								<button
									type="button"
									className={`px-3 py-2 text-sm rounded ${uploading || !file ? 'opacity-60 cursor-not-allowed' : 'bg-standout text-on-standout'}`}
									disabled={uploading || !file}
									onClick={handleUpload}
								>
									{uploading ? 'Uploading…' : 'Upload'}
								</button>
							</div>
						</div>
					)}
				</div>
				<div className="mt-4 flex items-center justify-end gap-2">
					<AlertDialogCancel type="button">Cancel</AlertDialogCancel>
					<AlertDialogAction
						type="button"
						onClick={() => {
							if (selected) {
								onSelect(selected)
								onOpenChange(false)
							}
						}}
						disabled={!selected}
						className={!selected ? 'opacity-60 cursor-not-allowed' : undefined}
					>
						Use Selected
					</AlertDialogAction>
				</div>
			</AlertDialogContent>
		</AlertDialog>
	)
}


