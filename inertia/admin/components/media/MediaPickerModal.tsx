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
import { toast } from 'sonner'
import { MediaRenderer } from '../../../components/MediaRenderer'
import { getMediaLabel, type MediaVariant } from '~/lib/media'

type MediaItem = {
  id: string
  url: string
  optimizedUrl?: string | null
  optimizedSize?: number | null
  originalFilename?: string
  mimeType?: string
  alt?: string | null
  metadata?: {
    variants?: MediaVariant[]
    darkSourceUrl?: string
    darkOptimizedUrl?: string
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
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  useEffect(() => {
    setSelectedId(initialSelectedId || null)
  }, [initialSelectedId, open])

  useEffect(() => {
    if (!open) return
    let alive = true
    ;(async () => {
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

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) || null,
    [items, selectedId]
  )

  function defaultAltFromFilename(name: string): string {
    const dot = name.lastIndexOf('.')
    const base = dot >= 0 ? name.slice(0, dot) : name
    return base
      .replace(/[-_]+/g, ' ')
      .trim()
      .replace(/\s{2,}/g, ' ')
  }

  async function handleUpload(filesToUpload: File[] = files) {
    if (!filesToUpload.length) return
    try {
      setUploading(true)
      for (const f of filesToUpload) {
        const form = new FormData()
        form.append('file', f)
        form.append('altText', defaultAltFromFilename(f.name))
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
          throw new Error(j?.error || `Upload failed for ${f.name}`)
        }
        const item: MediaItem | undefined = j?.data
        if (item?.id) {
          setItems((prev) => [item, ...prev])
          setSelectedId(item.id)
        }
      }
      setTab('library')
      setFiles([])
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const dt = e.dataTransfer
    const dropped: File[] = []
    if (dt?.items) {
      for (let i = 0; i < dt.items.length; i++) {
        if (dt.items[i].kind === 'file') {
          const f = dt.items[i].getAsFile()
          if (f) dropped.push(f)
        }
      }
    } else if (dt?.files) {
      for (let i = 0; i < dt.files.length; i++) {
        dropped.push(dt.files[i])
      }
    }
    if (dropped.length > 0) {
      handleUpload(dropped)
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
              <div className="text-sm text-neutral-medium">
                {loading ? 'Loading…' : `Items: ${items.length}`}
              </div>
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
                    className={`group border rounded overflow-hidden ${selectedId === m.id ? 'border-standout-high' : 'border-line-low'} bg-backdrop-low`}
                    title={getMediaLabel(m)}
                  >
                    <div className="aspect-square flex items-center justify-center bg-backdrop-low dark:bg-backdrop-medium relative overflow-hidden">
                      {/* Subtle checkerboard for transparency awareness */}
                      <div
                        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
                        style={{
                          backgroundImage: `url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uAnRowBoEMBAQQWBgZAiM0E0DAAwiAsQD8LYYByDMc8EBIAVScG6S+69Z0AAAAASUVORK5CYII=")`,
                          backgroundSize: '8px 8px',
                        }}
                      />
                      <MediaRenderer
                        image={m}
                        variant="thumb"
                        alt={getMediaLabel(m)}
                        className="w-full h-full object-cover relative z-10"
                        controls={false}
                        autoPlay={false}
                      />
                    </div>
                    <div className="p-1 text-[10px] text-neutral-medium truncate">
                      {getMediaLabel(m)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {allowUpload && tab === 'upload' && (
            <div
              className={`space-y-3 p-8 border-2 border-dashed rounded-lg transition-colors ${
                isDragOver ? 'border-standout-high bg-backdrop-medium/20' : 'border-line-low'
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={onDrop}
            >
              <div className="text-center">
                <div className="text-sm text-neutral-medium mb-4">
                  {uploading ? 'Uploading…' : 'Drag & drop files here or click to browse'}
                </div>
                <div className="flex justify-center">
                  <Input
                    type="file"
                    accept="image/*,video/*,application/json,.json,.lottie"
                    multiple
                    className="max-w-xs"
                    onChange={(e) => {
                      const f = Array.from(e.currentTarget.files || [])
                      setFiles(f)
                    }}
                    disabled={uploading}
                  />
                </div>
                {files.length > 0 && (
                  <div className="mt-4 text-xs text-neutral-medium">
                    {files.length} file(s) selected
                  </div>
                )}
                <div className="mt-6">
                  <button
                    type="button"
                    className={`px-6 py-2 text-sm font-medium rounded-md shadow-sm transition-all ${
                      uploading || files.length === 0
                        ? 'bg-backdrop-medium text-neutral-medium cursor-not-allowed opacity-60'
                        : 'bg-standout-high text-on-high hover:bg-standout-high active:scale-95'
                    }`}
                    disabled={uploading || files.length === 0}
                    onClick={() => handleUpload()}
                  >
                    {uploading ? 'Uploading…' : 'Start Upload'}
                  </button>
                </div>
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
