import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Get file size in bytes for a given public URL
 */
async function getFileSize(publicUrl: string): Promise<number> {
  try {
    const filePath = path.join(process.cwd(), 'public', publicUrl.replace(/^\//, ''))
    const stats = await fs.stat(filePath)
    return stats.size
  } catch {
    return 0
  }
}

export default class extends BaseSeeder {
  public static environment = ['development']
  async run() {
    // NOTE: This seeder creates bulk test data for smoke testing.
    // It uses direct inserts for performance, which is acceptable for test data.
    // Production seeders MUST use CreatePost action instead.

    console.log('🧪 Running smoke tests for database schema (with i18n support)...')

    // Ensure locales exist for FK constraints
    const now = new Date()
    await db.rawQuery(
      `
      INSERT INTO locales (code, is_enabled, is_default, created_at, updated_at)
      VALUES 
        (?, TRUE, TRUE, ?, ?),
        (?, TRUE, FALSE, ?, ?)
      ON CONFLICT (code) DO UPDATE
      SET 
        is_enabled = EXCLUDED.is_enabled,
        is_default = EXCLUDED.is_default,
        updated_at = EXCLUDED.updated_at
      `,
      ['en', now, now, 'es', now, now]
    )

    // Get or create a test user for posts
    let user = await User.findBy('email', 'test@example.com')
    if (!user) {
      user = await User.create({
        email: 'test@example.com',
        password: 'password',
      })
    }

    // Lookup demo-blog media asset (for featured images on Blog posts)
    const [demoBlogMedia] = await db
      .from('media_assets')
      .where('original_filename', 'demo-blog.jpg')
      .limit(1)
    const demoBlogId: string | null = demoBlogMedia ? String((demoBlogMedia as any).id) : null

    // Test 1: Ensure a Blog template exists (prefer registry-synced blog-default, but create if missing)
    const existingTemplate = await db.from('templates').where({ post_type: 'blog' }).first()
    let template: any = existingTemplate
    if (!template) {
      const [createdTemplate] = await db
        .table('templates')
        .insert({
          name: 'blog-default',
          post_type: 'blog',
          description: 'Default Blog Template',
          locked: false,
          created_at: now,
          updated_at: now,
        })
        .returning('*')
      template = createdTemplate
      console.log('✅ Created fallback blog template:', (template as any).name)
    } else {
      console.log('✅ Using blog template:', (template as any).name)
    }

    // Test 2: Add modules to template (use hero-with-callout as default hero)
    await db.table('template_modules').insert({
      template_id: template.id,
      type: 'hero-with-callout',
      default_props: JSON.stringify({ title: 'Default Hero', subtitle: 'Powered by modules' }),
      order_index: 0,
      locked: true,
      created_at: new Date(),
      updated_at: new Date(),
    })
    console.log('✅ Created template module')

    // Test 3: Create a post with template (default locale)
    const [post] = await db
      .table('posts')
      .insert({
        type: 'blog',
        slug: 'test-post',
        title: 'Test Blog Post',
        status: 'draft',
        locale: 'en',
        template_id: template.id,
        user_id: user.id,
        excerpt:
          'This is a seeded excerpt for the primary test blog post, shown in Blog List teasers.',
        meta_title: 'Test Meta Title',
        meta_description: 'Test meta description',
        robots_json: JSON.stringify({ index: true, follow: true }),
        // Seed featured image for primary test blog post (if demo-blog exists)
        featured_image_id: demoBlogId,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*')
    console.log('✅ Created post (en):', post.slug)

    // Test 3b: Create a Spanish translation
    const [postEs] = await db
      .table('posts')
      .insert({
        type: 'blog',
        slug: 'publicacion-de-prueba',
        title: 'Publicación de Prueba',
        status: 'draft',
        locale: 'es',
        translation_of_id: post.id,
        template_id: template.id,
        user_id: user.id,
        meta_title: 'Título Meta de Prueba',
        meta_description: 'Descripción meta de prueba',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*')
    console.log('✅ Created post translation (es):', postEs.slug)

    // Test 3c: Create bulk posts to exercise pagination (en/es)
    {
      const statuses = ['draft', 'scheduled', 'published', 'archived'] as const
      const nowTimestamp = Date.now()
      const bulkRows: any[] = []
      for (let i = 1; i <= 120; i++) {
        const loc = i % 2 === 0 ? 'en' : 'es'
        bulkRows.push({
          type: 'blog',
          slug: `seed-post-${i}-${loc}`,
          title: `Seed Post ${i} (${loc.toUpperCase()})`,
          status: statuses[i % statuses.length],
          locale: loc,
          translation_of_id: null,
          template_id: template.id,
          user_id: user.id,
          excerpt: `This is a seeded excerpt for Seed Post ${i} (${loc.toUpperCase()}) to demonstrate Blog List teasers.`,
          meta_title: null,
          meta_description: `Seeded description ${i}`,
          robots_json: JSON.stringify({ index: i % 5 !== 0, follow: true }),
          // Apply demo-blog featured image to all English-language blog seeds
          featured_image_id: loc === 'en' && demoBlogId ? demoBlogId : null,
          created_at: new Date(nowTimestamp - i * 3600 * 1000),
          updated_at: new Date(nowTimestamp - i * 3500 * 1000),
        })
      }
      await db.table('posts').insert(bulkRows)
      console.log(`✅ Seeded ${bulkRows.length} additional posts for pagination testing`)
    }

    // Test 4: Create global module (hero-with-callout)
    const [globalModule] = await db
      .table('module_instances')
      .insert({
        scope: 'global',
        type: 'hero-with-callout',
        global_slug: 'main-hero',
        props: JSON.stringify({ title: 'Welcome', subtitle: 'To our site' }),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*')
    console.log('✅ Created global module:', globalModule.global_slug)

    // Test 5: Attach module to post
    await db.table('post_modules').insert({
      post_id: post.id,
      module_id: globalModule.id,
      order_index: 0,
      overrides: JSON.stringify({ title: 'Post-specific title' }),
      created_at: new Date(),
      updated_at: new Date(),
    })
    console.log('✅ Attached module to post')

    // Test 6: Create URL patterns (with locale support), idempotent
    {
      const nowTs = new Date()
      const existing = await db
        .from('url_patterns')
        .whereIn('locale', ['en', 'es'])
        .andWhere('post_type', 'blog')
      const hasEn = existing.some((r: any) => (r as any).locale === 'en')
      const hasEs = existing.some((r: any) => (r as any).locale === 'es')
      const toInsert: any[] = []
      if (!hasEn) {
        toInsert.push({
          post_type: 'blog',
          locale: 'en',
          pattern: '/blog/{path}',
          is_default: true,
          created_at: nowTs,
          updated_at: nowTs,
        })
      }
      if (!hasEs) {
        toInsert.push({
          post_type: 'blog',
          locale: 'es',
          pattern: '/{locale}/blog/{path}',
          is_default: true,
          created_at: nowTs,
          updated_at: nowTs,
        })
      }
      if (toInsert.length > 0) {
        await db.table('url_patterns').insert(toInsert)
      }
      console.log('✅ Ensured URL patterns (en, es)')
    }

    // Test 7: Create redirects (with locale support)
    await db.table('url_redirects').insert([
      {
        from_path: '/old-post',
        to_path: '/blog/2025/test-post',
        http_status: 301,
        locale: 'en',
        post_id: post.id,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        from_path: '/es/publicacion-antigua',
        to_path: '/es/blog/2025/publicacion-de-prueba',
        http_status: 301,
        locale: 'es',
        post_id: postEs.id,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ])
    console.log('✅ Created URL redirects (en, es)')

    // Test 8: Seed a "Module Catalog" page showcasing available modules (development helper)
    {
      const nowTs = new Date()
      // Ensure a page-type post exists for the catalog
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
        console.log('✅ Created Module Catalog post:', catalogPost.slug)
      } else {
        console.log('✅ Module Catalog post already exists, skipping create')
      }


      // Only seed initial modules if this catalog page has no modules attached yet
      const existingCatalogModules = await db
        .from('post_modules')
        .where('post_id', catalogPost.id)
        .count('* as total')
      const existingCount = Number((existingCatalogModules[0] as any)?.total || 0)

      if (existingCount === 0) {
        // Optionally seed a demo media asset for modules that showcase imagery
        const [existingDemoMedia] = await db
          .from('media_assets')
          .where('original_filename', 'demo-placeholder.jpg')
          .limit(1)

        let demoMedia = existingDemoMedia as any
        if (!demoMedia) {
          const demoPlaceholderSize = await getFileSize('/uploads/demo-placeholder.jpg')
          const thumbVariant = {
            name: 'thumb',
            url: '/uploads/demo-placeholder.jpg',
            width: null,
            height: null,
            size: demoPlaceholderSize,
          }

          const [createdDemoMedia] = await db
            .table('media_assets')
            .insert({
              url: '/uploads/demo-placeholder.jpg',
              original_filename: 'demo-placeholder.jpg',
              mime_type: 'image/jpeg',
              size: demoPlaceholderSize,
              alt_text: 'Factory placeholder image',
              caption: 'Generic factory-style placeholder image for content module examples.',
              description:
                'Factory-themed demo image used to showcase content modules (hero, kitchen sink, etc.).',
              categories: db.raw('ARRAY[]::text[]') as any,
              metadata: { variants: [thumbVariant] } as any,
              created_at: nowTs,
              updated_at: nowTs,
            })
            .returning('*')
          demoMedia = createdDemoMedia
          console.log('✅ Seeded demo media asset for Module Catalog:', (demoMedia as any).id)
        } else {
          console.log('✅ Demo media asset for Module Catalog already exists, skipping create')
        }

        // Create a few illustrative modules; keep simple and deterministic
        const [heroInstance] = await db
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

        const [heroWithMediaInstance] = await db
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

        const [proseInstance] = await db
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

        const [heroWithCalloutInstance] = await db
          .table('module_instances')
          .insert({
            type: 'hero-with-callout',
            scope: 'post',
            props: {
              title: "We invest in the world's potential",
              subtitle: 'This hero demonstrates a centered layout using neutral project tokens.',
              callouts: [
                {
                  label: 'Explore modules',
                  url: { kind: 'url', url: '#' },
                  target: '_self',
                },
              ],
              backgroundColor: 'bg-backdrop-low',
            },
            created_at: nowTs,
            updated_at: nowTs,
          })
          .returning('*')

        const [featuresListInstance] = await db
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

        const [proseWithMediaInstance] = await db
          .table('module_instances')
          .insert({
            type: 'prose-with-media',
            scope: 'post',
            props: {
              title: "Let's create more tools and ideas that bring us together.",
              body: 'This layout pairs narrative content with a focused visual, ideal for feature callouts, product explainers, and lightweight storytelling.',
              image: (demoMedia as any).id,
              imageAlt: 'Prose with Media example',
              imagePosition: 'left',
              primaryCta: {
                label: 'Get started',
                url: '#',
                target: '_self',
              },
              backgroundColor: 'bg-backdrop-low',
            },
            created_at: nowTs,
            updated_at: nowTs,
          })
          .returning('*')

        const [statisticsInstance] = await db
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

        const [kitchenSinkInstance] = await db
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

        // Attach in a sensible order near the top of the page
        const catalogModulesToAttach = [
          { instanceId: heroInstance.id, orderIndex: 0 },
          { instanceId: heroWithMediaInstance.id, orderIndex: 1 },
          { instanceId: heroWithCalloutInstance.id, orderIndex: 2 },
          { instanceId: featuresListInstance.id, orderIndex: 3 },
          { instanceId: proseWithMediaInstance.id, orderIndex: 4 },
          { instanceId: statisticsInstance.id, orderIndex: 5 },
          { instanceId: proseInstance.id, orderIndex: 6 },
          { instanceId: kitchenSinkInstance.id, orderIndex: 7 },
        ]

        for (const row of catalogModulesToAttach) {
          await db.table('post_modules').insert({
            post_id: catalogPost.id,
            module_id: row.instanceId,
            order_index: row.orderIndex,
            overrides: null,
            created_at: nowTs,
            updated_at: nowTs,
          })
        }

        console.log(
          '✅ Seeded Module Catalog modules (hero, hero-with-media, hero-centered, prose, kitchen-sink)'
        )
      } else {
        console.log('ℹ️ Module Catalog already has modules; skipping initial module seeding')

        // Ensure the new "hero-with-callout" module type is present and attached for existing catalogs
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
                title: "We invest in the world's potential",
                subtitle: 'This hero demonstrates a centered layout using neutral project tokens.',
                callouts: [
                  {
                    label: 'Explore modules',
                    url: '#',
                    target: '_self',
                  },
                ],
                backgroundColor: 'bg-backdrop-low',
              },
              created_at: nowTs,
              updated_at: nowTs,
            })
            .returning('*')
          heroCenteredInstance = createdHeroCentered
          console.log('✅ Created hero-with-callout module instance for existing Module Catalog')
        } else {
          console.log('ℹ️ hero-with-callout module instance already exists; skipping create')
        }

        // Attach hero-with-callout to the catalog post if not already attached
        const existingAttachment = await db
          .from('post_modules')
          .where({
            post_id: catalogPost.id,
            module_id: heroCenteredInstance.id,
          })
          .first()

        if (!existingAttachment) {
          const maxOrder = await db
            .from('post_modules')
            .where('post_id', catalogPost.id)
            .max('order_index as max')
          const nextOrder = Number((maxOrder[0] as any)?.max ?? 0) + 1

          await db.table('post_modules').insert({
            post_id: catalogPost.id,
            module_id: heroCenteredInstance.id,
            order_index: nextOrder,
            overrides: null,
            created_at: nowTs,
            updated_at: nowTs,
          })

          console.log('✅ Attached hero-with-callout module to existing Module Catalog')
        } else {
          console.log(
            'ℹ️ hero-with-callout module already attached to Module Catalog; skipping attach'
          )
        }
      }
    }

    // Test 9: Seed top-level marketing pages used by primary navigation
    {
      const nowTs = new Date()

      async function ensurePage(
        slug: string,
        title: string,
        excerpt: string,
        metaDescription: string
      ) {
        const [existing] = await db
          .from('posts')
          .where({ type: 'page', slug, locale: 'en' })
          .limit(1)

        if (existing) {
          console.log(`ℹ️ Page "${slug}" already exists, skipping create`)
          return
        }

        await db
          .table('posts')
          .insert({
            type: 'page',
            slug,
            title,
            excerpt,
            status: 'published',
            locale: 'en',
            user_id: user!.id,
            meta_title: title,
            meta_description: metaDescription,
            robots_json: JSON.stringify({ index: true, follow: true }),
            created_at: nowTs,
            updated_at: nowTs,
          })
        console.log(`✅ Created marketing page: ${slug}`)
      }

      await ensurePage(
        'learn-more',
        'Learn More about EOS',
        'Overview of the EOS starter kit, its architecture, and how it fits into your stack.',
        'Learn more about the EOS AdonisJS + Inertia starter: goals, architecture, and when to use it.'
      )
    }

    // Test 10-11: Custom fields (code-first only): store by slug in post_custom_field_values
    try {
      await db.table('post_custom_field_values').insert({
        id: crypto.randomUUID(),
        post_id: post.id,
        field_slug: 'author-bio',
        value: JSON.stringify('This is a code-first test author bio'),
        created_at: new Date(),
        updated_at: new Date(),
      })
      console.log('✅ Set custom field value by slug (code-first)')
    } catch {
      /* ignore */
    }

    // Test 11: Create module scope for testimonial-list module
    await db.table('module_scopes').insert({
      module_type: 'testimonial-list',
      post_type: 'testimonial',
    })
    console.log('✅ Created testimonial-list module scope restriction')

    console.log('\n✨ Smoke tests completed for database schema (with i18n).')
    console.log('📊 Summary:')
    console.log('  - Templates: ✓')
    console.log('  - Posts with translations: ✓')
    console.log('  - Modules: ✓')
    console.log('  - URL patterns (locale-aware): ✓')
    console.log('  - URL redirects (locale-aware): ✓')
    console.log('  - Custom fields: ✓')
    console.log('  - Module scopes: ✓')
  }
}
