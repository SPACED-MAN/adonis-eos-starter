import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'

export default class extends BaseSeeder {
  async run() {
    // Clean up existing test data
    await db.rawQuery('TRUNCATE posts, module_instances, post_modules, templates, template_modules, url_patterns, url_redirects, module_scopes, custom_fields, post_type_custom_fields, post_custom_field_values CASCADE')

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

    // Test 1: Create a template
    const [template] = await db.table('templates').insert({
      name: 'test-blog-template',
      post_type: 'blog',
      description: 'Test blog template',
      locked: false,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('*')
    console.log('✅ Created template:', template.name)

    // Test 2: Add modules to template
    await db.table('template_modules').insert({
      template_id: template.id,
      type: 'hero',
      default_props: JSON.stringify({ title: 'Default Hero' }),
      order_index: 0,
      locked: true,
      created_at: new Date(),
      updated_at: new Date(),
    })
    console.log('✅ Created template module')

    // Test 3: Create a post with template (default locale)
    const [post] = await db.table('posts').insert({
      type: 'blog',
      slug: 'test-post',
      title: 'Test Blog Post',
      status: 'draft',
      locale: 'en',
      template_id: template.id,
      user_id: user.id,
      meta_title: 'Test Meta Title',
      meta_description: 'Test meta description',
      robots_json: JSON.stringify({ index: true, follow: true }),
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('*')
    console.log('✅ Created post (en):', post.slug)

    // Test 3b: Create a Spanish translation
    const [postEs] = await db.table('posts').insert({
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
    }).returning('*')
    console.log('✅ Created post translation (es):', postEs.slug)

    // Test 3c: Create bulk posts to exercise pagination (en/es)
    {
      const statuses = ['draft', 'review', 'scheduled', 'published', 'archived'] as const
      const now = Date.now()
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
          meta_title: null,
          meta_description: `Seeded description ${i}`,
          robots_json: JSON.stringify({ index: i % 5 !== 0, follow: true }),
          created_at: new Date(now - i * 3600 * 1000),
          updated_at: new Date(now - i * 3500 * 1000),
        })
      }
      await db.table('posts').insert(bulkRows)
      console.log(`✅ Seeded ${bulkRows.length} additional posts for pagination testing`)
    }

    // Test 4: Create global module
    const [globalModule] = await db.table('module_instances').insert({
      scope: 'global',
      type: 'hero',
      global_slug: 'main-hero',
      props: JSON.stringify({ title: 'Welcome', subtitle: 'To our site' }),
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('*')
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

    // Test 6: Create URL patterns (with locale support)
    await db.table('url_patterns').insert([
      {
        post_type: 'blog',
        locale: 'en',
        pattern: '/blog/{yyyy}/{slug}',
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        post_type: 'blog',
        locale: 'es',
        pattern: '/es/blog/{yyyy}/{slug}',
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ])
    console.log('✅ Created URL patterns (en, es)')

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

    // Test 8: Create custom fields (translatable and non-translatable)
    const [field] = await db.table('custom_fields').insert({
      slug: 'author-bio',
      label: 'Author Bio',
      field_type: 'textarea',
      config: JSON.stringify({ maxLength: 500 }),
      translatable: true,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('*')
    console.log('✅ Created translatable custom field:', field.slug)

    // Test 9: Attach field to post type
    await db.table('post_type_custom_fields').insert({
      post_type: 'blog',
      field_id: field.id,
    })
    console.log('✅ Attached field to post type')

    // Test 10: Set field value for post (with translations)
    await db.table('post_custom_field_values').insert([
      {
        post_id: post.id,
        field_id: field.id,
        value: JSON.stringify({
          en: 'This is a test author bio in English',
          es: 'Esta es una biografía de prueba del autor en español',
        }),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ])
    console.log('✅ Set translatable custom field value (en, es)')

    // Test 11: Create module scope
    await db.table('module_scopes').insert({
      module_type: 'testimonial-grid',
      post_type: 'testimonial',
    })
    console.log('✅ Created module scope restriction')

    console.log('\n✨ All smoke tests passed! Database schema with i18n is working correctly.')
    console.log('📊 Summary: 11 tests passed')
    console.log('  - Templates: ✓')
    console.log('  - Posts with translations: ✓')
    console.log('  - Modules: ✓')
    console.log('  - URL patterns (locale-aware): ✓')
    console.log('  - URL redirects (locale-aware): ✓')
    console.log('  - Custom fields (translatable): ✓')
    console.log('  - Module scopes: ✓')
  }
}