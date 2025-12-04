import { Head, Link } from '@inertiajs/react'
import * as Modules from '../../modules'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { useState, useEffect } from 'react'

interface SupportPageProps {
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

interface SupportPage {
	id: string
	title: string
	slug: string
	url?: string
	parentId?: string | null
	depth?: number
}

function getModuleComponent(type: string): any {
	const key = Object.keys(Modules).find((k) => k.toLowerCase() === type.replace(/[-_]/g, ''))
	// @ts-ignore
	return Modules[key as keyof typeof Modules] || null
}

export default function SupportPostType({ post, modules, seo }: SupportPageProps) {
	const [supportPages, setSupportPages] = useState<SupportPage[]>([])

	useEffect(() => {
		// Fetch all support pages for sidebar navigation
		fetch(`/api/posts?type=support&status=published&locale=${post.locale}`)
			.then((res) => res.json())
			.then((data) => {
				if (data.data) {
					setSupportPages(data.data)
				}
			})
			.catch(() => {
				// Silently handle error - supportNav will remain empty
			})
	}, [post.locale])

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
			<SiteHeader />

			{/* Support Page Layout with Sidebar */}
			<main className="bg-backdrop-low min-h-screen">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
					<div className="flex flex-col lg:flex-row gap-8">
						{/* Sidebar Navigation */}
						<aside className="lg:w-64 flex-shrink-0">
							<div className="sticky top-8">
								<h2 className="text-lg font-semibold text-neutral-high mb-4">
									Support Documentation
								</h2>
								<nav className="space-y-1">
									{(supportNav || supportPages).map((page) => {
										// Calculate depth based on parentId (simple: if has parent, depth=1)
										const hasParent = page.parentId !== null && page.parentId !== undefined
										const indentClass = hasParent ? 'pl-6' : ''

										return (
											<Link
												key={page.id}
												href={page.url || `/support/${page.slug}`}
												className={`block px-3 py-2 rounded text-sm transition-colors ${indentClass} ${page.id === post.id
													? 'bg-standout text-on-standout font-medium'
													: 'text-neutral-medium hover:bg-backdrop-medium hover:text-neutral-high'
													}`}
											>
												{page.title}
											</Link>
										)
									})}
								</nav>
							</div>
						</aside>

						{/* Main Content */}
						<div className="flex-1 min-w-0">
							{/* Page Title */}
							<h1 className="text-4xl font-bold text-neutral-high mb-8 px-4 sm:px-6 lg:px-8">{post.title}</h1>

							{/* Modules */}
							<div className="space-y-0">
								{modules.map((module) => {
									const Component = getModuleComponent(module.type)
									if (!Component) {
										return null
									}
									return (
										<div key={module.id}>
											<Component {...module.props} />
										</div>
									)
								})}
							</div>
						</div>
					</div>
				</div>
			</main>

			<SiteFooter />
		</>
	)
}

