import { useMemo, Suspense, lazy } from 'react'
import { Head, usePage } from '@inertiajs/react'
import Modules from '../../modules'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { SidebarMenu } from '../components/menu/SidebarMenu'
import { SearchModal } from '../components/SearchModal'
import { slugify, getModuleAnchors } from '~/utils/strings'
import { useAnchorScroll } from '../hooks/useAnchorScroll'
import { ModuleContext } from '../../components/ModuleContext'
import {
  StaticInlineEditorProvider,
  useInlineEditor,
} from '../../components/inline-edit/InlineEditorContext'
import { useState, useEffect } from 'react'

function InlineEditorShellWrapper({ children, ...props }: any) {
  const [Component, setComponent] = useState<any>(null)

  useEffect(() => {
    import('../../components/inline-edit/InlineEditorShell').then((m) =>
      setComponent(() => m.default)
    )
  }, [])

  if (!Component) {
    return <StaticInlineEditorProvider {...props}>{children}</StaticInlineEditorProvider>
  }

  return <Component {...props}>{children}</Component>
}

import type { TreeNode } from '../components/menu/types'

interface DocumentationPageProps {
  post: {
    id: string
    type: string
    locale: string
    slug: string
    title: string
    excerpt: string | null
    metaTitle: string | null
    metaDescription: string | null
    status: string
  }
  abVariations?: Array<{ id: string; variation: string; status: string }>
  translations?: Array<{ id: string; locale: string; path: string }>
  modules: Array<{
    id: string
    type: string
    name?: string
    scope?: 'local' | 'global' | 'static'
    globalSlug?: string | null
    globalLabel?: string | null
    adminLabel?: string | null
    props: Record<string, any>
    sourceProps?: Record<string, any>
    sourceOverrides?: Record<string, any>
    reviewProps?: Record<string, any>
    aiReviewProps?: Record<string, any>
    overrides?: Record<string, any>
    reviewOverrides?: Record<string, any>
    aiReviewOverrides?: Record<string, any>
    aiReviewAdded?: boolean
  }>
  documentationNav?: TreeNode[]
  seo?: {
    canonical?: string
    alternates?: Array<{ locale: string; href: string }>
    robots?: string
    lcpImageUrl?: string
    og?: { title?: string; description?: string; url?: string; type?: string }
    twitter?: { card?: string; title?: string; description?: string }
    jsonLd?: any
  }
  siteSettings?: {
    defaultMetaDescription?: string | null
    [key: string]: any
  }
  customFields?: Record<string, any>
  availableModes?: {
    hasSource: boolean
    hasReview: boolean
    hasAiReview: boolean
  }
}

function getModuleComponent(type: string): any {
  if (!type) return null
  const key = Object.keys(Modules).find((k) => k.toLowerCase() === type.replace(/[-_]/g, ''))
  // @ts-ignore
  return Modules[key as keyof typeof Modules] || null
}

/**
 * Live module list that responds to context changes (e.g. reordering)
 */
function ModuleList({ postId, initialModules }: { postId: string; initialModules: any[] }) {
  const editor = useInlineEditor()
  const modules = editor?.modules || initialModules
  const isInlineEnabled = editor?.enabled || false

  const anchors = useMemo(() => getModuleAnchors(modules), [modules])

  return (
    <div className="space-y-0">
      {modules.map((module, index) => {
        const Component = getModuleComponent(module.type)
        if (!Component) return null
        const anchor = anchors.get(module.id)?.replace('#', '')
        return (
          <div
            key={module.id}
            id={anchor}
            data-module-id={module.id}
            {...(isInlineEnabled
              ? {
                'data-inline-module': module.id,
                'data-inline-scope': module.scope || 'local',
                'data-inline-global-slug': module.globalSlug || undefined,
                'data-inline-global-label': module.globalLabel || undefined,
              }
              : {})}
          >
            <Suspense fallback={<div className="min-h-[100px] flex items-center justify-center bg-backdrop-low/50 animate-pulse rounded-lg m-4" />}>
              <ModuleContext.Provider value={{ isFirst: index === 0, index }}>
                <Component {...module.props} __postId={postId} __moduleId={module.id} />
              </ModuleContext.Provider>
            </Suspense>
          </div>
        )
      })}
    </div>
  )
}

export default function DocumentationPostType({
  post,
  modules,
  documentationNav = [],
  seo,
  abVariations = [],
  translations = [],
  customFields = {},
  availableModes,
  siteSettings,
}: DocumentationPageProps) {
  const page = usePage()
  const currentUser = (page.props as any)?.currentUser
  const isAuthenticated =
    !!currentUser && ['admin', 'editor_admin', 'editor', 'translator'].includes(String(currentUser.role || ''))

  const memoizedModules = useMemo(
    () =>
      modules.map((m) => ({
        id: m.id,
        type: m.type,
        name: m.name,
        scope: m.scope,
        globalSlug: m.globalSlug,
        globalLabel: m.globalLabel,
        adminLabel: m.adminLabel,
        props: m.props,
        sourceProps: m.sourceProps,
        sourceOverrides: m.sourceOverrides,
        reviewProps: m.reviewProps,
        aiReviewProps: m.aiReviewProps,
        overrides: m.overrides,
        reviewOverrides: m.reviewOverrides,
        aiReviewOverrides: m.aiReviewOverrides,
        aiReviewAdded: (m as any).aiReviewAdded,
      })),
    [modules]
  )

  const showSearch =
    siteSettings?.customFields?.show_search !== false &&
    siteSettings?.customFields?.show_search !== 'false'

  const content = (
    <>
      <SiteHeader />

      {/* Support Page Layout with Sidebar */}
      <main className="bg-backdrop-low min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar Navigation */}
            <aside className="lg:w-64 shrink-0">
              {showSearch && (
                <SearchModal type="documentation" placeholder="Search docs..." />
              )}
              <SidebarMenu
                nodes={documentationNav}
                currentPageId={post.id}
                title="Documentation"
              />
            </aside>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Title */}
              <h1 className="text-4xl font-bold text-neutral-high mb-8 px-4 sm:px-6 lg:px-8">
                {post.title}
              </h1>

              {/* Modules */}
              <ModuleList postId={post.id} initialModules={memoizedModules} />
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  )

  const staticProvider = (
    <StaticInlineEditorProvider
      postId={post.id}
      post={post}
      translations={translations}
      modules={memoizedModules}
      availableModes={availableModes}
      abVariations={abVariations}
    >
      {content}
    </StaticInlineEditorProvider>
  )

  return (
    <>
      <Head title={post.metaTitle || post.title}>
        {seo?.canonical && <link rel="canonical" href={seo.canonical} />}
        {seo?.lcpImageUrl && <link rel="preload" as="image" href={seo.lcpImageUrl} />}
        {seo?.alternates?.map((alt) => (
          <link key={alt.locale} rel="alternate" hrefLang={alt.locale} href={alt.href} />
        ))}
        {post.metaDescription && <meta name="description" content={post.metaDescription} />}
        {seo?.robots && <meta name="robots" content={seo.robots} />}
        {/* OpenGraph */}
        {seo?.og?.title && <meta property="og:title" content={seo.og.title} />}
        {seo?.og?.description && <meta property="og:description" content={seo.og.description} />}
        {seo?.og?.url && <meta property="og:url" content={seo.og.url} />}
        {seo?.og?.type && <meta property="og:type" content={seo.og.type} />}
        {/* Twitter */}
        {seo?.twitter?.card && <meta name="twitter:card" content={seo.twitter.card} />}
        {seo?.twitter?.title && <meta name="twitter:title" content={seo.twitter.title} />}
        {seo?.twitter?.description && (
          <meta name="twitter:description" content={seo.twitter.description} />
        )}
        {/* JSON-LD */}
        {seo?.jsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.jsonLd) }}
          />
        )}
      </Head>

      {isAuthenticated ? (
        <InlineEditorShellWrapper
          postId={post.id}
          post={post}
          translations={translations}
          modules={memoizedModules}
          availableModes={availableModes}
          abVariations={abVariations}
        >
          {content}
        </InlineEditorShellWrapper>
      ) : (
        staticProvider
      )}
    </>
  )
}
