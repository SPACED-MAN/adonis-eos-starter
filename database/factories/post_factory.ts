import factory from '@adonisjs/lucid/factories'
import Post from '#models/post'

export const PostFactory = factory
  .define(Post, ({ faker }) => {
    return {
      type: 'blog',
      slug: `${faker.lorem.slug()}-${faker.string.alphanumeric(8).toLowerCase()}`,
      title: faker.lorem.sentence(),
      excerpt: faker.lorem.paragraph(),
      status: 'draft' as const,
      locale: 'en',
      metaTitle: faker.lorem.sentence(),
      metaDescription: faker.lorem.sentences(2),
      userId: 1,
      authorId: 1,
    }
  })
  .state('published', (post) => {
    post.status = 'published'
  })
  .state('draft', (post) => {
    post.status = 'draft'
  })
  .state('blog', (post) => {
    post.type = 'blog'
  })
  .state('page', (post) => {
    post.type = 'page'
  })
  .build()


