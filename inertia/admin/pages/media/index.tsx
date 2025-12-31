import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, usePage } from '@inertiajs/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPencil,
  faTrash,
  faChartBar,
  faSync,
  faTruckArrowRight,
  faListOl,
  faThLarge,
  faVideo,
  faImage,
  faXmark,
  faCrop,
  faCrosshairs,
  faExchangeAlt,
  faCloudUploadAlt,
  faFont,
  faExternalLinkAlt,
} from '@fortawesome/free-solid-svg-icons'
import {
  pickMediaVariantUrl,
  isMediaVideo,
  getMediaLabel,
  type MediaVariant,
} from '~/lib/media'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { toast } from 'sonner'
import { Pencil, Trash2, BarChart3, RefreshCw, ListOrdered, LayoutGrid } from 'lucide-react'
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
import { Input } from '../../../components/ui/input'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { MediaRenderer } from '../../../components/MediaRenderer'

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
  title?: string | null
  description?: string | null
  categories?: string[]
  createdAt: string
  metadata?: { variants?: Variant[]; playMode?: 'autoplay' | 'inline' | 'modal' } | null
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
  const [editAlt, setEditAlt] = useState<string>('')
  const [editTitle, setEditTitle] = useState<string>('')
  const [editDescription, setEditDescription] = useState<string>('')
  const [editPlayMode, setEditPlayMode] = useState<'autoplay' | 'inline' | 'modal'>('autoplay')
  const [savingEdit, setSavingEdit] = useState<boolean>(false)
  const [sortBy, setSortBy] = useState<'created_at' | 'original_filename' | 'size'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [whereUsed, setWhereUsed] = useState<{
    inModules: any[]
    inOverrides: any[]
    inPosts?: any[]
    inSettings?: boolean
  } | null>(null)
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
  const [bulkActionToConfirm, setBulkActionToConfirm] = useState<
    'optimize' | 'generate-missing' | 'regenerate' | 'delete' | null
  >(null)
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
  const [dupResolve, setDupResolve] = useState<
    ((choice: 'override' | 'save' | 'cancel') => void) | null
  >(null)
  const [dupExistingId, setDupExistingId] = useState<string>('')

  const imgRef = useRef<HTMLImageElement | null>(null)
  const [cropping, setCropping] = useState<boolean>(false)
  const [cropSel, setCropSel] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  ) // in display px
  const [dragging, setDragging] = useState<boolean>(false)
  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number } | null>(null)
  const [focalMode, setFocalMode] = useState<boolean>(false)
  const [focalDot, setFocalDot] = useState<{ x: number; y: number } | null>(null) // display px
  const [usageFor, setUsageFor] = useState<MediaItem | null>(null)
  const [selectedVariantName, setSelectedVariantName] = useState<string>('original')
  const [editTheme, setEditTheme] = useState<'light' | 'dark'>('light')
  const [replaceFile, setReplaceFile] = useState<File | null>(null)
  const [replaceUploading, setReplaceUploading] = useState<boolean>(false)
  const [darkPreviewVersion, setDarkPreviewVersion] = useState<number>(0)

  const page = usePage<PageProps>()
  const isAdmin = !!page.props?.isAdmin
  const preferredThumb =
    (page.props?.mediaAdmin?.thumbnailVariant as string | undefined) ||
    (import.meta as any).env?.MEDIA_ADMIN_THUMBNAIL_VARIANT ||
    (import.meta as any).env?.VITE_MEDIA_THUMBNAIL_VARIANT
  const preferredModal =
    (page.props?.mediaAdmin?.modalVariant as string | undefined) ||
    (import.meta as any).env?.MEDIA_ADMIN_MODAL_VARIANT ||
    (import.meta as any).env?.VITE_MEDIA_MODAL_VARIANT

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
  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    if (typeof localStorage !== 'undefined')
      localStorage.setItem('mediaUseOriginalName', String(useOriginalName))
  }, [useOriginalName])

  useEffect(() => {
    if (viewing) {
      setEditAlt(viewing.altText || '')
      setEditTitle(viewing.title || '')
      setEditDescription((viewing as any).description || '')
      setEditPlayMode((viewing.metadata as any)?.playMode || 'autoplay')
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
  useEffect(() => {
    load()
  }, [sortBy, sortOrder, selectedCategory])

  // Refresh a single media item from the API (used after per-item operations)
  async function refreshMediaItem(id: string) {
    try {
      const res = await fetch(`/api/media/${encodeURIComponent(id)}`, {
        credentials: 'same-origin',
      })
      if (!res.ok) return null
      const j = await res.json().catch(() => ({}))
      const data = (j as any)?.data
      if (!data || !data.id) return null

      // Update collection list
      setItems((prev) => prev.map((m) => (m.id === data.id ? { ...m, ...data } : m)))

      // Update currently viewed item if it matches
      setViewing((prev) => (prev && prev.id === data.id ? ({ ...prev, ...data } as any) : prev))

      return data as any
    } catch {
      // non-fatal
      return null
    }
  }

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
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ ids }),
      }).then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j?.error || 'Bulk optimize failed')
        }
      }),
      {
        loading: 'Optimizing selected…',
        success: 'Bulk optimize complete',
        error: (e) => String(e.message || e),
      }
    )
    setBulkKey((k) => k + 1)
    await load()
  }

  async function applyBulkGenerateMissing() {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)

    // For each selected item, check if it's missing variants and generate only what's missing
    let lightCount = 0
    let darkCount = 0

    for (const id of ids) {
      const item = items.find((i) => i.id === id)
      if (!item) continue

      // SVG media does not support generated variants – always use originals.
      const mime = (item.mimeType || '').toLowerCase()
      const isSvg = mime === 'image/svg+xml' || (item.url || '').toLowerCase().endsWith('.svg')
      if (isSvg) continue

      const status = getVariantStatus(item)

      try {
        // Generate light if missing
        if (!status.hasAllLight) {
          await fetch(`/api/media/${encodeURIComponent(id)}/variants`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
            },
            credentials: 'same-origin',
            body: JSON.stringify({ theme: 'light' }),
          })
          lightCount++
        }

        // Generate dark if missing
        if (!status.hasAllDark || !status.hasDarkBase) {
          await fetch(`/api/media/${encodeURIComponent(id)}/variants`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
            },
            credentials: 'same-origin',
            body: JSON.stringify({ theme: 'dark' }),
          })
          darkCount++
        }
      } catch {
        // Continue with next item on error
      }
    }

    toast.success(`Generated ${lightCount} light and ${darkCount} dark variant sets`)
    setBulkKey((k) => k + 1)
    await load()
  }

  async function applyBulkRegenerate() {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)

    // Regenerate ALL variants (light + dark) for all selected items
    let count = 0
    for (const id of ids) {
      try {
        const item = items.find((i) => i.id === id)
        if (!item) continue

        const mime = (item.mimeType || '').toLowerCase()
        const isSvg = mime === 'image/svg+xml' || (item.url || '').toLowerCase().endsWith('.svg')
        if (isSvg) continue

        // Regenerate light
        await fetch(`/api/media/${encodeURIComponent(id)}/variants`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
          },
          credentials: 'same-origin',
          body: JSON.stringify({ theme: 'light' }),
        })

        // Regenerate dark
        await fetch(`/api/media/${encodeURIComponent(id)}/variants`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
          },
          credentials: 'same-origin',
          body: JSON.stringify({ theme: 'dark' }),
        })

        count++
      } catch {
        // Continue with next item on error
      }
    }

    toast.success(`Regenerated all variants for ${count} items`)
    setBulkKey((k) => k + 1)
    await load()
  }

  async function applyBulkDelete() {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    await toast.promise(
      fetch('/api/media/delete-bulk', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
        },
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
    const selected = items.filter((i) => selectedIds.has(i.id))
    const allCats = selected.map((i) => (Array.isArray(i.categories) ? i.categories : []))
    let shared = allCats.length ? [...allCats[0]] : []
    for (const cats of allCats.slice(1)) {
      const set = new Set(cats)
      shared = shared.filter((c) => set.has(c))
    }
    setBulkCats(shared)
    setBulkCatsInitial(shared)
    setBulkCatInput('')
    setBulkCategoriesOpen(true)
  }

  async function saveBulkCategories() {
    const initial = new Set(bulkCatsInitial)
    const finalSet = new Set(bulkCats.map((c) => c.trim()).filter(Boolean))
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
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ ids, add, remove }),
      }).then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j?.error || 'Bulk category update failed')
        }
      }),
      {
        loading: 'Saving categories…',
        success: 'Categories updated',
        error: (e) => String(e.message || e),
      }
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

  function defaultAltFromFilename(name: string): string {
    const dot = name.lastIndexOf('.')
    const base = dot >= 0 ? name.slice(0, dot) : name
    return base
      .replace(/[-_]+/g, ' ')
      .trim()
      .replace(/\s{2,}/g, ' ')
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
            const j = await chk.json().catch(() => ({}) as any)
            const arr = Array.isArray(j?.data) ? j.data : []
            if (arr.length > 0) duplicateId = arr[0].id
          }
        } catch { }

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
    const res = await fetch(`/api/media/${encodeURIComponent(id)}/where-used`, {
      credentials: 'same-origin',
    })
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

  // Helper: check if media item has all expected variants (light + dark)
  function getVariantStatus(m: MediaItem | null): {
    hasAllLight: boolean
    hasAllDark: boolean
    hasDarkBase: boolean
  } {
    if (!m) return { hasAllLight: false, hasAllDark: false, hasDarkBase: false }
    const mime = (m.mimeType || '').toLowerCase()
    const isSvg = mime === 'image/svg+xml' || (m.url || '').toLowerCase().endsWith('.svg')
    // SVGs never have generated size variants; only track presence of a dark base.
    if (isSvg) {
      const meta = (m as any)?.metadata || {}
      const darkSourceUrl = typeof meta.darkSourceUrl === 'string' && meta.darkSourceUrl
      return { hasAllLight: false, hasAllDark: false, hasDarkBase: !!darkSourceUrl }
    }
    const meta = (m as any)?.metadata || {}
    const variants: Variant[] = Array.isArray(meta.variants) ? meta.variants : []
    const darkSourceUrl = typeof meta.darkSourceUrl === 'string' && meta.darkSourceUrl

    // Expected variant names from MEDIA_DERIVATIVES (default: thumb, small, medium, large)
    const expectedBaseNames = ['thumb', 'small', 'medium', 'large']

    const lightVariants = variants.filter((v) => !String(v?.name || '').endsWith('-dark'))
    const darkVariants = variants.filter((v) => String(v?.name || '').endsWith('-dark'))

    const hasAllLight = expectedBaseNames.every((name) =>
      lightVariants.some((v) => v.name === name)
    )
    const hasAllDark = expectedBaseNames.every((name) =>
      darkVariants.some((v) => v.name === `${name}-dark`)
    )
    const hasDarkBase = !!darkSourceUrl

    return { hasAllLight, hasAllDark, hasDarkBase }
  }

  function getEditDisplayUrl(m: any, theme: 'light' | 'dark'): string {
    // During cropping, always show the light original so cropRect maps to original pixels
    if (cropping) return m.url

    if (selectedVariantName === 'original') {
      if (theme === 'dark') {
        const meta = (m as any)?.metadata || {}
        const variants: any[] = Array.isArray((meta as any).variants) ? (meta as any).variants : []

        // Prefer a dedicated dark base if one exists, otherwise fall back to the largest dark variant,
        // and finally to the light original.
        const darkSource = (meta as any).darkSourceUrl as string | undefined
        let urlToUse: string | null = darkSource || null

        if (!urlToUse && variants.length > 0) {
          const darkVariants = variants.filter((v) => String(v?.name || '').endsWith('-dark'))
          if (darkVariants.length > 0) {
            const sortedDesc = [...darkVariants].sort(
              (a, b) => (b.width || b.height || 0) - (a.width || a.height || 0)
            )
            const best = sortedDesc[0]
            urlToUse = best?.url || null
          }
        }

        if (!urlToUse) urlToUse = m.url || null
        if (!urlToUse) return m.url
        // Cache‑bust dark preview so newly written files are visible immediately
        return `${urlToUse}?v=${darkPreviewVersion}`
      }
      return m.url
    }

    const vUrl = getVariantUrlByName(m, selectedVariantName)
    if (!vUrl) return m.url
    if (theme === 'dark') {
      // Also cache‑bust explicitly selected dark variants (e.g. thumb-dark)
      return `${vUrl}?v=${darkPreviewVersion}`
    }
    return vUrl
  }

  async function applyCrop() {
    const target = viewing
    if (!target || !imgRef.current) return
    if (selectedVariantName !== 'original') {
      toast.error('Crop is only available for the Original image')
      return
    }
    if (!cropSel) {
      toast.error('Select a crop region')
      return
    }
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
    if (w <= 0 || h <= 0) {
      toast.error('Select a crop region')
      return
    }
    const payload = { target: 'original-cropped', cropRect: { x, y, width: w, height: h } }
    const res = await fetch(`/api/media/${encodeURIComponent(target.id)}/variants`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
      },
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
    const target = viewing
    if (!target || !imgRef.current || !focalDot) return
    if (selectedVariantName !== 'original') {
      toast.error('Focal point is only available for the Original image')
      return
    }
    const img = imgRef.current
    const displayRect = img.getBoundingClientRect()
    const fx = Math.max(0, Math.min(1, focalDot.x / displayRect.width))
    const fy = Math.max(0, Math.min(1, focalDot.y / displayRect.height))
    const res = await fetch(`/api/media/${encodeURIComponent(target.id)}/variants`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
      },
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
    <div className="min-h-screen bg-backdrop-medium">
      <AdminHeader title="Media Library" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-backdrop-low rounded-lg shadow border border-line-low p-6">
          <div
            className={`mb-4 p-6 border-2 border-dashed rounded transition-colors ${isDragOver ? 'border-standout-medium bg-backdrop-medium' : 'border-line-high bg-backdrop-input'}`}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-neutral-medium">
                {uploading ? 'Uploading…' : 'Drag & drop files here or use the button to upload'}
              </div>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 text-xs text-neutral-high">
                  <input
                    type="checkbox"
                    checked={useOriginalName}
                    onChange={(e) => setUseOriginalName(e.target.checked)}
                  />
                  <span>Use original filename for storage</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="file"
                    onChange={onUpload}
                    disabled={uploading}
                    className="hidden"
                    id="mediaUploadInput"
                  />
                  <button
                    className="px-3 py-1.5 text-xs rounded bg-standout-medium text-on-high disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    disabled={uploading}
                    onClick={() =>
                      (document.getElementById('mediaUploadInput') as HTMLInputElement)?.click()
                    }
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
              className="text-sm border border-line-low bg-backdrop-input text-neutral-high px-2 py-1"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="created_at">Date Added</option>
              <option value="original_filename">Filename</option>
              <option value="size">Size</option>
            </select>
            <select
              className="text-sm border border-line-low bg-backdrop-input text-neutral-high px-2 py-1"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
            <div className="ml-auto flex items-center gap-2">
              <label className="text-xs text-neutral-medium">Category</label>
              <select
                className="text-sm border border-line-low bg-backdrop-input text-neutral-high px-2 py-1"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">All</option>
                {allCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* Bulk actions and view toggle */}
          <div className="mt-4 pb-2 border-b border-line-low flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-neutral-medium">
              <Checkbox checked={selectAll} onCheckedChange={() => toggleSelectAll()} />
              Select All
            </label>
            <div className="w-[200px]">
              <Select
                key={bulkKey}
                onValueChange={(
                  val: 'optimize' | 'generate-missing' | 'regenerate' | 'delete' | 'categories'
                ) => {
                  if (val === 'categories') {
                    openBulkCategories()
                  } else {
                    setBulkActionToConfirm(val)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Bulk actions..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="optimize">Optimize (WebP)</SelectItem>
                  <SelectItem value="generate-missing">Generate missing variations</SelectItem>
                  <SelectItem value="regenerate">Regenerate all variations</SelectItem>
                  {isAdmin && <SelectItem value="delete">Delete</SelectItem>}
                  <SelectItem value="categories">Edit Category…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`px-2 py-1.5 text-sm border border-line-low rounded inline-flex items-center gap-1 ${viewMode === 'gallery' ? 'bg-backdrop-medium' : ''}`}
                    onClick={() => setViewMode('gallery')}
                  >
                    <LayoutGrid className="w-4 h-4" /> Gallery
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Gallery view</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`px-2 py-1.5 text-sm border border-line-low rounded inline-flex items-center gap-1 ${viewMode === 'table' ? 'bg-backdrop-medium' : ''}`}
                    onClick={() => setViewMode('table')}
                  >
                    <ListOrdered className="w-4 h-4" /> List
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>List view</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="mt-4">
            {loading ? (
              <div className="text-sm text-neutral-medium">Loading…</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-neutral-low">
                No media yet. Upload a file to get started.
              </div>
            ) : (
              <>
                {viewMode === 'gallery' ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {items.map((m) => {
                      const isImage =
                        (m.mimeType && m.mimeType.startsWith('image/')) ||
                        /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(m.url || '')
                      const checked = selectedIds.has(m.id)
                      return (
                        <div
                          key={m.id}
                          className="border border-line-low rounded p-2 bg-backdrop-low"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <label className="inline-flex items-center gap-2 text-xs text-neutral-medium">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleSelect(m.id)}
                              />
                              Select
                            </label>
                          </div>
                          <div className="aspect-video bg-backdrop-medium border border-line-low overflow-hidden rounded">
                            <MediaRenderer
                              image={m}
                              variant="thumb"
                              alt={getMediaLabel(m)}
                              className="w-full h-full object-contain"
                              controls={false}
                              autoPlay={false}
                              objectFit="contain"
                            />
                          </div>
                          <div className="mt-2">
                            <div className="text-xs text-neutral-high break-all font-medium">
                              {getMediaLabel(m)}
                            </div>
                            <div className="text-[10px] text-neutral-low mt-1">
                              {m.mimeType} • {(m.size / 1024).toFixed(1)} KB
                              {typeof m.optimizedSize === 'number' && m.optimizedSize > 0 && (
                                <> → {(m.optimizedSize / 1024).toFixed(1)} KB (WebP)</>
                              )}
                            </div>
                            <div className="text-[10px] text-neutral-low">
                              File: {m.url.split('/').pop()}
                            </div>
                            <div className="text-[10px] text-neutral-low">
                              Date Added: {new Date(m.createdAt).toLocaleString()}
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="px-3 py-1.5 text-sm border border-line-low rounded hover:bg-backdrop-medium inline-flex items-center gap-1"
                                  onClick={() => {
                                    setViewing(m)
                                    setSelectedVariantName('original')
                                    setEditTheme('light')
                                    setCropping(false)
                                    setFocalMode(false)
                                    setCropSel(null)
                                    setFocalDot(null)
                                    setReplaceFile(null)
                                  }}
                                  aria-label="Edit"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit</p>
                              </TooltipContent>
                            </Tooltip>

                            {isImage && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className="px-3 py-1.5 text-sm border border-line-low rounded hover:bg-backdrop-medium inline-flex items-center gap-1"
                                    onClick={async () => {
                                      await toast.promise(
                                        fetch(`/api/media/${encodeURIComponent(m.id)}/optimize`, {
                                          method: 'POST',
                                          headers: {
                                            'Accept': 'application/json',
                                            'Content-Type': 'application/json',
                                            ...(xsrfFromCookie
                                              ? { 'X-XSRF-TOKEN': xsrfFromCookie }
                                              : {}),
                                          },
                                          credentials: 'same-origin',
                                        }).then(async (r) => {
                                          if (!r.ok) {
                                            const j = await r.json().catch(() => ({}))
                                            throw new Error(j?.error || 'Optimize failed')
                                          }
                                        }),
                                        {
                                          loading: 'Optimizing…',
                                          success: 'Optimized',
                                          error: (e) => String(e.message || e),
                                        }
                                      )
                                      await load()
                                    }}
                                    aria-label="Optimize"
                                  >
                                    <FontAwesomeIcon icon={faTruckArrowRight} size="sm" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Optimize (WebP)</p>
                                </TooltipContent>
                              </Tooltip>
                            )}

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="px-3 py-1.5 text-sm border border-line-low rounded hover:bg-backdrop-medium inline-flex items-center gap-1"
                                  onClick={() => {
                                    setUsageFor(m)
                                    fetchWhereUsed(m.id)
                                  }}
                                  aria-label="Usage"
                                >
                                  <BarChart3 className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Usage</p>
                              </TooltipContent>
                            </Tooltip>

                            {/* Replace is now handled inside the integrated editor modal */}
                            {isAdmin && (
                              <AlertDialog>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertDialogTrigger asChild>
                                      <button
                                        className="px-3 py-1.5 text-sm border border-line-low rounded hover:bg-backdrop-medium text-danger inline-flex items-center gap-1"
                                        aria-label="Delete"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </AlertDialogTrigger>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Delete</p>
                                  </TooltipContent>
                                </Tooltip>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete this media?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will delete the original file and all generated variants.
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={async () => {
                                        const res = await fetch(
                                          `/api/media/${encodeURIComponent(m.id)}`,
                                          {
                                            method: 'DELETE',
                                            headers: {
                                              ...(xsrfFromCookie
                                                ? { 'X-XSRF-TOKEN': xsrfFromCookie }
                                                : {}),
                                            },
                                            credentials: 'same-origin',
                                          }
                                        )
                                        if (res.ok) {
                                          toast.success('Deleted')
                                          await load()
                                        } else {
                                          toast.error('Delete failed')
                                        }
                                      }}
                                    >
                                      Delete
                                    </AlertDialogAction>
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
                            <Checkbox
                              checked={selectAll}
                              onCheckedChange={() => toggleSelectAll()}
                              aria-label="Select all"
                            />
                          </TableHead>
                          <TableHead>Preview</TableHead>
                          <TableHead>Label</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Optimized</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((m) => {
                          const isImage =
                            (m.mimeType && m.mimeType.startsWith('image/')) ||
                            /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(m.url || '')
                          const checked = selectedIds.has(m.id)
                          return (
                            <TableRow key={m.id}>
                              <TableCell>
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleSelect(m.id)}
                                  aria-label="Select row"
                                />
                              </TableCell>
                              <TableCell>
                                <div className="w-16 h-10 border border-line-low overflow-hidden rounded bg-backdrop-medium">
                                  <MediaRenderer
                                    image={m}
                                    variant="thumb"
                                    alt=""
                                    className="w-full h-full object-cover"
                                    controls={false}
                                    autoPlay={false}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="max-w-[240px] truncate" title={getMediaLabel(m)}>
                                {getMediaLabel(m)}
                              </TableCell>
                              <TableCell>{m.mimeType}</TableCell>
                              <TableCell>{(m.size / 1024).toFixed(1)} KB</TableCell>
                              <TableCell>
                                {typeof m.optimizedSize === 'number'
                                  ? `${(m.optimizedSize / 1024).toFixed(1)} KB`
                                  : '-'}
                              </TableCell>
                              <TableCell>{new Date(m.createdAt).toLocaleString()}</TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium inline-flex items-center gap-1"
                                    onClick={() => {
                                      setViewing(m)
                                      setSelectedVariantName('original')
                                      setEditTheme('light')
                                      setCropping(false)
                                      setFocalMode(false)
                                      setCropSel(null)
                                      setFocalDot(null)
                                      setReplaceFile(null)
                                    }}
                                    aria-label="Edit"
                                    title="Edit"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  {isImage && (
                                    <button
                                      className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium inline-flex items-center gap-1"
                                      onClick={async () => {
                                        await toast.promise(
                                          fetch(`/api/media/${encodeURIComponent(m.id)}/optimize`, {
                                            method: 'POST',
                                            headers: {
                                              'Accept': 'application/json',
                                              'Content-Type': 'application/json',
                                              ...(xsrfFromCookie
                                                ? { 'X-XSRF-TOKEN': xsrfFromCookie }
                                                : {}),
                                            },
                                            credentials: 'same-origin',
                                          }).then(async (r) => {
                                            if (!r.ok) {
                                              const j = await r.json().catch(() => ({}))
                                              throw new Error(j?.error || 'Optimize failed')
                                            }
                                          }),
                                          {
                                            loading: 'Optimizing…',
                                            success: 'Optimized',
                                            error: (e) => String(e.message || e),
                                          }
                                        )
                                        await load()
                                      }}
                                      aria-label="Optimize"
                                      title="Optimize (WebP)"
                                    >
                                      <FontAwesomeIcon
                                        icon={faTruckArrowRight}
                                        size="sm"
                                      />
                                    </button>
                                  )}
                                  <button
                                    className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium inline-flex items-center gap-1"
                                    onClick={() => {
                                      setUsageFor(m)
                                      fetchWhereUsed(m.id)
                                    }}
                                    aria-label="Usage"
                                    title="Usage"
                                  >
                                    <BarChart3 className="w-4 h-4" />
                                  </button>
                                  {/* Replace is now handled inside the integrated editor modal */}
                                  {isAdmin && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <button
                                          className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-danger inline-flex items-center gap-1"
                                          aria-label="Delete"
                                          title="Delete"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete this media?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            This will delete the original file and all generated
                                            variants. This action cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={async () => {
                                              const res = await fetch(
                                                `/api/media/${encodeURIComponent(m.id)}`,
                                                {
                                                  method: 'DELETE',
                                                  headers: {
                                                    ...(xsrfFromCookie
                                                      ? { 'X-XSRF-TOKEN': xsrfFromCookie }
                                                      : {}),
                                                  },
                                                  credentials: 'same-origin',
                                                }
                                              )
                                              if (res.ok) {
                                                toast.success('Deleted')
                                                await load()
                                              } else {
                                                toast.error('Delete failed')
                                              }
                                            }}
                                          >
                                            Delete
                                          </AlertDialogAction>
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
        </div>

        {/* Meta Editor modal (opens via pencil) */}
        {/* Bulk Action confirm */}
        <AlertDialog
          open={bulkActionToConfirm !== null}
          onOpenChange={(open) => {
            if (!open) setBulkActionToConfirm(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {bulkActionToConfirm === 'delete' && 'Delete selected media?'}
                {bulkActionToConfirm === 'optimize' && 'Optimize selected media?'}
                {bulkActionToConfirm === 'generate-missing' && 'Generate missing variations?'}
                {bulkActionToConfirm === 'regenerate' && 'Regenerate all variations?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {bulkActionToConfirm === 'delete' &&
                  'This will permanently delete the originals and all variants. This action cannot be undone.'}
                {bulkActionToConfirm === 'optimize' &&
                  'This will generate WebP versions for the selected images and their variants to improve performance.'}
                {bulkActionToConfirm === 'generate-missing' &&
                  'This will check each selected item and generate any missing light or dark mode variants.'}
                {bulkActionToConfirm === 'regenerate' &&
                  'This will re-generate ALL variants (light and dark) for the selected items, overwriting any existing ones.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setBulkActionToConfirm(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  const action = bulkActionToConfirm
                  setBulkActionToConfirm(null)
                  if (action === 'delete') {
                    await applyBulkDelete()
                  } else if (action === 'optimize') {
                    await applyBulk('optimize')
                  } else if (action === 'generate-missing') {
                    await applyBulkGenerateMissing()
                  } else if (action === 'regenerate') {
                    await applyBulkRegenerate()
                  }
                }}
                className={bulkActionToConfirm === 'delete' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
              >
                {bulkActionToConfirm === 'delete' ? 'Delete' : 'Continue'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Categories modal */}
        {bulkCategoriesOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/70"
              onClick={() => setBulkCategoriesOpen(false)}
            />
            <div className="relative z-10 w-full max-w-xl rounded-lg border border-line-low bg-backdrop-input p-3 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-neutral-high">Categories (free tags)</div>
                <button
                  className="text-neutral-medium hover:text-neutral-high"
                  onClick={() => setBulkCategoriesOpen(false)}
                >
                  ✕
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="text-xs text-neutral-medium">
                  Editing shared categories for {selectedIds.size} selected item(s). Add tags to
                  apply to all; remove to clear from all.
                </div>
                <div className="flex flex-wrap gap-2">
                  {bulkCats.map((c, idx) => (
                    <span
                      key={`${c}-${idx}`}
                      className="inline-flex items-center gap-1 px-2 py-1 border border-line-low rounded"
                    >
                      {c}
                      <button
                        className="text-neutral-low hover:text-neutral-high"
                        onClick={() => setBulkCats(bulkCats.filter((x, i) => !(i === idx)))}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 px-2 py-1 border border-line-low bg-backdrop-input text-neutral-high"
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
                    className="px-3 py-1.5 text-xs rounded bg-standout-medium text-on-high disabled:opacity-50"
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
                  <button
                    className="px-3 py-1.5 text-xs border border-line-low rounded"
                    onClick={() => setBulkCategoriesOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-3 py-1.5 text-xs rounded bg-standout-medium text-on-high"
                    onClick={saveBulkCategories}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Single-item integrated editor modal (meta + image editing) */}
        {viewing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setViewing(null)}
            />
            <div className="relative z-10 w-full max-w-5xl rounded-2xl border border-line-low bg-backdrop-low shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between p-4 border-b border-line-low bg-backdrop-low">
                <div className="flex flex-col ml-1">
                  <div className="text-sm font-bold text-neutral-high truncate max-w-md">
                    {getMediaLabel(viewing)}
                  </div>
                  <div className="text-[10px] text-neutral-medium uppercase tracking-wider font-semibold flex items-center gap-2">
                    <FontAwesomeIcon
                      icon={isMediaVideo(viewing) ? faVideo : faImage}
                      size="sm"
                    />
                    {isMediaVideo(viewing) ? 'Video Asset' : 'Image Asset'} • {viewing.id}
                    <a
                      href={viewing.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-standout-medium hover:underline inline-flex items-center gap-1 normal-case"
                      title="Open raw asset in new tab"
                    >
                      <FontAwesomeIcon icon={faExternalLinkAlt} size="2xs" />
                      Full Asset
                    </a>
                  </div>
                </div>
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-full text-neutral-medium hover:text-neutral-high hover:bg-backdrop-medium transition-all"
                  onClick={() => {
                    setViewing(null)
                    setCropping(false)
                    setCropSel(null)
                    setFocalMode(false)
                    setFocalDot(null)
                    setSelectedVariantName('original')
                    setEditTheme('light')
                    setReplaceFile(null)
                  }}
                >
                  <FontAwesomeIcon icon={faXmark} size="lg" />
                </button>
              </div>
              <div className="flex flex-1 min-h-0 overflow-hidden text-sm">
                {/* Left Panel: Preview & Creative Controls */}
                <div className="flex-1 overflow-auto p-8 pt-35 bg-backdrop-medium/20 flex flex-col items-center justify-center min-h-[400px]">
                  {!isMediaVideo(viewing) && (
                    <div className="mb-6 flex items-center justify-center w-full">
                      <div className="inline-flex items-center p-1 bg-backdrop-medium rounded-xl border border-line-low shadow-sm">
                        <button
                          className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${editTheme === 'light'
                            ? 'bg-backdrop-low text-neutral-high shadow-sm ring-1 ring-black/5'
                            : 'text-neutral-medium hover:text-neutral-high'
                            }`}
                          onClick={() => {
                            setEditTheme('light')
                            setSelectedVariantName('original')
                          }}
                        >
                          Light Mode
                        </button>
                        <button
                          className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${editTheme === 'dark'
                            ? 'bg-backdrop-low text-neutral-high shadow-sm ring-1 ring-black/5'
                            : 'text-neutral-medium hover:text-neutral-high'
                            }`}
                          onClick={() => {
                            setEditTheme('dark')
                            const variants: any[] = Array.isArray(
                              (viewing as any)?.metadata?.variants
                            )
                              ? (viewing as any).metadata.variants
                              : []
                            const firstDark = variants.find((v) =>
                              String(v.name || '').endsWith('-dark')
                            )
                            setSelectedVariantName(firstDark?.name || 'original')
                          }}
                        >
                          Dark Mode
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="relative group max-w-full flex items-center justify-center">
                    <div
                      className="relative flex items-center justify-center border border-line-low shadow-2xl rounded-xl overflow-hidden bg-black/10 min-w-[200px] min-h-[200px]"
                      onMouseDown={onCropMouseDown}
                      onMouseMove={onCropMouseMove}
                      onMouseUp={onCropMouseUp}
                      onClick={onFocalClick}
                    >
                      <MediaRenderer
                        ref={imgRef}
                        url={getEditDisplayUrl(viewing, editTheme)}
                        mimeType={viewing.mimeType}
                        alt={getMediaLabel(viewing)}
                        className="max-w-full h-auto max-h-[55vh] block"
                        controls={isMediaVideo(viewing)}
                        autoPlay={false}
                        playMode={editPlayMode}
                        objectFit="contain"
                      />
                      {cropping && cropSel && (
                        <div
                          className="absolute border-2 border-standout-medium bg-standout-medium/10 ring-1 ring-white/50"
                          style={{
                            left: `${cropSel.x}px`,
                            top: `${cropSel.y}px`,
                            width: `${cropSel.w}px`,
                            height: `${cropSel.h}px`,
                          }}
                        />
                      )}
                      {focalMode && focalDot && (
                        <div
                          className="absolute -translate-x-1/2 -translate-y-1/2 drop-shadow-md pointer-events-none"
                          style={{ left: `${focalDot.x}px`, top: `${focalDot.y}px` }}
                        >
                          <div className="w-6 h-6 rounded-full bg-standout-medium border-2 border-white shadow-lg animate-pulse" />
                        </div>
                      )}
                    </div>
                  </div>

                  {!isMediaVideo(viewing) && (
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] text-neutral-medium font-bold uppercase tracking-wider px-1">
                          Variation Preview
                        </span>
                        <select
                          className="text-xs border border-line-medium bg-backdrop-low text-neutral-high px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-standout-medium/20 focus:border-standout-medium outline-none transition-all min-w-[160px] shadow-sm"
                          value={selectedVariantName}
                          onChange={(e) => setSelectedVariantName(e.target.value)}
                        >
                          <option value="original">
                            {editTheme === 'dark' ? 'Original (Dark)' : 'Original (Light)'}
                          </option>
                          {(viewing as any).metadata?.variants
                            ?.filter((v: any) =>
                              editTheme === 'dark'
                                ? String(v.name || '').endsWith('-dark')
                                : !String(v.name || '').endsWith('-dark')
                            )
                            .map((v: any) => (
                              <option key={v.name} value={v.name}>
                                {getVariantLabel(v)}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] text-neutral-medium font-bold uppercase tracking-wider px-1 invisible">
                          Tools
                        </span>
                        <div className="flex items-center gap-2">
                          {!focalMode &&
                            !cropping &&
                            selectedVariantName === 'original' &&
                            (() => {
                              const mime = (viewing?.mimeType || '').toLowerCase()
                              const isSvg =
                                mime === 'image/svg+xml' ||
                                (viewing?.url || '').toLowerCase().endsWith('.svg')
                              if (isSvg) return null
                              return (
                                <button
                                  className="px-4 py-2.5 text-xs font-bold border border-line-medium rounded-xl hover:bg-backdrop-low hover:border-neutral-low transition-all flex items-center gap-2 shadow-sm bg-backdrop-low/50"
                                  onClick={() => setCropping(true)}
                                >
                                  <FontAwesomeIcon icon={faCrop} size="sm" />
                                  Crop Image
                                </button>
                              )
                            })()}
                          {cropping && (
                            <>
                              <button
                                className="px-5 py-2.5 text-xs font-bold border border-line-medium rounded-xl hover:bg-backdrop-medium transition-all"
                                onClick={() => {
                                  setCropping(false)
                                  setCropSel(null)
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-standout-medium text-on-high shadow-lg shadow-standout-medium/20 hover:bg-standout-high transition-all"
                                onClick={applyCrop}
                              >
                                Apply Crop
                              </button>
                            </>
                          )}
                          {!cropping &&
                            !focalMode &&
                            selectedVariantName === 'original' &&
                            (() => {
                              const mime = (viewing?.mimeType || '').toLowerCase()
                              const isSvg =
                                mime === 'image/svg+xml' ||
                                (viewing?.url || '').toLowerCase().endsWith('.svg')
                              if (isSvg) return null
                              return (
                                <>
                                  <button
                                    className="px-4 py-2.5 text-xs font-bold border border-line-medium rounded-xl hover:bg-backdrop-low hover:border-neutral-low transition-all flex items-center gap-2 shadow-sm bg-backdrop-low/50"
                                    onClick={() => setFocalMode(true)}
                                  >
                                    <FontAwesomeIcon icon={faCrosshairs} size="sm" />
                                    Focal Point
                                  </button>
                                  {(() => {
                                    const status = getVariantStatus(viewing)
                                    const allVariantsExist =
                                      status.hasAllLight && status.hasAllDark && status.hasDarkBase
                                    const buttonLabel = allVariantsExist
                                      ? 'Regenerate All'
                                      : 'Generate Variations'
                                    const isRegenerateMode = allVariantsExist

                                    return (
                                      <button
                                        className="px-4 py-2.5 text-xs font-bold border border-line-medium rounded-xl hover:bg-backdrop-low hover:border-neutral-low transition-all shadow-sm bg-backdrop-low/50"
                                        onClick={async () => {
                                          if (!viewing) return
                                          const targetId = viewing.id
                                          try {
                                            if (!status.hasAllLight || isRegenerateMode) {
                                              await toast.promise(
                                                fetch(
                                                  `/api/media/${encodeURIComponent(targetId)}/variants`,
                                                  {
                                                    method: 'POST',
                                                    headers: {
                                                      'Accept': 'application/json',
                                                      'Content-Type': 'application/json',
                                                      ...(xsrfFromCookie
                                                        ? { 'X-XSRF-TOKEN': xsrfFromCookie }
                                                        : {}),
                                                    },
                                                    credentials: 'same-origin',
                                                    body: JSON.stringify({ theme: 'light' }),
                                                  }
                                                ).then((r) => {
                                                  if (!r.ok)
                                                    throw new Error('Light variants failed')
                                                  return r
                                                }),
                                                {
                                                  loading: 'Generating light variants…',
                                                  success: 'Light variants generated',
                                                  error: (e) => String(e.message || e),
                                                }
                                              )
                                            }
                                            if (
                                              !status.hasAllDark ||
                                              !status.hasDarkBase ||
                                              isRegenerateMode
                                            ) {
                                              await toast.promise(
                                                fetch(
                                                  `/api/media/${encodeURIComponent(targetId)}/variants`,
                                                  {
                                                    method: 'POST',
                                                    headers: {
                                                      'Accept': 'application/json',
                                                      'Content-Type': 'application/json',
                                                      ...(xsrfFromCookie
                                                        ? { 'X-XSRF-TOKEN': xsrfFromCookie }
                                                        : {}),
                                                    },
                                                    credentials: 'same-origin',
                                                    body: JSON.stringify({ theme: 'dark' }),
                                                  }
                                                ).then((r) => {
                                                  if (!r.ok) throw new Error('Dark variants failed')
                                                  return r
                                                }),
                                                {
                                                  loading: 'Generating dark variants…',
                                                  success: 'Dark variants generated',
                                                  error: (e) => String(e.message || e),
                                                }
                                              )
                                            }
                                            await refreshMediaItem(targetId)
                                            setDarkPreviewVersion((v) => v + 1)
                                            if (!isRegenerateMode) {
                                              setEditTheme('dark')
                                              setSelectedVariantName('original')
                                            }
                                          } catch (err) {
                                            toast.error(String(err.message || err))
                                          }
                                        }}
                                      >
                                        {buttonLabel}
                                      </button>
                                    )
                                  })()}
                                </>
                              )
                            })()}
                          {focalMode && (
                            <>
                              <button
                                className="px-5 py-2.5 text-xs font-bold border border-line-medium rounded-xl hover:bg-backdrop-medium transition-all"
                                onClick={() => {
                                  setFocalMode(false)
                                  setFocalDot(null)
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-standout-medium text-on-high shadow-lg shadow-standout-medium/20 hover:bg-standout-high transition-all"
                                onClick={applyFocal}
                              >
                                Save Focal Point
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Panel: Metadata & Management */}
                <div className="w-full max-w-[340px] flex flex-col border-l border-line-low bg-backdrop-low/50">
                  <div className="flex-1 overflow-auto p-6 space-y-8">
                    {/* General Section */}
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-medium px-1">
                        Metadata
                      </h3>

                      {!isMediaVideo(viewing) && (
                        <div>
                          <label className="block text-[11px] font-bold text-neutral-medium mb-1.5 ml-1">
                            Alt Text
                          </label>
                          <input
                            className="w-full px-4 py-2.5 text-xs border border-line-medium rounded-xl bg-backdrop-input text-neutral-high focus:ring-2 focus:ring-standout-medium/20 focus:border-standout-medium outline-none transition-all shadow-sm"
                            value={editAlt}
                            onChange={(e) => setEditAlt(e.target.value)}
                            placeholder="Screen reader description"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-bold text-neutral-medium mb-1.5 ml-1">
                          Caption / Title
                        </label>
                        <input
                          className="w-full px-4 py-2.5 text-xs border border-line-medium rounded-xl bg-backdrop-input text-neutral-high focus:ring-2 focus:ring-standout-medium/20 focus:border-standout-medium outline-none transition-all shadow-sm"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="Optional display title"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-neutral-medium mb-1.5 ml-1">
                          Description
                        </label>
                        <textarea
                          className="w-full px-4 py-2.5 text-xs border border-line-medium rounded-xl bg-backdrop-input text-neutral-high min-h-[90px] focus:ring-2 focus:ring-standout-medium/20 focus:border-standout-medium outline-none transition-all resize-none shadow-sm"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Longer context or notes"
                        />
                      </div>

                      {isMediaVideo(viewing) && (
                        <div>
                          <label className="block text-[11px] font-bold text-neutral-medium mb-1.5 ml-1">
                            Default Video Behavior
                          </label>
                          <Select
                            value={editPlayMode}
                            onValueChange={(val: any) => setEditPlayMode(val)}
                          >
                            <SelectTrigger className="h-10 text-xs border-line-medium bg-backdrop-input rounded-xl shadow-sm">
                              <SelectValue placeholder="Select play mode" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="autoplay">Inline (Auto-loop)</SelectItem>
                              <SelectItem value="inline">Inline (With Controls)</SelectItem>
                              <SelectItem value="modal">Open in Modal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-bold text-neutral-medium mb-1.5 ml-1">
                          Categorization
                        </label>
                        <div className="flex items-center gap-1.5 flex-wrap mb-2.5 px-1">
                          {editCategories.map((c) => (
                            <span
                              key={c}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-backdrop-medium border border-line-medium text-neutral-high group transition-all hover:border-neutral-low"
                            >
                              {c}
                              <button
                                className="text-neutral-low hover:text-error transition-colors"
                                onClick={() =>
                                  setEditCategories((prev) => prev.filter((x) => x !== c))
                                }
                              >
                                <FontAwesomeIcon icon={faXmark} size="sm" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <input
                          className="w-full px-4 py-2.5 text-xs border border-line-medium rounded-xl bg-backdrop-input text-neutral-high focus:ring-2 focus:ring-standout-medium/20 focus:border-standout-medium outline-none transition-all shadow-sm"
                          placeholder="Type tag and press enter..."
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ',') {
                              e.preventDefault()
                              const v = newCategory.trim()
                              if (v && !editCategories.includes(v))
                                setEditCategories([...editCategories, v])
                              setNewCategory('')
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Management Section */}
                    <div className="space-y-4 pt-4 border-t border-line-low">
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-medium px-1">
                        Management
                      </h3>

                      <div className="p-4 bg-backdrop-medium/40 border border-line-low rounded-2xl space-y-4 shadow-inner">
                        <div className="text-[11px] font-bold text-neutral-high flex items-center gap-2">
                          <FontAwesomeIcon icon={faExchangeAlt} size="sm" />
                          {editTheme === 'dark' ? 'Upload Dark Version' : 'Replace Asset Source'}
                        </div>
                        <div className="space-y-3">
                          <input
                            type="file"
                            id="replace-file-input"
                            className="hidden"
                            accept={isMediaVideo(viewing) ? 'video/*' : 'image/*'}
                            onChange={(e) => setReplaceFile(e.target.files?.[0] || null)}
                            disabled={replaceUploading}
                          />
                          <label
                            htmlFor="replace-file-input"
                            className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-line-medium rounded-xl cursor-pointer hover:bg-backdrop-medium hover:border-neutral-low transition-all"
                          >
                            <FontAwesomeIcon
                              icon={faCloudUploadAlt}
                              className="mb-1 text-neutral-low"
                              size="xl"
                            />
                            <span className="text-[10px] font-semibold text-neutral-medium text-center">
                              {replaceFile
                                ? replaceFile.name
                                : editTheme === 'dark'
                                  ? 'Click to choose dark version'
                                  : 'Click to choose new file'}
                            </span>
                          </label>
                          <button
                            className="w-full px-4 py-2.5 text-[11px] font-bold rounded-xl bg-neutral-high text-backdrop-low hover:bg-neutral-high/90 disabled:opacity-50 transition-all shadow-md disabled:cursor-not-allowed"
                            disabled={replaceUploading || !replaceFile}
                            onClick={async () => {
                              if (!viewing || !replaceFile) return
                              setReplaceUploading(true)
                              try {
                                const form = new FormData()
                                form.append('file', replaceFile)
                                form.append('theme', editTheme)
                                const res = await fetch(
                                  `/api/media/${encodeURIComponent(viewing.id)}/override`,
                                  {
                                    method: 'POST',
                                    headers: {
                                      ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
                                    },
                                    credentials: 'same-origin',
                                    body: form,
                                  }
                                )
                                if (res.ok) {
                                  // SOC2/Security: Also save any pending metadata changes automatically
                                  // as user expects "Confirm" to be the final action for this asset.
                                  await fetch(`/api/media/${encodeURIComponent(viewing.id)}`, {
                                    method: 'PATCH',
                                    headers: {
                                      'Accept': 'application/json',
                                      'Content-Type': 'application/json',
                                      ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
                                    },
                                    credentials: 'same-origin',
                                    body: JSON.stringify({
                                      altText: isMediaVideo(viewing) ? undefined : editAlt,
                                      title: editTitle,
                                      description: editDescription,
                                      playMode: isMediaVideo(viewing) ? editPlayMode : undefined,
                                      categories: editCategories,
                                    }),
                                  })

                                  toast.success(
                                    editTheme === 'dark'
                                      ? 'Dark version saved'
                                      : 'Asset replaced and saved'
                                  )
                                  await load()
                                  setReplaceFile(null)
                                  setViewing(null) // Close modal
                                } else {
                                  toast.error('Replacement failed')
                                }
                              } finally {
                                setReplaceUploading(false)
                              }
                            }}
                          >
                            {replaceUploading
                              ? 'Uploading...'
                              : editTheme === 'dark'
                                ? 'Confirm Dark Version'
                                : 'Confirm Replacement'}
                          </button>
                        </div>
                      </div>

                      <div className="p-4 bg-backdrop-medium/40 border border-line-low rounded-2xl space-y-4 shadow-inner">
                        <div className="text-[11px] font-bold text-neutral-high flex items-center gap-2">
                          <FontAwesomeIcon icon={faFont} size="sm" />
                          Rename Filename
                        </div>
                        <div className="flex flex-col gap-3">
                          <input
                            className="px-4 py-2.5 text-[11px] border border-line-medium rounded-xl bg-backdrop-low text-neutral-high outline-none focus:ring-2 focus:ring-standout-medium/20 transition-all shadow-sm"
                            placeholder="Enter new name..."
                            value={newFilename}
                            onChange={(e) => setNewFilename(e.target.value)}
                          />
                          <button
                            className="w-full px-4 py-2.5 text-[11px] font-bold rounded-xl border border-line-medium bg-backdrop-low hover:bg-backdrop-medium transition-all shadow-sm"
                            disabled={renaming || !newFilename}
                            onClick={async () => {
                              if (!viewing || !newFilename) return
                              setRenaming(true)
                              try {
                                const res = await fetch(
                                  `/api/media/${encodeURIComponent(viewing.id)}/rename`,
                                  {
                                    method: 'PATCH',
                                    headers: {
                                      'Accept': 'application/json',
                                      'Content-Type': 'application/json',
                                      ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
                                    },
                                    credentials: 'same-origin',
                                    body: JSON.stringify({ filename: newFilename }),
                                  }
                                )
                                if (res.ok) {
                                  toast.success('Renamed successfully')
                                  await load()
                                  setNewFilename('')
                                } else {
                                  toast.error('Rename failed')
                                }
                              } finally {
                                setRenaming(false)
                              }
                            }}
                          >
                            {renaming ? 'Renaming...' : 'Apply New Name'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="p-6 border-t border-line-low bg-backdrop-low flex flex-col gap-3">
                    <button
                      className="w-full px-6 py-3 text-xs font-bold rounded-xl bg-standout-medium text-on-high shadow-lg shadow-standout-medium/20 hover:bg-standout-high hover:shadow-standout-medium/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      disabled={savingEdit}
                      onClick={async () => {
                        if (!viewing) return
                        setSavingEdit(true)
                        try {
                          const res = await fetch(`/api/media/${encodeURIComponent(viewing.id)}`, {
                            method: 'PATCH',
                            headers: {
                              'Accept': 'application/json',
                              'Content-Type': 'application/json',
                              ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
                            },
                            credentials: 'same-origin',
                            body: JSON.stringify({
                              altText: isMediaVideo(viewing) ? null : editAlt,
                              title: editTitle,
                              description: editDescription,
                              playMode: isMediaVideo(viewing) ? editPlayMode : undefined,
                              categories: editCategories,
                            }),
                          })
                          if (res.ok) {
                            toast.success('Changes saved successfully')
                            await load()
                            setViewing(null)
                          } else {
                            toast.error('Failed to save metadata')
                          }
                        } finally {
                          setSavingEdit(false)
                        }
                      }}
                    >
                      {savingEdit ? 'Saving...' : 'Save All Changes'}
                    </button>
                    <button
                      className="w-full px-6 py-3 text-xs font-bold rounded-xl border border-line-medium text-neutral-high hover:bg-backdrop-medium transition-all"
                      onClick={() => {
                        setViewing(null)
                        setCropping(false)
                        setCropSel(null)
                        setFocalMode(false)
                        setFocalDot(null)
                        setSelectedVariantName('original')
                        setEditTheme('light')
                        setReplaceFile(null)
                      }}
                    >
                      Discard & Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Usage modal */}
        {usageFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => {
                setUsageFor(null)
                setWhereUsed(null)
              }}
            />
            <div className="relative z-10 w-full max-w-lg rounded-lg border border-line-low bg-backdrop-input p-6 shadow-xl max-h-[90vh] overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-neutral-high">Usage</h3>
                <button
                  className="text-neutral-medium hover:text-neutral-high"
                  onClick={() => {
                    setUsageFor(null)
                    setWhereUsed(null)
                  }}
                >
                  ✕
                </button>
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
                          <li key={m.id} className="text-xs">
                            {m.scope === 'global' ? (
                              <Link
                                href={`/admin/modules?q=${encodeURIComponent(m.globalSlug || '')}`}
                                className="text-standout-medium hover:underline"
                              >
                                Global Module {m.type} ({m.globalSlug})
                              </Link>
                            ) : m.postId ? (
                              <Link
                                href={`/admin/posts/${m.postId}/edit`}
                                className="text-standout-medium hover:underline"
                              >
                                Module {m.type} in "{m.postTitle || m.postId}"
                              </Link>
                            ) : (
                              `Module ${m.type} (id: ${m.id}, scope: ${m.scope})`
                            )}
                          </li>
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
                          <li key={o.id} className="text-xs">
                            <Link
                              href={`/admin/posts/${o.postId}/edit`}
                              className="text-standout-medium hover:underline"
                            >
                              PostModule in "{o.postTitle || o.postId}"
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {whereUsed.inPosts && whereUsed.inPosts.length > 0 && (
                    <div>
                      <div className="font-medium">In Posts ({whereUsed.inPosts.length})</div>
                      <ul className="list-disc pl-5 text-neutral-medium">
                        {whereUsed.inPosts.map((p: any) => (
                          <li key={p.id} className="text-xs">
                            <Link
                              href={`/admin/posts/${p.id}/edit`}
                              className="text-standout-medium hover:underline"
                            >
                              {p.title || 'Untitled'} ({p.type})
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {whereUsed.inSettings && (
                    <div>
                      <div className="font-medium">In Site Settings</div>
                      <div className="text-xs text-neutral-medium">
                        Used in{' '}
                        <Link
                          href="/admin/settings/general"
                          className="text-standout-medium hover:underline"
                        >
                          Logo, Favicon, or Social OG settings
                        </Link>
                        .
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-neutral-low">Loading…</div>
              )}
            </div>
          </div>
        )}

        {/* Duplicate dialog remains ... */}
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
      {/* Duplicate choice dialog */}
      <AlertDialog
        open={dupOpen}
        onOpenChange={(open) => {
          setDupOpen(open)
          if (!open && dupResolve) {
            dupResolve('cancel')
            setDupResolve(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate media detected</AlertDialogTitle>
            <AlertDialogDescription>
              "{dupFileName}" already exists. Choose an action:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                if (dupResolve) dupResolve('cancel')
                setDupResolve(null)
                setDupOpen(false)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (dupResolve) dupResolve('save')
                setDupResolve(null)
                setDupOpen(false)
              }}
            >
              Save as new
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                if (dupResolve) dupResolve('override')
                setDupResolve(null)
                setDupOpen(false)
              }}
            >
              Override
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
