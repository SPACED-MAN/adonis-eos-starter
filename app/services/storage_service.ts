import fs from 'node:fs/promises'
import path from 'node:path'
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import env from '#start/env'

type StorageDriver = 'local' | 'r2'

function inferContentType(filePathOrKey: string): string {
  const ext = (path.extname(filePathOrKey) || '').toLowerCase()
  switch (ext) {
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
    case '.avif':
      return 'image/avif'
    case '.mp4':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    case '.ogg':
      return 'video/ogg'
    case '.mp3':
      return 'audio/mpeg'
    case '.wav':
      return 'audio/wav'
    case '.json':
      return 'application/json'
    case '.txt':
      return 'text/plain; charset=utf-8'
    default:
      return 'application/octet-stream'
  }
}

class LocalDriver {
  private getRoot(): string {
    return env.get('STORAGE_LOCAL_ROOT') || path.join(process.cwd(), 'public')
  }

  async put(
    key: string,
    data: Buffer | Uint8Array | string,
    _contentType?: string
  ): Promise<string> {
    const dest = path.join(this.getRoot(), key)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.writeFile(dest, data as any)
    return `/${key}`
  }

  async publishFile(
    absPath: string,
    key: string,
    _contentType?: string
  ): Promise<string> {
    // Already in public, nothing to do; ensure directory exists in case of move
    const dest = path.join(this.getRoot(), key)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    if (path.resolve(dest) !== path.resolve(absPath)) {
      try {
        await fs.copyFile(absPath, dest)
      } catch {
        // ignore copy errors if same file already exists
      }
    }
    return `/${key}`
  }

  async deleteByUrl(key: string): Promise<void> {
    const dest = path.join(this.getRoot(), key)
    try {
      await fs.unlink(dest)
    } catch {
      /* ignore */
    }
  }

  async get(key: string): Promise<Buffer> {
    const dest = path.join(this.getRoot(), key)
    return await fs.readFile(dest)
  }
}

class R2Driver {
  private client: any
  private bucket: string
  private publicBaseUrl: string | null

  constructor() {
    const endpoint = env.get('R2_ENDPOINT') || process.env.R2_ENDPOINT || ''
    this.bucket = env.get('R2_BUCKET') || process.env.R2_BUCKET || ''
    this.client = new S3Client({
      region: 'auto',
      endpoint: endpoint || undefined,
      credentials: {
        accessKeyId: env.get('R2_ACCESS_KEY_ID') || process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: env.get('R2_SECRET_ACCESS_KEY') || process.env.R2_SECRET_ACCESS_KEY || '',
      },
    })
    this.publicBaseUrl = env.get('R2_PUBLIC_BASE_URL') || process.env.R2_PUBLIC_BASE_URL || null
  }

  public buildPublicUrl(key: string): string {
    const clean = key.replace(/^\/+/, '')
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/+$/, '')}/${clean}`
    }
    // Fallback to path-style URL via endpoint (may require public bucket policy)
    const endpoint = env.get('R2_ENDPOINT') || ''
    if (!endpoint) return `/${clean}`
    return `${endpoint.replace(/\/+$/, '')}/${this.bucket}/${clean}`
  }

  async put(
    key: string,
    data: Buffer | Uint8Array | string,
    contentType?: string
  ): Promise<string> {
    const Body = typeof data === 'string' ? Buffer.from(data) : data
    const ContentType = contentType || inferContentType(key)
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body, ContentType })
    )
    return this.buildPublicUrl(key)
  }

  async publishFile(absPath: string, key: string, contentType?: string): Promise<string> {
    const Body = await fs.readFile(absPath)
    const ContentType = contentType || inferContentType(key)
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body, ContentType })
    )
    return this.buildPublicUrl(key)
  }

  async deleteByUrl(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
    } catch {
      /* ignore */
    }
  }

  async get(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    )
    if (!response.Body) {
      throw new Error(`Empty body for key ${key}`)
    }
    const bytes = await response.Body.transformToByteArray()
    return Buffer.from(bytes)
  }
}

class StorageService {
  private driver: StorageDriver
  private local: LocalDriver
  private r2: R2Driver | null

  constructor() {
    this.driver = (env.get('STORAGE_DRIVER') || process.env.STORAGE_DRIVER) === 'r2' ? 'r2' : 'local'
    this.local = new LocalDriver()
    this.r2 = this.driver === 'r2' ? new R2Driver() : null
  }

  isR2(): boolean {
    return this.driver === 'r2'
  }

  /**
   * Resolves a public URL for a given relative path.
   * If R2 is enabled, it returns the full R2 URL.
   */
  resolvePublicUrl(urlOrPath: string | null | undefined): string {
    if (!urlOrPath) return ''
    if (urlOrPath.startsWith('http')) return urlOrPath
    if (this.driver === 'r2' && this.r2) {
      return this.r2.buildPublicUrl(urlOrPath)
    }
    return urlOrPath
  }

  getLocalRoot(): string {
    if (this.driver === 'r2') {
      // Use a transient tmp folder when using R2 to avoid double-serving
      return (
        env.get('STORAGE_LOCAL_ROOT') ||
        process.env.STORAGE_LOCAL_ROOT ||
        path.join(process.cwd(), 'tmp')
      )
    }
    return path.join(process.cwd(), 'public')
  }

  /**
   * Extracts the storage key from a URL or path.
   */
  getKey(urlOrPath: string): string {
    let rel = urlOrPath
    if (urlOrPath.startsWith('http')) {
      try {
        const url = new URL(urlOrPath)
        rel = url.pathname

        // Special case: if R2_PUBLIC_BASE_URL is set, and it includes a path,
        // we might need to strip that prefix from the key.
        const publicBaseUrl = env.get('R2_PUBLIC_BASE_URL') || process.env.R2_PUBLIC_BASE_URL
        if (publicBaseUrl) {
          try {
            const baseUrl = new URL(publicBaseUrl)
            const basePrefix = baseUrl.pathname.replace(/\/+$/, '')
            if (basePrefix && rel.startsWith(basePrefix)) {
              rel = rel.substring(basePrefix.length)
            }
          } catch {
            /* ignore base URL parse error */
          }
        }
      } catch {
        /* ignore */
      }
    }
    return rel.replace(/^\/+/, '')
  }

  getLocalPath(urlOrPath: string): string {
    const key = this.getKey(urlOrPath)
    return path.join(this.getLocalRoot(), key)
  }

  /**
   * Returns the relative directory path for a given URL or path.
   * Useful for constructing storage keys for related files (variants, optimized).
   */
  getRelativeDir(urlOrPath: string): string {
    const key = this.getKey(urlOrPath)
    return path.posix.dirname(key)
  }

  /**
   * Ensures a file exists locally. If using R2 and it's missing from local disk,
   * it will be downloaded from R2 first.
   */
  async ensureLocalFile(urlOrPath: string): Promise<string> {
    const absPath = this.getLocalPath(urlOrPath)
    try {
      await fs.access(absPath)
      return absPath
    } catch {
      // Missing locally
      if (this.driver === 'r2' && this.r2) {
        // Try to download from R2
        const key = this.getKey(urlOrPath)

        try {
          const data = await this.r2.get(key)
          await fs.mkdir(path.dirname(absPath), { recursive: true })
          await fs.writeFile(absPath, data)
          return absPath
        } catch (err) {
          throw new Error(
            `File is missing locally and could not be fetched from R2 (key: ${key}): ${err.message}`
          )
        }
      }
      throw new Error(`Input file is missing: ${absPath}`)
    }
  }

  async put(
    key: string,
    data: Buffer | Uint8Array | string,
    contentType?: string
  ): Promise<string> {
    const cleanKey = this.getKey(key)
    if (this.driver === 'r2' && this.r2) return this.r2.put(cleanKey, data, contentType)
    return this.local.put(cleanKey, data, contentType)
  }

  async publishFile(absPath: string, publicUrlPath: string, contentType?: string): Promise<string> {
    const cleanKey = this.getKey(publicUrlPath)
    if (this.driver === 'r2' && this.r2) {
      const resultUrl = await this.r2.publishFile(absPath, cleanKey, contentType)

      // When using R2, we don't want the file in the public directory anymore.
      // If it's already in the public directory (e.g. legacy), we should delete it.
      // If it's in our new non-public storage folder, we can keep it for now
      // for future processing (like cropping).

      const publicPath = path.join(process.cwd(), 'public', cleanKey)
      if (path.resolve(absPath) === path.resolve(publicPath)) {
        try {
          await fs.unlink(publicPath)
        } catch {
          /* ignore */
        }
      }

      return resultUrl
    }
    return this.local.publishFile(absPath, cleanKey, contentType)
  }

  async deleteByUrl(publicUrlPath: string): Promise<void> {
    const key = this.getKey(publicUrlPath)
    if (this.driver === 'r2' && this.r2) {
      await this.r2.deleteByUrl(key)
    }

    // Also try to delete from all potential local roots (legacy and current)
    const roots = [
      path.join(process.cwd(), 'public'),
      path.join(process.cwd(), 'storage'),
      path.join(process.cwd(), 'tmp'),
    ]

    for (const root of roots) {
      try {
        await fs.unlink(path.join(root, key))
      } catch {
        /* ignore */
      }
    }
  }
}

const storageService = new StorageService()
export default storageService
