import type { HttpContext } from '@adonisjs/core/http'
import Feedback from '#models/feedback'
import CreateFeedback from '#actions/feedbacks/create_feedback'
import { feedbackValidator } from '#validators/feedback'

export default class FeedbacksController {
  async index({ request, response }: HttpContext) {
    const { postId, mode } = request.qs()

    if (!postId) {
      return response.badRequest({ message: 'postId is required' })
    }

    const query = Feedback.query()
      .where('post_id', postId)
      .preload('user', (q) => q.select('id', 'username', 'email', 'role'))
      .orderBy('created_at', 'desc')

    if (mode) {
      query.where('mode', mode)
    }

    const feedbacks = await query
    return response.ok(feedbacks)
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const payload = await request.validateUsing(feedbackValidator)

    const feedback = await CreateFeedback.handle({
      ...payload,
      userId: user.id,
      mode: payload.mode as 'approved' | 'review' | 'ai-review',
    })

    return response.created(feedback)
  }

  async update({ params, request, response }: HttpContext) {
    const feedback = await Feedback.findOrFail(params.id)
    const { status } = request.only(['status'])

    if (status) {
      feedback.status = status
      await feedback.save()
    }

    return response.ok(feedback)
  }

  async destroy({ params, response }: HttpContext) {
    const feedback = await Feedback.findOrFail(params.id)
    await feedback.delete()
    return response.noContent()
  }
}

