import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import CreatePost from '#actions/posts/create_post'
import AddModuleToPost from '#actions/posts/add_module_to_post'

/**
 * Homepage Seeder
 *
 * Uses CreatePost and AddModuleToPost actions - same code path as API endpoints.
 * This ensures:
 * - Module schema validation
 * - Proper business logic execution
 * - Same code path as AI agents and admin UI
 */
export default class extends BaseSeeder {
  async run() {
    // Get admin user ID
    const admin = await db.from('users').where('email', 'admin@example.com').first()
    if (!admin) {
      console.log('⚠️  Admin user not found. Run user_seeder first.')
      return
    }

    // Check if homepage already exists
    const existing = await db.from('posts').where('slug', 'home').where('type', 'page').first()
    if (existing) {
      console.log('ℹ️  Homepage already exists, skipping...')
      return
    }

    console.log('✨ Creating homepage...')

    try {
      // Step 1: Create the post using the CreatePost action
      const post = await CreatePost.handle({
        type: 'page',
        locale: 'en',
        slug: 'home',
        title: 'Home',
        status: 'published',
        metaTitle: 'Adonis EOS - Modern Content Management System',
        metaDescription:
          'Build beautiful, performant websites with Adonis EOS. A modern CMS built on AdonisJS with modular architecture, multi-language support, and powerful content workflows.',
        userId: admin.id,
      })

      console.log(`   ✓ Post created with ID: ${post.id}`)

      // Get developer documentation post for callout button
      // Look up documentation posts for callouts
      const [overviewPost, editorsPost, developerDocsPost] = await Promise.all([
        db
          .from('posts')
          .where('slug', 'overview')
          .where('type', 'documentation')
          .first(),
        db
          .from('posts')
          .where('slug', 'quick-start')
          .where('type', 'documentation')
          .first(),
        db
          .from('posts')
          .where('slug', 'getting-started')
          .where('type', 'documentation')
          .first(),
      ])

      // Step 2: Add modules using AddModuleToPost action (same as API endpoint)
      // Hero with Callouts module
      await AddModuleToPost.handle({
        postId: post.id,
        moduleType: 'hero-with-callout',
        scope: 'local',
        props: {
          title: 'Build the web your way',
          subtitle:
            'Adonis EOS is a modern content management system built for developers and content creators. Create beautiful, performant websites with a modular architecture, powerful workflows, and an intuitive editing experience.',
          callouts: [
            {
              label: 'Learn More',
              url: overviewPost
                ? {
                  kind: 'post',
                  postId: overviewPost.id,
                  slug: overviewPost.slug,
                  locale: overviewPost.locale || 'en',
                  target: '_self',
                }
                : { kind: 'url', url: 'https://adoniseos.com/docs', target: '_self' },
            },
            {
              label: 'For Editors',
              url: editorsPost
                ? {
                  kind: 'post',
                  postId: editorsPost.id,
                  slug: editorsPost.slug,
                  locale: editorsPost.locale || 'en',
                  target: '_self',
                }
                : { kind: 'url', url: 'https://adoniseos.com/docs/quick-start', target: '_self' },
            },
            {
              label: 'For Developers',
              url: developerDocsPost
                ? {
                  kind: 'post',
                  postId: developerDocsPost.id,
                  slug: developerDocsPost.slug,
                  locale: developerDocsPost.locale || 'en',
                  target: '_self',
                }
                : { kind: 'url', url: 'https://adoniseos.com/docs/getting-started', target: '_self' },
            },
          ],
          backgroundColor: 'bg-backdrop-low',
        },
        orderIndex: 0,
      })

      // Features module
      await AddModuleToPost.handle({
        postId: post.id,
        moduleType: 'features-list',
        scope: 'local',
        props: {
          title: 'Why Adonis EOS?',
          subtitle: 'Built for modern web development with everything you need out of the box',
          backgroundColor: 'bg-backdrop',
          features: [
            {
              icon: 'cube',
              title: 'Modular Architecture',
              description:
                'Build pages with reusable, composable modules. Create custom modules with our intuitive API and node ace commands.',
            },
            {
              icon: 'language',
              title: 'Multi-Language Support',
              description:
                'Built-in internationalization with locale-specific content, URL patterns, and translation workflows.',
            },
            {
              icon: 'users',
              title: 'Role-Based Access Control',
              description:
                'Fine-grained permissions system with customizable roles for admins, editors, and translators.',
            },
            {
              icon: 'code-branch',
              title: 'Content Workflows',
              description:
                'Review drafts, AI-assisted content, and approval workflows to ensure quality before publishing.',
            },
            {
              icon: 'palette',
              title: 'Fully Customizable',
              description:
                'Tailwind CSS theming, custom post types, taxonomies, and extensible module system.',
            },
            {
              icon: 'bolt',
              title: 'Developer Friendly',
              description:
                'Built on AdonisJS with TypeScript, Inertia.js, and React. Clean API, great DX, and comprehensive documentation.',
            },
          ],
        },
        orderIndex: 1,
      })

      console.log(`   ✓ Modules added via API action`)
      console.log(`✅ Homepage created successfully!`)
    } catch (error) {
      console.error('❌ Error creating homepage:', error)
      throw error
    }
  }
}
