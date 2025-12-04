import type { AgentDefinition } from '#types/agent_types'

/**
 * SEO Optimizer Agent
 * External webhook-based agent that optimizes SEO metadata
 */
const SeoOptimizerAgent: AgentDefinition = {
  id: 'seo-optimizer',
  name: 'SEO Optimizer',
  description: 'Automatically generates and optimizes SEO metadata',
  type: 'external',
  enabled: true,

  external: {
    url: process.env.AGENT_SEO_OPTIMIZER_URL || '',
    devUrl: process.env.AGENT_SEO_OPTIMIZER_DEV_URL,
    secret: process.env.AGENT_SEO_OPTIMIZER_SECRET,
    timeout: 30000,
  },

  scopes: [
    {
      scope: 'dropdown',
      order: 20,
      enabled: true,
    },
    {
      scope: 'post.publish',
      order: 10,
      enabled: false, // Can be enabled to auto-optimize on publish
    },
  ],
}

export default SeoOptimizerAgent

