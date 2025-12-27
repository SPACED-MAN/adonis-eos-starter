import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

export function FeedbackMarkers({
  feedbacks = [],
  onMarkerClick,
  visible = true,
  activeId = null,
}: {
  feedbacks: any[]
  onMarkerClick: (f: any) => void
  visible?: boolean
  activeId?: string | null
}) {
  const [markers, setMarkers] = useState<
    Array<{ id: string; x: number; y: number; feedback: any }>
  >([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const updateMarkers = useCallback(() => {
    if (!visible || !feedbacks || !Array.isArray(feedbacks) || feedbacks.length === 0) {
      if (markers.length > 0) setMarkers([])
      return
    }

    const nextMarkers: Array<{ id: string; x: number; y: number; feedback: any }> = []

    feedbacks.forEach((f) => {
      // Handle both stringified and parsed context
      let context = f.context
      if (typeof context === 'string') {
        try {
          context = JSON.parse(context)
        } catch (e) {
          /* not json */
        }
      }

      if (f.status === 'pending' && context?.selector) {
        try {
          const el = document.querySelector(context.selector)
          if (el) {
            const rect = el.getBoundingClientRect()

            // Only show if element is actually visible in the DOM
            if (rect.width > 0 || rect.height > 0) {
              nextMarkers.push({
                id: f.id,
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
                feedback: f,
              })
            }
          }
        } catch (e) {
          /* ignore invalid selectors */
        }
      }
    })

    setMarkers(nextMarkers)
  }, [feedbacks, visible])

  useEffect(() => {
    if (!visible) return

    updateMarkers()

    // Listen for scroll and resize
    window.addEventListener('resize', updateMarkers, { passive: true })
    window.addEventListener('scroll', updateMarkers, { passive: true })

    // Periodic refresh for dynamic content
    const interval = setInterval(updateMarkers, 2000)

    return () => {
      window.removeEventListener('resize', updateMarkers)
      window.removeEventListener('scroll', updateMarkers)
      clearInterval(interval)
    }
  }, [updateMarkers, visible])

  if (!visible || !mounted) return null

  // Render markers into portal
  return createPortal(
    <div
      id="feedback-markers-portal"
      style={{ position: 'fixed', top: 0, left: 0, zIndex: 46, pointerEvents: 'none' }}
    >
      <style>{`
        @keyframes feedback-pulse-ring {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .feedback-marker-container {
          position: absolute;
          pointer-events: auto;
          cursor: pointer;
          user-select: none;
          display: block;
          visibility: visible;
          opacity: 1;
        }
        .feedback-marker-dot {
          width: 16px;
          height: 16px;
          background: var(--color-standout-medium, #3b82f6);
          border: 2px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          position: relative;
          z-index: 2;
          transition: all 0.3s ease;
        }
        .feedback-marker-container.is-active .feedback-marker-dot {
          background: var(--color-standout-high, #2563eb);
          transform: scale(1.4);
          box-shadow: 0 0 15px var(--color-standout-medium);
        }
        .feedback-marker-container.is-active {
          z-index: 3;
        }
        .feedback-marker-pulse {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: var(--color-standout-medium, #3b82f6);
          border-radius: 50%;
          z-index: 1;
          animation: feedback-pulse-ring 2s cubic-bezier(0.24, 0, 0.38, 1) infinite;
        }
        .feedback-marker-container.is-active .feedback-marker-pulse {
          animation-duration: 1s;
          background: var(--color-standout-high, #2563eb);
        }
        .feedback-marker-container:hover .feedback-marker-dot {
          background: var(--color-standout-high, #2563eb);
          transform: scale(1.1);
        }
      `}</style>
      {markers.map((m) => (
        <div
          key={m.id}
          className={`feedback-marker-container ${activeId === m.id ? 'is-active' : ''}`}
          style={{
            top: `${m.y}px`,
            left: `${m.x}px`,
            transform: 'translate(-50%, -50%)',
          }}
          onClick={(e) => {
            e.stopPropagation()
            onMarkerClick(m.feedback)
          }}
        >
          <div className="feedback-marker-pulse" />
          <div
            className="feedback-marker-dot"
            title={`Feedback: ${m.feedback.content.substring(0, 50)}...`}
          />
        </div>
      ))}
    </div>,
    document.body
  )
}
