import type { AgentDefinition } from '#types/agent_types'
import { buildSystemPrompt } from '#services/agent_prompt_service'

/**
 * Graphic Designer Agent
 *
 * Specialized agent for generating and enhancing media assets.
 * Scoped to 'media' field type for per-field AI assistance.
 *
 * To enable:
 * 1. Set enabled: true
 * 2. Configure API keys in .env:
 *    - AI_PROVIDER_GOOGLE_API_KEY (for Gemini text and Imagen media generation)
 *    - AI_PROVIDER_OPENAI_API_KEY (optional, if using DALL-E)
 * 3. Enable scopes as needed
 */
const GraphicDesignerAgent: AgentDefinition = {
  id: 'graphic-designer',
  name: 'Graphic Designer',
  description: 'Generate and enhance media assets with AI-powered design assistance.',
  enabled: true,

  llmConfig: {
    // Reasoning model (Google Gemini 2.0 Flash)
    // This high-speed model is the "brain" that understands design instructions.
    providerText: 'google',
    modelText: 'gemini-2.0-flash',

    // Media Generation (Visual Artist)
    // Removed explicit providerMedia/modelMedia to use global 'AI Configuration' defaults.
    // To override, add providerMedia: 'google' | 'openai' and modelMedia: string here.

    // API key (optional - will use AI_PROVIDER_GOOGLE_API_KEY env var if not set)
    // apiKey: process.env.AI_PROVIDER_GOOGLE_API_KEY,

    systemPrompt: buildSystemPrompt(
      `You are a professional graphic designer AI assistant specialized in creating and enhancing visual media assets.

1. GENERATE vs SEARCH:
   - If the user uses "generate" or "create" → Use the generate_image tool immediately.
   - If the user uses "add", "include", or "find" → Search the existing media library first using search_media.
2. CONTEXTUAL SELECTION:
   - Use the module's text content as the context for searching or generating media.`,
      ['AGENT_CAPABILITIES', 'MEDIA_HANDLING']
    ),

    options: {
      temperature: 0.8, // Higher creativity for design work
      maxTokens: 8000,
    },

    // Enable MCP tool usage for media operations
    useMCP: true,

    // MCP Tool Access Control (RBAC)
    allowedMCPTools: [
      'list_media',
      'get_media',
      'search_media',
      'generate_image',
      'get_post_context',
      'update_post_module_ai_review',
      'save_post_ai_review',
    ],
  },

  // Style guide for media generation
  styleGuide: {
    designStyle: 'modern minimalist',
    colorPalette: 'clean and professional',
    designTreatments: ['high-quality photography', 'subtle gradients'],
    notes: 'Images should be professional and relevant to the content context.',
  },

  // Writing style preferences (even if media-focused, can be used for metadata)
  writingStyle: {
    tone: 'professional',
    voice: 'engaging',
    conventions: ['use active voice', 'descriptive but concise'],
    notes:
      'Metadata like alt text and descriptions should be descriptive and helpful for accessibility.',
  },

  scopes: [
    {
      scope: 'dropdown',
      order: 10,
      enabled: true,
    },
    {
      scope: 'global',
      order: 10,
      enabled: true,
    },
    {
      scope: 'field',
      order: 10,
      enabled: true,
      // Only available for media field types
      fieldTypes: ['media'],
    },
  ],

  // Optional: Open-ended context for user instructions
  openEndedContext: {
    enabled: true,
    label: 'What would you like the Graphic Designer to help with?',
    placeholder:
      'Example: "Create a modern, minimalist design for a tech startup logo" or "Suggest improvements for this image"',
    maxChars: 2000,
  },

  // Optional: Reactions (execute after agent completion)
  reactions: [],

  // Create dedicated user account for attribution
  userAccount: {
    enabled: true,
  },
}

export default GraphicDesignerAgent
