import path from 'node:path'
import fs from 'node:fs/promises'
import sharp from 'sharp'
import storageService from '#services/storage_service'

type DerivSpec = { name: string; width?: number; height?: number; fit: 'inside' | 'cover' }
type VariantInfo = { name: string; url: string; width?: number; height?: number; size: number }

type CropRect = { left: number; top: number; width: number; height: number }

type FocalPoint = { x: number; y: number } // normalized 0..1 in original image coordinates

class MediaService {
  parseDerivatives(): DerivSpec[] {
    const raw = process.env.MEDIA_DERIVATIVES || 'thumb:200x200_crop,small:400x,medium:800x,large:1600x'
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
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

  private computeFocalCropRect(originalW: number, originalH: number, spec: DerivSpec, focal: FocalPoint): CropRect | null {
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

  async generateVariants(inputPath: string, publicUrl: string, specsArg?: DerivSpec[] | null, cropRect?: CropRect | null, focalPoint?: FocalPoint | null): Promise<VariantInfo[]> {
    const specs = specsArg && specsArg.length ? specsArg : this.parseDerivatives()
    if (specs.length === 0) return []
    const parsed = path.parse(inputPath)

    // Probe original dimensions once
    const meta = await sharp(inputPath).metadata()
    const originalW = meta.width || 0
    const originalH = meta.height || 0

    const variants: VariantInfo[] = []
    for (const spec of specs) {
      const outName = `${parsed.name}.${spec.name}${parsed.ext}`
      const outPath = path.join(parsed.dir, outName)
      const outUrl = path.posix.join(path.posix.dirname(publicUrl), outName)

      let pipeline = sharp(inputPath)
      // Apply cropRect or focal crop (for cover)
      if (cropRect && cropRect.width > 0 && cropRect.height > 0) {
        pipeline = pipeline.extract({ left: Math.max(0, Math.floor(cropRect.left)), top: Math.max(0, Math.floor(cropRect.top)), width: Math.floor(cropRect.width), height: Math.floor(cropRect.height) })
      } else if (focalPoint && spec.fit === 'cover' && originalW > 0 && originalH > 0) {
        const rect = this.computeFocalCropRect(originalW, originalH, spec, focalPoint)
        if (rect) {
          pipeline = pipeline.extract(rect)
        }
      }

      if (spec.width || spec.height) {
        pipeline = pipeline.resize({ width: spec.width, height: spec.height, fit: spec.fit })
      }

      const info = await pipeline.toFile(outPath)
      try { await storageService.publishFile(outPath, outUrl, inferMimeFromExt(parsed.ext)) } catch { /* ignore */ }
      variants.push({ name: spec.name, url: outUrl, width: info.width, height: info.height, size: info.size || 0 })
    }
    return variants
  }

  async optimizeToWebp(inputPath: string, publicUrl: string): Promise<{ optimizedPath: string; optimizedUrl: string; size: number } | null> {
    // Only handle raster images supported by sharp
    const lower = inputPath.toLowerCase()
    const isRaster = /\.(jpe?g|png|webp|gif|tiff?|bmp|avif)$/.test(lower)
    if (!isRaster) return null
    const parsed = path.parse(inputPath)
    const alreadyWebp = parsed.ext.toLowerCase() === '.webp'
    const outName = alreadyWebp ? `${parsed.name}.optimized.webp` : `${parsed.name}.webp`
    const outPath = path.join(parsed.dir, outName)
    const outUrl = path.posix.join(path.posix.dirname(publicUrl), outName)
    const quality = Number(process.env.MEDIA_WEBP_QUALITY || 82)
    const info = await sharp(inputPath).webp({ quality: Number.isFinite(quality) ? Math.max(1, Math.min(100, Math.floor(quality))) : 82 }).toFile(outPath)
    const size = info.size || 0
    try { await storageService.publishFile(outPath, outUrl, 'image/webp') } catch { /* ignore */ }
    return { optimizedPath: outPath, optimizedUrl: outUrl, size }
  }

  async renameWithVariants(oldPath: string, oldUrl: string, newBaseName: string): Promise<{ newPath: string; newUrl: string; renamedVariants: Array<{ oldUrl: string; newUrl: string }> }> {
    const parsed = path.parse(oldPath)
    const dir = parsed.dir
    const ext = parsed.ext
    const newPath = path.join(dir, `${newBaseName}${ext}`)
    const newUrl = path.posix.join(path.posix.dirname(oldUrl), `${newBaseName}${ext}`)
    await fs.rename(oldPath, newPath)

    const files = await fs.readdir(dir)
    const oldBase = parsed.name
    const renamedVariants: Array<{ oldUrl: string; newUrl: string }> = []
    for (const f of files) {
      if (f.startsWith(`${oldBase}.`) && f.endsWith(ext)) {
        const variantName = f.slice(oldBase.length + 1, f.length - ext.length)
        const oldVarPath = path.join(dir, f)
        const newVarName = `${newBaseName}.${variantName}${ext}`
        const newVarPath = path.join(dir, newVarName)
        await fs.rename(oldVarPath, newVarName ? newVarPath : oldVarPath)
        const oldVarUrl = path.posix.join(path.posix.dirname(oldUrl), f)
        const newVarUrl = path.posix.join(path.posix.dirname(oldUrl), newVarName)
        renamedVariants.push({ oldUrl: oldVarUrl, newUrl: newVarUrl })
      }
    }
    return { newPath, newUrl, renamedVariants }
  }
}

const mediaService = new MediaService()
export default mediaService


