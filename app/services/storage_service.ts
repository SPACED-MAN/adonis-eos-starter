import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'

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
    case '.json':
      return 'application/json'
    case '.txt':
      return 'text/plain; charset=utf-8'
    default:
      return 'application/octet-stream'
  }
}

class LocalDriver {
  async put(
    key: string,
    data: Buffer | Uint8Array | string,
    _contentType?: string
  ): Promise<string> {
    const rel = key.replace(/^\/+/, '')
    const dest = path.join(process.cwd(), 'public', rel)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.writeFile(dest, data as any)
    return `/${rel}`
  }

  async publishFile(
    absPath: string,
    publicUrlPath: string,
    _contentType?: string
  ): Promise<string> {
    // Already in public, nothing to do; ensure directory exists in case of move
    const rel = publicUrlPath.replace(/^\/+/, '')
    const dest = path.join(process.cwd(), 'public', rel)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    if (path.resolve(dest) !== path.resolve(absPath)) {
      try {
        await fs.copyFile(absPath, dest)
      } catch {
        // ignore copy errors if same file already exists
      }
    }
    return `/${rel}`
  }

  async deleteByUrl(publicUrlPath: string): Promise<void> {
    const rel = publicUrlPath.replace(/^\/+/, '')
    const dest = path.join(process.cwd(), 'public', rel)
    try {
      await fs.unlink(dest)
    } catch {
      /* ignore */
    }
  }
}

class R2Driver {
  private client: any
  private bucket: string
  private publicBaseUrl: string | null

  constructor() {
    // Lazy import to avoid bundling when not used
    const { S3Client } = require('@aws-sdk/client-s3')
    const accountId = process.env.R2_ACCOUNT_ID || ''
    const endpoint =
      process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '')
    this.bucket = process.env.R2_BUCKET || ''
    this.client = new S3Client({
      region: 'auto',
      endpoint: endpoint || undefined,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    })
    this.publicBaseUrl = process.env.R2_PUBLIC_BASE_URL || null
  }

  private buildPublicUrl(key: string): string {
    const clean = key.replace(/^\/+/, '')
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/+$/, '')}/${clean}`
    }
    // Fallback to path-style URL via endpoint (may require public bucket policy)
    const accountId = process.env.R2_ACCOUNT_ID || ''
    const endpoint =
      process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '')
    return `${endpoint.replace(/\/+$/, '')}/${this.bucket}/${clean}`
  }

  async put(
    key: string,
    data: Buffer | Uint8Array | string,
    contentType?: string
  ): Promise<string> {
    const { PutObjectCommand } = require('@aws-sdk/client-s3')
    const clean = key.replace(/^\/+/, '')
    const Body = typeof data === 'string' ? Buffer.from(data) : data
    const ContentType = contentType || inferContentType(clean)
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: clean, Body, ContentType })
    )
    return this.buildPublicUrl(clean)
  }

  async publishFile(absPath: string, publicUrlPath: string, contentType?: string): Promise<string> {
    const { PutObjectCommand } = require('@aws-sdk/client-s3')
    const clean = publicUrlPath.replace(/^\/+/, '')
    const Body = Readable.from(await fs.readFile(absPath))
    const ContentType = contentType || inferContentType(clean)
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: clean, Body, ContentType })
    )
    return this.buildPublicUrl(clean)
  }

  async deleteByUrl(publicUrlPath: string): Promise<void> {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3')
    const clean = publicUrlPath.replace(/^\/+/, '')
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: clean }))
    } catch {
      /* ignore */
    }
  }
}

class StorageService {
  private driver: StorageDriver
  private local: LocalDriver
  private r2: R2Driver | null

  constructor() {
    this.driver = process.env.STORAGE_DRIVER === 'r2' ? 'r2' : 'local'
    this.local = new LocalDriver()
    this.r2 = this.driver === 'r2' ? new R2Driver() : null
  }

  isR2(): boolean {
    return this.driver === 'r2'
  }

  async put(
    key: string,
    data: Buffer | Uint8Array | string,
    contentType?: string
  ): Promise<string> {
    if (this.driver === 'r2' && this.r2) return this.r2.put(key, data, contentType)
    return this.local.put(key, data, contentType)
  }

  async publishFile(absPath: string, publicUrlPath: string, contentType?: string): Promise<string> {
    if (this.driver === 'r2' && this.r2)
      return this.r2.publishFile(absPath, publicUrlPath, contentType)
    return this.local.publishFile(absPath, publicUrlPath, contentType)
  }

  async deleteByUrl(publicUrlPath: string): Promise<void> {
    if (this.driver === 'r2' && this.r2) {
      await this.r2.deleteByUrl(publicUrlPath)
    }
    await this.local.deleteByUrl(publicUrlPath) // also try local cleanup
  }
}

const storageService = new StorageService()
export default storageService
