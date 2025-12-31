import React, { useState, forwardRef } from 'react'
import { Dialog, DialogContent, DialogTitle } from './ui/dialog'
import { useMediaUrl, type MediaObject } from '../utils/useMediaUrl'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'lottie-player': any
    }
  }
}

export interface MediaRendererProps {
  url?: string | null | undefined
  image?: MediaObject | string | null | undefined
  variant?: string | null
  mimeType?: string | null
  alt?: string | null
  className?: string
  fetchPriority?: 'high' | 'low' | 'auto'
  decoding?: 'async' | 'auto' | 'sync'
  loading?: 'lazy' | 'eager'
  controls?: boolean
  autoPlay?: boolean
  loop?: boolean
  muted?: boolean
  playsInline?: boolean
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  playMode?: 'autoplay' | 'inline' | 'modal'
  poster?: string | null
}

export const MediaRenderer = forwardRef<HTMLImageElement | HTMLVideoElement, MediaRendererProps>(
  (
    {
      url: explicitUrl,
      image,
      variant,
      mimeType: explicitMimeType,
      alt = '',
      className = 'w-full h-full object-cover',
      fetchPriority,
      decoding,
      loading,
      controls: initialControls,
      autoPlay: initialAutoPlay,
      loop: initialLoop,
      muted: initialMuted,
      playsInline = true,
      objectFit = 'cover',
      playMode = 'autoplay',
      poster,
    },
    ref
  ) => {
    const [isModalOpen, setIsModalOpen] = useState(false)

    // Resolve URL seamlessly if an image object is provided, otherwise fall back to explicit url
    const resolvedUrl = useMediaUrl(image, variant) || explicitUrl
    const mimeType =
      (typeof image === 'object' && image !== null ? (image as any).mimeType : null) ||
      explicitMimeType

    if (!resolvedUrl || typeof resolvedUrl !== 'string') {
      if (resolvedUrl) {
        console.warn('[MediaRenderer] resolvedUrl is not a string:', resolvedUrl, {
          image,
          explicitUrl,
        })
      }
      return null
    }

    const isVideo =
      (typeof mimeType === 'string' && mimeType.startsWith('video/')) ||
      /\.(mp4|webm|ogg|mov|m4v|avi)$/i.test(resolvedUrl.split('?')[0].toLowerCase())

    const isLottie =
      (typeof mimeType === 'string' &&
        (mimeType === 'application/json' || mimeType === 'application/x-lottie')) ||
      /\.(json|lottie)$/i.test(resolvedUrl.split('?')[0].toLowerCase())

    const isSvg =
      (typeof mimeType === 'string' && mimeType === 'image/svg+xml') ||
      /\.svg$/i.test(resolvedUrl.split('?')[0].toLowerCase())

    const isAnimation = isLottie || isSvg

    if (isVideo || isLottie || (isSvg && playMode === 'modal')) {
      const isAutoplayMode = playMode === 'autoplay'
      const isModalMode = playMode === 'modal'

      if (isModalMode) {
        return (
          <>
            <div
              className="relative group cursor-pointer w-full h-full"
              onClick={() => setIsModalOpen(true)}
            >
              {isVideo || isSvg ? (
                isVideo ? (
                  <video
                    src={resolvedUrl}
                    className={className}
                    style={{ objectFit }}
                    playsInline={playsInline}
                    autoPlay={false}
                    loop={false}
                    muted={true}
                    controls={false}
                    poster={poster || undefined}
                    ref={ref as React.Ref<HTMLVideoElement>}
                  />
                ) : (
                  <img
                    src={resolvedUrl}
                    alt={alt || (typeof image === 'object' ? (image as any)?.altText : null) || ''}
                    className={className}
                    style={{ objectFit }}
                  />
                )
              ) : (
                <div className={className} style={{ objectFit }}>
                  <lottie-player
                    src={resolvedUrl}
                    autoplay={false}
                    loop={false}
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                <div className="w-12 h-12 flex items-center justify-center rounded-full bg-white/80 text-black shadow-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogContent
                className="max-w-4xl p-0 overflow-hidden bg-black border-none"
                aria-describedby={undefined}
              >
                <DialogTitle className="sr-only">
                  {isVideo ? 'Video Player' : 'Animation Player'}
                </DialogTitle>
                {isVideo ? (
                  <video
                    src={resolvedUrl}
                    className="w-full h-auto max-h-[80vh]"
                    controls
                    autoPlay
                    playsInline
                  />
                ) : isSvg ? (
                  <div className="w-full h-auto max-h-[80vh] flex items-center justify-center bg-white/5 p-8">
                    <img
                      src={resolvedUrl}
                      alt={alt || (typeof image === 'object' ? (image as any)?.altText : null) || ''}
                      className="max-w-full max-h-full"
                    />
                  </div>
                ) : (
                  <div className="w-full h-auto max-h-[80vh] flex items-center justify-center bg-white/5">
                    <lottie-player
                      src={resolvedUrl}
                      autoplay
                      loop
                      controls
                      style={{ width: '100%', height: '100%', maxWidth: '800px' }}
                    />
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </>
        )
      }

      if (isVideo) {
        return (
          <video
            src={resolvedUrl}
            className={className}
            style={{ objectFit }}
            playsInline={playsInline}
            ref={ref as React.Ref<HTMLVideoElement>}
            controls={initialControls ?? (isAutoplayMode ? false : true)}
            autoPlay={initialAutoPlay ?? (isAutoplayMode ? true : false)}
            loop={initialLoop ?? (isAutoplayMode ? true : false)}
            muted={initialMuted ?? (isAutoplayMode ? true : false)}
            poster={poster || undefined}
          />
        )
      } else {
        return (
          <lottie-player
            src={resolvedUrl}
            autoplay={initialAutoPlay ?? (isAutoplayMode ? true : false)}
            loop={initialLoop ?? (isAutoplayMode ? true : false)}
            controls={initialControls ?? (isAutoplayMode ? false : true)}
            style={{ width: '100%', height: '100%', objectFit }}
            className={className}
          />
        )
      }
    }

    return (
      <img
        ref={ref as React.Ref<HTMLImageElement>}
        src={resolvedUrl}
        alt={alt || (typeof image === 'object' ? (image as any)?.altText : null) || ''}
        className={className}
        fetchPriority={fetchPriority}
        decoding={decoding}
        loading={loading}
        style={{ objectFit }}
      />
    )
  }
)

MediaRenderer.displayName = 'MediaRenderer'
