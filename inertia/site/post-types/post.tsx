import { useEffect, useMemo, Suspense, lazy } from 'react'
import { Head, usePage } from '@inertiajs/react'
import Modules from '../../modules'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { slugify, getModuleAnchors } from '~/utils/strings'
import { useAnchorScroll } from '../hooks/useAnchorScroll'
import { ModuleContext } from '../../components/ModuleContext'
import {
  StaticInlineEditorProvider,
  useInlineEditor,
} from '../../components/inline-edit/InlineEditorContext'
import { useState } from 'react'

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

interface PostPageProps {
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
    reviewDraft?: any
    aiReviewDraft?: any
    abVariation?: string | null
    abGroupId?: string | null
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
    <main className="overflow-x-clip">
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
    </main>
  )
}

export default function PostTypeDefault({
  post,
  modules,
  seo,
  siteSettings,
  translations = [],
  customFields,
  abVariations = [],
  availableModes,
}: PostPageProps) {
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

  // Track A/B variation in Google Analytics dataLayer if available
  useEffect(() => {
    if (post.abVariation && typeof window !== 'undefined' && (window as any).dataLayer) {
      ; (window as any).dataLayer.push({
        event: 'ab_variation_view',
        ab_variation: post.abVariation,
        ab_group_id: post.abGroupId || post.id,
      })
    }
  }, [post.id, post.abVariation, post.abGroupId])

  // Generate meta description with fallback chain
  const metaDescription =
    post.metaDescription ||
    post.excerpt ||
    seo?.og?.description ||
    siteSettings?.defaultMetaDescription ||
    null

  const content = (
    <>
      <SiteHeader />
      <ModuleList postId={post.id} initialModules={memoizedModules} />
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
        {/* ... existing head content ... */}
        {seo?.canonical && <link rel="canonical" href={seo.canonical} />}
        {seo?.lcpImageUrl && <link rel="preload" as="image" href={seo.lcpImageUrl} />}
        {seo?.alternates?.map((alt) => (
          <link key={alt.locale} rel="alternate" hrefLang={alt.locale} href={alt.href} />
        ))}
        {metaDescription && <meta name="description" content={metaDescription} />}
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
