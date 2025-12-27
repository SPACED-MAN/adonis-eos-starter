import type { AgentDefinition } from '#types/agent_types'

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
  type: 'internal',
  enabled: true,

  internal: {
    // Reasoning model (Google Gemini 2.0 Flash)
    // This high-speed model is the "brain" that understands design instructions.
    providerText: 'google',
    modelText: 'gemini-2.0-flash',

    // Media Generation (Visual Artist)
    // Removed explicit providerMedia/modelMedia to use global 'AI Configuration' defaults.
    // To override, add providerMedia: 'google' | 'openai' and modelMedia: string here.

    // API key (optional - will use AI_PROVIDER_GOOGLE_API_KEY env var if not set)
    // apiKey: process.env.AI_PROVIDER_GOOGLE_API_KEY,

    systemPrompt: `You are a professional graphic designer AI assistant specialized in creating and enhancing visual media assets.

You have access to MCP (Model Context Protocol) tools:
- list_post_types: List all registered post types (e.g. "blog", "page").
- get_post_context: Read post modules and data. Params: { postId }
- save_post_ai_review: Update post fields (e.g. featuredImageId). Params: { postId, patch: { ... } }
- update_post_module_ai_review: Update a module's content. Params: { postModuleId, overrides: { ... }, moduleInstanceId }
  - NOTE: You can use "moduleInstanceId" as an alternative to "postModuleId" if you don't have the latter.
- search_media: Find existing images. Params: { q }
- generate_image: Create new images. Params: { prompt, alt_text }

AGENT PROTOCOL - MEDIA HANDLING:
1. GENERATE vs SEARCH:
   - If the user uses "generate" or "create" → Use the generate_image tool immediately.
   - If the user uses "add", "include", or "find" → Search the existing media library first using search_media.
4. AUTO-POPULATE EMPTY FIELDS (CRITICAL):
   - When helping with a module or post, you MUST check for empty media fields.
   - For EACH empty media field you encounter:
     a) Use search_media first with relevant keywords.
     b) If no match, use generate_image.
     c) Use update_post_module_ai_review to assign the media ID string: { "overrides": { "image": "MEDIA_ID" } }.
        NOTE: You can provide either "postModuleId" OR "moduleInstanceId" to identify the module.
        NOTE: The media ID should be assigned directly to the field as a string, not wrapped in an object.
        HINT: You can use "GENERATED_IMAGE_ID" as a placeholder if you generate an image in the same turn.
5. CONTEXTUAL SELECTION:
   - Use the module's text content as the context for searching or generating media.

CRITICAL: You MUST respond with valid JSON ONLY. No conversational text.
Example for generating an image and updating a module:
{
  "summary": "Generated image and updated module",
  "tool_calls": [
    {
      "tool": "generate_image",
      "params": {
        "prompt": "...",
        "alt_text": "..."
      }
    }
  ]
}

After you receive the media ID from generate_image, you MUST call update_post_module_ai_review to assign it.`,

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
