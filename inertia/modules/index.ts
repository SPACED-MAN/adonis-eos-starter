/**
 * Module Registry (Filesystem-based Auto-discovery)
 *
 * Automatically discovers and exports all module components using Vite's import.meta.glob.
 * No need to manually add exports when creating new modules.
 *
 * Naming convention:
 * - Each module lives in `inertia/modules/{type}.tsx`
 *   e.g. type: 'prose'  → prose.tsx
 *        type: 'gallery' → gallery.tsx
 *
 * Static vs React behaviour is controlled by the backend module's
 * `getRenderingMode()` – not by filename suffixes.
 */

import React, { lazy } from 'react'

// Auto-discover all .tsx module files with lazy loading for dynamic imports
const lazyModules = import.meta.glob('./*.tsx')

// Helper to convert kebab-case to PascalCase
// 'hero-with-media' -> 'HeroWithMedia'
function toPascalCase(str: string): string {
  return str
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

// Build dynamic component map and exports
const exports: Record<string, any> = {}
const componentMap: Record<string, any> = {}

for (const [path, loader] of Object.entries(lazyModules)) {
  // Extract filename: './hero-with-media.tsx' -> 'hero-with-media'
  const fileName = path.replace(/^\.\//, '').replace(/\.tsx$/, '')

  // Create lazy component (only once!)
  const lazyComponent = lazy(loader as any)

  // Add to kebab-case map
  componentMap[fileName] = lazyComponent

  // Add to PascalCase exports: 'hero-with-media' -> 'HeroWithMedia'
  const exportName = toPascalCase(fileName)
  exports[exportName] = lazyComponent
}

// Export all discovered modules dynamically as PascalCase
export default exports

export const MODULE_COMPONENTS = componentMap as Record<string, React.LazyExoticComponent<any>>
export type ModuleComponentName = keyof typeof MODULE_COMPONENTS
