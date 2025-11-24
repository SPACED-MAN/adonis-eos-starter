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
}

export default function Post({ post, modules, seo }: PostPageProps) {
	const PageComponent = getPostTypePageComponent(post.type)
	return <PageComponent post={post} modules={modules} seo={seo} />
}

