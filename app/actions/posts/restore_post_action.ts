import Post from '#models/post'
import logActivityAction from '#actions/log_activity_action'
import dispatchWebhookAction from '#actions/dispatch_webhook_action'

export interface RestorePostOptions {
  id: string
  userId?: number | null
}

export class RestorePostAction {
  async handle(options: RestorePostOptions) {
    const { id, userId } = options
    
    // Temporarily include deleted posts
    Post.softDeleteEnabled = false
    const post = await Post.find(id)
    Post.softDeleteEnabled = true

    if (!post) throw new Error('Post not found')
    if (!post.isDeleted) throw new Error('Post is not deleted')

    await post.restore()

    await logActivityAction.handle({
      action: 'post.restore',
      userId,
      entityType: 'post',
      entityId: id,
    })

    await dispatchWebhookAction.handle({
      event: 'post.restored',
      data: { id },
    })

    return true
  }
}

export default new RestorePostAction()

