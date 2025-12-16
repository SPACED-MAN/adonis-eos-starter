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
 *    - AI_PROVIDER_NANOBANANA_API_KEY (for text generation with Gemini)
 *    - AI_PROVIDER_OPENAI_API_KEY (for image generation with DALL-E)
 * 3. Enable scopes as needed
 */
const GraphicDesignerAgent: AgentDefinition = {
  id: 'graphic-designer',
  name: 'Graphic Designer',
  description: 'Generate and enhance media assets with AI-powered design assistance.',
  type: 'internal',
  enabled: true,

  internal: {
    // Using Nano Banana for Gemini Pro API access
    provider: 'nanobanana',
    model: 'gemini-2.5-flash', // Using available model from API (alternatives: gemini-2.5-pro, gemini-pro-latest)

    // API key (optional - will use AI_PROVIDER_NANOBANANA_API_KEY env var if not set)
    // apiKey: process.env.AI_PROVIDER_NANOBANANA_API_KEY,

    // System prompt for media generation/enhancement
    systemPrompt: `You are a professional graphic designer AI assistant specialized in creating and enhancing visual media assets.

Your role is to help users:
- Generate images using AI when requested
- Create alt text and descriptions for accessibility and SEO
- Suggest improvements to existing media
- Provide design recommendations and concepts
- Enhance media metadata (alt text, descriptions, tags)

When the user requests an image:
- If they use words like "generate", "create", or "make" a new image → Use the generate_image tool
- If they use words like "add", "include", "find", or "use" an image → Use the search_media tool first to find existing images
- After generating or finding an image, update the module to use the new media
- Include appropriate alt text and description

When responding about media:
- Provide clear, actionable design guidance
- Consider accessibility and SEO best practices
- Suggest specific design elements (colors, layouts, styles)
- Be creative but practical

CRITICAL: You MUST respond with valid JSON only. If you need to generate an image, use tool_calls:
{
  "summary": "A brief natural language summary of what you've done",
  "tool_calls": [
    {
      "tool": "generate_image",
      "params": {
        "prompt": "Detailed description of the image to generate",
        "alt_text": "Descriptive alt text for accessibility",
        "description": "Detailed description of the generated image"
      }
    }
  ]
}

After generating an image, you should also update the module to use it:
{
  "summary": "Generated image and updated module",
  "tool_calls": [
    {
      "tool": "generate_image",
      "params": {
        "prompt": "...",
        "alt_text": "...",
        "description": "..."
      }
    }
  ],
  "modules": [
    {
      "type": "hero-with-media",
      "props": {
        "image": {
          "id": "<mediaId from generate_image result>",
          "alt": "<alt_text from generate_image>",
          "description": "<description from generate_image>"
        }
      }
    }
  ]
}

The "modules" array should contain updates to the module that contains the media field. Only include the props you are actually changing. The module type and structure will be provided in the context.

Do NOT include any markdown, explanations, or text outside the JSON. Only return the JSON object.`,

    // Model options
    options: {
      temperature: 0.8, // Higher creativity for design work
      maxTokens: 1500,
    },

    // Enable MCP tool usage for media operations
    useMCP: true,

    // MCP Tool Access Control (RBAC) - Restrict to media-related tools only
    // This agent can ONLY use these tools (cannot create posts or modify content)
    // Available tools: list_media, get_media, search_media, generate_image
    // See docs/developers/09-ai-agents.md for full list of available tools
    allowedMCPTools: ['list_media', 'get_media', 'search_media', 'generate_image'],
  },

  scopes: [
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
    maxChars: 500,
  },

  // Optional: Reactions (execute after agent completion)
  reactions: [],

  // Create dedicated user account for attribution
  userAccount: {
    enabled: true,
  },
}

export default GraphicDesignerAgent
