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
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { useInlineValue } from '../components/inline-edit/InlineEditorContext'
import { MediaRenderer } from '../components/MediaRenderer'
import type { MediaObject } from '../utils/useMediaUrl'

interface GalleryProps {
  images: Array<{
    url: string | MediaObject
    alt?: string
    altText?: string
    caption?: string
    width?: number
    height?: number
    mimeType?: string
    metadata?: any
  }>
  layout?: 'grid' | 'masonry'
  columns?: number
  backgroundColor?: string
  __moduleId?: string
  _useReact?: boolean
}

export default function Gallery({
  images = [],
  layout = 'grid',
  columns = 3,
  backgroundColor: initialBackground = 'bg-transparent',
  __moduleId,
  _useReact,
}: GalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const bg = useInlineValue(__moduleId, 'backgroundColor', initialBackground) || initialBackground

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

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.8, ease: 'easeOut' },
    },
  }

  const gridContent = (
    <div className={gridClass}>
      {images.map((item, idx) => {
        // EOS resolves the media ID to a full object. Because the field slug was 'url',
        // item.url will be the media object if resolved, or a string if not.
        const media = (typeof item.url === 'object' && item.url !== null ? item.url : null) as MediaObject | null
        const imageSource = media || (item.url as string)

        const caption = media?.title || media?.caption || item.caption
        const hasCaption = !!caption?.trim()
        const effectiveAlt = media?.altText || item.alt || item.altText || ''
        const altMatchesCaption = hasCaption && effectiveAlt.trim() === caption?.trim()
        const altText = altMatchesCaption
          ? `Image ${idx + 1}${hasCaption ? `: ${caption.substring(0, 50)}` : ''}`
          : effectiveAlt || (hasCaption ? `Image ${idx + 1}` : `Gallery image ${idx + 1}`)

        const figure = (
          <figure
            key={idx}
            className="cursor-pointer overflow-hidden rounded-lg transition-all hover:ring-2 hover:ring-primary/50 aspect-square group bg-backdrop-medium"
            onClick={() => openLightbox(idx)}
          >
            <MediaRenderer
              image={imageSource}
              alt={altText}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
              decoding="async"
            />
            {hasCaption && (
              <figcaption className="p-2 text-sm text-neutral-low truncate bg-backdrop-high/80">
                {caption}
              </figcaption>
            )}
          </figure>
        )

        return _useReact ? (
          <motion.div key={idx} variants={itemVariants}>
            {figure}
          </motion.div>
        ) : (
          <div key={idx}>{figure}</div>
        )
      })}
    </div>
  )

  return (
    <section
      className={`${bg} py-12 lg:py-16`}
      data-module="gallery"
      data-inline-type="select"
      data-inline-path="backgroundColor"
      data-inline-options={JSON.stringify([
        { label: 'Transparent', value: 'bg-transparent' },
        { label: 'Low', value: 'bg-backdrop-low' },
        { label: 'Medium', value: 'bg-backdrop-medium' },
        { label: 'High', value: 'bg-backdrop-high' },
        { label: 'Dark', value: 'bg-neutral-high' },
      ])}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Gallery Grid */}
        {_useReact ? (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={containerVariants}
          >
            {gridContent}
          </motion.div>
        ) : (
          gridContent
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={closeLightbox}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="dialog"
            aria-modal="true"
          >
            {/* Close Button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 text-white text-4xl hover:text-neutral-low transition-colors z-10"
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
                className="absolute left-4 text-white text-4xl hover:text-neutral-low transition-colors z-10"
                aria-label="Previous image"
              >
                ‹
              </button>
            )}

            {/* Image */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="max-w-7xl max-h-full flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const item = images[currentIndex]
                const media = (typeof item.url === 'object' && item.url !== null ? item.url : null) as MediaObject | null
                const imageSource = media || (item.url as string)

                const caption = media?.title || media?.caption || item.caption
                const hasCaption = !!caption?.trim()
                const effectiveAlt = media?.altText || item.alt || item.altText || ''
                const altMatchesCaption = hasCaption && effectiveAlt.trim() === caption?.trim()
                const altText = altMatchesCaption
                  ? `Image ${currentIndex + 1}${hasCaption ? `: ${caption.substring(0, 50)}` : ''
                  }`
                  : effectiveAlt ||
                  (hasCaption
                    ? `Image ${currentIndex + 1}`
                    : `Gallery image ${currentIndex + 1}`)

                return (
                  <>
                    <MediaRenderer
                      image={imageSource}
                      alt={altText}
                      className="max-w-full max-h-[80vh] object-contain shadow-2xl rounded"
                      decoding="async"
                      key={currentIndex}
                    />
                    {hasCaption && (
                      <p className="text-center text-white mt-6 max-w-2xl px-4 italic">
                        {caption}
                      </p>
                    )}
                  </>
                )
              })()}
            </motion.div>

            {/* Next Button */}
            {images.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  nextImage()
                }}
                className="absolute right-4 text-white text-4xl hover:text-neutral-low transition-colors z-10"
                aria-label="Next image"
              >
                ›
              </button>
            )}

            {/* Image Counter */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium tracking-widest uppercase">
              {currentIndex + 1} / {images.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
