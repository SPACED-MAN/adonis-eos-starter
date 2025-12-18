import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { UserFactory, PostFactory } from '#database/factories'

const postForUser = (userId: number) => PostFactory.merge({ userId, authorId: userId })

test.group('Posts API', (group) => {
  let adminUser: any
  let editorUser: any

  group.setup(async () => {
    // Create test users
    adminUser = await UserFactory.apply('admin').merge({ email: 'admin-test@example.com' }).create()
    editorUser = await UserFactory.apply('editor')
      .merge({ email: 'editor-test@example.com' })
      .create()

    // Ensure modules are registered
    const { registerAllModules } = await import('../unit/actions/module_test_helper.js')
    await registerAllModules()
  })

  group.teardown(async () => {
    // Cleanup test data
    await db.from('posts').whereIn('user_id', [adminUser.id, editorUser.id]).delete()
    await db.from('users').whereIn('id', [adminUser.id, editorUser.id]).delete()
  })

  group.each.setup(async () => {
    // Clean up posts before each test
    await db.from('posts').whereIn('user_id', [adminUser.id, editorUser.id]).delete()
  })

  test('GET /api/posts returns paginated list', async ({ client, assert }) => {
    // Create some test posts with the correct user
    await postForUser(editorUser.id).createMany(5)

    const response = await client.get('/api/posts').withGuard('web').loginAs(editorUser)

    response.assertStatus(200)
    assert.exists(response.body().data)
    assert.exists(response.body().meta)
    assert.isAtLeast(response.body().data.length, 5)
  })

  test('GET /api/posts filters by type', async ({ client, assert }) => {
    await postForUser(editorUser.id).apply('blog').create()
    await postForUser(editorUser.id).apply('page').create()

    const response = await client.get('/api/posts?type=blog').withGuard('web').loginAs(editorUser)

    response.assertStatus(200)
    const posts = response.body().data
    assert.isTrue(posts.every((p: any) => p.type === 'blog'))
  })

  test('GET /api/posts filters by status', async ({ client, assert }) => {
    await postForUser(editorUser.id).apply('draft').create()
    await postForUser(editorUser.id).apply('published').create()

    const response = await client
      .get('/api/posts?status=published')
      .withGuard('web')
      .loginAs(editorUser)

    response.assertStatus(200)
    const posts = response.body().data
    assert.isTrue(posts.every((p: any) => p.status === 'published'))
  })

  test('POST /api/posts creates a new post', async ({ client, assert }) => {
    const response = await client
      .post('/api/posts')
      .withCsrfToken()
      .json({
        type: 'blog',
        locale: 'en',
        slug: 'test-post-create',
        title: 'Test Post Creation',
      })
      .withGuard('web')
      .loginAs(editorUser)

    response.assertStatus(201)
    assert.exists(response.body().data.id)
    assert.equal(response.body().data.slug, 'test-post-create')
  })

  test('POST /api/posts validates required fields', async ({ client }) => {
    const response = await client
      .post('/api/posts')
      .withCsrfToken()
      .json({
        type: 'blog',
        // Missing required fields: locale, slug, title
      })
      .withGuard('web')
      .loginAs(editorUser)

    response.assertStatus(422)
  })

  test('POST /api/posts rejects duplicate slug', async ({ client }) => {
    // Pre-create a post with the target slug/locale via the API so unique constraint is satisfied once
    await client
      .post('/api/posts')
      .withCsrfToken()
      .json({
        type: 'blog',
        locale: 'en',
        slug: 'duplicate-slug',
        title: 'Original Duplicate Slug',
      })
      .withGuard('web')
      .loginAs(editorUser)

    const response = await client
      .post('/api/posts')
      .withCsrfToken()
      .json({
        type: 'blog',
        locale: 'en',
        slug: 'duplicate-slug',
        title: 'Duplicate Test',
      })
      .withGuard('web')
      .loginAs(editorUser)

    response.assertStatus(409)
  })

  test('PUT /api/posts/:id updates a post', async ({ client, assert }) => {
    const post = await postForUser(editorUser.id).create()

    const response = await client
      .put(`/api/posts/${post.id}`)
      .withCsrfToken()
      .json({
        title: 'Updated Title',
        slug: post.slug,
      })
      .withGuard('web')
      .loginAs(editorUser)

    // Should redirect for Inertia or return success
    assert.isTrue([200, 302, 303].includes(response.status()))
  })

  test('translator cannot create posts', async ({ client }) => {
    const translator = await UserFactory.apply('translator')
      .merge({ email: 'translator-test@example.com' })
      .create()

    try {
      const response = await client
        .post('/api/posts')
        .withCsrfToken()
        .json({
          type: 'blog',
          locale: 'en',
          slug: 'translator-post',
          title: 'Translator Post',
        })
        .withGuard('web')
        .loginAs(translator)

      response.assertStatus(403)
    } finally {
      await db.from('users').where('id', translator.id).delete()
    }
  })

  test('DELETE /api/posts/:id soft deletes archived post', async ({ client, assert }) => {
    const post = await postForUser(adminUser.id).merge({ status: 'archived' }).create()

    const response = await client
      .delete(`/api/posts/${post.id}`)
      .withCsrfToken()
      .withGuard('web')
      .loginAs(adminUser)

    response.assertStatus(204)

    // Verify soft deleted
    const deleted = await db.from('posts').where('id', post.id).first()
    assert.isNotNull(deleted.deleted_at)
  })

  test('DELETE /api/posts/:id requires archived status', async ({ client }) => {
    const post = await postForUser(adminUser.id).apply('published').create()

    const response = await client
      .delete(`/api/posts/${post.id}`)
      .withCsrfToken()
      .withGuard('web')
      .loginAs(adminUser)

    response.assertStatus(400)
  })

  test('POST /api/posts/:id/restore restores soft deleted post', async ({ client, assert }) => {
    const post = await postForUser(adminUser.id).merge({ status: 'archived' }).create()

    // Soft delete first
    await db.from('posts').where('id', post.id).update({ deleted_at: new Date() })

    const response = await client
      .post(`/api/posts/${post.id}/restore`)
      .withCsrfToken()
      .withGuard('web')
      .loginAs(adminUser)

    response.assertStatus(200)

    // Verify restored
    const restored = await db.from('posts').where('id', post.id).first()
    assert.isNull(restored.deleted_at)
  })

  test('POST /api/posts/bulk performs bulk status change', async ({ client, assert }) => {
    const posts = await postForUser(editorUser.id).apply('draft').createMany(3)
    const ids = posts.map((p) => p.id)

    const response = await client
      .post('/api/posts/bulk')
      .withCsrfToken()
      .json({
        action: 'publish',
        ids,
      })
      .withGuard('web')
      .loginAs(editorUser)

    response.assertStatus(200)

    // Verify all published
    const updated = await db.from('posts').whereIn('id', ids)
    assert.isTrue(updated.every((p: any) => p.status === 'published'))
  })

  test('POST /api/posts/reorder updates order indexes', async ({ client, assert }) => {
    const posts = await postForUser(editorUser.id)
      .apply('blog')
      .merge({ locale: 'en' })
      .createMany(3)

    const response = await client
      .post('/api/posts/reorder')
      .withCsrfToken()
      .json({
        scope: { type: 'blog', locale: 'en', parentId: null },
        items: [
          { id: posts[2].id, orderIndex: 0 },
          { id: posts[0].id, orderIndex: 1 },
          { id: posts[1].id, orderIndex: 2 },
        ],
      })
      .withGuard('web')
      .loginAs(editorUser)

    response.assertStatus(200)
    assert.equal(response.body().updated, 3)
  })
})

test.group('Posts Modules API', (group) => {
  let adminUser: any
  let post: any

  group.setup(async () => {
    adminUser = await UserFactory.apply('admin')
      .merge({ email: 'admin-modules@example.com' })
      .create()
    post = await postForUser(adminUser.id).create()
  })

  group.teardown(async () => {
    await db.from('post_modules').where('post_id', post.id).delete()
    await db.from('posts').where('id', post.id).delete()
    await db.from('users').where('id', adminUser.id).delete()
  })

  test('POST /api/posts/:id/modules adds a module', async ({ client, assert }) => {
    const response = await client
      .post(`/api/posts/${post.id}/modules`)
      .withCsrfToken()
      .json({
        moduleType: 'hero',
        scope: 'local',
        props: { title: 'Test Hero' },
      })
      .withGuard('web')
      .loginAs(adminUser)

    // Should redirect or return success
    assert.isTrue([201, 302, 303].includes(response.status()))
  })

  test('DELETE /api/post-modules/:id removes a module', async ({ client }) => {
    // First add a module
    await client
      .post(`/api/posts/${post.id}/modules`)
      .withCsrfToken()
      .json({
        moduleType: 'prose',
        scope: 'local',
        props: {},
      })
      .withGuard('web')
      .loginAs(adminUser)

    // Get the module ID from the response or query
    const postModules = await db.from('post_modules').where('post_id', post.id)
    const moduleId = postModules[postModules.length - 1]?.id

    if (moduleId) {
      const response = await client
        .delete(`/api/post-modules/${moduleId}`)
        .withCsrfToken()
        .withGuard('web')
        .loginAs(adminUser)

      response.assertStatus(204)
    }
  })
})

test.group('Posts Revisions API', (group) => {
  let adminUser: any
  let post: any

  group.setup(async () => {
    adminUser = await UserFactory.apply('admin')
      .merge({ email: 'admin-revisions@example.com' })
      .create()
    post = await postForUser(adminUser.id).create()

    // Create some revisions
    for (let i = 0; i < 3; i++) {
      const { randomUUID } = await import('node:crypto')
      await db.table('post_revisions').insert({
        id: randomUUID(),
        post_id: post.id,
        user_id: adminUser.id,
        mode: 'approved',
        snapshot: { title: `Revision ${i}` },
        created_at: new Date(),
      })
    }
  })

  group.teardown(async () => {
    await db.from('post_revisions').where('post_id', post.id).delete()
    await db.from('posts').where('id', post.id).delete()
    await db.from('users').where('id', adminUser.id).delete()
  })

  test('GET /api/posts/:id/revisions lists revisions', async ({ client, assert }) => {
    const response = await client
      .get(`/api/posts/${post.id}/revisions`)
      .withGuard('web')
      .loginAs(adminUser)

    response.assertStatus(200)
    assert.isAtLeast(response.body().data.length, 3)
  })

  test('POST /api/posts/:id/revisions/:revId/revert restores a revision', async ({ client }) => {
    const revisions = await db
      .from('post_revisions')
      .where('post_id', post.id)
      .orderBy('created_at', 'desc')
    const revId = revisions[0]?.id

    if (revId) {
      const response = await client
        .post(`/api/posts/${post.id}/revisions/${revId}/revert`)
        .withCsrfToken()
        .withGuard('web')
        .loginAs(adminUser)

      response.assertStatus(200)
    }
  })
})

test.group('Posts Export/Import API', (group) => {
  let adminUser: any
  let post: any

  group.setup(async () => {
    adminUser = await UserFactory.apply('admin')
      .merge({ email: 'admin-export@example.com' })
      .create()
    post = await postForUser(adminUser.id).create()
  })

  group.teardown(async () => {
    await db.from('posts').where('user_id', adminUser.id).delete()
    await db.from('users').where('id', adminUser.id).delete()
  })

  test('GET /api/posts/:id/export returns canonical JSON', async ({ client, assert }) => {
    const response = await client
      .get(`/api/posts/${post.id}/export?download=0`)
      .withGuard('web')
      .loginAs(adminUser)

    response.assertStatus(200)
    const exportBody = response.body()
    assert.equal(exportBody.metadata.version, '2.0.0')
    assert.exists(exportBody.post)
    assert.equal(exportBody.post.slug, post.slug)
  })

  test('POST /api/posts/import creates a new post', async ({ client, assert }) => {
    const response = await client
      .post('/api/posts/import')
      .withCsrfToken()
      .json({
        data: {
          metadata: {
            version: '2.0.0',
            timestamp: new Date().toISOString(),
          },
          post: {
            type: 'blog',
            locale: 'en',
            slug: 'imported-post',
            title: 'Imported Post',
            status: 'draft',
          },
          modules: [],
        },
      })
      .withGuard('web')
      .loginAs(adminUser)

    response.assertStatus(201)
    assert.exists(response.body().data.id)
  })
})
