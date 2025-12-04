import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'

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
    
    // Get support post for linking
    const gettingStartedPost = await db.from('posts').where('slug', 'getting-started').where('type', 'support').first()
    const indexPost = await db.from('posts').where('slug', 'index').where('type', 'support').first()

    const now = new Date()
    const postId = randomUUID()
    const heroModuleId = randomUUID()
    const featuresModuleId = randomUUID()

    // Create homepage post
    await db.table('posts').insert({
      id: postId,
      title: 'Home',
      slug: 'home',
      type: 'page',
      status: 'published',
      locale: 'en',
      user_id: admin.id,
      author_id: admin.id,
      meta_title: 'Adonis EOS - Modern Content Management System',
      meta_description:
        'Build beautiful, performant websites with Adonis EOS. A modern CMS built on AdonisJS with modular architecture, multi-language support, and powerful content workflows.',
      created_at: now,
      updated_at: now,
    })

    console.log(`   ✓ Homepage post created with ID: ${postId}`)

    // Create Hero module
    await db.table('module_instances').insert({
      id: heroModuleId,
      type: 'hero-with-callout',
      scope: 'post',
      post_id: postId,
      props: JSON.stringify({
        title: 'Build the web your way',
        subtitle:
          'Adonis EOS is a modern content management system built for developers and content creators. Create beautiful, performant websites with a modular architecture, powerful workflows, and an intuitive editing experience.',
        backgroundImage: null,
        backgroundColor: 'bg-backdrop-low',
        primaryCta: {
          text: 'View Documentation',
          url: gettingStartedPost ? `/support/${gettingStartedPost.slug}` : '/support/getting-started',
          style: 'primary',
        },
        secondaryCta: {
          text: 'AdonisJS Docs',
          url: 'https://docs.adonisjs.com',
          style: 'secondary',
          external: true,
        },
        callout: {
          title: '📚 Comprehensive Documentation',
          description:
            'Everything you need to get started, from installation to advanced features. Browse our complete documentation to learn about building modules, managing content, and customizing your site.',
          ctaText: 'Browse Documentation',
          ctaUrl: indexPost ? `/support/${indexPost.slug}` : '/support/index',
          ctaStyle: 'primary',
        },
      }),
      created_at: now,
      updated_at: now,
    })

    console.log(`   ✓ Hero module created`)

    // Create Features module
    await db.table('module_instances').insert({
      id: featuresModuleId,
      type: 'features-list',
      scope: 'post',
      post_id: postId,
      props: JSON.stringify({
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
      }),
      created_at: now,
      updated_at: now,
    })

    console.log(`   ✓ Features module created`)

    // Link modules to post
    await db.table('post_modules').insert([
      {
        id: randomUUID(),
        post_id: postId,
        module_id: heroModuleId,
        order_index: 0,
        overrides: JSON.stringify({}),
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        post_id: postId,
        module_id: featuresModuleId,
        order_index: 1,
        overrides: JSON.stringify({}),
        created_at: now,
        updated_at: now,
      },
    ])

    console.log(`   ✓ Modules linked to homepage`)
    console.log(`\n✅ Homepage created successfully!`)
  }
}
