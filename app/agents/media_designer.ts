import type { AgentDefinition } from '#types/agent_types'

/**
 * Media Designer Agent
 *
 * Field-scoped agent intended for per-field AI buttons that help:
 * - generate image ideas/prompts
 * - suggest alt text/captions
 * - propose image selections from the media library (by searching)
 *
 * NOTE: This agent does not upload media itself. Use MCP media discovery tools
 * (`list_media`, `get_media`) and stage module updates via AI Review tools.
 */
const MediaDesignerAgent: AgentDefinition = {
  id: 'media-designer',
  name: 'Media Designer',
  description: 'Generates image concepts/prompts and suggests media selections for specific fields/modules',
  type: 'external',
  enabled: true,

  external: {
    url: process.env.AGENT_MEDIA_DESIGNER_URL || '',
    devUrl: process.env.AGENT_MEDIA_DESIGNER_DEV_URL,
    secret: process.env.AGENT_MEDIA_DESIGNER_SECRET,
    secretHeader: process.env.AGENT_MEDIA_DESIGNER_SECRET_HEADER || 'X-Agent-Secret',
    timeout: 60000,
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


