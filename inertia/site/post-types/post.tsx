import { Head } from '@inertiajs/react'
import Modules from '../../modules'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'

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
		props: Record<string, any>
	}>
	seo?: {
		canonical?: string
		alternates?: Array<{ locale: string; href: string }>
		robots?: string
		og?: { title?: string; description?: string; url?: string; type?: string }
		twitter?: { card?: string; title?: string; description?: string }
		jsonLd?: any
	}
}

function getModuleComponent(type: string): any {
	const key = Object.keys(Modules).find((k) => k.toLowerCase() === type.replace(/[-_]/g, ''))
	// @ts-ignore
	return Modules[key as keyof typeof Modules] || null
}

export default function PostTypeDefault({ post, modules, seo }: PostPageProps) {
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
				{seo?.twitter?.description && <meta name="twitter:description" content={seo.twitter.description} />}
				{/* JSON-LD */}
				{seo?.jsonLd && (
					<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.jsonLd) }} />
				)}
			</Head>
			<SiteHeader />
			{/* Post Content - Rendered Modules */}
			<main className="overflow-x-hidden">
				{modules.map((module) => {
					const Component = getModuleComponent(module.type)
					if (!Component) {
						return null
					}
					return (
						<section key={module.id} className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
							<Component {...module.props} />
						</section>
					)
				})}
			</main>

			<SiteFooter />
		</>
	)
}


