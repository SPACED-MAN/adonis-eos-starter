/**
 * Module System Bootstrap (filesystem-based auto-discovery)
 *
 * Automatically discovers and registers all modules from app/modules/.
 * This file is loaded on application startup.
 *
 * To add a new module:
 * 1. Create your module class in app/modules/your_module.ts
 * 2. Export it as default
 * 3. It will be auto-registered on next server start
 */

import moduleRegistry from '#services/module_registry'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Auto-register all modules found in app/modules/*
try {
  const dir = path.join(process.cwd(), 'app', 'modules')
  if (fs.existsSync(dir)) {
    const files = fs
      .readdirSync(dir)
      .filter((f) => (f.endsWith('.ts') || f.endsWith('.js')) && f !== 'base.ts')

    for (const file of files) {
      try {
        const full = path.join(dir, file)
        const mod = await import(pathToFileURL(full).href)
        const ModuleClass = mod?.default || mod

        if (ModuleClass && typeof ModuleClass === 'function') {
          const instance = new ModuleClass()
          moduleRegistry.register(instance)
        }
      } catch (error) {
        console.error(`Failed to register module from ${file}:`, error)
        // Continue loading other modules even if one fails
      }
    }
  }
} catch (error) {
  console.error('Failed to load modules directory:', error)
  // Non-fatal - application can still start
}

// Log registered modules (development only)
if (process.env.NODE_ENV === 'development') {
  const types = moduleRegistry.getTypes()
  console.log(`📦 Registered ${types.length} modules: ${types.join(', ')}`)
}
