/**
 * Public Post Page
 *
 * Displays a post with its modules.
 * Modules are rendered using React components for SSR + hydration.
 */

import * as Modules from '../../modules'
import { Head } from '@inertiajs/react'
import { SiteFooter } from '../components/SiteFooter'

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
		canonical: string
		alternates: Array<{ locale: string; href: string }>
	}
}

export default function Post({ post, modules, seo }: PostPageProps) {
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
			{/* Post Header */}
			<header className="bg-backdrop-low py-12">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
						<h1 className="text-4xl sm:text-5xl font-bold text-neutral-high mb-4">
							{post.title}
						</h1>
						{post.excerpt && (
							<p className="text-xl text-neutral-low">{post.excerpt}</p>
						)}
					</div>
				</div>
			</header>

			{/* Post Content - Rendered Modules */}
			<main>
				{modules.map((module) => {
					const Component = getModuleComponent(module.type)
					if (!Component) {
            return (
              <div key={module.id} className="border border-error bg-[color:#fef2f2] p-4">
                <p className="text-error">Module not found: {module.type}</p>
              </div>
            )
					}
					return <Component key={module.id} {...module.props} />
				})}
			</main>
			<SiteFooter />
		</>
	)
}

/**
 * Map module types to their React components
 */
function getModuleComponent(type: string) {
	const componentMap: Record<string, any> = {
		hero: Modules.HeroStatic,
		prose: Modules.ProseStatic,
		gallery: Modules.Gallery,
		accordion: Modules.Accordion,
	}

	return componentMap[type] || null
}

