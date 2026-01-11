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
 */

import React from 'react'

// Auto-discover all .tsx module files eagerly to avoid hydration mismatches
// with lazy loading and ensure full SSR support.
const modules = import.meta.glob('./*.tsx', { eager: true })

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

for (const [path, module] of Object.entries(modules)) {
  // Extract filename: './hero-with-media.tsx' -> 'hero-with-media'
  const fileName = path.replace(/^\.\//, '').replace(/\.tsx$/, '')
  const component = (module as any).default

  if (component) {
    // Add to kebab-case map
    componentMap[fileName] = component

    // Add to PascalCase exports: 'hero-with-media' -> 'HeroWithMedia'
    const exportName = toPascalCase(fileName)
    exports[exportName] = component
  }
}

// Export all discovered modules dynamically as PascalCase
export default exports

export const MODULE_COMPONENTS = componentMap as Record<string, any>
export type ModuleComponentName = keyof typeof MODULE_COMPONENTS
