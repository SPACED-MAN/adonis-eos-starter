/**
 * Menu Templates Bootstrap (filesystem-based auto-discovery)
 *
 * Automatically discovers and imports all menu templates from app/menus/.
 * Each template self-registers when imported via menuTemplates.register()
 *
 * To add a new menu template:
 * 1. Create your template file in app/menus/your_menu.ts
 * 2. Include menuTemplates.register(YourTemplate) in the file
 * 3. It will be auto-imported on next server start
 */

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Auto-import all menu templates from app/menus/*
try {
  const dir = path.join(process.cwd(), 'app', 'menus')
  if (fs.existsSync(dir)) {
    const files = fs
      .readdirSync(dir)
      .filter((f) => (f.endsWith('.ts') || f.endsWith('.js')) && f !== 'index.ts')

    for (const file of files) {
      try {
        const full = path.join(dir, file)
        // Import for side effects (each template self-registers)
        await import(pathToFileURL(full).href)
      } catch (error) {
        console.error(`Failed to load menu template from ${file}:`, error)
        // Continue loading other templates even if one fails
      }
    }
  }
} catch (error) {
  console.error('Failed to load menus directory:', error)
  // Non-fatal - application can still start
}
