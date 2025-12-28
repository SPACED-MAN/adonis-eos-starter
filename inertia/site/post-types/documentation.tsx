import { useMemo } from 'react'
import { Head, usePage } from '@inertiajs/react'
import Modules from '../../modules'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { SidebarMenu } from '../components/menu/SidebarMenu'
import { SearchModal } from '../components/SearchModal'
import {
  InlineEditorProvider,
  useInlineEditor,
} from '../../components/inline-edit/InlineEditorContext'
import { InlineOverlay } from '../../components/inline-edit/InlineOverlay'
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
function LiveModuleList({ postId }: { postId: string }) {
  const { modules, enabled: isInlineEnabled } = useInlineEditor()

  return (
    <div className="space-y-0">
      {modules.map((module) => {
        const Component = getModuleComponent(module.type)
        if (!Component) return null
        return (
          <div
            key={module.id}
            {...(isInlineEnabled
              ? {
                  'data-inline-module': module.id,
                  'data-inline-scope': module.scope || 'local',
                  'data-inline-global-slug': module.globalSlug || undefined,
                  'data-inline-global-label': module.globalLabel || undefined,
                }
              : {})}
          >
            <Component {...module.props} __postId={postId} __moduleId={module.id} />
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
  customFields = {},
  availableModes,
}: DocumentationPageProps) {
  const page = usePage()
  const currentUser = (page.props as any)?.currentUser
  const isAuthenticated =
    !!currentUser && ['admin', 'editor', 'translator'].includes(String(currentUser.role || ''))

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

  return (
    <>
      <Head title={post.metaTitle || post.title}>
        {seo?.canonical && <link rel="canonical" href={seo.canonical} />}
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

      <InlineEditorProvider
        postId={post.id}
        post={post}
        customFields={customFields}
        abVariations={abVariations}
        modules={memoizedModules}
        availableModes={availableModes}
      >
        <SiteHeader />

        {/* Support Page Layout with Sidebar */}
        <main className="bg-backdrop-low min-h-screen">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Sidebar Navigation */}
              <aside className="lg:w-64 shrink-0">
                <SearchModal type="documentation" placeholder="Search docs..." />
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
                <LiveModuleList postId={post.id} />
              </div>
            </div>
          </div>
        </main>

        <SiteFooter />
        {isAuthenticated && <InlineOverlay />}
      </InlineEditorProvider>
    </>
  )
}
