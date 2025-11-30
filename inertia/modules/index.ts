/**
 * Module Registry
 * 
 * Central export for all module components.
 * Components are dynamically imported based on module type from backend.
 * 
 * Naming convention:
 * - Static modules: '{type}-static' → hero-static.tsx
 * - React modules: '{type}' → gallery.tsx
 */

// Static modules (pure SSR, max performance)
export { default as HeroStatic } from './hero-static'
export { default as ProseStatic } from './prose-static'

// React modules (SSR + hydration, interactive)
export { default as Gallery } from './gallery'
export { default as Accordion } from './accordion'
export { default as KitchenSink } from './kitchen-sink'
export { default as Feed } from './feed'
export { default as HeroWithMedia } from './hero-with-media'
export { default as HeroWithCallout } from './hero-with-callout'

/**
 * Module component map for dynamic imports
 * Key is the component name returned from backend
 */
export const MODULE_COMPONENTS = {
  // Static variants
  'hero-static': () => import('./hero-static'),
  'prose-static': () => import('./prose-static'),

  // React variants
  'gallery': () => import('./gallery'),
  'accordion': () => import('./accordion'),
  'kitchen-sink': () => import('./kitchen-sink'),
  'feed': () => import('./feed'),
  'hero-with-media': () => import('./hero-with-media'),
  'hero-with-callout': () => import('./hero-with-callout'),
} as const

export type ModuleComponentName = keyof typeof MODULE_COMPONENTS

