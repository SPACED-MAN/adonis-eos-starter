import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import CreatePost, { CreatePostException } from '#actions/posts/create_post'
import UpdatePost, { UpdatePostException } from '#actions/posts/update_post'
import moduleRegistry from '#services/module_registry'
import ProseModule from '#modules/prose'

test.group('Post Actions - CreatePost', (group) => {
  group.each.setup(async () => {
    await testUtils.db().truncate()
    
    // Register modules
    moduleRegistry.clear()
    moduleRegistry.register(new ProseModule())
  })

  test('should create a basic post', async ({ assert }) => {
    const user = await User.create({
      email: `test-${Date.now()}@example.com`,
      password: 'password',
    })

    const post = await CreatePost.handle({
      type: 'blog',
      locale: 'en',
      slug: `test-post-${Date.now()}`,
      title: 'Test Post',
      status: 'draft',
      userId: user.id,
    })

    assert.isDefined(post.id)
    assert.equal(post.type, 'blog')
    assert.equal(post.locale, 'en')
    assert.equal(post.title, 'Test Post')
    assert.equal(post.status, 'draft')
    assert.equal(post.userId, user.id)
  })

  test('should throw exception for duplicate slug in same locale', async ({ assert }) => {
    const user = await User.create({
      email: `test-${Date.now()}@example.com`,
      password: 'password',
    })

    const slug = `duplicate-slug-${Date.now()}`

    await CreatePost.handle({
      type: 'blog',
      locale: 'en',
      slug,
      title: 'First Post',
      userId: user.id,
    })

    try {
      await CreatePost.handle({
        type: 'blog',
        locale: 'en',
        slug,
        title: 'Second Post',
        userId: user.id,
      })
      assert.fail('Should have thrown CreatePostException')
    } catch (error) {
      assert.instanceOf(error, CreatePostException)
      assert.equal(error.statusCode, 409)
    }
  })

  test('should allow same slug in different locale', async ({ assert }) => {
    const user = await User.create({
      email: `test-${Date.now()}@example.com`,
      password: 'password',
    })

    const slug = `same-slug-${Date.now()}`

    const postEn = await CreatePost.handle({
      type: 'blog',
      locale: 'en',
      slug,
      title: 'English Post',
      userId: user.id,
    })

    const postEs = await CreatePost.handle({
      type: 'blog',
      locale: 'es',
      slug,
      title: 'Spanish Post',
      userId: user.id,
    })

    assert.isDefined(postEn.id)
    assert.isDefined(postEs.id)
    assert.notEqual(postEn.id, postEs.id)
    assert.equal(postEn.locale, 'en')
    assert.equal(postEs.locale, 'es')
  })
})

test.group('Post Actions - UpdatePost', (group) => {
  group.each.setup(async () => {
    await testUtils.db().truncate()
  })

  test('should update post fields', async ({ assert }) => {
    const user = await User.create({
      email: `test-${Date.now()}@example.com`,
      password: 'password',
    })

    const post = await CreatePost.handle({
      type: 'blog',
      locale: 'en',
      slug: `original-slug-${Date.now()}`,
      title: 'Original Title',
      userId: user.id,
    })

    const updated = await UpdatePost.handle({
      postId: post.id,
      title: 'Updated Title',
      status: 'published',
      excerpt: 'New excerpt',
    })

    assert.equal(updated.id, post.id)
    assert.equal(updated.title, 'Updated Title')
    assert.equal(updated.status, 'published')
    assert.equal(updated.excerpt, 'New excerpt')
  })

  test('should throw exception for non-existent post', async ({ assert }) => {
    try {
      await UpdatePost.handle({
        postId: '00000000-0000-0000-0000-000000000000',
        title: 'Updated Title',
      })
      assert.fail('Should have thrown UpdatePostException')
    } catch (error) {
      assert.instanceOf(error, UpdatePostException)
      assert.equal(error.statusCode, 404)
    }
  })

  test('should prevent slug conflict when updating', async ({ assert }) => {
    const user = await User.create({
      email: `test-${Date.now()}@example.com`,
      password: 'password',
    })

    const slug1 = `post-one-${Date.now()}`
    const slug2 = `post-two-${Date.now()}`

    const post1 = await CreatePost.handle({
      type: 'blog',
      locale: 'en',
      slug: slug1,
      title: 'Post One',
      userId: user.id,
    })

    await CreatePost.handle({
      type: 'blog',
      locale: 'en',
      slug: slug2,
      title: 'Post Two',
      userId: user.id,
    })

    // Try to change post1's slug to slug2 (should fail)
    try {
      await UpdatePost.handle({
        postId: post1.id,
        slug: slug2,
      })
      assert.fail('Should have thrown UpdatePostException')
    } catch (error) {
      assert.instanceOf(error, UpdatePostException)
      assert.equal(error.statusCode, 409)
    }
  })
})

