import { Head, usePage } from '@inertiajs/react'
import Modules from '../../modules'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { InlineEditorProvider } from '../../components/inline-edit/InlineEditorContext'
import { InlineOverlay } from '../../components/inline-edit/InlineOverlay'

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
	}
	modules: Array<{
		id: string
		type: string
		scope?: 'local' | 'global' | 'static'
		globalSlug?: string | null
		globalLabel?: string | null
		props: Record<string, any>
		reviewProps?: Record<string, any>
		aiReviewProps?: Record<string, any>
		overrides?: Record<string, any>
		reviewOverrides?: Record<string, any>
		aiReviewOverrides?: Record<string, any>
	}>
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
}

function getModuleComponent(type: string): any {
	const key = Object.keys(Modules).find((k) => k.toLowerCase() === type.replace(/[-_]/g, ''))
	// @ts-ignore
	return Modules[key as keyof typeof Modules] || null
}

export default function PostTypeDefault({ post, modules, seo, siteSettings }: PostPageProps) {
	const page = usePage()
	const currentUser = (page.props as any)?.currentUser
	const isAuthenticated = !!currentUser && ['admin', 'editor', 'translator'].includes(String(currentUser.role || ''))
	
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
			{/* Post Content - Rendered Modules */}
			<main className="overflow-x-hidden">
				{modules.map((module) => {
					const Component = getModuleComponent(module.type)
					if (!Component) {
						return null
					}
					return (
						<section
							key={module.id}
							className="container mx-auto px-4 sm:px-6 lg:px-8 py-8"
							{...(isAuthenticated ? {
								'data-inline-module': module.id,
								'data-inline-scope': module.scope || 'local',
								'data-inline-global-slug': module.globalSlug || undefined,
								'data-inline-global-label': module.globalLabel || undefined,
							} : {})}
						>
							<Component {...module.props} {...(isAuthenticated ? { __postId: post.id, __moduleId: module.id } : {})} />
						</section>
					)
				})}
			</main>
			<SiteFooter />
		</>
	)

	return (
		<>
			<Head title={post.metaTitle || post.title}>
				{seo?.canonical && <link rel="canonical" href={seo.canonical} />}
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
				{seo?.twitter?.description && <meta name="twitter:description" content={seo.twitter.description} />}
				{/* JSON-LD */}
				{seo?.jsonLd && (
					<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.jsonLd) }} />
				)}
			</Head>
			{isAuthenticated ? (
				<InlineEditorProvider
					postId={post.id}
					modules={modules.map((m) => ({
						id: m.id,
						scope: m.scope,
						globalSlug: m.globalSlug,
						globalLabel: m.globalLabel,
						props: m.props,
						reviewProps: m.reviewProps,
						aiReviewProps: m.aiReviewProps,
						overrides: m.overrides,
						reviewOverrides: m.reviewOverrides,
						aiReviewOverrides: m.aiReviewOverrides,
					}))}
				>
					{content}
					<InlineOverlay />
				</InlineEditorProvider>
			) : (
				content
			)}
		</>
	)
}


