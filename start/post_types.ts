/**
 * Post Types bootstrap (code-first, registry-based)
 *
 * Register all post types and ensure DB artifacts (templates, URL patterns)
 * reflect the version-controlled configuration.
 */
import postTypeRegistry from '#services/post_type_registry'
import db from '@adonisjs/lucid/services/db'

// Import code-defined post type configs and register them explicitly
// Add new imports/registrations here to mirror the modules pattern.
import profileConfig from '#post_types/profile'
import ipsumConfig from '#post_types/ipsum'

postTypeRegistry.register('profile', profileConfig as any)
postTypeRegistry.register('ipsum', ipsumConfig as any)

// Ensure DB reflects code config (idempotent)
async function syncFromRegistry() {
  for (const [type, cfg] of postTypeRegistry.entries()) {
    // Template
    if (cfg.template?.name) {
      const now = new Date()
      const existing = await db.from('templates').where({ name: cfg.template.name }).first()
      if (!existing) {
        await db.table('templates').insert({
          name: cfg.template.name,
          post_type: type,
          description: cfg.template.description || null,
          locked: false,
          created_at: now,
          updated_at: now,
        })
      } else if ((existing as any).post_type !== type || (existing as any).description !== (cfg.template.description || null)) {
        await db.from('templates').where({ name: cfg.template.name }).update({
          post_type: type,
          description: cfg.template.description || null,
          updated_at: now,
        })
      }
    }
    // URL patterns
    if (Array.isArray(cfg.urlPatterns)) {
      for (const p of cfg.urlPatterns) {
        const now = new Date()
        const row = await db.from('url_patterns').where({ post_type: type, locale: p.locale }).first()
        if (!row) {
          await db.table('url_patterns').insert({
            post_type: type,
            locale: p.locale,
            pattern: p.pattern,
            is_default: !!p.isDefault,
            created_at: now,
            updated_at: now,
          })
        } else if ((row as any).pattern !== p.pattern || !!(row as any).is_default !== !!p.isDefault) {
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


