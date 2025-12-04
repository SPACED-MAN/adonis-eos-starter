import type { AgentDefinition } from '#types/agent_types'

/**
 * Internal AI Assistant (Placeholder)
 * Future: Will use internal AI service instead of external webhooks
 */
const InternalAiAssistantAgent: AgentDefinition = {
  id: 'internal-ai-assistant',
  name: 'Internal AI Assistant',
  description: 'Built-in AI assistant powered by internal service',
  type: 'internal',
  enabled: false, // Disabled until internal service is implemented

  internal: {
    serviceId: 'openai',
    model: 'gpt-4',
    options: {
      temperature: 0.7,
      maxTokens: 2000,
    },
  },

  scopes: [
    {
      scope: 'dropdown',
      order: 5,
      enabled: false,
    },
    {
      scope: 'post.ai-review.save',
      order: 10,
      enabled: false,
    },
  ],
}

export default InternalAiAssistantAgent

