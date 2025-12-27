import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Post from '#models/post'
import PostModule from '#models/post_module'
import ModuleInstance from '#models/module_instance'
import PostSerializerService from '#services/post_serializer_service'
import { randomUUID } from 'node:crypto'

test.group('PostSerializerService', (group) => {
  group.each.setup(async () => {
    await testUtils.db().truncate()
  })

  test('should serialize a post with modules', async ({ assert }) => {
    // 1. Create a post
    const post = await Post.create({
      type: 'blog',
      slug: `test-post-${Date.now()}`,
      title: 'Test Post',
      status: 'published',
      locale: 'en',
      userId: 1,
    })

    // 2. Create a module instance
    const instance = await ModuleInstance.create({
      id: randomUUID(),
      type: 'prose',
      scope: 'post',
      props: { content: { root: { children: [] } } },
    })

    // 3. Link module to post
    await PostModule.create({
      id: randomUUID(),
      postId: post.id,
      moduleId: instance.id,
      orderIndex: 0,
    })

    // 4. Serialize
    const result = await PostSerializerService.serialize(post.id, 'source')

    // 5. Assertions
    assert.equal(result.post.id, post.id)
    assert.equal(result.post.slug, post.slug)
    assert.equal(result.post.title, 'Test Post')
    assert.lengthOf(result.modules, 1)
    assert.equal(result.modules[0].type, 'prose')
    assert.equal(result.modules[0].moduleInstanceId, instance.id)
  })

  test('should throw error for non-existent post', async ({ assert }) => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000'
    
    await assert.rejects(async () => {
      await PostSerializerService.serialize(nonExistentId)
    }, 'Post not found')
  })
})

