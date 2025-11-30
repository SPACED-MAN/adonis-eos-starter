/**
 * Module Renderer
 * 
 * Dynamic component renderer for both static and React modules.
 * Used in both admin (preview) and public site (rendering).
 * 
 * Supports two rendering strategies:
 * 1. Static modules: Pre-rendered HTML from server (hero-static, prose-static)
 * 2. React modules: Client-side components with interactivity (gallery, accordion)
 */

import { ComponentType, lazy, Suspense } from 'react'

// Import module registry
import * as Modules from '../modules'

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
    console.error(`Module component not found: ${componentName}`)
    return (
      <div className="border border-error bg-[color:#fef2f2] p-4 rounded">
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
 * Get module component from registry
 * Supports both direct imports and lazy loading
 */
function getModuleComponent(componentName: string): ComponentType<any> | null {
  // Map component names to actual components
  const componentMap: Record<string, ComponentType<any>> = {
    'hero-static': Modules.HeroStatic,
    'prose-static': Modules.ProseStatic,
    'gallery': Modules.Gallery,
    'accordion': Modules.Accordion,
    'kitchen-sink': Modules.KitchenSink,
    'feed': Modules.Feed,
    'hero-with-media': Modules.HeroWithMedia,
    'hero-with-callout': Modules.HeroWithCallout,
  }

  return componentMap[componentName] || null
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

