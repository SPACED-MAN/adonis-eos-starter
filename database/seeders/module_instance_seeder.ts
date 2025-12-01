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
							url: { kind: 'url', url: '#' },
							style: 'primary',
							target: '_self',
						},
						secondaryCta: {
							label: 'Speak to Sales',
							url: { kind: 'url', url: '#' },
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

		// Features List instance
		const existingFeaturesList = await db
			.from('module_instances')
			.where({ type: 'features-list', scope: 'post' })
			.first()

		let featuresListInstance: any = existingFeaturesList
		if (!featuresListInstance) {
			const [createdFeaturesList] = await db
				.table('module_instances')
				.insert({
					type: 'features-list',
					scope: 'post',
					props: {
						title: 'Designed for business teams like yours',
						subtitle:
							'We focus on markets where technology, innovation, and capital can unlock long-term value and drive growth.',
						features: [
							{
								icon: 'fa-solid fa-bullhorn',
								title: 'Marketing',
								body: 'Plan it, create it, launch it. Collaborate seamlessly across the organization and hit your marketing goals every month.',
							},
							{
								icon: 'fa-solid fa-scale-balanced',
								title: 'Legal',
								body: 'Protect your organization and stay compliant with structured workflows and granular permissions.',
							},
							{
								icon: 'fa-solid fa-gear',
								title: 'Business Automation',
								body: 'Automate handoffs, notifications, and approvals so your team can focus on high‑value work.',
							},
							{
								icon: 'fa-solid fa-coins',
								title: 'Finance',
								body: 'Audit‑ready workflows for close, forecasting, and quarterly budgeting.',
							},
							{
								icon: 'fa-solid fa-pen-ruler',
								title: 'Enterprise Design',
								body: 'Craft consistent experiences for both marketing and product with shared systems.',
							},
							{
								icon: 'fa-solid fa-diagram-project',
								title: 'Operations',
								body: 'Keep the business running smoothly with repeatable, measurable processes.',
							},
						],
						backgroundColor: 'bg-backdrop-low',
					},
					created_at: nowTs,
					updated_at: nowTs,
				})
				.returning('*')
			featuresListInstance = createdFeaturesList
			console.log('✅ [ModuleInstanceSeeder] Created features-list module instance')
		} else {
			console.log('ℹ️ [ModuleInstanceSeeder] features-list module instance already exists; reusing')
		}

		// Prose with Media instance
		const existingProseWithMedia = await db
			.from('module_instances')
			.where({ type: 'prose-with-media', scope: 'post' })
			.first()

		let proseWithMediaInstance: any = existingProseWithMedia
		if (!proseWithMediaInstance) {
			const [createdProseWithMedia] = await db
				.table('module_instances')
				.insert({
					type: 'prose-with-media',
					scope: 'post',
					props: {
						title: "Let's create more tools and ideas that bring us together.",
						body:
							'This layout pairs narrative content with a focused visual, ideal for feature callouts, product explainers, and lightweight storytelling.',
						image: (demoMedia as any).id,
						imageAlt: 'Prose with Media example',
						imagePosition: 'left',
						primaryCta: {
							label: 'Get started',
							url: { kind: 'url', url: '#' },
							target: '_self',
						},
						backgroundColor: 'bg-backdrop-low',
					},
					created_at: nowTs,
					updated_at: nowTs,
				})
				.returning('*')
			proseWithMediaInstance = createdProseWithMedia
			console.log('✅ [ModuleInstanceSeeder] Created prose-with-media module instance')
		} else {
			console.log('ℹ️ [ModuleInstanceSeeder] prose-with-media module instance already exists; reusing')
		}

		// Statistics instance
		const existingStatistics = await db
			.from('module_instances')
			.where({ type: 'statistics', scope: 'post' })
			.first()

		let statisticsInstance: any = existingStatistics
		if (!statisticsInstance) {
			const [createdStatistics] = await db
				.table('module_instances')
				.insert({
					type: 'statistics',
					scope: 'post',
					props: {
						stats: [
							{ value: 73_000_000, suffix: 'M+', label: 'developers' },
							{ value: 1_000_000_000, suffix: 'B+', label: 'contributors' },
							{ value: 4_000_000, suffix: 'M+', label: 'organizations' },
						],
						backgroundColor: 'bg-backdrop-low',
					},
					created_at: nowTs,
					updated_at: nowTs,
				})
				.returning('*')
			statisticsInstance = createdStatistics
			console.log('✅ [ModuleInstanceSeeder] Created statistics module instance')
		} else {
			console.log('ℹ️ [ModuleInstanceSeeder] statistics module instance already exists; reusing')
		}

		// Profile List instance
		const existingProfileList = await db
			.from('module_instances')
			.where({ type: 'profile-list', scope: 'post' })
			.first()

		let profileListInstance: any = existingProfileList
		if (!profileListInstance) {
			const [createdProfileList] = await db
				.table('module_instances')
				.insert({
					type: 'profile-list',
					scope: 'post',
					props: {
						title: 'Meet the Team',
						subtitle:
							'Profiles are powered by the Profile post type. Add or edit profiles in the CMS and they will appear here automatically.',
						profiles: [],
					},
					created_at: nowTs,
					updated_at: nowTs,
				})
				.returning('*')
			profileListInstance = createdProfileList
			console.log('✅ [ModuleInstanceSeeder] Created profile-list module instance')
		} else {
			console.log('ℹ️ [ModuleInstanceSeeder] profile-list module instance already exists; reusing')
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
							url: { kind: 'url', url: '#' },
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

		await ensureAttached(String(heroWithMediaInstance.id), 'hero-with-media module')
		await ensureAttached(String(heroCenteredInstance.id), 'hero-with-callout module')
		await ensureAttached(String(featuresListInstance.id), 'features-list module')
		await ensureAttached(String(proseWithMediaInstance.id), 'prose-with-media module')
		await ensureAttached(String(statisticsInstance.id), 'statistics module')
		await ensureAttached(String(profileListInstance.id), 'profile-list module')
		await ensureAttached(String(proseInstance.id), 'prose module')
		await ensureAttached(String(feedInstance.id), 'feed module')
		await ensureAttached(String(kitchenSinkInstance.id), 'kitchen-sink module')
	}
}


