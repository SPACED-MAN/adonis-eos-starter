import db from '@adonisjs/lucid/services/db'
import Post from '#models/post'
import logActivityAction from '#actions/log_activity_action'

export interface UpdatePostAuthorOptions {
  postId: string
  authorId: number
  userId?: number | null
}

export class UpdatePostAuthorAction {
  async handle(options: UpdatePostAuthorOptions) {
    const { postId, authorId, userId } = options

    const post = await Post.find(postId)
    if (!post) throw new Error('Post not found')

    const userExists = await db.from('users').where('id', authorId).first()
    if (!userExists) throw new Error('User not found')

    if (post.type === 'profile') {
      const existing = await db
        .from('posts')
        .where({ type: 'profile', author_id: authorId })
        .andWhereNot('id', postId)
        .first()
      if (existing) {
        throw new Error('Target user already has a profile')
      }
    }

    await db.from('posts').where('id', postId).update({
      author_id: authorId,
      updated_at: new Date(),
    })

    await logActivityAction.handle({
      action: 'post.author_update',
      userId,
      entityType: 'post',
      entityId: postId,
      metadata: { authorId },
    })

    return true
  }
}

export default new UpdatePostAuthorAction()

