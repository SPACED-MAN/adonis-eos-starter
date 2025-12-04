import { getPostTypePageComponent } from '../post-types/_resolver'

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
	[key: string]: any // Allow additional props for post-type-specific data
}

export default function Post(props: PostPageProps) {
	const PageComponent = getPostTypePageComponent(props.post.type)
	// Pass all props through to the post-type-specific component
	return <PageComponent {...props} />
}

