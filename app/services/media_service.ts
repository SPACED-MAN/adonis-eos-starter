import path from 'node:path'
import fs from 'node:fs/promises'
import sharp from 'sharp'
import storageService from '#services/storage_service'

type DerivSpec = { name: string; width?: number; height?: number; fit: 'inside' | 'cover' }
type VariantInfo = {
  name: string
  url: string
  width?: number
  height?: number
  size: number
  optimizedUrl?: string
  optimizedSize?: number
}

function inferMimeFromExt(ext: string): string {
  const lower = (ext || '').toLowerCase()
  switch (lower) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.svg':
      return 'image/svg+xml'
    case '.json':
      return 'application/json'
    case '.lottie':
      return 'application/x-lottie'
    case '.avif':
      return 'image/avif'
    default:
      return 'application/octet-stream'
  }
}

type CropRect = { left: number; top: number; width: number; height: number }

type FocalPoint = { x: number; y: number } // normalized 0..1 in original image coordinates

class MediaService {
  parseDerivatives(): DerivSpec[] {
    const raw =
      process.env.MEDIA_DERIVATIVES || 'thumb:200x200_crop,small:400x,medium:800x,large:1600x'
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const specs: DerivSpec[] = []
    for (const p of parts) {
      const [namePart, dimsPartRaw] = p.split(':')
      if (!namePart || !dimsPartRaw) continue
      const crop = dimsPartRaw.includes('crop')
      const dims = dimsPartRaw.replace(/_?crop/i, '')
      const [wStr, hStr] = dims.split('x')
      const width = wStr ? Number(wStr) || undefined : undefined
      const height = hStr ? Number(hStr) || undefined : undefined
      if (!width && !height) continue
      specs.push({ name: namePart, width, height, fit: crop ? 'cover' : 'inside' })
    }
    return specs
  }

  private computeFocalCropRect(
    originalW: number,
    originalH: number,
    spec: DerivSpec,
    focal: FocalPoint
  ): CropRect | null {
    if (!spec.width || !spec.height) return null
    // Aspect ratio target
    const targetRatio = spec.width / spec.height
    // Compute maximal crop rect that fits target ratio inside original
    let cropW = Math.min(originalW, Math.round(originalH * targetRatio))
    let cropH = Math.min(originalH, Math.round(originalW / targetRatio))
    // Ensure exact ratio
    if (Math.round(cropW / targetRatio) !== cropH) {
      cropH = Math.round(cropW / targetRatio)
    }
    // Center around focal
    const cx = Math.max(0, Math.min(originalW, Math.round(focal.x * originalW)))
    const cy = Math.max(0, Math.min(originalH, Math.round(focal.y * originalH)))
    let left = Math.round(cx - cropW / 2)
    let top = Math.round(cy - cropH / 2)
    // Clamp to bounds
    if (left < 0) left = 0
    if (top < 0) top = 0
    if (left + cropW > originalW) left = originalW - cropW
    if (top + cropH > originalH) top = originalH - cropH
    return { left, top, width: cropW, height: cropH }
  }

  async generateVariants(
    inputPath: string,
    publicUrl: string,
    specsArg?: DerivSpec[] | null,
    cropRect?: CropRect | null,
    focalPoint?: FocalPoint | null,
    theme: 'light' | 'dark' = 'light',
    options?: { applyTint?: boolean; nameSuffix?: string }
  ): Promise<VariantInfo[]> {
    const specs = specsArg && specsArg.length ? specsArg : this.parseDerivatives()
    if (specs.length === 0) return []
    const parsed = path.parse(inputPath)

    // Probe original dimensions once (only for raster formats supported by sharp)
    const meta = await sharp(inputPath).metadata()
    const originalW = meta.width || 0
    const originalH = meta.height || 0

    // Dark-mode tuning (controlled via env, with safe defaults)
    const darkBrightnessRaw = process.env.MEDIA_DARK_BRIGHTNESS
    const darkSaturationRaw = process.env.MEDIA_DARK_SATURATION
    const darkBrightness = (() => {
      const n = darkBrightnessRaw !== undefined ? Number(darkBrightnessRaw) : 0.55
      return Number.isFinite(n) ? Math.max(0.1, Math.min(2, n)) : 0.55
    })()
    const darkSaturation = (() => {
      const n = darkSaturationRaw !== undefined ? Number(darkSaturationRaw) : 0.75
      return Number.isFinite(n) ? Math.max(0, Math.min(2, n)) : 0.75
    })()

    // Allow caller to override whether tint is applied (default: follow theme)
    const applyTint = options?.applyTint !== undefined ? options.applyTint : theme === 'dark'
    // Allow caller to override name suffix (default: use theme)
    const suffix =
      options?.nameSuffix !== undefined ? options.nameSuffix : theme === 'dark' ? '-dark' : ''

    const variants: VariantInfo[] = []
    for (const spec of specs) {
      const variantName = suffix ? `${spec.name}${suffix}` : spec.name
      const outName = `${parsed.name}.${variantName}${parsed.ext}`
      const outPath = path.join(parsed.dir, outName)
      const outUrl = path.posix.join(storageService.getRelativeDir(publicUrl), outName)

      let pipeline = sharp(inputPath)
      // Apply cropRect or focal crop (for cover)
      if (cropRect && cropRect.width > 0 && cropRect.height > 0) {
        pipeline = pipeline.extract({
          left: Math.max(0, Math.floor(cropRect.left)),
          top: Math.max(0, Math.floor(cropRect.top)),
          width: Math.floor(cropRect.width),
          height: Math.floor(cropRect.height),
        })
      } else if (focalPoint && spec.fit === 'cover' && originalW > 0 && originalH > 0) {
        const rect = this.computeFocalCropRect(originalW, originalH, spec, focalPoint)
        if (rect) {
          pipeline = pipeline.extract(rect)
        }
      }

      if (spec.width || spec.height) {
        pipeline = pipeline.resize({ width: spec.width, height: spec.height, fit: spec.fit })
      }

      // Apply a dark-mode transform when generating dark variants for raster images
      if (applyTint) {
        pipeline = pipeline.modulate({
          // Tunable via MEDIA_DARK_BRIGHTNESS / MEDIA_DARK_SATURATION
          brightness: darkBrightness,
          saturation: darkSaturation,
        })
      }

      const info = await pipeline.toFile(outPath)
      let finalUrl = outUrl
      try {
        const storageUrl = await storageService.publishFile(
          outPath,
          outUrl,
          inferMimeFromExt(parsed.ext)
        )
        if (storageUrl) {
          finalUrl = storageUrl

          // If we are using R2, we can delete the local variant file after publishing
          // since it's just a derivative and can be regenerated from the original.
          if (storageService.isR2()) {
            try {
              await fs.unlink(outPath)
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* ignore */
      }
      variants.push({
        name: variantName,
        url: finalUrl,
        width: info.width,
        height: info.height,
        size: info.size || 0,
      })
    }

    return variants
  }

  async optimizeToWebp(
    inputPath: string,
    publicUrl: string
  ): Promise<{ optimizedPath: string; optimizedUrl: string; size: number } | null> {
    // Only handle raster images supported by sharp
    const lower = inputPath.toLowerCase()
    const isRaster = /\.(jpe?g|png|webp|gif|tiff?|bmp|avif)$/.test(lower)
    if (!isRaster) return null
    const parsed = path.parse(inputPath)
    const alreadyWebp = parsed.ext.toLowerCase() === '.webp'
    const outName = alreadyWebp ? `${parsed.name}.optimized.webp` : `${parsed.name}.webp`
    const outPath = path.join(parsed.dir, outName)
    const outUrl = path.posix.join(storageService.getRelativeDir(publicUrl), outName)
    const quality = Number(process.env.MEDIA_WEBP_QUALITY || 82)
    const info = await sharp(inputPath)
      .webp({
        quality: Number.isFinite(quality) ? Math.max(1, Math.min(100, Math.floor(quality))) : 82,
      })
      .toFile(outPath)
    const size = info.size || 0
    let finalUrl = outUrl
    try {
      const storageUrl = await storageService.publishFile(outPath, outUrl, 'image/webp')
      if (storageUrl) {
        finalUrl = storageUrl
      }
    } catch {
      /* ignore */
    }
    return { optimizedPath: outPath, optimizedUrl: finalUrl, size }
  }

  async optimizeVariantsToWebp(
    variants: VariantInfo[]
  ): Promise<VariantInfo[]> {
    const results: VariantInfo[] = []
    for (const v of variants) {
      if (!v.url) {
        results.push(v)
        continue
      }
      const absPath = await storageService.ensureLocalFile(v.url)
      try {
        const optimized = await this.optimizeToWebp(absPath, v.url)
        if (optimized) {
          results.push({
            ...v,
            optimizedUrl: optimized.optimizedUrl,
            optimizedSize: optimized.size,
          } as any)
        } else {
          results.push(v)
        }
      } catch {
        results.push(v)
      }
    }
    return results
  }

  async renameWithVariants(
    oldPath: string,
    oldUrl: string,
    newBaseName: string
  ): Promise<{
    newPath: string
    newUrl: string
    renamedVariants: Array<{ oldUrl: string; newUrl: string }>
  }> {
    const parsed = path.parse(oldPath)
    const dir = parsed.dir
    const ext = parsed.ext
    const newPath = path.join(dir, `${newBaseName}${ext}`)
    const newUrl = path.posix.join(storageService.getRelativeDir(oldUrl), `${newBaseName}${ext}`)
    await fs.rename(oldPath, newPath)

    const files = await fs.readdir(dir)
    const oldBase = parsed.name
    const renamedVariants: Array<{ oldUrl: string; newUrl: string }> = []
    for (const f of files) {
      // Match any file that starts with oldBase. (variants, optimized)
      // or oldBase-dark. (dark variants)
      const isRelated = f.startsWith(oldBase + '.') || f.startsWith(oldBase + '-dark')
      if (isRelated && f !== parsed.base) {
        const suffix = f.startsWith(oldBase + '.')
          ? f.slice(oldBase.length)
          : f.slice(oldBase.length) // handles -dark cases too

        const oldVarPath = path.join(dir, f)
        const newVarName = `${newBaseName}${suffix}`
        const newVarPath = path.join(dir, newVarName)

        await fs.rename(oldVarPath, newVarPath)

        const oldVarUrl = path.posix.join(storageService.getRelativeDir(oldUrl), f)
        const newVarUrl = path.posix.join(storageService.getRelativeDir(oldUrl), newVarName)
        renamedVariants.push({ oldUrl: oldVarUrl, newUrl: newVarUrl })
      }
    }
    return { newPath, newUrl, renamedVariants }
  }

  /**
   * Helper to resolve all URLs within metadata (variants, dark source, etc.)
   */
  resolveMetadataUrls(metadata: any): any {
    if (!metadata) return null
    const m = { ...metadata }

    if (m.darkSourceUrl) {
      m.darkSourceUrl = storageService.resolvePublicUrl(m.darkSourceUrl)
    }
    if (m.darkOptimizedUrl) {
      m.darkOptimizedUrl = storageService.resolvePublicUrl(m.darkOptimizedUrl)
    }

    if (Array.isArray(m.variants)) {
      m.variants = m.variants.map((v: any) => ({
        ...v,
        url: storageService.resolvePublicUrl(v.url),
        optimizedUrl: storageService.resolvePublicUrl(v.optimizedUrl),
      }))
    }

    return m
  }
}

const mediaService = new MediaService()
export default mediaService
