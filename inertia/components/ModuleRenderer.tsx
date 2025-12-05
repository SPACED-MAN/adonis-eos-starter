/**
 * Module Renderer
 * 
 * Dynamic component renderer for both static and React modules.
 * Used in both admin (preview) and public site (rendering).
 * 
 * Supports two rendering strategies:
 * 1. Static modules: Pre-rendered HTML from server (e.g. prose-static)
 * 2. React modules: Client-side components with interactivity (gallery, accordion)
 */

import { ComponentType, Suspense } from 'react'

// Import module registry (auto-discovered)
import Modules from '../modules'

interface ModuleData {
  id: string
  type: string
  componentName: string // 'hero-static', 'gallery', etc.
  renderingMode: 'static' | 'react'
  props: Record<string, any>
  html?: string // Pre-rendered HTML for static modules
}

interface ModuleRendererProps {
  module: ModuleData
}

/**
 * Render a single module based on its type and rendering mode
 */
export function ModuleRenderer({ module }: ModuleRendererProps) {
  const { componentName, renderingMode, props, html } = module

  // Static modules: Use pre-rendered HTML
  if (renderingMode === 'static' && html) {
    return <StaticModuleRenderer html={html} />
  }

  // React modules: Dynamic import and render
  return <ReactModuleRenderer componentName={componentName} props={props} />
}

/**
 * Static Module Renderer
 * Renders pre-generated HTML from server (no hydration)
 */
function StaticModuleRenderer({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

/**
 * React Module Renderer
 * Dynamically loads and renders React components
 */
function ReactModuleRenderer({
  componentName,
  props,
}: {
  componentName: string
  props: Record<string, any>
}) {
  // Get component from registry
  const Component = getModuleComponent(componentName)

  if (!Component) {
    // Module component not found
    return (
      <div className="border border-error bg-[#fef2f2] p-4 rounded">
        <p className="text-error">
          Module not found: <code>{componentName}</code>
        </p>
      </div>
    )
  }

  return (
    <Suspense fallback={<ModuleLoadingFallback />}>
      <Component {...props} />
    </Suspense>
  )
}

/**
 * Get module component from registry (auto-discovered)
 * 
 * Dynamically resolves module components by converting kebab-case names to PascalCase.
 * No manual mapping needed - all modules are auto-discovered via import.meta.glob.
 * 
 * Examples:
 * - 'hero' → Modules.Hero
 * - 'hero-with-media' → Modules.HeroWithMedia
 * - 'prose-static' → Modules.ProseStatic (or Modules.Prose alias)
 */
function getModuleComponent(componentName: string): ComponentType<any> | null {
  // Convert kebab-case to PascalCase
  // 'hero-with-media' → 'HeroWithMedia'
  const pascalName = componentName
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')

  // Access the component from the Modules namespace
  const component = (Modules as any)[pascalName]

  if (component) {
    return component
  }

  // If not found, return null (will show error in UI)
  return null
}

/**
 * Loading fallback for lazy-loaded modules
 */
function ModuleLoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-pulse text-neutral-low">Loading module...</div>
    </div>
  )
}

/**
 * Render multiple modules in sequence
 */
export function ModuleList({ modules }: { modules: ModuleData[] }) {
  return (
    <>
      {modules.map((module) => (
        <ModuleRenderer key={module.id} module={module} />
      ))}
    </>
  )
}

