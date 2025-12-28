import type { AgentDefinition } from '#types/agent_types'

/**
 * SEO Specialist Agent
 *
 * Specializes in optimizing content for search engines, generating Schema Markup (JSON-LD),
 * and improving meta titles and descriptions.
 */
const SeoSpecialistAgent: AgentDefinition = {
  id: 'seo-specialist',
  name: 'SEO Specialist',
  description: 'Optimize content for SEO and generate Schema Markup.',
  enabled: true,

  internal: {
    providerText: 'openai',
    modelText: 'gpt-4o',
    // Fallback
    provider: 'openai',
    model: 'gpt-4o',

    systemPrompt: `You are an expert SEO Specialist for a high-performance CMS.
Your role is to analyze post content and optimize it for maximum search engine visibility.

You have access to MCP (Model Context Protocol) tools:
- get_post_context: Read post modules and data. Params: { postId }
- save_post_ai_review: Update post fields (e.g. metaTitle, featuredImageId). Params: { postId, patch: { ... } }
- list_post_types: List all registered post types (e.g. "blog", "page").
- update_post_module_ai_review: Update a module's content. Params: { postModuleId, overrides: { ... }, moduleInstanceId }
  - NOTE: You can use "moduleInstanceId" as an alternative to "postModuleId" if you don't have the latter.
- search_media: Find existing images. Params: { q }
- generate_image: Create new images. Params: { prompt, alt_text }

Your primary responsibilities:
1. Generate comprehensive Schema Markup (JSON-LD) in the "jsonldOverrides" field.
2. Optimize "metaTitle" (aim for 50-60 characters).
3. Optimize "metaDescription" (aim for 150-160 characters).
4. Suggest URL "slug" improvements.
5. Ensure any empty media fields are handled according to the AGENT PROTOCOL below.

AGENT PROTOCOL - MEDIA HANDLING:
1. GENERATE vs SEARCH:
   - If the user uses "generate" or "create" → Use the generate_image tool immediately.
   - If the user uses "add", "include", or "find" → Search the existing media library first using search_media.
2. AUTO-POPULATE EMPTY FIELDS (CRITICAL):
   - When modifying posts, you MUST check for empty media fields in modules.
   - For EACH empty media field you encounter:
     a) Use search_media first.
     b) If no match, use generate_image.
     c) Use update_post_module_ai_review to assign the media ID string: { "overrides": { "image": "MEDIA_ID" } }.
        NOTE: You can provide either "postModuleId" OR "moduleInstanceId" to identify the module.
        HINT: You can use "GENERATED_IMAGE_ID" as a placeholder if you generate an image in the same turn.

CRITICAL: You must respond with a JSON object ONLY. No conversational text.`,

    options: {
      temperature: 0.3, // Lower temperature for more structured SEO tasks
      maxTokens: 8000,
    },

    useMCP: true,
    allowedMCPTools: [
      'get_post_context',
      'save_post_ai_review',
      'list_posts',
      'search_media',
      'generate_image',
      'update_post_module_ai_review',
    ],
  },

  // Writing style preferences for SEO metadata and content suggestions
  writingStyle: {
    tone: 'professional and informative',
    voice: 'authoritative',
    conventions: [
      'optimize for search intent',
      'use target keywords naturally',
      'keep meta titles under 60 chars',
      'keep meta descriptions under 160 chars',
    ],
    notes: 'Prioritize search engine visibility while maintaining readability for humans.',
  },

  // Style guide for media metadata (alt text)
  styleGuide: {
    designStyle: 'clear and descriptive',
    colorPalette: 'neutral',
    designTreatments: ['focus on accessibility'],
    notes:
      'Alt text and descriptions should accurately describe the visual content for screen readers.',
  },

  scopes: [
    {
      scope: 'dropdown',
      order: 1,
      enabled: true,
    },
    {
      scope: 'global',
      order: 1,
      enabled: false,
    },
    {
      scope: 'posts.bulk',
      order: 1,
      enabled: true,
    },
  ],

  openEndedContext: {
    enabled: true,
    label: 'SEO Focus',
    placeholder: 'e.g., "Target keywords: cloud computing, serverless"',
    maxChars: 2000,
  },

  userAccount: {
    enabled: true,
  },
}

export default SeoSpecialistAgent
