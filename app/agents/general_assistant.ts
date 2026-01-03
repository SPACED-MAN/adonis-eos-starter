import type { AgentDefinition } from '#types/agent_types'
import { buildSystemPrompt } from '#services/agent_prompt_service'

/**
 * General Assistant
 *
 * General-purpose AI assistant using OpenAI. Can be configured to use any supported provider
 * (OpenAI, Anthropic, Google, Nano Banana) by changing the provider and model fields.
 *
 * To enable:
 * 1. Set enabled: true
 * 2. Configure API key in .env: AI_PROVIDER_OPENAI_API_KEY=your-key
 *    OR set apiKey directly in the config (not recommended for production)
 * 3. Enable scopes as needed
 */
const GeneralAssistantAgent: AgentDefinition = {
  id: 'general-assistant',
  name: 'General Assistant',
  description: 'Make any general request.',
  enabled: true, // Set to true to enable

  llmConfig: {
    // Provider: 'openai' | 'anthropic' | 'google' | 'nanobanana'
    providerText: 'openai',
    modelText: 'gpt-4o',

    // Fallback options
    provider: 'openai',
    model: 'gpt-4o',

    // Model identifier (provider-specific)
    // OpenAI: 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini'
    // Anthropic: 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'
    // Google: 'gemini-pro', 'gemini-pro-vision'
    // Nano Banana: 'gemini-pro' (uses Gemini Pro API via Nano Banana service)
    // model: 'gpt-4o', // Using gpt-4o as default (more widely available)

    // API key (optional - will use AI_PROVIDER_OPENAI_API_KEY env var if not set)
    // apiKey: process.env.AI_PROVIDER_OPENAI_API_KEY,

    systemPrompt: buildSystemPrompt(
      `You are a helpful content assistant for a CMS system. Your role is to help improve and enhance content while maintaining the original intent.`,
      ['AGENT_CAPABILITIES', 'CONTENT_QUALITY', 'MODULE_HANDLING', 'MEDIA_HANDLING']
    ),

    // Model options
    options: {
      temperature: 0.7,
      maxTokens: 8000, // Increased for complex multi-turn workflows
    },

    // Enable MCP tool usage (allows agent to use CMS tools)
    useMCP: true,

    // MCP Tool Access Control (RBAC)
    // - If empty array []: Agent has access to ALL MCP tools (default)
    // - If specified: Agent can ONLY use the tools listed in the array
    // This agent has access to all tools including media search and generation
    // Note: The system prompt guides the agent to search existing media first, only generate if explicitly asked
    allowedMCPTools: [], // Full access - includes search_media and generate_image
  },

  // Writing style preferences for text generation
  writingStyle: {
    tone: 'professional',
    voice: 'engaging',
    conventions: ['use active voice', 'keep sentences concise'],
    notes: 'Maintain a helpful and informative tone consistent with a professional CMS assistant.',
  },

  // Style guide for media generation
  styleGuide: {
    designStyle: 'modern minimalist',
    colorPalette: 'clean and professional',
    designTreatments: ['high-quality photography', 'subtle gradients'],
    notes: 'Images should be professional and relevant to the content context.',
  },

  scopes: [
    {
      scope: 'dropdown',
      order: 5,
      enabled: true, // Set to true to enable manual execution
    },
    {
      scope: 'global',
      order: 5,
      enabled: true, // Set to true to enable global floating button
    },
    {
      scope: 'post.ai-review.save',
      order: 10,
      enabled: false, // Set to true to auto-trigger on AI review save
    },
    {
      scope: 'field',
      order: 5,
      enabled: true,
      fieldTypes: ['text', 'textarea', 'richtext'],
    },
  ],

  // Optional: Open-ended context for user instructions
  openEndedContext: {
    enabled: true,
    label: 'What would you like the AI to help with?',
    placeholder: 'Example: "Improve the SEO metadata and make the content more engaging."',
    maxChars: 10000,
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
    // email: 'general-assistant@agents.local', // Optional, auto-generated if omitted
  },
}

export default GeneralAssistantAgent
