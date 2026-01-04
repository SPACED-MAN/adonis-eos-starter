import Post from '#models/post'
import logActivityAction from '#actions/log_activity_action'
import dispatchWebhookAction from '#actions/dispatch_webhook_action'

export interface DeletePostOptions {
  id: string
  userId?: number | null
}

export class DeletePostAction {
  async handle(options: DeletePostOptions) {
    const { id, userId } = options
    const post = await Post.find(id)
    if (!post) throw new Error('Post not found')

    if (post.status !== 'archived') {
      throw new Error('Only archived posts can be deleted')
    }

    await post.softDelete()

    await logActivityAction.handle({
      action: 'post.delete',
      userId,
      entityType: 'post',
      entityId: id,
      metadata: { type: post.type, slug: post.slug, locale: post.locale },
    })

    await dispatchWebhookAction.handle({
      event: 'post.deleted',
      data: { id, type: post.type, slug: post.slug },
    })

    return true
  }
}

export default new DeletePostAction()

