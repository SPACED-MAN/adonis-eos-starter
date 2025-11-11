/**
 * Public Post Page
 *
 * Displays a post with its modules.
 * Modules are rendered using React components for SSR + hydration.
 */

import * as Modules from '../../modules'
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
}

export default function Post({ post, modules }: PostPageProps) {
	return (
		<>
			{/* Post Header */}
			<header className="bg-bg-50 py-12">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="max-w-4xl mx-auto">
						<h1 className="text-4xl sm:text-5xl font-bold text-neutral-900 mb-4">
							{post.title}
						</h1>
						{post.excerpt && (
							<p className="text-xl text-neutral-600">{post.excerpt}</p>
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
							<div key={module.id} className="border border-red-500 bg-red-50 p-4">
								<p>Module not found: {module.type}</p>
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

