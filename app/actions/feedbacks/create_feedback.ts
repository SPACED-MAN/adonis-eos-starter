import Feedback from '#models/feedback'
import activityLogService from '#services/activity_log_service'
import workflowExecutionService from '#services/workflow_execution_service'
import agentTriggerService from '#services/agent_trigger_service'
import Post from '#models/post'

type CreateFeedbackParams = {
  postId: string
  userId: number
  mode: 'approved' | 'review' | 'ai-review'
  content: string
  type: string
  context?: any
}

export default class CreateFeedback {
  static async handle({
    postId,
    userId,
    mode,
    content,
    type,
    context,
  }: CreateFeedbackParams): Promise<Feedback> {
    const feedback = await Feedback.create({
      postId,
      userId,
      mode,
      content,
      type,
      context,
      status: 'pending',
    })

    const post = await Post.find(postId)

    // 1. Audit Log
    await activityLogService.log({
      action: 'feedback.created',
      userId,
      entityType: 'post',
      entityId: postId,
      metadata: {
        feedbackId: feedback.id,
        mode,
        type,
        content: content.substring(0, 100),
      },
    })

    // 2. Trigger Workflows
    await workflowExecutionService.executeWorkflows(
      'feedback.created',
      {
        feedback: feedback.toJSON(),
        post: post?.toJSON(),
        user: { id: userId },
      },
      {
        userId,
        postType: post?.type,
      }
    )

    // 3. Trigger Agents
    await agentTriggerService.runAgentsForScope('feedback.created', postId, {
      feedback: feedback.toJSON(),
      userId,
      viewMode: mode,
    })

    return feedback
  }
}
