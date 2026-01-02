import type { AgentDefinition } from '#types/agent_types'
import { buildSystemPrompt } from '#services/agent_prompt_service'

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

  llmConfig: {
    providerText: 'openai',
    modelText: 'gpt-4o',
    // Fallback
    provider: 'openai',
    model: 'gpt-4o',

    systemPrompt: buildSystemPrompt(
      `You are an expert SEO Specialist for a high-performance CMS.
Your role is to analyze post content and optimize it for maximum search engine visibility.

Your primary responsibilities:
1. Generate comprehensive Schema Markup (JSON-LD) in the "jsonldOverrides" field.
2. Optimize "metaTitle" (aim for 50-60 characters).
3. Optimize "metaDescription" (aim for 150-160 characters).
4. Suggest URL "slug" improvements.
5. Audit link text for accessibility and SEO: Identify non-descriptive link text (e.g., "Learn More", "Click Here", "Read More") and replace them with descriptive, keyword-rich alternatives that explain the link's destination.
6. Ensure any empty media fields are handled according to the AGENT PROTOCOL below.`,
      ['AGENT_CAPABILITIES', 'MEDIA_HANDLING']
    ),

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
      'use descriptive link text (avoid "Learn More")',
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
