import type { AgentDefinition } from '#types/agent_types'

/**
 * Content Enhancer Agent
 * External webhook-based agent that improves post content
 */
const ContentEnhancerAgent: AgentDefinition = {
  id: 'content-enhancer',
  name: 'Content Enhancer',
  description: 'AI-powered content improvement suggestions for posts',
  type: 'external',
  enabled: true,

  external: {
    // Production webhook URL
    url: process.env.AGENT_CONTENT_ENHANCER_URL || '',

    // Development webhook URL (optional)
    devUrl: process.env.AGENT_CONTENT_ENHANCER_DEV_URL,

    // Authentication
    secret: process.env.AGENT_CONTENT_ENHANCER_SECRET,
    secretHeader: 'X-Agent-Secret', // Optional: defaults to Authorization: Bearer

    // Timeout in milliseconds
    timeout: 30000,
  },

  scopes: [
    {
      scope: 'dropdown',
      order: 10,
      enabled: true,
    },
    {
      scope: 'post.review.save',
      order: 20,
      enabled: false, // Disabled by default, can be enabled as needed
    },
  ],
}

export default ContentEnhancerAgent

