import { useEffect, useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Badge } from '~/components/ui/badge'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFire, faSpinner } from '@fortawesome/free-solid-svg-icons'

interface HeatmapModalProps {
  post: { id: string; title: string; slug: string; publicPath: string } | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HeatmapModal({ post, open, onOpenChange }: HeatmapModalProps) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && post) {
      setData([])
      setIframeLoaded(false)
      loadData()
    }
  }, [open, post])

  async function loadData() {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics/heatmap?postId=${post?.id}`, {
        credentials: 'same-origin',
      })
      const json = await res.json()
      setData(json.data || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (iframeLoaded && data.length > 0) {
      // Delay slightly to ensure layout is stable
      const timer = setTimeout(renderHeatmap, 500)
      return () => clearTimeout(timer)
    }
  }, [iframeLoaded, data])

  function renderHeatmap() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const container = containerRef.current
    if (!container) return

    // Set canvas size to document size of iframe
    canvas.width = container.scrollWidth
    canvas.height = Math.max(container.scrollHeight, 2000)

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw heat points
    data.forEach((point) => {
      const x = point.x
      const y = point.y

      // Only draw if within bounds
      if (x != null && y != null) {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 25)
        gradient.addColorStop(0, 'rgba(255, 69, 0, 0.5)')
        gradient.addColorStop(0.5, 'rgba(255, 140, 0, 0.2)')
        gradient.addColorStop(1, 'rgba(255, 140, 0, 0)')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, 25, 0, 2 * Math.PI)
        ctx.fill()
      }
    })
  }

  // Use the public path from the post data
  const publicUrl = post?.publicPath || ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[95vw] h-[95vh] flex flex-col p-0 overflow-hidden bg-backdrop-low border-line-low">
        <DialogHeader className="px-6 py-4 border-b border-line-low shrink-0 bg-backdrop">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-neutral-high">
              <FontAwesomeIcon icon={faFire} className="text-orange-500" />
              Interaction Heatmap: {post?.title}
            </DialogTitle>
            <div className="flex items-center gap-4">
              {loading && (
                <FontAwesomeIcon icon={faSpinner} className="animate-spin text-neutral-medium" />
              )}
              <Badge variant="outline" className="font-mono text-[10px]">
                {data.length} interactions
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 relative overflow-auto bg-white" ref={containerRef}>
          {post && (
            <>
              <iframe
                src={publicUrl}
                className="w-full h-full border-none pointer-events-none"
                onLoad={() => setIframeLoaded(true)}
                style={{ minHeight: '3000px', minWidth: '1200px' }}
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none z-10"
                style={{ mixBlendMode: 'multiply' }}
              />
            </>
          )}

          {!iframeLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-backdrop-low/50 z-20">
              <div className="text-center space-y-3">
                <FontAwesomeIcon
                  icon={faSpinner}
                  className="animate-spin text-standout-medium text-3xl"
                />
                <p className="text-sm text-neutral-medium font-medium">
                  Loading preview and interaction data...
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-line-low shrink-0 bg-backdrop text-[10px] text-neutral-low flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
              <div className="w-2 h-2 rounded-full bg-orange-500" /> Click Hotspot
            </span>
          </div>
          <div className="flex items-center gap-2 italic">
            Note: Interactions are recorded on desktop viewports. Responsiveness may cause offsets.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
