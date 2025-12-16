/**
 * Gallery Module - React Variant
 *
 * Interactive React component (SSR + hydration)
 * Use for image galleries with lightbox, navigation, etc.
 *
 * Located in inertia/modules/ (shared between admin preview and public site)
 * No -static suffix = React component with full interactivity
 */

import { useState } from 'react'
import type { Image } from './types'

interface GalleryProps {
  images: Image[]
  layout?: 'grid' | 'masonry'
  columns?: number
}

export default function Gallery({ images, layout = 'grid', columns = 3 }: GalleryProps) {
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
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
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
        {images.map((image, idx) => {
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
          {images.length > 1 && (
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
              const currentImage = images[currentIndex]
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
          {images.length > 1 && (
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
            {currentIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </div>
  )
}
