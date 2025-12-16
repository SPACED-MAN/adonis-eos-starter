import type { AgentDefinition } from '#types/agent_types'

/**
 * Media Designer Agent
 *
 * @deprecated This agent has been replaced by the Graphic Designer agent (app/agents/graphic_designer.ts).
 * The Graphic Designer is an internal AI agent that can generate images and search media.
 * 
 * This file is disabled. You can delete it or keep it as a reference.
 */
const MediaDesignerAgent: AgentDefinition = {
  id: 'media-designer',
  name: 'Media Designer',
  description: 'Generates image concepts/prompts and suggests media selections for specific fields/modules',
  type: 'internal', // Changed from 'external' - needs proper internal config
  enabled: false, // Disabled - use graphic_designer.ts instead

  internal: {
    provider: 'openai',
    model: 'gpt-4',
    systemPrompt: 'Help with media selection and generation.',
    options: {
      temperature: 0.7,
      maxTokens: 1000,
    },
    useMCP: true,
    allowedMCPTools: ['list_media', 'get_media', 'search_media', 'generate_image'],
  },

  scopes: [
    // Field-scope = per-field AI buttons
    {
      scope: 'field',
      order: 10,
      enabled: true,
      fieldKeys: [
        // Core post media-ish fields
        'post.featuredImageId',

        // Common module image/media props in this codebase
        'module.hero-with-media.image',
        'module.prose-with-media.image',
        'module.kitchen-sink.image',
        'module.blockquote.avatar',
      ],
    },
  ],
  openEndedContext: {
    enabled: true,
    label: 'Creative direction',
    placeholder:
      'Example: “Warm, modern, minimal. Avoid stock-photo vibes. Include diverse people if applicable.”',
    maxChars: 800,
  },

  // Create a dedicated user account for attribution (email auto-generated if omitted)
  userAccount: { enabled: true },
}

export default MediaDesignerAgent


