import type { AgentDefinition } from '#types/agent_types'

/**
 * Videographer Agent
 *
 * Specialized agent for generating and enhancing video assets.
 * Scoped to 'media' field type for per-field AI assistance.
 *
 * To enable:
 * 1. Set enabled: true
 * 2. Configure API keys in .env:
 *    - AI_PROVIDER_GOOGLE_API_KEY (for Gemini text and Veo video generation)
 * 3. Enable scopes as needed
 */
const VideographerAgent: AgentDefinition = {
  id: 'videographer',
  name: 'Videographer',
  description: 'Generate and enhance video assets with AI-powered video production assistance.',
  enabled: true,

  internal: {
    // Reasoning model (Google Gemini 2.0 Flash)
    providerText: 'google',
    modelText: 'gemini-2.0-flash',

    // Video Generation (Cinematographer)
    // Uses global 'AI Configuration' video defaults if providerVideo/modelVideo are omitted.
    // To override, uncomment and specify:
    // providerVideo: 'google',
    // modelVideo: 'veo-2',

    systemPrompt: `You are a professional videographer AI assistant specialized in creating and enhancing video assets.

You have access to MCP (Model Context Protocol) tools:
- list_post_types: List all registered post types.
- get_post_context: Read post modules and data. Params: { postId }
- save_post_ai_review: Update post fields (e.g. featuredImageId, which can also hold video IDs). Params: { postId, patch: { ... } }
- update_post_module_ai_review: Update a module's content. Params: { postModuleId, overrides: { ... }, moduleInstanceId }
- search_media: Find existing videos or images. Params: { q }
- generate_video: Create new video clips. Params: { prompt, aspect_ratio }

AGENT PROTOCOL - VIDEO HANDLING:
1. GENERATE vs SEARCH:
   - If the user uses "generate", "create", or "make" a video → Use the generate_video tool.
   - If the user uses "add", "include", or "find" → Search existing media first using search_media.
2. AUTO-POPULATE EMPTY FIELDS:
   - Check for empty video or media fields in modules.
   - Use search_media or generate_video as appropriate.
   - Update the module using update_post_module_ai_review.
3. CONTEXTUAL PRODUCTION:
   - Use the surrounding text and post context to determine the style and content of the video.

CRITICAL: You MUST respond with valid JSON ONLY. No conversational text.`,

    options: {
      temperature: 0.7,
      maxTokens: 8000,
    },

    useMCP: true,

    allowedMCPTools: [
      'list_media',
      'get_media',
      'search_media',
      'generate_video',
      'get_post_context',
      'update_post_module_ai_review',
      'save_post_ai_review',
    ],
  },

  styleGuide: {
    designStyle: 'cinematic',
    colorPalette: 'natural and vibrant',
    designTreatments: ['high-definition', 'smooth transitions'],
    notes: 'Videos should be professional and match the brand aesthetic.',
  },

  writingStyle: {
    tone: 'professional',
    voice: 'engaging',
    conventions: ['descriptive metadata', 'accessibility-focused captions'],
  },

  scopes: [
    {
      scope: 'dropdown',
      order: 11,
      enabled: true,
    },
    {
      scope: 'global',
      order: 11,
      enabled: true,
    },
    {
      scope: 'field',
      order: 11,
      enabled: true,
      fieldTypes: ['media'],
    },
  ],

  openEndedContext: {
    enabled: true,
    label: 'What kind of video assistance do you need?',
    placeholder: 'Example: "Generate a cinematic aerial shot of a coffee shop" or "Find a video of a person typing on a laptop"',
    maxChars: 2000,
  },

  userAccount: {
    enabled: true,
  },
}

export default VideographerAgent

