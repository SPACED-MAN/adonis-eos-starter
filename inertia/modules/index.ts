/**
 * Module Registry (Filesystem-based Auto-discovery)
 *
 * Automatically discovers and exports all module components using Vite's import.meta.glob.
 * No need to manually add exports when creating new modules!
 *
 * Naming convention:
 * - Static modules: '{type}-static' → prose-static.tsx
 * - React modules: '{type}' → hero.tsx
 *
 * To add a new module:
 * 1. Create your component file in inertia/modules/your-module.tsx
 * 2. Export default from the file
 * 3. That's it! It will be auto-discovered and available.
 */

// Auto-discover all .tsx module files with eager loading for named exports
const eagerModules = import.meta.glob<{ default: any }>('./*.tsx', { eager: true })

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

// Build named exports dynamically
const exports: Record<string, any> = {}

for (const [path, module] of Object.entries(eagerModules)) {
  // Extract filename: './hero-with-media.tsx' -> 'hero-with-media'
  const fileName = path.replace(/^\.\//, '').replace(/\.tsx$/, '')

  // Convert to PascalCase: 'hero-with-media' -> 'HeroWithMedia'
  const exportName = toPascalCase(fileName)

  // Add to exports
  exports[exportName] = module.default

  // Also export without 'Static' suffix for static modules
  // 'ProseStatic' -> also export as 'Prose'
  if (fileName.endsWith('-static')) {
    const withoutStatic = fileName.replace(/-static$/, '')
    const aliasName = toPascalCase(withoutStatic)
    exports[aliasName] = module.default
  }
}

// Export all discovered modules dynamically
// No need to manually list each module - they're auto-discovered!
export default exports

/**
 * Module component map for dynamic imports
 * Auto-generated from discovered modules
 */
const componentMap: Record<string, () => Promise<any>> = {}

for (const [path, loader] of Object.entries(lazyModules)) {
  // Extract filename: './hero-with-media.tsx' -> 'hero-with-media'
  const fileName = path.replace(/^\.\//, '').replace(/\.tsx$/, '')
  componentMap[fileName] = loader as () => Promise<any>
}

export const MODULE_COMPONENTS = componentMap as Record<string, () => Promise<{ default: any }>>
export type ModuleComponentName = keyof typeof MODULE_COMPONENTS
