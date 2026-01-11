import fs from 'node:fs'
import path from 'node:path'
import db from '@adonisjs/lucid/services/db'
import mediaService from '#services/media_service'
import storageService from '#services/storage_service'
import logActivityAction from '#actions/log_activity_action'

export interface RenameMediaOptions {
  id: string
  filename: string
  userId: number | null
}

export class RenameMediaAction {
  async handle(options: RenameMediaOptions) {
    const { id, filename, userId } = options
    let newName = filename.trim()
    if (!newName) {
      throw new Error('filename is required')
    }

    const row = await db.from('media_assets').where('id', id).first()
    if (!row) throw new Error('Media not found')

    const oldUrl: string = String(row.url)
    const oldPath = storageService.getLocalPath(oldUrl)
    const parsed = path.parse(oldPath)

    let base = newName
    let ext = parsed.ext
    const provided = path.parse(newName)
    if (provided.ext) {
      base = provided.name
      ext = provided.ext.startsWith('.') ? provided.ext : `.${provided.ext}`
    }

    base = base
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
    if (!base) base = 'file'

    const dir = parsed.dir
    let candidate = `${base}${ext}`
    let counter = 1
    while (true) {
      try {
        await fs.promises.access(path.join(dir, candidate))
        const nameOnly = `${base}-${counter++}`
        candidate = `${nameOnly}${ext}`
      } catch {
        break
      }
    }
    const newBase = path.parse(candidate).name
    const { newPath, newUrl, renamedVariants } = await mediaService.renameWithVariants(
      oldPath,
      oldUrl,
      newBase
    )

    let metadata = row.metadata || {}
    if (metadata && (metadata as any).variants && Array.isArray((metadata as any).variants)) {
      ; (metadata as any).variants = (metadata as any).variants.map((v: any) => {
        const found = renamedVariants.find((rv) => rv.oldUrl === v.url)
        if (found) {
          return { ...v, url: found.newUrl }
        }
        const relDir = storageService.getRelativeDir(oldUrl)
        if (typeof v.url === 'string' && v.url.startsWith(relDir)) {
          const trailing = v.url.substring(relDir.length + 1)
          if (trailing.startsWith(`${parsed.name}.`)) {
            const variantName = trailing.slice(parsed.name.length + 1)
            return {
              ...v,
              url: path.posix.join(relDir, `${newBase}.${variantName}`),
            }
          }
        }
        return v
      })
    }

    await db
      .from('media_assets')
      .where('id', id)
      .update({
        url: newUrl,
        original_filename: path.parse(newPath).base,
        metadata: metadata as any,
        updated_at: new Date(),
      } as any)

    const oldUrlEsc = oldUrl.replace(/'/g, "''")
    const newUrlEsc = newUrl.replace(/'/g, "''")

    // Update references in JSONB fields
    await db.raw(
      `UPDATE module_instances SET props = REPLACE(props::text, '${oldUrlEsc}', '${newUrlEsc}')::jsonb WHERE props::text LIKE '%${oldUrlEsc}%'`
    )
    await db.raw(
      `UPDATE module_instances SET review_props = REPLACE(review_props::text, '${oldUrlEsc}', '${newUrlEsc}')::jsonb WHERE review_props::text LIKE '%${oldUrlEsc}%'`
    )
    await db.raw(
      `UPDATE post_modules SET overrides = REPLACE(overrides::text, '${oldUrlEsc}', '${newUrlEsc}')::jsonb WHERE overrides::text LIKE '%${oldUrlEsc}%'`
    )
    await db.raw(
      `UPDATE post_modules SET review_overrides = REPLACE(review_overrides::text, '${oldUrlEsc}', '${newUrlEsc}')::jsonb WHERE review_overrides::text LIKE '%${oldUrlEsc}%'`
    )

    await logActivityAction.handle({
      action: 'media.rename',
      userId,
      entityType: 'media',
      entityId: id,
      metadata: { oldUrl, newUrl },
    })

    return { url: newUrl }
  }
}

export default new RenameMediaAction()

