import type { AgentDefinition } from '#types/agent_types'

/**
 * SEO Optimizer Agent
 * 
 * @deprecated External agents have been moved to the Workflows system.
 * This agent is disabled and needs to be migrated:
 * - If you need AI-powered SEO optimization: Convert to an internal agent (type: 'internal')
 * - If you need webhook-based automation: Create a workflow in app/workflows/
 * 
 * To re-enable, convert this to an internal agent or delete and create a workflow.
 */
const SeoOptimizerAgent: AgentDefinition = {
  id: 'seo-optimizer',
  name: 'SEO Optimizer',
  description: 'Automatically generates and optimizes SEO metadata',
  type: 'internal', // Changed from 'external' - needs proper internal config
  enabled: false, // Disabled until migrated

  internal: {
    provider: 'openai',
    model: 'gpt-4',
    systemPrompt: 'You are an SEO expert. Optimize metadata for better search rankings.',
    options: {
      temperature: 0.7,
      maxTokens: 500,
    },
    useMCP: true,
    allowedMCPTools: ['get_post_context', 'save_post_ai_review'],
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
  openEndedContext: {
    enabled: true,
    label: 'SEO goals / constraints',
    placeholder:
      'Example: “Target keyword: ‘fleet management software’. Keep title under 60 chars, meta under 155 chars.”',
    maxChars: 800,
  },

  // Create a dedicated user account for attribution (email auto-generated if omitted)
  userAccount: { enabled: true },
}

export default SeoOptimizerAgent
