import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Post from '#models/post'
import agentRegistry from '#services/agent_registry'
import CreateTranslation, {
  CreateTranslationException,
} from '#actions/translations/create_translation'
import DeleteTranslation, {
  DeleteTranslationException,
} from '#actions/translations/delete_translation'

test.group('CreateTranslationAction', (group) => {
  group.setup(async () => {
    // Prevent agents from running during tests as they call external APIs
    agentRegistry.clear()
  })

  group.each.setup(async () => {
    await testUtils.db().truncate()
  })

  test('should create translation for a post', async ({ assert }) => {
    // Create original post
    const originalPost = await Post.create({
      type: 'blog',
      slug: `test-post-${Date.now()}`,
      title: 'Test Post',
      status: 'draft',
      locale: 'en',
      userId: 1,
    })

    // Execute action
    const translation = await CreateTranslation.handle({
      postId: originalPost.id,
      locale: 'es',
      slug: `publicacion-de-prueba-${Date.now()}`,
      title: 'Publicación de Prueba',
      metaTitle: 'Meta de Prueba',
      metaDescription: 'Descripción de prueba',
    })

    // Assertions
    assert.exists(translation.id)
    assert.equal(translation.locale, 'es')
    assert.include(translation.slug, 'publicacion-de-prueba')
    assert.equal(translation.title, 'Publicación de Prueba')
    assert.equal(translation.status, 'draft')
    assert.equal(translation.translationOfId, originalPost.id)
    assert.equal(translation.type, originalPost.type)
    assert.equal((translation as any).moduleGroupId, (originalPost as any).moduleGroupId)
  })

  test('should throw exception when post not found', async ({ assert }) => {
    // Use a valid UUID format that doesn't exist in database
    const nonExistentId = '00000000-0000-0000-0000-000000000000'

    try {
      await CreateTranslation.handle({
        postId: nonExistentId,
        locale: 'es',
        slug: 'test',
        title: 'Test',
      })
      assert.fail('Should have thrown CreateTranslationException')
    } catch (error) {
      assert.instanceOf(error, CreateTranslationException)
      assert.equal(error.message, 'Post not found')
      assert.equal(error.statusCode, 404)
    }
  })

  test('should throw exception for unsupported locale', async ({ assert }) => {
    const originalPost = await Post.create({
      type: 'blog',
      slug: `test-post-${Date.now()}`,
      title: 'Test Post',
      status: 'draft',
      locale: 'en',
      userId: 1,
    })

    try {
      await CreateTranslation.handle({
        postId: originalPost.id,
        locale: 'invalid',
        slug: 'test',
        title: 'Test',
      })
      assert.fail('Should have thrown CreateTranslationException')
    } catch (error) {
      assert.instanceOf(error, CreateTranslationException)
      assert.include(error.message, 'Unsupported locale')
      assert.equal(error.statusCode, 400)
    }
  })

  test('should throw exception when translation already exists', async ({ assert }) => {
    const originalPost = await Post.create({
      type: 'blog',
      slug: `test-post-${Date.now()}`,
      title: 'Test Post',
      status: 'draft',
      locale: 'en',
      userId: 1,
    })

    // Create first translation
    await Post.create({
      type: 'blog',
      slug: `publicacion-de-prueba-${Date.now()}`,
      title: 'Publicación de Prueba',
      status: 'draft',
      locale: 'es',
      translationOfId: originalPost.id,
      userId: 1,
    })

    try {
      await CreateTranslation.handle({
        postId: originalPost.id,
        locale: 'es',
        slug: `another-slug-${Date.now()}`,
        title: 'Another Title',
      })
      assert.fail('Should have thrown CreateTranslationException')
    } catch (error) {
      assert.instanceOf(error, CreateTranslationException)
      assert.include(error.message, 'Translation already exists')
      assert.equal(error.statusCode, 409)
    }
  })

  test('should handle translation of a translation (get base post)', async ({ assert }) => {
    const originalPost = await Post.create({
      type: 'blog',
      slug: `test-post-${Date.now()}`,
      title: 'Test Post',
      status: 'draft',
      locale: 'en',
      userId: 1,
    })

    const esTranslation = await Post.create({
      type: 'blog',
      slug: `publicacion-de-prueba-${Date.now()}`,
      title: 'Publicación de Prueba',
      status: 'draft',
      locale: 'es',
      translationOfId: originalPost.id,
      userId: 1,
    })

    // Try to create French translation from Spanish translation
    // Should use original post as base
    const frTranslation = await CreateTranslation.handle({
      postId: esTranslation.id,
      locale: 'fr',
      slug: `article-de-test-${Date.now()}`,
      title: 'Article de Test',
    })

    assert.equal(frTranslation.translationOfId, originalPost.id)
    assert.notEqual(frTranslation.translationOfId, esTranslation.id)
  })
})

test.group('DeleteTranslationAction', (group) => {
  group.each.setup(async () => {
    await testUtils.db().truncate()
  })

  test('should delete a translation', async ({ assert }) => {
    const originalPost = await Post.create({
      type: 'blog',
      slug: `test-post-${Date.now()}`,
      title: 'Test Post',
      status: 'draft',
      locale: 'en',
      userId: 1,
    })

    const translation = await Post.create({
      type: 'blog',
      slug: `publicacion-de-prueba-${Date.now()}`,
      title: 'Publicación de Prueba',
      status: 'draft',
      locale: 'es',
      translationOfId: originalPost.id,
      userId: 1,
    })

    const deleted = await DeleteTranslation.handle({
      postId: originalPost.id,
      locale: 'es',
    })

    assert.equal(deleted.id, translation.id)

    // Verify it's deleted
    const found = await Post.find(translation.id)
    assert.isNull(found)
  })

  test('should throw exception when post not found', async ({ assert }) => {
    // Use a valid UUID format that doesn't exist in database
    const nonExistentId = '00000000-0000-0000-0000-000000000000'

    try {
      await DeleteTranslation.handle({
        postId: nonExistentId,
        locale: 'es',
      })
      assert.fail('Should have thrown DeleteTranslationException')
    } catch (error) {
      assert.instanceOf(error, DeleteTranslationException)
      assert.equal(error.message, 'Post not found')
      assert.equal(error.statusCode, 404)
    }
  })

  test('should throw exception when translation not found', async ({ assert }) => {
    const originalPost = await Post.create({
      type: 'blog',
      slug: `test-post-${Date.now()}`,
      title: 'Test Post',
      status: 'draft',
      locale: 'en',
      userId: 1,
    })

    try {
      await DeleteTranslation.handle({
        postId: originalPost.id,
        locale: 'es',
      })
      assert.fail('Should have thrown DeleteTranslationException')
    } catch (error) {
      assert.instanceOf(error, DeleteTranslationException)
      assert.include(error.message, 'Translation not found')
      assert.equal(error.statusCode, 404)
    }
  })

  test('should prevent deletion of original post', async ({ assert }) => {
    const originalPost = await Post.create({
      type: 'blog',
      slug: `test-post-${Date.now()}`,
      title: 'Test Post',
      status: 'draft',
      locale: 'en',
      userId: 1,
    })

    try {
      await DeleteTranslation.handle({
        postId: originalPost.id,
        locale: 'en',
      })
      assert.fail('Should have thrown DeleteTranslationException')
    } catch (error) {
      assert.instanceOf(error, DeleteTranslationException)
      assert.include(error.message, 'Cannot delete original post')
      assert.equal(error.statusCode, 400)
    }

    // Verify original post still exists
    const found = await Post.find(originalPost.id)
    assert.isNotNull(found)
  })

  test('should delete translation when called with translation ID', async ({ assert }) => {
    const originalPost = await Post.create({
      type: 'blog',
      slug: `test-post-${Date.now()}`,
      title: 'Test Post',
      status: 'draft',
      locale: 'en',
      userId: 1,
    })

    const translation = await Post.create({
      type: 'blog',
      slug: `publicacion-de-prueba-${Date.now()}`,
      title: 'Publicación de Prueba',
      status: 'draft',
      locale: 'es',
      translationOfId: originalPost.id,
      userId: 1,
    })

    // Call with translation ID (not original ID)
    const deleted = await DeleteTranslation.handle({
      postId: translation.id,
      locale: 'es',
    })

    assert.equal(deleted.id, translation.id)

    // Verify it's deleted
    const found = await Post.find(translation.id)
    assert.isNull(found)
  })
})
