import moduleRegistry from '#services/module_registry'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Helper to register all available modules for tests.
 * Duplicates logic from start/modules.ts but ensures it's available for unit tests.
 */
export async function registerAllModules() {
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
            const config = new ModuleClass().getConfig()
            if (!moduleRegistry.has(config.type)) {
              moduleRegistry.register(new ModuleClass())
            }
          }
        } catch (error) {
          // ignore
        }
      }
    }
  } catch (error) {
    // ignore
  }
}
