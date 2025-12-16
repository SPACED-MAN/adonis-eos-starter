/**
 * Gallery Module - React Variant
 *
 * Interactive React component (SSR + hydration)
 * Use for image galleries with lightbox, navigation, etc.
 *
 * Located in inertia/modules/ (shared between admin preview and public site)
 * No -static suffix = React component with full interactivity
 */

import { useState, useEffect, useMemo } from 'react'
import { pickMediaVariantUrl } from '../lib/media'
import type { Image } from './types'

interface GalleryProps {
  images: Image[]
  layout?: 'grid' | 'masonry'
  columns?: number
}

export default function Gallery({ images, layout = 'grid', columns = 3 }: GalleryProps) {
  // Resolved images with URLs (media IDs converted to actual URLs)
  const [resolvedImages, setResolvedImages] = useState<Image[]>([])

  // Extract unique media IDs from images (where url looks like a UUID)
  const mediaIds = useMemo(() => {
    const ids: string[] = []
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    images.forEach((img) => {
      if (img.url && uuidRegex.test(img.url)) {
        ids.push(img.url)
      }
    })
    return [...new Set(ids)] // Remove duplicates
  }, [images])

  // Resolve media IDs to URLs
  useEffect(() => {
    let cancelled = false

    async function resolveImages() {
      if (mediaIds.length === 0) {
        // If no media IDs, use images as-is (already URLs)
        if (!cancelled) setResolvedImages(images)
        return
      }

      // Create a map of media ID -> resolved URL
      const urlMap = new Map<string, string>()

      // Fetch all media items in parallel
      await Promise.all(
        mediaIds.map(async (id) => {
          try {
            const res = await fetch(`/public/media/${encodeURIComponent(id)}`)
            if (!res.ok) return
            const j = await res.json().catch(() => null)
            const data = j?.data
            if (!data) return

            const meta = (data as any).metadata || {}
            const variants = Array.isArray(meta?.variants) ? (meta.variants as any[]) : []
            const darkSourceUrl =
              typeof meta.darkSourceUrl === 'string' ? (meta.darkSourceUrl as string) : undefined
            const url = pickMediaVariantUrl(data.url, variants, undefined, { darkSourceUrl })
            if (!cancelled) urlMap.set(id, url)
          } catch {
            // Ignore errors for individual images
          }
        })
      )

      if (cancelled) return

      // Map images to resolved URLs
      const resolved = images.map((img) => {
        // If url looks like a UUID, resolve it; otherwise use as-is
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (img.url && uuidRegex.test(img.url)) {
          const resolvedUrl = urlMap.get(img.url) || img.url
          return { ...img, url: resolvedUrl }
        }
        return img
      })

      setResolvedImages(resolved)
    }

    resolveImages()

    return () => {
      cancelled = true
    }
  }, [images, mediaIds])

  // Use resolved images for rendering
  const displayImages = resolvedImages.length > 0 ? resolvedImages : images
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  const openLightbox = (index: number) => {
    setCurrentIndex(index)
    setLightboxOpen(true)
  }

  const closeLightbox = () => {
    setLightboxOpen(false)
  }

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % displayImages.length)
  }

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!lightboxOpen) return

    switch (e.key) {
      case 'Escape':
        closeLightbox()
        break
      case 'ArrowRight':
        nextImage()
        break
      case 'ArrowLeft':
        prevImage()
        break
    }
  }

  const gridClass = layout === 'grid' ? `grid grid-cols-${columns} gap-4` : 'columns-3 gap-4'

  return (
    <div className="gallery-module py-8" data-module="gallery">
      {/* Gallery Grid */}
      <div className={gridClass}>
        {displayImages.map((image, idx) => {
          // Avoid redundant alt text - if alt exactly matches caption, use a concise alternative
          // This prevents screen readers from reading the same text twice
          const hasCaption = image.caption?.trim()
          const altMatchesCaption = hasCaption && image.alt?.trim() === hasCaption
          const altText = altMatchesCaption
            ? `Image ${idx + 1}${hasCaption ? `: ${hasCaption.substring(0, 50)}` : ''}`
            : image.alt || (hasCaption ? `Image ${idx + 1}` : `Gallery image ${idx + 1}`)

          return (
            <figure
              key={idx}
              className="cursor-pointer overflow-hidden rounded-lg transition-transform hover:scale-105 aspect-square"
              onClick={() => openLightbox(idx)}
            >
              <img
                src={image.url}
                alt={altText}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
              {hasCaption && (
                <figcaption className="p-2 text-sm text-neutral-low">{image.caption}</figcaption>
              )}
            </figure>
          )
        })}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closeLightbox}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="dialog"
          aria-modal="true"
        >
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white text-4xl hover:text-neutral-low transition"
            aria-label="Close lightbox"
          >
            ×
          </button>

          {/* Previous Button */}
          {displayImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                prevImage()
              }}
              className="absolute left-4 text-white text-4xl hover:text-neutral-low transition"
              aria-label="Previous image"
            >
              ‹
            </button>
          )}

          {/* Image */}
          <div className="max-w-7xl max-h-full" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const currentImage = displayImages[currentIndex]
              const hasCaption = currentImage.caption?.trim()
              const altMatchesCaption = hasCaption && currentImage.alt?.trim() === hasCaption
              const altText = altMatchesCaption
                ? `Image ${currentIndex + 1}${hasCaption ? `: ${hasCaption.substring(0, 50)}` : ''}`
                : currentImage.alt ||
                  (hasCaption ? `Image ${currentIndex + 1}` : `Gallery image ${currentIndex + 1}`)

              return (
                <>
                  <img
                    src={currentImage.url}
                    alt={altText}
                    className="max-w-full max-h-[90vh] object-contain"
                    decoding="async"
                  />
                  {hasCaption && (
                    <p className="text-center text-white mt-4">{currentImage.caption}</p>
                  )}
                </>
              )
            })()}
          </div>

          {/* Next Button */}
          {displayImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                nextImage()
              }}
              className="absolute right-4 text-white text-4xl hover:text-neutral-low transition"
              aria-label="Next image"
            >
              ›
            </button>
          )}

          {/* Image Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white">
            {currentIndex + 1} / {displayImages.length}
          </div>
        </div>
      )}
    </div>
  )
}
