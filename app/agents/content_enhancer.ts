import type { AgentDefinition } from '#types/agent_types'

/**
 * Content Enhancer Agent
 * 
 * @deprecated External agents have been moved to the Workflows system.
 * This agent is disabled and needs to be migrated:
 * - If you need AI-powered content enhancement: Convert to an internal agent (type: 'internal')
 * - If you need webhook-based automation: Create a workflow in app/workflows/
 * 
 * To re-enable, convert this to an internal agent or delete and create a workflow.
 */
const ContentEnhancerAgent: AgentDefinition = {
  id: 'content-enhancer',
  name: 'Content Enhancer',
  description: 'AI-powered content improvement suggestions for posts',
  type: 'internal', // Changed from 'external' - needs proper internal config
  enabled: false, // Disabled until migrated

  // TODO: Migrate to internal agent or workflow
  // For internal agent, add:
  // internal: {
  //   provider: 'openai',
  //   model: 'gpt-4',
  //   systemPrompt: '...',
  //   useMCP: true,
  // }
  // For workflow, create app/workflows/content_enhancer.ts
  internal: {
    provider: 'openai',
    model: 'gpt-4',
    systemPrompt: 'You are a content enhancement assistant. Improve content while maintaining the original intent.',
    options: {
      temperature: 0.7,
      maxTokens: 2000,
    },
    useMCP: true,
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
  openEndedContext: {
    enabled: true,
    label: 'What would you like to improve?',
    placeholder:
      'Example: “Make this clearer for beginners. Keep the tone friendly. Don’t change the CTA.”',
    maxChars: 1200,
  },

  // Create a dedicated user account for attribution (email auto-generated if omitted)
  userAccount: { enabled: true },
}

export default ContentEnhancerAgent
