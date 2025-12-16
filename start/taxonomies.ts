/**
 * Taxonomy bootstrap (code-first)
 *
 * Loads taxonomy configs from app/taxonomies/*.ts and the registry,
 * ensures DB rows exist, and caches configs for runtime access.
 */
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import db from '@adonisjs/lucid/services/db'
import taxonomyRegistry, { type RegisteredTaxonomyConfig } from '#services/taxonomy_registry'

async function loadFromFs() {
  const dir = path.join(process.cwd(), 'app', 'taxonomies')
  if (!fs.existsSync(dir)) return
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
  for (const file of files) {
    const full = path.join(dir, file)
    try {
      const mod = await import(pathToFileURL(full).href)
      const cfg: RegisteredTaxonomyConfig | RegisteredTaxonomyConfig[] | undefined =
        (mod?.default || mod) as any
      if (Array.isArray(cfg)) {
        cfg.forEach((c) => c && taxonomyRegistry.register(c))
      } else if (cfg && typeof cfg === 'object') {
        taxonomyRegistry.register(cfg as RegisteredTaxonomyConfig)
      }
    } catch {
      // ignore broken configs to avoid boot failure
    }
  }
}

async function tableExists(name: string): Promise<boolean> {
  try {
    const result = await db.rawQuery<{ exists: string | null }>('SELECT to_regclass(?) as exists', [
      `public.${name}`,
    ])
    const exists =
      (result as any)?.rows?.[0]?.exists !== null &&
      (result as any)?.rows?.[0]?.exists !== undefined
    return exists
  } catch {
    return false
  }
}

async function ensureDatabaseRows() {
  // Skip if migrations have not created the table yet (e.g., during migration:fresh startup)
  const hasTable = await tableExists('taxonomies')
  if (!hasTable) return

  const configs = taxonomyRegistry.list()
  const registeredSlugs = new Set(configs.map((c) => c.slug))
  
  // Ensure database rows exist for registered taxonomies
  for (const cfg of configs) {
    const existing = await db.from('taxonomies').where('slug', cfg.slug).first()
    const now = new Date()
    if (!existing) {
      await db
        .table('taxonomies')
        .insert({ slug: cfg.slug, name: cfg.name, created_at: now, updated_at: now })
    } else if ((existing as any).name !== cfg.name) {
      await db
        .from('taxonomies')
        .where('slug', cfg.slug)
        .update({ name: cfg.name, updated_at: now })
    }
  }
  
  // Optionally: Remove orphaned taxonomies from database (those without config files)
  // This keeps the database in sync with the filesystem
  if (registeredSlugs.size > 0) {
    await db.from('taxonomies').whereNotIn('slug', Array.from(registeredSlugs)).delete()
  } else {
    // If no taxonomies are registered, remove all (clean slate)
    await db.from('taxonomies').delete()
  }
}

async function bootstrap() {
  await loadFromFs()
  await ensureDatabaseRows()
}

await bootstrap()
