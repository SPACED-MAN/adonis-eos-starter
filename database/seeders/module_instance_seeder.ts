import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'

export default class ModuleInstanceSeeder extends BaseSeeder {
	public static environment = ['development']

	public async run() {
		const nowTs = new Date()

		// Ensure a baseline user exists (re-use the smoke test user)
		let user = await User.findBy('email', 'test@example.com')
		if (!user) {
			user = await User.create({
				email: 'test@example.com',
				password: 'password',
			})
		}

		// Ensure a page-type post exists for the Module Catalog
		const [catalogPostRow] = await db
			.from('posts')
			.where({ type: 'page', slug: 'module-catalog', locale: 'en' })
			.limit(1)
		let catalogPost: any = catalogPostRow

		if (!catalogPost) {
			const [createdCatalogPost] = await db
				.table('posts')
				.insert({
					type: 'page',
					slug: 'module-catalog',
					title: 'Module Catalog',
					excerpt: 'Showcase of all content modules with sample configurations.',
					status: 'draft',
					locale: 'en',
					user_id: user.id,
					meta_title: 'Module Catalog',
					meta_description: 'Showcase of all content modules for design and QA.',
					robots_json: JSON.stringify({ index: false, follow: true }),
					created_at: nowTs,
					updated_at: nowTs,
				})
				.returning('*')
			catalogPost = createdCatalogPost
			console.log('✅ [ModuleInstanceSeeder] Created Module Catalog post:', catalogPost.slug)
		} else {
			console.log('ℹ️ [ModuleInstanceSeeder] Module Catalog post already exists')
		}

		// Ensure demo-placeholder media asset exists
		const [existingDemoMedia] = await db
			.from('media_assets')
			.where('original_filename', 'demo-placeholder.jpg')
			.limit(1)

		let demoMedia = existingDemoMedia as any
		if (!demoMedia) {
			const thumbVariant = {
				name: 'thumb',
				url: '/uploads/demo-placeholder.jpg',
				width: null,
				height: null,
				size: 0,
			}

			const [createdDemoMedia] = await db
				.table('media_assets')
				.insert({
					url: '/uploads/demo-placeholder.jpg',
					original_filename: 'demo-placeholder.jpg',
					mime_type: 'image/jpeg',
					size: 0,
					alt_text: 'Factory placeholder image',
					caption: 'Generic factory-style placeholder image for content module examples.',
					description: 'Factory-themed demo image used to showcase content modules (hero, kitchen sink, etc.).',
					categories: db.raw('ARRAY[]::text[]') as any,
					metadata: { variants: [thumbVariant] } as any,
					created_at: nowTs,
					updated_at: nowTs,
				})
				.returning('*')
			demoMedia = createdDemoMedia
			console.log('✅ [ModuleInstanceSeeder] Seeded demo media asset for Module Catalog:', (demoMedia as any).id)
		} else {
			console.log('ℹ️ [ModuleInstanceSeeder] Demo media asset already exists; skipping create')
		}

		// Ensure core demo module instances exist for the catalog

		// Hero (static-style) instance
		const existingHeroInstance = await db
			.from('module_instances')
			.where({ type: 'hero', scope: 'post' })
			.first()

		let heroInstance: any = existingHeroInstance
		if (!heroInstance) {
			const [createdHero] = await db
				.table('module_instances')
				.insert({
					type: 'hero',
					scope: 'post',
					props: {
						title: 'Hero (Static)',
						subtitle: 'Classic hero module using static SSR rendering.',
					},
					created_at: nowTs,
					updated_at: nowTs,
				})
				.returning('*')
			heroInstance = createdHero
			console.log('✅ [ModuleInstanceSeeder] Created hero module instance')
		} else {
			console.log('ℹ️ [ModuleInstanceSeeder] hero module instance already exists; reusing')
		}

		// Hero with Media instance
		const existingHeroWithMedia = await db
			.from('module_instances')
			.where({ type: 'hero-with-media', scope: 'post' })
			.first()

		let heroWithMediaInstance: any = existingHeroWithMedia
		if (!heroWithMediaInstance) {
			const [createdHeroWithMedia] = await db
				.table('module_instances')
				.insert({
					type: 'hero-with-media',
					scope: 'post',
					props: {
						title: 'Hero with Media',
						subtitle:
							'Two-column hero with media and dual CTAs. Uses project-neutral color tokens.',
						image: (demoMedia as any).id,
						imageAlt: 'Hero with Media example',
						imagePosition: 'right',
						primaryCta: {
							label: 'Get started',
							url: '#',
							style: 'primary',
							target: '_self',
						},
						secondaryCta: {
							label: 'Speak to Sales',
							url: '#',
							style: 'outline',
							target: '_self',
						},
						backgroundColor: 'bg-backdrop-low',
					},
					created_at: nowTs,
					updated_at: nowTs,
				})
				.returning('*')
			heroWithMediaInstance = createdHeroWithMedia
			console.log('✅ [ModuleInstanceSeeder] Created hero-with-media module instance')
		} else {
			console.log('ℹ️ [ModuleInstanceSeeder] hero-with-media module instance already exists; reusing')
		}

		// Prose instance
		const existingProseInstance = await db
			.from('module_instances')
			.where({ type: 'prose', scope: 'post' })
			.first()

		let proseInstance: any = existingProseInstance
		if (!proseInstance) {
			const [createdProse] = await db
				.table('module_instances')
				.insert({
					type: 'prose',
					scope: 'post',
					props: {
						content: {
							root: {
								type: 'root',
								children: [
									{
										type: 'paragraph',
										children: [
											{
												type: 'text',
												text: 'This is the Prose module, rendering rich text content.',
											},
										],
									},
								],
							},
						},
					},
					created_at: nowTs,
					updated_at: nowTs,
				})
				.returning('*')
			proseInstance = createdProse
			console.log('✅ [ModuleInstanceSeeder] Created prose module instance')
		} else {
			console.log('ℹ️ [ModuleInstanceSeeder] prose module instance already exists; reusing')
		}

		// Feed instance
		const existingFeedInstance = await db
			.from('module_instances')
			.where({ type: 'feed', scope: 'post' })
			.first()

		let feedInstance: any = existingFeedInstance
		if (!feedInstance) {
			const [createdFeed] = await db
				.table('module_instances')
				.insert({
					type: 'feed',
					scope: 'post',
					props: {
						title: 'Recent Blog Posts',
						postTypes: ['blog'],
						limit: 5,
						showExcerpt: true,
					},
					created_at: nowTs,
					updated_at: nowTs,
				})
				.returning('*')
			feedInstance = createdFeed
			console.log('✅ [ModuleInstanceSeeder] Created feed module instance')
		} else {
			console.log('ℹ️ [ModuleInstanceSeeder] feed module instance already exists; reusing')
		}

		// Kitchen Sink instance
		const existingKitchenSink = await db
			.from('module_instances')
			.where({ type: 'kitchen-sink', scope: 'post' })
			.first()

		let kitchenSinkInstance: any = existingKitchenSink
		if (!kitchenSinkInstance) {
			const [createdKitchenSink] = await db
				.table('module_instances')
				.insert({
					type: 'kitchen-sink',
					scope: 'post',
					props: {
						title: 'Kitchen Sink Demo',
						description: 'Demonstration of all supported field types, including media.',
						count: 3,
						category: 'general',
						tags: ['alpha', 'beta'],
						featured: true,
						publishDate: new Date().toISOString().slice(0, 10),
						linkUrl: 'https://example.com',
						image: (demoMedia as any).id,
						imageVariant: 'large',
						metadata: {
							author: 'Demo Author',
							readingTime: 5,
							attributionRequired: false,
						},
						items: [
							{ label: 'First', value: 'One', highlight: true },
							{ label: 'Second', value: 'Two', highlight: false },
						],
						content: {
							root: {
								type: 'root',
								children: [
									{
										type: 'paragraph',
										children: [
											{
												type: 'text',
												text: 'This is a rich text field powered by Lexical, shown inside the Kitchen Sink example.',
											},
										],
									},
								],
							},
						},
					},
					created_at: nowTs,
					updated_at: nowTs,
				})
				.returning('*')
			kitchenSinkInstance = createdKitchenSink
			console.log('✅ [ModuleInstanceSeeder] Created kitchen-sink module instance')
		} else {
			console.log('ℹ️ [ModuleInstanceSeeder] kitchen-sink module instance already exists; reusing')
		}

		// Ensure hero-with-callout module instance exists
		const existingHeroCentered = await db
			.from('module_instances')
			.where({ type: 'hero-with-callout', scope: 'post' })
			.first()

		let heroCenteredInstance: any = existingHeroCentered
		if (!heroCenteredInstance) {
			const [createdHeroCentered] = await db
				.table('module_instances')
				.insert({
					type: 'hero-with-callout',
					scope: 'post',
					props: {
						title: 'We invest in the world’s potential',
						subtitle:
							'This hero demonstrates a centered layout using neutral project tokens.',
						primaryCta: {
							label: 'Explore modules',
							url: '#',
							target: '_self',
						},
						backgroundColor: 'bg-backdrop-low',
					},
					created_at: nowTs,
					updated_at: nowTs,
				})
				.returning('*')
			heroCenteredInstance = createdHeroCentered
			console.log('✅ [ModuleInstanceSeeder] Created hero-with-callout module instance')
		} else {
			console.log('ℹ️ [ModuleInstanceSeeder] hero-with-callout module instance already exists; reusing')
		}

		// Attach each demo module to the catalog post if not already attached
		async function ensureAttached(moduleId: string, label: string) {
			const existing = await db
				.from('post_modules')
				.where({
					post_id: catalogPost.id,
					module_id: moduleId,
				})
				.first()

			if (existing) {
				console.log(`ℹ️ [ModuleInstanceSeeder] ${label} already attached to Module Catalog`)
				return
			}

			const maxOrder = await db
				.from('post_modules')
				.where('post_id', catalogPost.id)
				.max('order_index as max')
			const nextOrder = Number((maxOrder[0] as any)?.max ?? 0) + 1

			await db.table('post_modules').insert({
				post_id: catalogPost.id,
				module_id: moduleId,
				order_index: nextOrder,
				overrides: null,
				created_at: nowTs,
				updated_at: nowTs,
			})

			console.log(`✅ [ModuleInstanceSeeder] Attached ${label} to Module Catalog`)
		}

		await ensureAttached(String(heroInstance.id), 'hero module')
		await ensureAttached(String(heroWithMediaInstance.id), 'hero-with-media module')
		await ensureAttached(String(heroCenteredInstance.id), 'hero-with-callout module')
		await ensureAttached(String(proseInstance.id), 'prose module')
		await ensureAttached(String(feedInstance.id), 'feed module')
		await ensureAttached(String(kitchenSinkInstance.id), 'kitchen-sink module')
	}
}


