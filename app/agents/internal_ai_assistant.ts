import type { AgentDefinition } from '#types/agent_types'

/**
 * Internal AI Assistant
 *
 * Example internal agent using OpenAI. Can be configured to use any supported provider
 * (OpenAI, Anthropic, Google) by changing the provider and model fields.
 *
 * To enable:
 * 1. Set enabled: true
 * 2. Configure API key in .env: AI_PROVIDER_OPENAI_API_KEY=your-key
 *    OR set apiKey directly in the config (not recommended for production)
 * 3. Enable scopes as needed
 */
const InternalAiAssistantAgent: AgentDefinition = {
  id: 'internal-ai-assistant',
  name: 'Internal AI Assistant',
  description: 'Built-in AI assistant powered by OpenAI (configurable to Anthropic/Google)',
  type: 'internal',
  enabled: true, // Set to true to enable

  internal: {
    // Provider: 'openai' | 'anthropic' | 'google'
    provider: 'openai',

    // Model identifier (provider-specific)
    // OpenAI: 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini'
    // Anthropic: 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'
    // Google: 'gemini-pro', 'gemini-pro-vision'
    model: 'gpt-4o', // Using gpt-4o as default (more widely available)

    // API key (optional - will use AI_PROVIDER_OPENAI_API_KEY env var if not set)
    // apiKey: process.env.AI_PROVIDER_OPENAI_API_KEY,

    // System prompt template (supports {{variable}} interpolation)
    systemPrompt: `You are a helpful content assistant for a CMS system.
Your role is to help improve and enhance content while maintaining the original intent.

CRITICAL: You MUST respond with valid JSON only, in this exact format:
{
  "post": {
    "title": "Updated title here",
    "excerpt": "Updated excerpt here",
    // Only include fields you are actually changing
  }
}

Do NOT include any markdown, explanations, or text outside the JSON. Only return the JSON object.`,

    // Model options
    options: {
      temperature: 0.7,
      maxTokens: 2000,
    },

    // Enable MCP tool usage (allows agent to use CMS tools)
    useMCP: false,

    // Restrict MCP tools (if empty, all tools available)
    // allowedMCPTools: ['list_posts', 'get_post_context'],
  },

  scopes: [
    {
      scope: 'dropdown',
      order: 5,
      enabled: true, // Set to true to enable manual execution
    },
    {
      scope: 'post.ai-review.save',
      order: 10,
      enabled: false, // Set to true to auto-trigger on AI review save
    },
  ],

  // Optional: Open-ended context for user instructions
  openEndedContext: {
    enabled: true,
    label: 'What would you like the AI to help with?',
    placeholder: 'Example: "Improve the SEO metadata and make the content more engaging."',
    maxChars: 1000,
  },

  // Optional: Reactions (execute after agent completion)
  reactions: [
    // Example: Slack notification on success
    // {
    //   type: 'slack',
    //   trigger: 'on_success',
    //   enabled: true,
    //   config: {
    //     webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
    //     channel: '#content-alerts',
    //     template: 'AI Assistant completed: {{agent}} processed post {{data.postId}}',
    //   },
    // },
  ],

  // Create dedicated user account for attribution
  userAccount: {
    enabled: true,
    // email: 'ai-assistant@agents.local', // Optional, auto-generated if omitted
  },
}

export default InternalAiAssistantAgent
