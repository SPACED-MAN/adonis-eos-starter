import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Post from '#models/post'
import localeService from '#services/locale_service'
import {
  generateHreflangTags,
  buildLocaleSwitcher,
  getLocalizedContent,
} from '#helpers/i18n_helpers'

test.group('i18n - Locale Service', () => {
  test('should return supported locales', ({ assert }) => {
    const locales = localeService.getSupportedLocales()
    assert.isArray(locales)
    assert.include(locales, 'en')
  })

  test('should return default locale', ({ assert }) => {
    const defaultLocale = localeService.getDefaultLocale()
    assert.equal(defaultLocale, 'en')
  })

  test('should validate locale support', ({ assert }) => {
    assert.isTrue(localeService.isLocaleSupported('en'))
    assert.isTrue(localeService.isLocaleSupported('es'))
    assert.isFalse(localeService.isLocaleSupported('invalid'))
  })

  test('should generate localized URL for non-default locale', ({ assert }) => {
    const url = localeService.generateLocalizedUrl('/blog/post', 'es')
    assert.equal(url, '/es/blog/post')
  })

  test('should not prefix default locale URL', ({ assert }) => {
    const url = localeService.generateLocalizedUrl('/blog/post', 'en')
    assert.equal(url, '/blog/post')
  })

  test('should strip locale from URL', ({ assert }) => {
    const stripped = localeService.stripLocaleFromUrl('/es/blog/post')
    assert.equal(stripped, '/blog/post')
  })
})

test.group('i18n - Post Model', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })

  group.each.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('should identify post as translation', async ({ assert }) => {
    const posts = await db.from('posts').select('*').limit(2)

    if (posts.length >= 2) {
      const originalPost = await Post.find(posts[0].id)
      const translationPost = await Post.find(posts[1].id)

      if (originalPost && translationPost && translationPost.translationOfId) {
        assert.isFalse(originalPost.isTranslation())
        assert.isTrue(translationPost.isTranslation())
      }
    }
  })

  test('should get all translations for a post', async ({ assert }) => {
    const post = await Post.query().whereNull('translation_of_id').first()

    if (post) {
      const translations = await post.getAllTranslations()
      assert.isArray(translations)
      assert.isAtLeast(translations.length, 1)
    }
  })

  test('should get specific translation by locale', async ({ assert }) => {
    const enPost = await Post.query().where('locale', 'en').first()

    if (enPost) {
      const hasEs = await enPost.hasTranslation('es')

      if (hasEs) {
        const esTranslation = await enPost.getTranslation('es')
        assert.isNotNull(esTranslation)
        assert.equal(esTranslation?.locale, 'es')
      }
    }
  })

  test('should use byLocale query scope', async ({ assert }) => {
    const enPosts = await Post.query().apply((scopes) => scopes.byLocale('en'))

    enPosts.forEach((post) => {
      assert.equal(post.locale, 'en')
    })
  })

  test('should use originals query scope', async ({ assert }) => {
    const originalPosts = await Post.query().apply((scopes) => scopes.originals())

    originalPosts.forEach((post) => {
      assert.isNull(post.translationOfId)
    })
  })
})

test.group('i18n - Helper Functions', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })

  group.each.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('should generate hreflang tags for post with translations', async ({ assert }) => {
    const post = await Post.query().where('locale', 'en').first()

    if (post) {
      const hreflangTags = await generateHreflangTags(post, 'https://example.com')

      assert.isArray(hreflangTags)
      assert.isAtLeast(hreflangTags.length, 1)

      // Check that tags contain proper hreflang format
      hreflangTags.forEach((tag) => {
        assert.include(tag, 'rel="alternate"')
        assert.include(tag, 'hreflang=')
        assert.include(tag, 'href=')
      })

      // Should include x-default
      const hasDefault = hreflangTags.some((tag) => tag.includes('hreflang="x-default"'))
      assert.isTrue(hasDefault)
    }
  })

  test('should build locale switcher data', async ({ assert }) => {
    const post = await Post.query().where('locale', 'en').first()

    if (post) {
      const switcher = await buildLocaleSwitcher(post, '/blog/test', 'https://example.com')

      assert.isArray(switcher)

      switcher.forEach((option) => {
        assert.property(option, 'locale')
        assert.property(option, 'label')
        assert.property(option, 'url')
        assert.property(option, 'isActive')
        assert.property(option, 'isAvailable')
      })

      // English should be active
      const enOption = switcher.find((o) => o.locale === 'en')
      assert.isTrue(enOption?.isActive)
    }
  })

  test('should extract localized content from object', ({ assert }) => {
    const content = {
      en: 'Hello',
      es: 'Hola',
    }

    const enContent = getLocalizedContent(content, 'en')
    assert.equal(enContent, 'Hello')

    const esContent = getLocalizedContent(content, 'es')
    assert.equal(esContent, 'Hola')
  })

  test('should fallback to default locale for missing translation', ({ assert }) => {
    const content = {
      en: 'Hello',
      es: 'Hola',
    }

    const frContent = getLocalizedContent(content, 'fr')
    assert.equal(frContent, 'Hello') // Falls back to English
  })

  test('should return content as-is if not an object', ({ assert }) => {
    const simpleContent = 'Simple string'
    const result = getLocalizedContent(simpleContent, 'en')
    assert.equal(result, 'Simple string')
  })
})
