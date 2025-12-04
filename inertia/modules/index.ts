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
export { default as Hero } from './hero'
export { default as HeroWithMedia } from './hero-with-media'
export { default as HeroWithCallout } from './hero-with-callout'
export { default as FeaturesList } from './features-list'
export { default as FeaturesListExpanded } from './features-list-expanded'
export { default as Blockquote } from './blockquote'
export { default as ProseWithMedia } from './prose-with-media'
export { default as ProseWithForm } from './prose-with-form'
export { default as Statistics } from './statistics'
export { default as ProfileList } from './profile-list'
export { default as CompanyList } from './company-list'
export { default as BlogList } from './blog-list'
export { default as Pricing } from './pricing'
export { default as Faq } from './faq'
export { default as TestimonialList } from './testimonial-list'
export { default as Form } from './form'

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
  'hero': () => import('./hero'),
  'hero-with-media': () => import('./hero-with-media'),
  'hero-with-callout': () => import('./hero-with-callout'),
  'features-list': () => import('./features-list'),
  'features-list-expanded': () => import('./features-list-expanded'),
  'blockquote': () => import('./blockquote'),
  'prose-with-media': () => import('./prose-with-media'),
  'prose-with-form': () => import('./prose-with-form'),
  'statistics': () => import('./statistics'),
  'profile-list': () => import('./profile-list'),
  'company-list': () => import('./company-list'),
  'blog-list': () => import('./blog-list'),
  'pricing': () => import('./pricing'),
  'faq': () => import('./faq'),
  'testimonial-list': () => import('./testimonial-list'),
  'form': () => import('./form'),
} as const

export type ModuleComponentName = keyof typeof MODULE_COMPONENTS
