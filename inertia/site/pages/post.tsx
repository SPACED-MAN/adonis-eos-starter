/**
 * Public Post Page
 *
 * Displays a post with its modules.
 * Modules are rendered using React components for SSR + hydration.
 */

import * as Modules from '../../modules'

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
			<header className="bg-sand-50 dark:bg-sand-900 py-12">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="max-w-4xl mx-auto">
						<h1 className="text-4xl sm:text-5xl font-bold text-sand-900 dark:text-sand-50 mb-4">
							{post.title}
						</h1>
						{post.excerpt && (
							<p className="text-xl text-sand-600 dark:text-sand-400">{post.excerpt}</p>
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

