import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import mediaService from '#services/media_service'

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
      console.log(
        '✅ [ModuleInstanceSeeder] Seeded demo media asset for Module Catalog:',
        (demoMedia as any).id
      )
    } else {
      console.log('ℹ️ [ModuleInstanceSeeder] Demo media asset already exists; skipping create')
    }

    // Ensure demo-blog hero image media asset exists (for seeded Blog posts)
    const [existingDemoBlog] = await db
      .from('media_assets')
      .where('original_filename', 'demo-blog.jpg')
      .limit(1)

    let demoBlogMedia = existingDemoBlog as any
    if (!demoBlogMedia) {
      const demoBlogSize = await getFileSize('/uploads/demo-blog.jpg')
      const [createdDemoBlog] = await db
        .table('media_assets')
        .insert({
          url: '/uploads/demo-blog.jpg',
          original_filename: 'demo-blog.jpg',
          mime_type: 'image/jpeg',
          size: demoBlogSize,
          alt_text: 'Demo blog hero image',
          caption: 'Demo hero image for seeded Blog posts.',
          description: 'Hero-style demo image used to illustrate Blog cards and listings.',
          categories: db.raw('ARRAY[]::text[]') as any,
          metadata: { variants: [] } as any,
          created_at: nowTs,
          updated_at: nowTs,
        })
        .returning('*')
      demoBlogMedia = createdDemoBlog
      console.log(
        '✅ [ModuleInstanceSeeder] Seeded demo-blog hero media asset for Blog posts:',
        (demoBlogMedia as any).id
      )
    } else {
      console.log(
        'ℹ️ [ModuleInstanceSeeder] Demo-blog hero media asset already exists; skipping create'
      )
    }

    // Ensure demo-avatar media asset exists (always seed, not conditional)
    const [existingAvatar] = await db
      .from('media_assets')
      .where('original_filename', 'demo-avatar.jpg')
      .limit(1)

    let avatarMedia = existingAvatar as any
    if (!avatarMedia) {
      const avatarSize = await getFileSize('/uploads/demo-avatar.jpg')
      const avatarVariant = {
        name: 'thumb',
        url: '/uploads/demo-avatar.jpg',
        width: null,
        height: null,
        size: avatarSize,
      }

      const [createdAvatar] = await db
        .table('media_assets')
        .insert({
          url: '/uploads/demo-avatar.jpg',
          original_filename: 'demo-avatar.jpg',
          mime_type: 'image/jpeg',
          size: avatarSize,
          alt_text: 'Demo avatar placeholder',
          caption: 'Demo avatar image for seeded Profiles.',
          description: 'Avatar-style demo image used to illustrate Profile cards.',
          categories: db.raw('ARRAY[]::text[]') as any,
          metadata: { variants: [avatarVariant] } as any,
          created_at: nowTs,
          updated_at: nowTs,
        })
        .returning('*')
      avatarMedia = createdAvatar
      console.log('✅ [ModuleInstanceSeeder] Seeded demo avatar media:', (avatarMedia as any).id)
    } else {
      console.log('ℹ️ [ModuleInstanceSeeder] Demo avatar media already exists; skipping create')
    }

    // Ensure a default Contact form exists for the Forms system
    const existingContactForm = await db.from('forms').where('slug', 'contact').first()
    if (!existingContactForm) {
      const contactFields = [
        { slug: 'name', label: 'Your Name', type: 'text', required: true },
        { slug: 'email', label: 'Your Email', type: 'email', required: true },
        { slug: 'company', label: 'Company', type: 'text', required: false },
        { slug: 'message', label: 'Your Message', type: 'textarea', required: true },
      ]
      const now = new Date()
      const [createdContactForm] = await db
        .table('forms')
        .insert({
          slug: 'contact',
          title: 'Contact Us',
          description: 'Reach out with questions, project ideas, or feedback.',
          fields_json: db.raw('?::jsonb', [JSON.stringify(contactFields)]) as any,
          subscriptions_json: db.raw(`'[]'::jsonb`) as any,
          success_message: 'Thanks! Your message has been sent.',
          thank_you_post_id: null,
          created_at: now,
          updated_at: now,
        })
        .returning('*')
      console.log(
        '✅ [ModuleInstanceSeeder] Seeded default Contact form:',
        (createdContactForm as any).slug
      )
    } else {
      console.log('ℹ️ [ModuleInstanceSeeder] Contact form already exists; skipping create')
    }

    // Seed a few demo Profiles for the Profile List module (if none exist)
    {
      const existingProfiles = await db
        .from('posts')
        .where({ type: 'profile', locale: 'en' })
        .limit(1)

      if (existingProfiles.length === 0) {
        // Create demo profile posts
        const profilesToInsert = [
          {
            type: 'profile',
            slug: 'demo-profile-ada-lovelace',
            title: 'Ada Lovelace',
            status: 'published',
            locale: 'en',
            user_id: user.id,
            excerpt: 'Mathematician and writer, often regarded as the first computer programmer.',
            meta_title: null,
            meta_description: null,
            robots_json: JSON.stringify({ index: false, follow: true }),
            created_at: nowTs,
            updated_at: nowTs,
          },
          {
            type: 'profile',
            slug: 'demo-profile-alan-turing',
            title: 'Alan Turing',
            status: 'published',
            locale: 'en',
            user_id: user.id,
            excerpt: 'Pioneer of theoretical computer science and artificial intelligence.',
            meta_title: null,
            meta_description: null,
            robots_json: JSON.stringify({ index: false, follow: true }),
            created_at: nowTs,
            updated_at: nowTs,
          },
          {
            type: 'profile',
            slug: 'demo-profile-grace-hopper',
            title: 'Grace Hopper',
            status: 'published',
            locale: 'en',
            user_id: user.id,
            excerpt: 'Computer scientist and US Navy rear admiral, known for work on compilers.',
            meta_title: null,
            meta_description: null,
            robots_json: JSON.stringify({ index: false, follow: true }),
            created_at: nowTs,
            updated_at: nowTs,
          },
        ]

        const avatarId = String((avatarMedia as any).id)
        // Update profiles with featured_image_id
        const profilesWithFeaturedImage = profilesToInsert.map((profile: any) => ({
          ...profile,
          featured_image_id: avatarId,
        }))
        const insertedProfiles = await db
          .table('posts')
          .insert(profilesWithFeaturedImage)
          .returning('*')

        console.log(
          '✅ [ModuleInstanceSeeder] Seeded demo Profiles for Profile List module with featured images'
        )

        // Populate profile custom fields: first_name, last_name, profile_image
        const makeFieldRows = (post: any, first: string, last: string) => {
          const values: Array<{
            id: string
            post_id: string
            field_slug: string
            value: any
            created_at: Date
            updated_at: Date
          }> = []
          const pid = String((post as any).id)
          const avatarId = String((avatarMedia as any).id)
          values.push({
            id: crypto.randomUUID(),
            post_id: pid,
            field_slug: 'first_name',
            value: JSON.stringify(first),
            created_at: nowTs,
            updated_at: nowTs,
          })
          values.push({
            id: crypto.randomUUID(),
            post_id: pid,
            field_slug: 'last_name',
            value: JSON.stringify(last),
            created_at: nowTs,
            updated_at: nowTs,
          })
          values.push({
            id: crypto.randomUUID(),
            post_id: pid,
            field_slug: 'profile_image',
            value: JSON.stringify(avatarId),
            created_at: nowTs,
            updated_at: nowTs,
          })
          return values
        }

        const cfRows: any[] = []
        const ada = insertedProfiles[0]
        const alan = insertedProfiles[1]
        const grace = insertedProfiles[2]
        cfRows.push(...makeFieldRows(ada, 'Ada', 'Lovelace'))
        cfRows.push(...makeFieldRows(alan, 'Alan', 'Turing'))
        cfRows.push(...makeFieldRows(grace, 'Grace', 'Hopper'))

        await db.table('post_custom_field_values').insert(cfRows)
        console.log(
          '✅ [ModuleInstanceSeeder] Seeded Profile custom fields (first/last name, profile image)'
        )
      } else {
        // Update existing profiles with featured_image_id if not set (regardless of whether we created new ones)
        if (avatarMedia) {
          const avatarIdForUpdate = String((avatarMedia as any).id)
          const existingProfilesWithoutImage = await db
            .from('posts')
            .where({ type: 'profile', locale: 'en' })
            .whereNull('featured_image_id')
            .limit(100)

          if (existingProfilesWithoutImage.length > 0) {
            await db
              .from('posts')
              .whereIn(
                'id',
                existingProfilesWithoutImage.map((p: any) => p.id)
              )
              .update({ featured_image_id: avatarIdForUpdate, updated_at: nowTs } as any)

            console.log(
              `✅ [ModuleInstanceSeeder] Set featured_image_id for ${existingProfilesWithoutImage.length} existing Profile posts`
            )
          }
        }
        console.log(
          'ℹ️ [ModuleInstanceSeeder] Profiles already exist; skipping demo Profile seeding'
        )
      }
    }

    // Ensure demo-company media asset exists (always seed, not conditional)
    const [existingCompanyLogo] = await db
      .from('media_assets')
      .where('original_filename', 'demo-company.png')
      .limit(1)

    let companyLogoMedia = existingCompanyLogo as any
    if (!companyLogoMedia) {
      const companySize = await getFileSize('/uploads/demo-company.png')
      const logoVariant = {
        name: 'thumb',
        url: '/uploads/demo-company.png',
        width: null,
        height: null,
        size: companySize,
      }

      const [createdCompanyLogo] = await db
        .table('media_assets')
        .insert({
          url: '/uploads/demo-company.png',
          original_filename: 'demo-company.png',
          mime_type: 'image/png',
          size: companySize,
          alt_text: 'Demo company logo',
          caption: 'Demo logo image for seeded Companies.',
          description: 'Logo-style demo image used to illustrate the Company List module.',
          categories: db.raw('ARRAY[]::text[]') as any,
          metadata: { variants: [logoVariant] } as any,
          created_at: nowTs,
          updated_at: nowTs,
        })
        .returning('*')
      companyLogoMedia = createdCompanyLogo
      console.log(
        '✅ [ModuleInstanceSeeder] Seeded demo company logo media:',
        (companyLogoMedia as any).id
      )
    } else {
      console.log(
        'ℹ️ [ModuleInstanceSeeder] Demo company logo media already exists; skipping create'
      )
    }

    // Check if demo-company-dark.png exists and update metadata accordingly
    if (companyLogoMedia) {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
      const darkFilePath = path.join(uploadsDir, 'demo-company-dark.png')
      try {
        await fs.access(darkFilePath)
        // Dark file exists - update metadata to include darkSourceUrl and generate dark variants
        const darkSourceUrl = '/uploads/demo-company-dark.png'
        const existingMetadata = (companyLogoMedia.metadata || {}) as any
        const existingVariants = Array.isArray(existingMetadata.variants)
          ? existingMetadata.variants
          : []

        // Generate dark variants using the action (handles tint logic automatically)
        let result: any
        try {
          const generateMediaVariantsAction = (
            await import('#actions/generate_media_variants_action')
          ).default

          // Update metadata first with darkSourceUrl
          const tempMetadata = {
            ...existingMetadata,
            darkSourceUrl,
          }

          result = await generateMediaVariantsAction.execute({
            mediaRecord: { ...companyLogoMedia, metadata: tempMetadata },
            theme: 'dark',
            updateDatabase: false, // We'll update manually below
          })
        } catch (err) {
          console.warn(
            '⚠️ [ModuleInstanceSeeder] Failed to generate dark variants for demo-company-dark.png:',
            err
          )
          result = { metadata: { ...existingMetadata, darkSourceUrl, variants: existingVariants } }
        }

        const updatedMetadata = result.metadata

        await db
          .from('media_assets')
          .where('id', (companyLogoMedia as any).id)
          .update({
            metadata: updatedMetadata as any,
            updated_at: nowTs,
          })

        console.log(
          '✅ [ModuleInstanceSeeder] Updated demo-company.png metadata with dark base and variants'
        )
      } catch {
        // Dark file doesn't exist - that's fine, just skip
        console.log(
          'ℹ️ [ModuleInstanceSeeder] demo-company-dark.png not found; skipping dark variant setup'
        )
      }
    }

    // Seed a few demo Companies for the Company List module (if none exist)
    {
      const existingCompanies = await db
        .from('posts')
        .where({ type: 'company', locale: 'en' })
        .limit(1)

      if (existingCompanies.length === 0) {
        const companiesToInsert = [
          {
            type: 'company',
            slug: 'demo-company-acme',
            title: 'Acme Inc.',
            status: 'published',
            locale: 'en',
            user_id: user.id,
            excerpt: 'Fictional company used for demos and examples.',
            meta_title: null,
            meta_description: null,
            robots_json: JSON.stringify({ index: false, follow: true }),
            created_at: nowTs,
            updated_at: nowTs,
          },
          {
            type: 'company',
            slug: 'demo-company-umbrella',
            title: 'Umbrella Corp.',
            status: 'published',
            locale: 'en',
            user_id: user.id,
            excerpt: 'Global conglomerate featured in fictional case studies.',
            meta_title: null,
            meta_description: null,
            robots_json: JSON.stringify({ index: false, follow: true }),
            created_at: nowTs,
            updated_at: nowTs,
          },
          {
            type: 'company',
            slug: 'demo-company-wayne',
            title: 'Wayne Enterprises',
            status: 'published',
            locale: 'en',
            user_id: user.id,
            excerpt: 'Large multinational with a diverse R&D portfolio.',
            meta_title: null,
            meta_description: null,
            robots_json: JSON.stringify({ index: false, follow: true }),
            created_at: nowTs,
            updated_at: nowTs,
          },
        ]

        const logoId = String((companyLogoMedia as any).id)
        // Update companies with featured_image_id
        const companiesWithFeaturedImage = companiesToInsert.map((company: any) => ({
          ...company,
          featured_image_id: logoId,
        }))
        const insertedCompanies = await db
          .table('posts')
          .insert(companiesWithFeaturedImage)
          .returning('*')
        console.log(
          '✅ [ModuleInstanceSeeder] Seeded demo Companies for Company List module with featured images'
        )
      } else {
        console.log(
          'ℹ️ [ModuleInstanceSeeder] Companies already exist; skipping demo Company seeding'
        )
      }

      // Update existing companies with featured_image_id if not set (regardless of whether we created new ones)
      if (companyLogoMedia) {
        const logoIdForUpdate = String((companyLogoMedia as any).id)
        const existingCompaniesWithoutImage = await db
          .from('posts')
          .where({ type: 'company', locale: 'en' })
          .whereNull('featured_image_id')
          .limit(100)

        if (existingCompaniesWithoutImage.length > 0) {
          await db
            .from('posts')
            .whereIn(
              'id',
              existingCompaniesWithoutImage.map((p: any) => p.id)
            )
            .update({ featured_image_id: logoIdForUpdate, updated_at: nowTs } as any)

          console.log(
            `✅ [ModuleInstanceSeeder] Set featured_image_id for ${existingCompaniesWithoutImage.length} existing Company posts`
          )
        }
      }
    }

    // Seed a few demo Testimonials for the Testimonial List module (if none exist)
    {
      const existingTestimonials = await db
        .from('posts')
        .where({ type: 'testimonial', locale: 'en' })
        .limit(1)

      if (existingTestimonials.length === 0) {
        const nowTsLocal = nowTs
        // Reuse avatar media if available, else no photo
        const photoId: string | null = avatarMedia ? String((avatarMedia as any).id) : null

        const testimonialsToInsert = [
          {
            type: 'testimonial',
            slug: 'demo-testimonial-bonnie-green',
            title: 'Bonnie Green',
            status: 'published',
            locale: 'en',
            user_id: user.id,
            excerpt: null,
            meta_title: null,
            meta_description: null,
            robots_json: JSON.stringify({ index: false, follow: true }),
            created_at: nowTsLocal,
            updated_at: nowTsLocal,
          },
          {
            type: 'testimonial',
            slug: 'demo-testimonial-roberta-casas',
            title: 'Roberta Casas',
            status: 'published',
            locale: 'en',
            user_id: user.id,
            excerpt: null,
            meta_title: null,
            meta_description: null,
            robots_json: JSON.stringify({ index: false, follow: true }),
            created_at: nowTsLocal,
            updated_at: nowTsLocal,
          },
          {
            type: 'testimonial',
            slug: 'demo-testimonial-jese-leos',
            title: 'Jese Leos',
            status: 'published',
            locale: 'en',
            user_id: user.id,
            excerpt: null,
            meta_title: null,
            meta_description: null,
            robots_json: JSON.stringify({ index: false, follow: true }),
            created_at: nowTsLocal,
            updated_at: nowTsLocal,
          },
        ]

        const insertedTestimonials = await db
          .table('posts')
          .insert(testimonialsToInsert)
          .returning('*')

        const cfRows: any[] = []
        const addCf = (
          post: any,
          authorName: string,
          authorTitle: string,
          quote: string,
          photoIdForPost: string | null
        ) => {
          const pid = String((post as any).id)
          cfRows.push(
            {
              id: crypto.randomUUID(),
              post_id: pid,
              field_slug: 'author_name',
              value: JSON.stringify(authorName),
              created_at: nowTsLocal,
              updated_at: nowTsLocal,
            },
            {
              id: crypto.randomUUID(),
              post_id: pid,
              field_slug: 'author_title',
              value: JSON.stringify(authorTitle),
              created_at: nowTsLocal,
              updated_at: nowTsLocal,
            },
            {
              id: crypto.randomUUID(),
              post_id: pid,
              field_slug: 'quote',
              value: JSON.stringify(quote),
              created_at: nowTsLocal,
              updated_at: nowTsLocal,
            }
          )
          if (photoIdForPost) {
            cfRows.push({
              id: crypto.randomUUID(),
              post_id: pid,
              field_slug: 'photo',
              value: JSON.stringify(photoIdForPost),
              created_at: nowTsLocal,
              updated_at: nowTsLocal,
            })
          }
        }

        const bonnie = insertedTestimonials[0]
        const roberta = insertedTestimonials[1]
        const jese = insertedTestimonials[2]

        addCf(
          bonnie,
          'Bonnie Green',
          'Developer at Open AI',
          "I'm speechless with how easy this was to integrate within my application. If you care for your time, I hands down would go with this.",
          photoId
        )
        addCf(
          roberta,
          'Roberta Casas',
          'Lead designer at Dropbox',
          'FlowBite provides a robust set of design tokens and components based on Tailwind CSS, giving a solid foundation for any project.',
          photoId
        )
        addCf(
          jese,
          'Jese Leos',
          'Software Engineer at Facebook',
          'Everything is so well structured and simple to use. The well designed components are beautiful and will level up your next application.',
          photoId
        )

        if (cfRows.length > 0) {
          await db.table('post_custom_field_values').insert(cfRows)
        }

        console.log(
          '✅ [ModuleInstanceSeeder] Seeded demo Testimonials for Testimonial List module'
        )
      } else {
        console.log(
          'ℹ️ [ModuleInstanceSeeder] Testimonials already exist; skipping demo Testimonial seeding'
        )
      }
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
      console.log(
        'ℹ️ [ModuleInstanceSeeder] hero-with-media module instance already exists; reusing'
      )
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
            body: 'This layout pairs narrative content with a focused visual, ideal for feature callouts, product explainers, and lightweight storytelling.',
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
      console.log(
        'ℹ️ [ModuleInstanceSeeder] prose-with-media module instance already exists; reusing'
      )
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
              // Use already-abbreviated values so suffixes read naturally (e.g. 73M+)
              { value: 73, suffix: 'M+', label: 'developers' },
              { value: 1, suffix: 'B+', label: 'contributors' },
              { value: 4, suffix: 'M+', label: 'organizations' },
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

    // Pricing instance
    const existingPricing = await db
      .from('module_instances')
      .where({ type: 'pricing', scope: 'post' })
      .first()

    let pricingInstance: any = existingPricing
    if (!pricingInstance) {
      const [createdPricing] = await db
        .table('module_instances')
        .insert({
          type: 'pricing',
          scope: 'post',
          props: {
            title: 'Designed for business teams like yours',
            subtitle:
              'We focus on markets where technology, innovation, and capital can unlock long-term value and drive economic growth.',
            plans: [
              {
                name: 'Starter',
                description: 'Best option for personal use & for your next project.',
                price: '29',
                period: '/month',
                features: [
                  'Individual configuration',
                  'No setup, or hidden fees',
                  'Team size: 1 developer',
                  'Premium support: 6 months',
                  'Free updates: 6 months',
                ],
                primary: false,
                ctaLabel: 'Get started',
                ctaUrl: { kind: 'url', url: '#' },
              },
              {
                name: 'Company',
                description: 'Relevant for multiple users, extended & premium support.',
                price: '99',
                period: '/month',
                features: [
                  'Individual configuration',
                  'No setup, or hidden fees',
                  'Team size: 10 developers',
                  'Premium support: 24 months',
                  'Free updates: 24 months',
                ],
                primary: true,
                ctaLabel: 'Get started',
                ctaUrl: { kind: 'url', url: '#' },
              },
              {
                name: 'Enterprise',
                description: 'Best for large scale uses and extended redistribution rights.',
                price: '499',
                period: '/month',
                features: [
                  'Individual configuration',
                  'No setup, or hidden fees',
                  'Team size: 100+ developers',
                  'Premium support: 36 months',
                  'Free updates: 36 months',
                ],
                primary: false,
                ctaLabel: 'Get started',
                ctaUrl: { kind: 'url', url: '#' },
              },
            ],
          },
          created_at: nowTs,
          updated_at: nowTs,
        })
        .returning('*')
      pricingInstance = createdPricing
      console.log('✅ [ModuleInstanceSeeder] Created pricing module instance')
    } else {
      console.log('ℹ️ [ModuleInstanceSeeder] pricing module instance already exists; reusing')
    }

    // FAQ instance
    const existingFaq = await db
      .from('module_instances')
      .where({ type: 'faq', scope: 'post' })
      .first()

    let faqInstance: any = existingFaq
    if (!faqInstance) {
      const [createdFaq] = await db
        .table('module_instances')
        .insert({
          type: 'faq',
          scope: 'post',
          props: {
            title: 'Frequently asked questions',
            subtitle:
              'Answers to common questions about how we work, what is included, and how we support your team.',
            items: [
              {
                question: 'What do you mean by “Figma assets”?',
                answer:
                  'You will have access to download the full design source, including all of the pages, reusable components, responsive variants, and supporting illustrations.',
              },
              {
                question: 'What does “lifetime access” mean?',
                answer:
                  'Once you purchase a license you can use the product for as long as you like and receive all future updates at no additional cost.',
              },
              {
                question: 'How does support work?',
                answer:
                  'Support is provided directly by the authors of the product so you get high‑quality, context‑aware answers.',
                linkLabel: 'Contact support',
                linkUrl: { kind: 'url', url: '#' },
              },
              {
                question: 'Can I use this for multiple projects?',
                answer:
                  'Yes. Your license covers an unlimited number of internal or client projects, as long as you are not reselling the kit itself as a competing product.',
              },
              {
                question: 'What do “free updates” include?',
                answer:
                  'Free updates include new components, patterns, and improvements that we ship as part of the public roadmap for this product.',
                linkLabel: 'View roadmap',
                linkUrl: { kind: 'url', url: '#' },
              },
              {
                question: 'Can I use this in open‑source projects?',
                answer:
                  'In most cases you can use the kit in open‑source projects, as long as the project is not a direct replacement for this product (for example, a competing UI kit or page‑builder).',
              },
            ],
          },
          created_at: nowTs,
          updated_at: nowTs,
        })
        .returning('*')
      faqInstance = createdFaq
      console.log('✅ [ModuleInstanceSeeder] Created faq module instance')
    } else {
      console.log('ℹ️ [ModuleInstanceSeeder] faq module instance already exists; reusing')
    }

    // Blockquote instance
    const existingBlockquote = await db
      .from('module_instances')
      .where({ type: 'blockquote', scope: 'post' })
      .first()

    let blockquoteInstance: any = existingBlockquote
    if (!blockquoteInstance) {
      const avatarIdForBlockquote: string | null = avatarMedia
        ? String((avatarMedia as any).id)
        : null

      const [createdBlockquote] = await db
        .table('module_instances')
        .insert({
          type: 'blockquote',
          scope: 'post',
          props: {
            quote:
              'Flowbite is just awesome. It contains tons of predesigned components and pages starting from login screen to complex dashboard. Perfect choice for your next SaaS application.',
            authorName: 'Michael Gough',
            authorTitle: 'CEO at Google',
            avatar: avatarIdForBlockquote,
            backgroundColor: 'bg-backdrop-low',
          },
          created_at: nowTs,
          updated_at: nowTs,
        })
        .returning('*')
      blockquoteInstance = createdBlockquote
      console.log('✅ [ModuleInstanceSeeder] Created blockquote module instance')
    } else {
      console.log('ℹ️ [ModuleInstanceSeeder] blockquote module instance already exists; reusing')
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

    // Testimonial List instance
    const existingTestimonialList = await db
      .from('module_instances')
      .where({ type: 'testimonial-list', scope: 'post' })
      .first()

    let testimonialListInstance: any = existingTestimonialList
    if (!testimonialListInstance) {
      const [createdTestimonialList] = await db
        .table('module_instances')
        .insert({
          type: 'testimonial-list',
          scope: 'post',
          props: {
            title: 'Testimonials',
            subtitle:
              'Showcase customer feedback using the Testimonial post type. Add or edit testimonials in the CMS and they will appear here automatically.',
            testimonials: [],
          },
          created_at: nowTs,
          updated_at: nowTs,
        })
        .returning('*')
      testimonialListInstance = createdTestimonialList
      console.log('✅ [ModuleInstanceSeeder] Created testimonial-list module instance')
    } else {
      console.log(
        'ℹ️ [ModuleInstanceSeeder] testimonial-list module instance already exists; reusing'
      )
    }

    // Blog List instance
    const existingBlogList = await db
      .from('module_instances')
      .where({ type: 'blog-list', scope: 'post' })
      .first()

    let blogListInstance: any = existingBlogList
    if (!blogListInstance) {
      const [createdBlogList] = await db
        .table('module_instances')
        .insert({
          type: 'blog-list',
          scope: 'post',
          props: {
            title: 'Our Blog',
            subtitle:
              'We use an agile approach to test assumptions and connect with the needs of your audience early and often.',
            posts: [],
          },
          created_at: nowTs,
          updated_at: nowTs,
        })
        .returning('*')
      blogListInstance = createdBlogList
      console.log('✅ [ModuleInstanceSeeder] Created blog-list module instance')
    } else {
      console.log('ℹ️ [ModuleInstanceSeeder] blog-list module instance already exists; reusing')
    }

    // Company List instance
    const existingCompanyList = await db
      .from('module_instances')
      .where({ type: 'company-list', scope: 'post' })
      .first()

    let companyListInstance: any = existingCompanyList
    if (!companyListInstance) {
      const [createdCompanyList] = await db
        .table('module_instances')
        .insert({
          type: 'company-list',
          scope: 'post',
          props: {
            title: 'You’ll be in good company',
            subtitle:
              'Logos and names of customers or partners, managed via the Company post type.',
            companies: [],
          },
          created_at: nowTs,
          updated_at: nowTs,
        })
        .returning('*')
      companyListInstance = createdCompanyList
      console.log('✅ [ModuleInstanceSeeder] Created company-list module instance')
    } else {
      console.log('ℹ️ [ModuleInstanceSeeder] company-list module instance already exists; reusing')
    }

    // Form module instance
    const existingFormModule = await db
      .from('module_instances')
      .where({ type: 'form', scope: 'post' })
      .first()

    let formModuleInstance: any = existingFormModule
    if (!formModuleInstance) {
      const [createdFormModule] = await db
        .table('module_instances')
        .insert({
          type: 'form',
          scope: 'post',
          props: {
            title: 'Contact us',
            subtitle: 'Fill out the form and our team will get back to you shortly.',
            formSlug: 'contact',
          },
          created_at: nowTs,
          updated_at: nowTs,
        })
        .returning('*')
      formModuleInstance = createdFormModule
      console.log('✅ [ModuleInstanceSeeder] Created form module instance')
    } else {
      console.log('ℹ️ [ModuleInstanceSeeder] form module instance already exists; reusing')
    }

    // Prose with Form module instance
    const existingProseWithForm = await db
      .from('module_instances')
      .where({ type: 'prose-with-form', scope: 'post' })
      .first()

    let proseWithFormInstance: any = existingProseWithForm
    if (!proseWithFormInstance) {
      const [createdProseWithForm] = await db
        .table('module_instances')
        .insert({
          type: 'prose-with-form',
          scope: 'post',
          props: {
            title: 'Ready to talk?',
            body: 'Use this section to invite visitors to reach out. The form will appear alongside this copy.',
            formSlug: 'contact',
            successMessage: 'Thanks! Your message has been sent.',
            layout: 'form-right',
            backgroundColor: 'bg-backdrop-low',
          },
          created_at: nowTs,
          updated_at: nowTs,
        })
        .returning('*')
      proseWithFormInstance = createdProseWithForm
      console.log('✅ [ModuleInstanceSeeder] Created prose-with-form module instance')
    } else {
      console.log(
        'ℹ️ [ModuleInstanceSeeder] prose-with-form module instance already exists; reusing'
      )
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
      heroCenteredInstance = createdHeroCentered
      console.log('✅ [ModuleInstanceSeeder] Created hero-with-callout module instance')
    } else {
      console.log(
        'ℹ️ [ModuleInstanceSeeder] hero-with-callout module instance already exists; reusing'
      )
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
    await ensureAttached(String(pricingInstance.id), 'pricing module')
    await ensureAttached(String(faqInstance.id), 'faq module')
    await ensureAttached(String(blockquoteInstance.id), 'blockquote module')
    await ensureAttached(String(profileListInstance.id), 'profile-list module')
    await ensureAttached(String(testimonialListInstance.id), 'testimonial-list module')
    await ensureAttached(String(companyListInstance.id), 'company-list module')
    await ensureAttached(String(blogListInstance.id), 'blog-list module')
    await ensureAttached(String(formModuleInstance.id), 'form module')
    await ensureAttached(String(proseWithFormInstance.id), 'prose-with-form module')
    await ensureAttached(String(proseInstance.id), 'prose module')
    await ensureAttached(String(kitchenSinkInstance.id), 'kitchen-sink module')
  }
}
