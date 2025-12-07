/**
 * Post Types bootstrap (code-first, registry-based)
 *
 * Register all post types and ensure DB artifacts (module groups, URL patterns)
 * reflect the version-controlled configuration.
 */
import postTypeRegistry from '#services/post_type_registry'
import db from '@adonisjs/lucid/services/db'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Auto-register all post types found in app/post_types/*
try {
  const dir = path.join(process.cwd(), 'app', 'post_types')
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
    for (const file of files) {
      const slug = file.replace(/\.(ts|js)$/g, '')
      try {
        const full = path.join(dir, file)
        const mod = await import(pathToFileURL(full).href)
        const cfg = mod?.default || mod
        if (cfg && typeof cfg === 'object') {
          postTypeRegistry.register(slug, cfg as any)
        }
      } catch {
        // Skip broken configs; do not crash boot
      }
    }
  }
} catch {
  // Ignore FS errors at boot
}

// Ensure DB reflects code config (idempotent)
async function syncFromRegistry() {
  for (const [type, cfg] of postTypeRegistry.entries()) {
    const urlPatterns = Array.isArray((cfg as any).urlPatterns) ? (cfg as any).urlPatterns : []
    const permalinksEnabled = (cfg as any).permalinksEnabled !== false && urlPatterns.length > 0
    const moduleGroupsEnabled =
      (cfg as any).moduleGroupsEnabled !== undefined
        ? !!(cfg as any).moduleGroupsEnabled
        : permalinksEnabled

    // Module Group (formerly template)
    if (moduleGroupsEnabled && (cfg as any).moduleGroup?.name) {
      const now = new Date()
      const existing = await db
        .from('module_groups')
        .where({ name: (cfg as any).moduleGroup.name })
        .first()
      if (!existing) {
        await db.table('module_groups').insert({
          name: (cfg as any).moduleGroup.name,
          post_type: type,
          description: (cfg as any).moduleGroup.description || null,
          locked: false,
          created_at: now,
          updated_at: now,
        })
      } else if (
        (existing as any).post_type !== type ||
        (existing as any).description !== ((cfg as any).moduleGroup.description || null)
      ) {
        await db
          .from('module_groups')
          .where({ name: (cfg as any).moduleGroup.name })
          .update({
            post_type: type,
            description: (cfg as any).moduleGroup.description || null,
            updated_at: now,
          })
      }
    }
    // URL patterns (remove if permalinks are disabled; otherwise ensure)
    if (!permalinksEnabled) {
      try {
        await db.from('url_patterns').where({ post_type: type }).delete()
      } catch {
        // ignore
      }
    } else if (urlPatterns.length > 0) {
      for (const p of urlPatterns) {
        const now = new Date()
        const row = await db
          .from('url_patterns')
          .where({ post_type: type, locale: p.locale })
          .first()
        if (!row) {
          await db.table('url_patterns').insert({
            post_type: type,
            locale: p.locale,
            pattern: p.pattern,
            is_default: !!p.isDefault,
            created_at: now,
            updated_at: now,
          })
        } else if (
          (row as any).pattern !== p.pattern ||
          !!(row as any).is_default !== !!p.isDefault
        ) {
          await db.from('url_patterns').where({ post_type: type, locale: p.locale }).update({
            pattern: p.pattern,
            is_default: !!p.isDefault,
            updated_at: now,
          })
        }
      }
    }
  }
}

try {
  await syncFromRegistry()
} catch {
  // non-fatal
}

// Log registered post types (development only)
if (process.env.NODE_ENV === 'development') {
  const types = postTypeRegistry.list()
  console.log(`🧩 Registered ${types.length} post types: ${types.join(', ')}`)
}
