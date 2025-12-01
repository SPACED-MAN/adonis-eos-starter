/**
 * Module Registry
 * 
 * Central export for all module components.
 * Components are dynamically imported based on module type from backend.
 * 
 * Naming convention:
 * - Static modules: '{type}-static' → prose-static.tsx
 * - React modules: '{type}' → gallery.tsx
 */

// Static modules (pure SSR, max performance)
export { default as ProseStatic } from './prose-static'

// React modules (SSR + hydration, interactive)
export { default as Gallery } from './gallery'
export { default as Accordion } from './accordion'
export { default as KitchenSink } from './kitchen-sink'
export { default as Feed } from './feed'
export { default as HeroWithMedia } from './hero-with-media'
export { default as HeroWithCallout } from './hero-with-callout'
export { default as FeaturesList } from './features-list'
export { default as ProseWithMedia } from './prose-with-media'
export { default as Statistics } from './statistics'
export { default as ProfileList } from './profile-list'

/**
 * Module component map for dynamic imports
 * Key is the component name returned from backend
 */
export const MODULE_COMPONENTS = {
  // Static variants
  'prose-static': () => import('./prose-static'),

  // React variants
  'gallery': () => import('./gallery'),
  'accordion': () => import('./accordion'),
  'kitchen-sink': () => import('./kitchen-sink'),
  'feed': () => import('./feed'),
  'hero-with-media': () => import('./hero-with-media'),
  'hero-with-callout': () => import('./hero-with-callout'),
  'features-list': () => import('./features-list'),
  'prose-with-media': () => import('./prose-with-media'),
  'statistics': () => import('./statistics'),
  'profile-list': () => import('./profile-list'),
} as const

export type ModuleComponentName = keyof typeof MODULE_COMPONENTS

