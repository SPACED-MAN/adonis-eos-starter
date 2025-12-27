import vine from '@vinejs/vine'

export const feedbackValidator = vine.compile(
  vine.object({
    postId: vine.string().uuid(),
    mode: vine.enum(['approved', 'review', 'ai-review']),
    content: vine.string().minLength(1),
    type: vine.string().maxLength(50).optional(),
    context: vine.any().optional(),
  })
)
