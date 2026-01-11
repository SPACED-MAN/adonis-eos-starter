import React, { useState, forwardRef, useRef, useEffect, useContext } from 'react'
import { useInView } from 'framer-motion'
import { usePage } from '@inertiajs/react'
import { Dialog, DialogContent, DialogTitle } from './ui/dialog'
import { useMediaAsset, type MediaObject } from '../utils/useMediaUrl'
import { ModuleContext } from './ModuleContext'

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
  /** Alias for variant, commonly used for media variation sizes like 'thumb' or 'small' */
  size?: string | null
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
  width?: string | number
  height?: string | number
  sizes?: string
}

export const MediaRenderer = forwardRef<HTMLImageElement | HTMLVideoElement, MediaRendererProps>(
  (
    {
      url: explicitUrl,
      image,
      variant,
      size,
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
      width,
      height,
      sizes,
    },
    ref
  ) => {
    const internalRef = useRef<any>(null)
    const combinedRef = (ref as any) || internalRef
    const [mounted, setMounted] = useState(false)
    const isInView = useInView(combinedRef, { once: true, margin: '0px 0px -100px 0px' })
    const [isModalOpen, setIsModalOpen] = useState(false)

    useEffect(() => {
      setMounted(true)
    }, [])
    const page = usePage()
    const lottieEnabled = (page.props.features as any)?.lottie !== false
    const { isFirst } = useContext(ModuleContext)

    // Performance optimizations for LCP (First module's images)
    const effectiveFetchPriority = fetchPriority || (isFirst ? 'high' : 'auto')
    const effectiveLoading = loading || (isFirst ? 'eager' : 'lazy')
    const effectiveDecoding = decoding || (isFirst ? 'sync' : 'async')

    // Resolve URL seamlessly if an image object is provided, otherwise fall back to explicit url
    const asset = useMediaAsset(image, variant || size || 'large')
    const resolvedUrl = asset.url || explicitUrl
    const intrinsicWidth = asset.width
    const intrinsicHeight = asset.height
    const srcset = asset.srcset

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

    const isAutoplayMode = playMode === 'autoplay'
    const effectiveInView = mounted && isInView

    useEffect(() => {
      if (isVideo && isAutoplayMode && effectiveInView && combinedRef.current) {
        // Explicitly set muted and loop properties to ensure autoplay is allowed by browser policies
        combinedRef.current.muted = true
        combinedRef.current.loop = true
        combinedRef.current.play().catch((err: any) => {
          // Fallback or ignore: browsers might still block it if no user interaction
          console.warn('[MediaRenderer] Autoplay failed:', err)
        })
      }
    }, [isInView, isVideo, isAutoplayMode])

    const isLottie =
      (typeof mimeType === 'string' &&
        (mimeType === 'application/json' || mimeType === 'application/x-lottie')) ||
      /\.(json|lottie)$/i.test(resolvedUrl.split('?')[0].toLowerCase())

    const isSvg =
      (typeof mimeType === 'string' && mimeType === 'image/svg+xml') ||
      /\.svg$/i.test(resolvedUrl.split('?')[0].toLowerCase())

    if (isVideo || (isLottie && lottieEnabled) || (isSvg && playMode === 'modal')) {
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
                    width={width || (intrinsicWidth ? Number(intrinsicWidth) : undefined)}
                    height={height || (intrinsicHeight ? Number(intrinsicHeight) : undefined)}
                    // @ts-ignore
                    fetchPriority={effectiveFetchPriority}
                  />
                ) : (
                  <img
                    src={resolvedUrl}
                    srcSet={!isSvg && !isVideo ? srcset : undefined}
                    sizes={!isSvg && !isVideo ? (sizes || (isFirst ? '100vw' : undefined)) : undefined}
                    alt={alt || (typeof image === 'object' ? (image as any)?.altText : null) || ''}
                    className={className}
                    style={{ objectFit }}
                    width={width || (intrinsicWidth ? Number(intrinsicWidth) : undefined)}
                    height={height || (intrinsicHeight ? Number(intrinsicHeight) : undefined)}
                    fetchPriority={effectiveFetchPriority}
                    loading={effectiveLoading}
                    decoding={effectiveDecoding}
                  />
                )
              ) : (
                <div className={className} style={{ objectFit }}>
                  {lottieEnabled && (
                    // @ts-ignore
                    <lottie-player
                      src={resolvedUrl}
                      autoplay={false}
                      loop={false}
                      style={{ width: '100%', height: '100%' }}
                    />
                  )}
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
                      srcSet={!isSvg ? srcset : undefined}
                      sizes="90vw"
                      alt={alt || (typeof image === 'object' ? (image as any)?.altText : null) || ''}
                      className="max-w-full max-h-full"
                      width={intrinsicWidth ? Number(intrinsicWidth) : undefined}
                      height={intrinsicHeight ? Number(intrinsicHeight) : undefined}
                    />
                  </div>
                ) : (
                  <div className="w-full h-auto max-h-[80vh] flex items-center justify-center bg-white/5">
                    {lottieEnabled && (
                      // @ts-ignore
                      <lottie-player
                        src={resolvedUrl}
                        autoplay
                        loop
                        controls
                        style={{ width: '100%', height: '100%', maxWidth: '800px' }}
                      />
                    )}
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
            ref={combinedRef}
            controls={initialControls ?? (isAutoplayMode ? false : true)}
            autoPlay={initialAutoPlay ?? (isAutoplayMode ? (effectiveInView ? true : false) : false)}
            loop={initialLoop ?? (isAutoplayMode ? true : false)}
            muted={initialMuted ?? (isAutoplayMode ? true : false)}
            poster={poster || undefined}
            width={width || (intrinsicWidth ? Number(intrinsicWidth) : undefined)}
            height={height || (intrinsicHeight ? Number(intrinsicHeight) : undefined)}
            // @ts-ignore
            fetchPriority={effectiveFetchPriority}
          />
        )
      } else if (isLottie && lottieEnabled) {
        return (
          // @ts-ignore
          <lottie-player
            src={resolvedUrl}
            autoplay={initialAutoPlay ?? (isAutoplayMode ? (isInView ? true : false) : false)}
            loop={initialLoop ?? (isAutoplayMode ? true : false)}
            controls={initialControls ?? (isAutoplayMode ? false : true)}
            style={{
              width: width || (intrinsicWidth ? Number(intrinsicWidth) : '100%'),
              height: height || (intrinsicHeight ? Number(intrinsicHeight) : '100%'),
              objectFit,
            }}
            className={className}
          />
        )
      }
    }

    return (
      <img
        ref={combinedRef}
        key={isSvg ? (effectiveInView ? 'in-view' : 'out-of-view') : undefined}
        src={resolvedUrl}
        srcSet={!isSvg && !isVideo ? srcset : undefined}
        sizes={!isSvg && !isVideo ? (sizes || (isFirst ? '100vw' : undefined)) : undefined}
        alt={alt || (typeof image === 'object' ? (image as any)?.altText : null) || ''}
        className={className}
        width={width || (intrinsicWidth ? Number(intrinsicWidth) : undefined)}
        height={height || (intrinsicHeight ? Number(intrinsicHeight) : undefined)}
        fetchPriority={effectiveFetchPriority}
        decoding={effectiveDecoding}
        loading={effectiveLoading}
        style={{ objectFit }}
      />
    )
  }
)

MediaRenderer.displayName = 'MediaRenderer'
