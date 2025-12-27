import type { AgentScope } from '#types/agent_types'
import agentRegistry from '#services/agent_registry'
import internalAgentExecutor from '#services/internal_agent_executor'
import PostSerializerService from '#services/post_serializer_service'

/**
 * Agent Trigger Service
 * Handles automatic execution of agents based on scope triggers
 */
class AgentTriggerService {
  /**
   * Run all agents enabled for a specific scope
   */
  async runAgentsForScope(
    scope: AgentScope,
    postId: string,
    context: Record<string, any> = {}
  ): Promise<void> {
    const agents = agentRegistry.listByScope(scope)

    if (agents.length === 0) {
      return
    }

    // Serialize post data for the agents
    // For automatic triggers, we typically use the 'review' or 'source' view mode
    // depending on the action. For translations, 'source' is fine.
    const viewMode = context.viewMode || 'source'
    const postData = await PostSerializerService.serialize(postId, viewMode)

    // Execute each agent
    for (const agent of agents) {
      try {
        const executionContext = {
          agent,
          scope,
          userId: context.userId,
          data: {
            postId,
            post: postData,
            ...context,
          },
        }

        const payload = {
          post: postData,
          modules: postData.modules,
          context: {
            ...context,
          },
        }

        // We run these in sequence to avoid overwhelming the AI providers
        // and because some agents might depend on changes from previous ones
        // (though currently we don't re-serialize between agents in the same scope)
        await internalAgentExecutor.execute(agent, executionContext, payload)
      } catch (error) {
        console.error(`Failed to run automatic agent ${agent.id} for scope ${scope}:`, error)
      }
    }
  }
}

const agentTriggerService = new AgentTriggerService()
export default agentTriggerService
