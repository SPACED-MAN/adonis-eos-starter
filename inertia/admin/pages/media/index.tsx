import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs'
import { toast } from 'sonner'
import { usePage } from '@inertiajs/react'
import { Pencil, Trash2, BarChart3, RefreshCw, Wand2, ListOrdered, LayoutGrid } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../../components/ui/alert-dialog'

import { Checkbox } from '../../../components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table'

type Variant = { name: string; url: string; width?: number; height?: number; size?: number }
type MediaItem = {
  id: string
  url: string
  originalFilename: string
  mimeType: string
  size: number
  optimizedUrl?: string | null
  optimizedSize?: number | null
  altText?: string | null
  caption?: string | null
  description?: string | null
  categories?: string[]
  createdAt: string
  metadata?: { variants?: Variant[] } | null
}

type PageProps = {
  mediaAdmin?: { thumbnailVariant?: string | null; modalVariant?: string | null }
  isAdmin?: boolean
}

export default function MediaIndex() {
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState<MediaItem | null>(null)
  const [viewing, setViewing] = useState<MediaItem | null>(null)
  const [imageEditingFor, setImageEditingFor] = useState<MediaItem | null>(null)
  const [editAlt, setEditAlt] = useState<string>('')
  const [editCaption, setEditCaption] = useState<string>('')
  const [editDescription, setEditDescription] = useState<string>('')
  const [savingEdit, setSavingEdit] = useState<boolean>(false)
  const [sortBy, setSortBy] = useState<'created_at' | 'original_filename' | 'size'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [whereUsed, setWhereUsed] = useState<{ inModules: any[]; inOverrides: any[] } | null>(null)
  const [renaming, setRenaming] = useState<boolean>(false)
  const [newFilename, setNewFilename] = useState<string>('')
  const [editCategories, setEditCategories] = useState<string[]>([])
  const [newCategory, setNewCategory] = useState<string>('')
  const [isDragOver, setIsDragOver] = useState<boolean>(false)
  const [cropName, setCropName] = useState<string>('crop')
  const [cropWidth, setCropWidth] = useState<string>('')
  const [cropHeight, setCropHeight] = useState<string>('')
  const [cropFit, setCropFit] = useState<'cover' | 'inside'>('cover')
  const [viewMode, setViewMode] = useState<'gallery' | 'table'>('gallery')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState<boolean>(false)
  const [bulkKey, setBulkKey] = useState<number>(0)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState<boolean>(false)
  const [bulkCategoriesOpen, setBulkCategoriesOpen] = useState<boolean>(false)
  const [bulkCats, setBulkCats] = useState<string[]>([])
  const [bulkCatsInitial, setBulkCatsInitial] = useState<string[]>([])
  const [bulkCatInput, setBulkCatInput] = useState<string>('')
  const [useOriginalName, setUseOriginalName] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return true
    const v = localStorage.getItem('mediaUseOriginalName')
    return v ? v === 'true' : true
  })

  // Duplicate prompt state (Override / Save as new / Cancel)
  const [dupOpen, setDupOpen] = useState(false)
  const [dupFileName, setDupFileName] = useState<string>('')
  const [dupResolve, setDupResolve] = useState<((choice: 'override' | 'save' | 'cancel') => void) | null>(null)
  const [dupExistingId, setDupExistingId] = useState<string>('')

  const imgRef = useRef<HTMLImageElement | null>(null)
  const [cropping, setCropping] = useState<boolean>(false)
  const [cropSel, setCropSel] = useState<{ x: number; y: number; w: number; h: number } | null>(null) // in display px
  const [dragging, setDragging] = useState<boolean>(false)
  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number } | null>(null)
  const [focalMode, setFocalMode] = useState<boolean>(false)
  const [focalDot, setFocalDot] = useState<{ x: number; y: number } | null>(null) // display px
  const [usageFor, setUsageFor] = useState<MediaItem | null>(null)
  const [selectedVariantName, setSelectedVariantName] = useState<string>('original')
  const [replacingFor, setReplacingFor] = useState<MediaItem | null>(null)
  const [replaceFile, setReplaceFile] = useState<File | null>(null)
  const [replaceUploading, setReplaceUploading] = useState<boolean>(false)

  const page = usePage<PageProps>()
  const isAdmin = !!page.props?.isAdmin
  const preferredThumb = (page.props?.mediaAdmin?.thumbnailVariant as string | undefined)
    || (import.meta as any).env?.MEDIA_ADMIN_THUMBNAIL_VARIANT
    || (import.meta as any).env?.VITE_MEDIA_THUMBNAIL_VARIANT
  const preferredModal = (page.props?.mediaAdmin?.modalVariant as string | undefined)
    || (import.meta as any).env?.MEDIA_ADMIN_MODAL_VARIANT
    || (import.meta as any).env?.VITE_MEDIA_MODAL_VARIANT

  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [allCategories, setAllCategories] = useState<string[]>([])
  async function loadCategories() {
    try {
      const res = await fetch('/api/media/categories', { credentials: 'same-origin' })
      const j = await res.json().catch(() => ({}))
      const list: string[] = Array.isArray(j?.data) ? j.data : []
      setAllCategories(list)
    } catch {
      setAllCategories([])
    }
  }
  useEffect(() => { loadCategories() }, [])

  useEffect(() => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('mediaUseOriginalName', String(useOriginalName))
  }, [useOriginalName])

  useEffect(() => {
    if (viewing) {
      setEditAlt(viewing.altText || '')
      setEditCaption(viewing.caption || '')
      setEditDescription((viewing as any).description || '')
      setEditCategories(Array.isArray(viewing.categories) ? viewing.categories : [])
      setNewFilename('')
    }
  }, [viewing])

  const xsrfFromCookie: string | undefined = (() => {
    if (typeof document === 'undefined') return undefined
    const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
    return m ? decodeURIComponent(m[1]) : undefined
  })()

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '100')
      params.set('sortBy', sortBy)
      params.set('sortOrder', sortOrder)
      if (selectedCategory) params.set('category', selectedCategory)
      const res = await fetch(`/api/media?${params.toString()}`, { credentials: 'same-origin' })
      const j = await res.json().catch(() => ({}))
      const list: MediaItem[] = Array.isArray(j?.data) ? j.data : []
      setItems(list)
      // keep categories fresh after data changes
      loadCategories()
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [sortBy, sortOrder, selectedCategory])

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleSelectAll() {
    setSelectAll((prev) => !prev)
    setSelectedIds(() => {
      if (!selectAll) {
        return new Set(items.map((i) => i.id))
      }
      return new Set()
    })
  }
  async function applyBulk(action: 'optimize') {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    await toast.promise(
      fetch('/api/media/optimize-bulk', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}) },
        credentials: 'same-origin',
        body: JSON.stringify({ ids }),
      }).then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j?.error || 'Bulk optimize failed')
        }
      }),
      { loading: 'Optimizing selected…', success: 'Bulk optimize complete', error: (e) => String(e.message || e) }
    )
    setSelectedIds(new Set())
    setSelectAll(false)
    setBulkKey((k) => k + 1)
    await load()
  }

  async function applyBulkRegenerate() {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    await toast.promise(
      fetch('/api/media/variants-bulk', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}) },
        credentials: 'same-origin',
        body: JSON.stringify({ ids }),
      }).then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j?.error || 'Bulk regenerate failed')
        }
      }),
      { loading: 'Regenerating…', success: 'Variants regenerated', error: (e) => String(e.message || e) }
    )
    await load()
  }

  async function applyBulkDelete() {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    await toast.promise(
      fetch('/api/media/delete-bulk', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}) },
        credentials: 'same-origin',
        body: JSON.stringify({ ids }),
      }).then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j?.error || 'Bulk delete failed')
        }
      }),
      { loading: 'Deleting…', success: 'Deleted', error: (e) => String(e.message || e) }
    )
    setSelectedIds(new Set())
    setSelectAll(false)
    await load()
  }

  function openBulkCategories() {
    if (selectedIds.size === 0) return
    const selected = items.filter(i => selectedIds.has(i.id))
    const allCats = selected.map(i => Array.isArray(i.categories) ? i.categories : [])
    let shared = allCats.length ? [...allCats[0]] : []
    for (const cats of allCats.slice(1)) {
      const set = new Set(cats)
      shared = shared.filter(c => set.has(c))
    }
    setBulkCats(shared)
    setBulkCatsInitial(shared)
    setBulkCatInput('')
    setBulkCategoriesOpen(true)
  }

  async function saveBulkCategories() {
    const initial = new Set(bulkCatsInitial)
    const finalSet = new Set(bulkCats.map(c => c.trim()).filter(Boolean))
    const add: string[] = []
    const remove: string[] = []
    // additions: in final but not in initial
    for (const c of finalSet) {
      if (!initial.has(c)) add.push(c)
    }
    // removals: in initial but not in final
    for (const c of initial) {
      if (!finalSet.has(c)) remove.push(c)
    }
    if (add.length === 0 && remove.length === 0) {
      setBulkCategoriesOpen(false)
      return
    }
    const ids = Array.from(selectedIds)
    await toast.promise(
      fetch('/api/media/categories-bulk', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}) },
        credentials: 'same-origin',
        body: JSON.stringify({ ids, add, remove }),
      }).then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j?.error || 'Bulk category update failed')
        }
      }),
      { loading: 'Saving categories…', success: 'Categories updated', error: (e) => String(e.message || e) }
    )
    setBulkCategoriesOpen(false)
    await load()
  }

  function deriveThumbFromOriginal(url: string): string {
    const lastSlash = url.lastIndexOf('/')
    const dir = lastSlash >= 0 ? url.slice(0, lastSlash) : ''
    const file = lastSlash >= 0 ? url.slice(lastSlash + 1) : url
    const dot = file.lastIndexOf('.')
    if (dot < 0) return url
    const base = file.slice(0, dot)
    const ext = file.slice(dot)
    const name = `${base}.thumb${ext}`
    return dir ? `${dir}/${name}` : name
  }

  function getPreviewUrl(m: MediaItem): string {
    const url = m.url || ''
    const isImage = (m.mimeType && m.mimeType.startsWith('image/')) || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(url)
    if (!isImage) return ''
    const variants = m.metadata?.variants || []
    if (preferredThumb) {
      const match = variants.find(v => v.name === preferredThumb)
      if (match?.url) return match.url
    }
    const byName = variants.find(v => v.name === 'thumb' || v.name === 'thumbnail')
    const chosen = byName?.url || (variants.length > 0
      ? [...variants].sort((a, b) => ((a.width || a.height || 0) - (b.width || b.height || 0)))[0]?.url
      : deriveThumbFromOriginal(url))
    return chosen || url
  }

  function getViewUrl(m: MediaItem): string {
    const url = m.url || ''
    const variants = m.metadata?.variants || []
    if (preferredModal) {
      const match = variants.find(v => v.name === preferredModal)
      if (match?.url) return match.url
    }
    if (variants.length > 0) {
      const sortedDesc = [...variants].sort((a, b) => ((b.width || b.height || 0) - (a.width || a.height || 0)))
      return sortedDesc[0]?.url || url
    }
    return url
  }

  function defaultAltFromFilename(name: string): string {
    const dot = name.lastIndexOf('.')
    const base = dot >= 0 ? name.slice(0, dot) : name
    return base.replace(/[-_]+/g, ' ').trim().replace(/\s{2,}/g, ' ')
  }

  async function uploadFiles(files: File[]) {
    if (!files.length) return
    setUploading(true)
    try {
      for (const file of files) {
        const altTextDefault = defaultAltFromFilename(file.name)
        // Duplicate check by original filename
        let duplicateId: string | null = null
        try {
          const chk = await fetch('/api/media/check-duplicate', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
            },
            credentials: 'same-origin',
            body: JSON.stringify({ originalFilename: file.name }),
          })
          if (chk.ok) {
            const j = await chk.json().catch(() => ({} as any))
            const arr = Array.isArray(j?.data) ? j.data : []
            if (arr.length > 0) duplicateId = arr[0].id
          }
        } catch {}

        if (duplicateId) {
          // ShadCN dialog prompt
          const choice = await new Promise<'override' | 'save' | 'cancel'>((resolve) => {
            setDupFileName(file.name)
            setDupExistingId(duplicateId as string)
            setDupResolve(() => resolve)
            setDupOpen(true)
          })
          if (choice === 'override') {
            const form = new FormData()
            form.append('file', file)
            const res = await fetch(`/api/media/${encodeURIComponent(duplicateId)}/override`, {
              method: 'POST',
              headers: { ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}) },
              credentials: 'same-origin',
              body: form,
            })
            if (res.ok) {
              toast.success(`Overridden ${file.name}`)
            } else {
              toast.error('Override failed; skipping')
            }
            continue
          } else if (choice === 'save') {
            const form = new FormData()
            form.append('file', file)
            form.append('naming', useOriginalName ? 'original' : 'uuid')
            form.append('appendIdIfExists', 'true')
            form.append('altText', altTextDefault)
            const res = await fetch('/api/media', {
              method: 'POST',
              headers: { ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}) },
              credentials: 'same-origin',
              body: form,
            })
            if (res.ok) toast.success(`Uploaded ${file.name}`)
            else toast.error(`Upload failed: ${file.name}`)
            continue
          } else {
            toast.info('Upload cancelled')
            continue
          }
        }

        // No duplicate; proceed normally
        const form = new FormData()
        form.append('file', file)
        form.append('naming', useOriginalName ? 'original' : 'uuid')
        form.append('altText', altTextDefault)
        const res = await fetch('/api/media', {
          method: 'POST',
          headers: {
            ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
          },
          credentials: 'same-origin',
          body: form,
        })
        if (res.ok) {
          toast.success(`Uploaded ${file.name}`)
        } else {
          toast.error(`Upload failed: ${file.name}`)
        }
      }
      await load()
    } finally {
      setUploading(false)
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadFiles([file])
    e.target.value = ''
  }

  async function fetchWhereUsed(id: string) {
    const res = await fetch(`/api/media/${encodeURIComponent(id)}/where-used`, { credentials: 'same-origin' })
    const j = await res.json().catch(() => ({}))
    setWhereUsed((j?.data as any) || { inModules: [], inOverrides: [] })
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const dt = e.dataTransfer
    const files: File[] = []
    if (dt?.items) {
      for (const item of Array.from(dt.items)) {
        if (item.kind === 'file') {
          const f = item.getAsFile()
          if (f) files.push(f)
        }
      }
    } else if (dt?.files) {
      for (const f of Array.from(dt.files)) files.push(f)
    }
    if (files.length) uploadFiles(files)
  }

  function onCropMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!cropping || focalMode) return
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setCropSel({ x, y, w: 0, h: 0 })
    setDragging(true)
    setDragOrigin({ x, y })
  }
  function onCropMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!cropping || focalMode || !dragging || !dragOrigin) return
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const w = Math.max(0, x - dragOrigin.x)
    const h = Math.max(0, y - dragOrigin.y)
    setCropSel({ x: dragOrigin.x, y: dragOrigin.y, w, h })
  }
  function onCropMouseUp() {
    if (!cropping || focalMode) return
    setDragging(false)
    setDragOrigin(null)
  }

  function onFocalClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!focalMode) return
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setFocalDot({ x, y })
  }

  function getVariantUrlByName(m: any, name: string | null): string | null {
    if (!name || !m?.metadata?.variants) return null
    const v = (m.metadata.variants as any[]).find((x) => x.name === name)
    return v?.url || null
  }

  function getVariantLabel(v: any): string {
    const dims = v?.width && v?.height ? `${v.width}x${v.height}` : ''
    const kb = v?.size ? `${Math.round((v.size || 0) / 1024)} KB` : ''
    const meta = [dims, kb].filter(Boolean).join(', ')
    return meta ? `${v.name} (${meta})` : v.name
  }

  function getEditDisplayUrl(m: any): string {
    // During cropping, always show the original image so cropRect maps to original pixels
    if (cropping) return m.url
    if (selectedVariantName === 'original') return m.url
    const vUrl = getVariantUrlByName(m, selectedVariantName)
    return vUrl || m.url
  }

  async function applyCrop() {
    const target = imageEditingFor || viewing
    if (!target || !imgRef.current) return
    if (selectedVariantName !== 'original') { toast.error('Crop is only available for the Original image'); return }
    if (!cropSel) { toast.error('Select a crop region'); return }
    const img = imgRef.current
    const naturalW = img.naturalWidth || img.width
    const naturalH = img.naturalHeight || img.height
    const displayRect = img.getBoundingClientRect()
    const scaleX = naturalW / displayRect.width
    const scaleY = naturalH / displayRect.height
    const x = Math.round(cropSel.x * scaleX)
    const y = Math.round(cropSel.y * scaleY)
    const w = Math.round(cropSel.w * scaleX)
    const h = Math.round(cropSel.h * scaleY)
    if (w <= 0 || h <= 0) { toast.error('Select a crop region'); return }
    const payload = { target: 'original-cropped', cropRect: { x, y, width: w, height: h } }
    const res = await fetch(`/api/media/${encodeURIComponent(target.id)}/variants`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}) },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      toast.success('Cropped and rebuilt variants')
      setCropping(false)
      setCropSel(null)
      setSelectedVariantName('cropped')
      await load()
    } else {
      toast.error('Crop failed')
    }
  }

  async function applyFocal() {
    const target = imageEditingFor || viewing
    if (!target || !imgRef.current || !focalDot) return
    if (selectedVariantName !== 'original') { toast.error('Focal point is only available for the Original image'); return }
    const img = imgRef.current
    const displayRect = img.getBoundingClientRect()
    const fx = Math.max(0, Math.min(1, focalDot.x / displayRect.width))
    const fy = Math.max(0, Math.min(1, focalDot.y / displayRect.height))
    const res = await fetch(`/api/media/${encodeURIComponent(target.id)}/variants`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}) },
      credentials: 'same-origin',
      body: JSON.stringify({ focalPoint: { x: fx, y: fy } }),
    })
    if (res.ok) {
      toast.success('Focal point applied (variants rebuilt)')
      setFocalMode(false)
      setFocalDot(null)
      await load()
    } else {
      toast.error('Failed to apply focal point')
    }
  }

  return (
    <div className="min-h-screen bg-backdrop-low">
      <AdminHeader title="Media Library" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdminBreadcrumbs items={[{ label: 'Dashboard', href: '/admin' }, { label: 'Media' }]} />
        <div className="bg-backdrop-low rounded-lg shadow border border-line p-6">
          <div
            className={`mb-4 p-6 border-2 border-dashed rounded transition-colors ${isDragOver ? 'border-standout bg-backdrop-medium' : 'border-line bg-backdrop-low'}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-neutral-medium">
                {uploading ? 'Uploading…' : 'Drag & drop files here or use the button to upload'}
              </div>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 text-xs text-neutral-high">
                  <input type="checkbox" checked={useOriginalName} onChange={(e) => setUseOriginalName(e.target.checked)} />
                  <span>Use original filename for storage</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="file" onChange={onUpload} disabled={uploading} className="hidden" id="mediaUploadInput" />
                  <button
                    className="px-3 py-1.5 text-xs rounded bg-standout text-on-standout disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    disabled={uploading}
                    onClick={() => (document.getElementById('mediaUploadInput') as HTMLInputElement)?.click()}
                  >
                    {uploading ? 'Uploading…' : 'Upload'}
                  </button>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <label className="text-xs text-neutral-medium">Sort by</label>
            <select
              className="text-sm border border-line bg-backdrop-low text-neutral-high px-2 py-1"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="created_at">Date Added</option>
              <option value="original_filename">Filename</option>
              <option value="size">Size</option>
            </select>
            <select
              className="text-sm border border-line bg-backdrop-low text-neutral-high px-2 py-1"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
            <div className="ml-auto flex items-center gap-2">
              <label className="text-xs text-neutral-medium">Category</label>
              <select
                className="text-sm border border-line bg-backdrop-low text-neutral-high px-2 py-1"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">All</option>
                {allCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Bulk actions and view toggle */}
          <div className="mt-3 flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-neutral-medium">
              <Checkbox checked={selectAll} onCheckedChange={() => toggleSelectAll()} />
              Select All
            </label>
            <div className="w-[200px]">
              <Select
                key={bulkKey}
                onValueChange={(val: 'optimize' | 'regenerate' | 'delete' | 'categories') => {
                  if (val === 'optimize') {
                    applyBulk('optimize')
                  } else if (val === 'regenerate') {
                    applyBulkRegenerate()
                  } else if (val === 'delete') {
                    setConfirmBulkDelete(true)
                  } else if (val === 'categories') {
                    openBulkCategories()
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Bulk actions..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="optimize">Optimize (WebP)</SelectItem>
                  <SelectItem value="regenerate">Regenerate variations</SelectItem>
                  {isAdmin && <SelectItem value="delete">Delete</SelectItem>}
                  <SelectItem value="categories">Edit Category…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                className={`px-2 py-1.5 text-sm border border-line rounded inline-flex items-center gap-1 ${viewMode === 'gallery' ? 'bg-backdrop-medium' : ''}`}
                onClick={() => setViewMode('gallery')}
                title="Gallery view"
              >
                <LayoutGrid className="w-4 h-4" /> Gallery
              </button>
              <button
                className={`px-2 py-1.5 text-sm border border-line rounded inline-flex items-center gap-1 ${viewMode === 'table' ? 'bg-backdrop-medium' : ''}`}
                onClick={() => setViewMode('table')}
                title="List view"
              >
                <ListOrdered className="w-4 h-4" /> List
              </button>
            </div>
          </div>
          {loading ? (
            <div className="text-sm text-neutral-medium">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-neutral-low">No media yet. Upload a file to get started.</div>
          ) : (
            <>
              {viewMode === 'gallery' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((m) => {
                const preview = getPreviewUrl(m)
                const isImage = (m.mimeType && m.mimeType.startsWith('image/')) || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(m.url || '')
                    const checked = selectedIds.has(m.id)
                return (
                  <div key={m.id} className="border border-line rounded p-2 bg-backdrop-low">
                        <div className="flex items-center justify-between mb-1">
                          <label className="inline-flex items-center gap-2 text-xs text-neutral-medium">
                            <Checkbox checked={checked} onCheckedChange={() => toggleSelect(m.id)} />
                            Select
                          </label>
                        </div>
                    <div className="aspect-video bg-backdrop-medium border border-line overflow-hidden rounded">
                      {isImage ? (
                        <img src={preview || m.url} alt={m.altText || m.originalFilename} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-neutral-low">No preview</div>
                      )}
                    </div>
                    <div className="mt-2">
                      <div className="text-xs text-neutral-high break-all">{m.altText || m.originalFilename}</div>
                          <div className="text-[10px] text-neutral-low">
                            {m.mimeType} • {(m.size / 1024).toFixed(1)} KB
                            {typeof m.optimizedSize === 'number' && m.optimizedSize > 0 && (
                              <> → {(m.optimizedSize / 1024).toFixed(1)} KB (WebP)</>
                            )}
                          </div>
                      <div className="text-[10px] text-neutral-low">Date Added: {new Date(m.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <button
                        className="px-3 py-1.5 text-sm border border-line rounded hover:bg-backdrop-medium inline-flex items-center gap-1"
                        onClick={() => { setViewing(m); setSelectedVariantName('original'); setCropping(false); setFocalMode(false); setCropSel(null); setFocalDot(null) }}
                        aria-label="Edit"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                          {isImage && (
                            <button
                              className="px-3 py-1.5 text-sm border border-line rounded hover:bg-backdrop-medium inline-flex items-center gap-1"
                              onClick={async () => {
                                await toast.promise(
                                  fetch(`/api/media/${encodeURIComponent(m.id)}/optimize`, {
                                    method: 'POST',
                                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}) },
                                    credentials: 'same-origin',
                                  }).then(async (r) => {
                                    if (!r.ok) {
                                      const j = await r.json().catch(() => ({}))
                                      throw new Error(j?.error || 'Optimize failed')
                                    }
                                  }),
                                  { loading: 'Optimizing…', success: 'Optimized', error: (e) => String(e.message || e) }
                                )
                                await load()
                              }}
                              aria-label="Optimize"
                              title="Optimize (WebP)"
                            >
                              <Wand2 className="w-4 h-4" />
                            </button>
                          )}
                      <button
                        className="px-3 py-1.5 text-sm border border-line rounded hover:bg-backdrop-medium inline-flex items-center gap-1"
                        onClick={() => { setUsageFor(m); fetchWhereUsed(m.id) }}
                        aria-label="Usage"
                        title="Usage"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <button
                          className="px-3 py-1.5 text-sm border border-line rounded hover:bg-backdrop-medium inline-flex items-center gap-1"
                          onClick={() => { setReplacingFor(m); setReplaceFile(null) }}
                          aria-label="Replace"
                          title="Replace"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                      {isAdmin && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="px-3 py-1.5 text-sm border border-line rounded hover:bg-backdrop-medium text-danger inline-flex items-center gap-1" aria-label="Delete" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this media?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will delete the original file and all generated variants. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={async () => {
                                  const res = await fetch(`/api/media/${encodeURIComponent(m.id)}`, {
                                    method: 'DELETE',
                                    headers: { ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}) },
                                    credentials: 'same-origin',
                                  })
                                  if (res.ok) { toast.success('Deleted'); await load() } else { toast.error('Delete failed') }
                                }}
                              >Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
              ) : (
                <div className="mt-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[44px]">
                          <Checkbox checked={selectAll} onCheckedChange={() => toggleSelectAll()} aria-label="Select all" />
                        </TableHead>
                        <TableHead>Preview</TableHead>
                        <TableHead>Filename</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Optimized</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((m) => {
                        const isImage = (m.mimeType && m.mimeType.startsWith('image/')) || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(m.url || '')
                        const preview = getPreviewUrl(m)
                        const checked = selectedIds.has(m.id)
                        return (
                          <TableRow key={m.id}>
                            <TableCell>
                              <Checkbox checked={checked} onCheckedChange={() => toggleSelect(m.id)} aria-label="Select row" />
                            </TableCell>
                            <TableCell>
                              <div className="w-16 h-10 border border-line overflow-hidden rounded bg-backdrop-medium">
                                {isImage ? <img src={preview || m.url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-low">N/A</div>}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[240px] truncate">{m.originalFilename}</TableCell>
                            <TableCell>{m.mimeType}</TableCell>
                            <TableCell>{(m.size / 1024).toFixed(1)} KB</TableCell>
                            <TableCell>{typeof m.optimizedSize === 'number' ? `${(m.optimizedSize / 1024).toFixed(1)} KB` : '-'}</TableCell>
                            <TableCell>{new Date(m.createdAt).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium inline-flex items-center gap-1"
                                  onClick={() => { setViewing(m); setSelectedVariantName('original'); setCropping(false); setFocalMode(false); setCropSel(null); setFocalDot(null) }}
                                  aria-label="Edit"
                                  title="Edit"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                {isImage && (
                                  <button
                                    className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium inline-flex items-center gap-1"
                                    onClick={async () => {
                                      await toast.promise(
                                        fetch(`/api/media/${encodeURIComponent(m.id)}/optimize`, {
                                          method: 'POST',
                                          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}) },
                                          credentials: 'same-origin',
                                        }).then(async (r) => {
                                          if (!r.ok) {
                                            const j = await r.json().catch(() => ({}))
                                            throw new Error(j?.error || 'Optimize failed')
                                          }
                                        }),
                                        { loading: 'Optimizing…', success: 'Optimized', error: (e) => String(e.message || e) }
                                      )
                                      await load()
                                    }}
                                    aria-label="Optimize"
                                    title="Optimize (WebP)"
                                  >
                                    <Wand2 className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium inline-flex items-center gap-1"
                                  onClick={() => { setUsageFor(m); fetchWhereUsed(m.id) }}
                                  aria-label="Usage"
                                  title="Usage"
                                >
                                  <BarChart3 className="w-4 h-4" />
                                </button>
                                {isAdmin && (
                                  <button
                                    className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium inline-flex items-center gap-1"
                                    onClick={() => { setReplacingFor(m); setReplaceFile(null) }}
                                    aria-label="Replace"
                                    title="Replace"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </button>
                                )}
                                {isAdmin && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <button className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium text-danger inline-flex items-center gap-1" aria-label="Delete" title="Delete">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete this media?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will delete the original file and all generated variants. This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={async () => {
                                            const res = await fetch(`/api/media/${encodeURIComponent(m.id)}`, {
                                              method: 'DELETE',
                                              headers: { ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}) },
                                              credentials: 'same-origin',
                                            })
                                            if (res.ok) { toast.success('Deleted'); await load() } else { toast.error('Delete failed') }
                                          }}
                                        >Delete</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </div>

        
        {/* Meta Editor modal (opens via pencil) */}
        {/* Bulk Delete confirm */}
        <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete selected media?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the originals and all variants. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmBulkDelete(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  setConfirmBulkDelete(false)
                  await applyBulkDelete()
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Categories modal */}
        {bulkCategoriesOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70" onClick={() => setBulkCategoriesOpen(false)} />
            <div className="relative z-10 w-full max-w-xl rounded-lg border border-line bg-backdrop-low p-3 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-neutral-high">Categories (free tags)</div>
                <button className="text-neutral-medium hover:text-neutral-high" onClick={() => setBulkCategoriesOpen(false)}>✕</button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="text-xs text-neutral-medium">
                  Editing shared categories for {selectedIds.size} selected item(s). Add tags to apply to all; remove to clear from all.
                </div>
                <div className="flex flex-wrap gap-2">
                  {bulkCats.map((c, idx) => (
                    <span key={`${c}-${idx}`} className="inline-flex items-center gap-1 px-2 py-1 border border-line rounded">
                      {c}
                      <button className="text-neutral-low hover:text-neutral-high" onClick={() => setBulkCats(bulkCats.filter((x, i) => !(i === idx)))}>×</button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 px-2 py-1 border border-line bg-backdrop-low text-neutral-high"
                    placeholder="Add category and press Enter"
                    value={bulkCatInput}
                    onChange={(e) => setBulkCatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const v = bulkCatInput.trim()
                        if (v && !bulkCats.includes(v)) setBulkCats([...bulkCats, v])
                        setBulkCatInput('')
                      }
                    }}
                  />
                  <button
                    className="px-3 py-1.5 text-xs rounded bg-standout text-on-standout disabled:opacity-50"
                    onClick={() => {
                      const v = bulkCatInput.trim()
                      if (v && !bulkCats.includes(v)) setBulkCats([...bulkCats, v])
                      setBulkCatInput('')
                    }}
                  >
                    Add
                  </button>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button className="px-3 py-1.5 text-xs border border-line rounded" onClick={() => setBulkCategoriesOpen(false)}>Cancel</button>
                  <button className="px-3 py-1.5 text-xs rounded bg-standout text-on-standout" onClick={saveBulkCategories}>Save</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Single-item editor modal */}
        {viewing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70" onClick={() => { setViewing(null); setCropping(false); setCropSel(null); setFocalMode(false); setFocalDot(null); setSelectedVariantName('original') }} />
            <div className="relative z-10 w-full max-w-5xl rounded-lg border border-line bg-backdrop-low p-3 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-neutral-high break-all">{viewing.altText || viewing.originalFilename}</div>
                <div className="flex items-center gap-2">
                  <button className="text-neutral-medium hover:text-neutral-high" onClick={() => { setViewing(null); setCropping(false); setCropSel(null); setFocalMode(false); setFocalDot(null); setSelectedVariantName('original') }}>✕</button>
                </div>
              </div>
              <div className="space-y-3 text-sm max-h-[70vh] overflow-auto">
                <div className="p-2 border border-dashed border-line rounded">
                  <div className="text-xs font-medium mb-2">Rename file</div>
                  <div className="flex items-center gap-2">
                    <input className="flex-1 px-2 py-1 border border-line bg-backdrop-low text-neutral-high" placeholder="new-filename (optional extension)" value={newFilename} onChange={(e) => setNewFilename(e.target.value)} />
                    <button className="px-3 py-1.5 text-xs rounded bg-standout text-on-standout disabled:opacity-50" disabled={renaming || !newFilename} onClick={async () => {
                      if (!viewing || !newFilename) return
                      setRenaming(true)
                      try {
                        const res = await fetch(`/api/media/${encodeURIComponent(viewing.id)}/rename`, { method: 'PATCH', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}) }, credentials: 'same-origin', body: JSON.stringify({ filename: newFilename }) })
                        if (res.ok) { toast.success('Renamed'); await load(); setNewFilename('') } else { toast.error('Rename failed') }
                      } finally { setRenaming(false) }
                    }}>Rename</button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-neutral-medium mb-1">Alt Text</label>
                  <input className="w-full px-2 py-1 border border-line bg-backdrop-low text-neutral-high" value={editAlt} onChange={(e) => setEditAlt(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-neutral-medium mb-1">Caption</label>
                  <input className="w-full px-2 py-1 border border-line bg-backdrop-low text-neutral-high" value={editCaption} onChange={(e) => setEditCaption(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-neutral-medium mb-1">Description</label>
                  <textarea className="w-full px-2 py-1 border border-line bg-backdrop-low text-neutral-high min-h-[80px]" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-neutral-medium mb-1">Categories (free tags)</label>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {editCategories.map((c) => (
                      <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-backdrop-medium border border-line">
                        {c}
                        <button className="ml-1 text-neutral-medium hover:text-neutral-high" onClick={() => setEditCategories((prev) => prev.filter((x) => x !== c))}>×</button>
                      </span>
                    ))}
                  </div>
                  <input
                    className="w-full px-2 py-1 border border-line bg-backdrop-low text-neutral-high"
                    placeholder="Type a tag and press Enter"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault()
                        const v = newCategory.trim()
                        if (v && !editCategories.includes(v)) setEditCategories([...editCategories, v])
                        setNewCategory('')
                      }
                    }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    className="px-3 py-1.5 text-xs rounded bg-standout text-on-standout hover:opacity-90"
                    onClick={() => { const v = viewing; if (!v) return; setViewing(null); setImageEditingFor(v); setSelectedVariantName('original'); setCropping(false); setFocalMode(false); setCropSel(null); setFocalDot(null) }}
                  >
                    Image Editor
                  </button>
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 text-xs border border-line rounded hover:bg-backdrop-medium" onClick={() => { setViewing(null); setWhereUsed(null) }}>Close</button>
                    <button className="px-3 py-1.5 text-xs rounded bg-standout text-on-standout disabled:opacity-50" disabled={savingEdit} onClick={async () => {
                      if (!viewing) return
                      setSavingEdit(true)
                      try {
                        const res = await fetch(`/api/media/${encodeURIComponent(viewing.id)}`, { method: 'PATCH', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}) }, credentials: 'same-origin', body: JSON.stringify({ altText: editAlt, caption: editCaption, description: editDescription, categories: editCategories }) })
                        if (res.ok) { toast.success('Saved'); await load(); setViewing(null) } else { toast.error('Save failed') }
                      } finally { setSavingEdit(false) }
                    }}>Save</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Image Editor modal (separate) */}
        {imageEditingFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70" onClick={() => { setImageEditingFor(null); setCropping(false); setCropSel(null); setFocalMode(false); setFocalDot(null); setSelectedVariantName('original') }} />
            <div className="relative z-10 w-full max-w-5xl rounded-lg border border-line bg-backdrop-low p-3 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-neutral-high break-all">{imageEditingFor.altText || imageEditingFor.originalFilename}</div>
                <div className="flex items-center gap-2">
                  <button className="text-neutral-medium hover:text-neutral-high" onClick={() => { setImageEditingFor(null); setCropping(false); setCropSel(null); setFocalMode(false); setFocalDot(null); setSelectedVariantName('original') }}>✕</button>
                </div>
              </div>
              <div className="max-h-[70vh] overflow-auto">
                <div className="relative inline-block" onMouseDown={onCropMouseDown} onMouseMove={onCropMouseMove} onMouseUp={onCropMouseUp} onClick={onFocalClick}>
                  <img ref={imgRef} src={getEditDisplayUrl(imageEditingFor)} alt={imageEditingFor.altText || imageEditingFor.originalFilename} className="w-full h-auto max-h-[70vh]" />
                  {cropping && cropSel && (
                    <div className="absolute border-2 border-standout bg-standout/10" style={{ left: `${cropSel.x}px`, top: `${cropSel.y}px`, width: `${cropSel.w}px`, height: `${cropSel.h}px` }} />
                  )}
                  {focalMode && focalDot && (
                    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${focalDot.x}px`, top: `${focalDot.y}px` }}>
                      <div className="w-4 h-4 rounded-full bg-standout border-2 border-white shadow" />
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <select className="text-xs border border-line bg-backdrop-low text-neutral-high px-2 py-1" value={selectedVariantName} onChange={(e) => setSelectedVariantName(e.target.value)}>
                  <option value="original">Original image</option>
                  {(imageEditingFor as any).metadata?.variants?.map((v: any) => (
                    <option key={v.name} value={v.name}>{getVariantLabel(v)}</option>
                  ))}
                </select>
                {!focalMode && !cropping && selectedVariantName === 'original' && (
                  <button className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium" onClick={() => setCropping(true)}>Crop</button>
                )}
                {cropping && (
                  <>
                    <button className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium" onClick={() => { setCropping(false); setCropSel(null) }}>Cancel</button>
                    <button className="px-2 py-1 text-xs rounded bg-standout text-on-standout" onClick={applyCrop}>Apply crop</button>
                  </>
                )}
                {!cropping && !focalMode && selectedVariantName === 'original' && (
                  <button className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium" onClick={() => setFocalMode(true)}>Focal point</button>
                )}
                {focalMode && (
                  <>
                    <button className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium" onClick={() => { setFocalMode(false); setFocalDot(null) }}>Cancel</button>
                    <button className="px-2 py-1 text-xs rounded bg-standout text-on-standout" onClick={applyFocal}>Apply focal</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Usage modal */}
        {usageFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => { setUsageFor(null); setWhereUsed(null) }} />
            <div className="relative z-10 w-full max-w-lg rounded-lg border border-line bg-backdrop-low p-6 shadow-xl max-h-[90vh] overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-neutral-high">Usage</h3>
                <button className="text-neutral-medium hover:text-neutral-high" onClick={() => { setUsageFor(null); setWhereUsed(null) }}>✕</button>
              </div>
              {whereUsed ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="font-medium">In Modules ({whereUsed.inModules.length})</div>
                    {whereUsed.inModules.length === 0 ? (
                      <div className="text-neutral-low text-xs">No matches</div>
                    ) : (
                      <ul className="list-disc pl-5 text-neutral-medium">
                        {whereUsed.inModules.map((m: any) => (
                          <li key={m.id} className="text-xs">Module {m.type} (id: {m.id}, scope: {m.scope})</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <div className="font-medium">In Overrides ({whereUsed.inOverrides.length})</div>
                    {whereUsed.inOverrides.length === 0 ? (
                      <div className="text-neutral-low text-xs">No matches</div>
                    ) : (
                      <ul className="list-disc pl-5 text-neutral-medium">
                        {whereUsed.inOverrides.map((o: any) => (
                          <li key={o.id} className="text-xs">PostModule id: {o.id} (post: {o.postId})</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-neutral-low">Loading…</div>
              )}
            </div>
          </div>
        )}

        {/* Replace modal */}
        {replacingFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => { if (!replaceUploading) { setReplacingFor(null); setReplaceFile(null) } }} />
            <div className="relative z-10 w-full max-w-lg rounded-lg border border-line bg-backdrop-low p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-neutral-high">Replace Media</h3>
                <button className="text-neutral-medium hover:text-neutral-high" onClick={() => { if (!replaceUploading) { setReplacingFor(null); setReplaceFile(null) } }}>✕</button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="text-xs text-neutral-medium">Current: {(replacingFor as any).originalFilename}</div>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="file" accept="image/*" onChange={(e) => setReplaceFile(e.target.files?.[0] || null)} disabled={replaceUploading} />
                </label>
                <div className="flex items-center justify-end gap-2">
                  <button className="px-3 py-1.5 text-xs border border-line rounded hover:bg-backdrop-medium" onClick={() => { if (!replaceUploading) { setReplacingFor(null); setReplaceFile(null) } }}>Cancel</button>
                  <button
                    className="px-3 py-1.5 text-xs rounded bg-standout text-on-standout disabled:opacity-50"
                    disabled={replaceUploading || !replaceFile}
                    onClick={async () => {
                      if (!replacingFor || !replaceFile) return
                      setReplaceUploading(true)
                      try {
                        const form = new FormData()
                        form.append('file', replaceFile)
                        const res = await fetch(`/api/media/${encodeURIComponent(replacingFor.id)}/override`, {
                          method: 'POST',
                          headers: { ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}) },
                          credentials: 'same-origin',
                          body: form,
                        })
                        if (res.ok) {
                          toast.success('Replaced')
                          await load()
                          setReplacingFor(null)
                          setReplaceFile(null)
                        } else {
                          toast.error('Replace failed')
                        }
                      } finally {
                        setReplaceUploading(false)
                      }
                    }}
                  >
                    Replace
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Duplicate dialog remains ... */}
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
      {/* Duplicate choice dialog */}
      <AlertDialog open={dupOpen} onOpenChange={(open) => { setDupOpen(open); if (!open && dupResolve) { dupResolve('cancel'); setDupResolve(null) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate media detected</AlertDialogTitle>
            <AlertDialogDescription>
              "{dupFileName}" already exists. Choose an action:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { if (dupResolve) dupResolve('cancel'); setDupResolve(null); setDupOpen(false) }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (dupResolve) dupResolve('save'); setDupResolve(null); setDupOpen(false) }}>Save as new</AlertDialogAction>
            <AlertDialogAction onClick={() => { if (dupResolve) dupResolve('override'); setDupResolve(null); setDupOpen(false) }}>Override</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


