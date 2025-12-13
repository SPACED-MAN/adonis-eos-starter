import type { AgentDefinition } from '#types/agent_types'

/**
 * Translator Agent
 *
 * Intended for generating translation variations of an existing post.
 *
 * Recommended workflow:
 * - Use MCP `create_translation_ai_review` (or `create_translations_ai_review_bulk`) to create the translation post(s)
 * - Then use MCP `run_field_agent` on specific fields/modules to translate content and stage into AI Review
 * - Submit AI Review to Review for human approval
 */
const TranslatorAgent: AgentDefinition = {
  id: 'translator',
  name: 'Translator',
  description: 'Generates translation variants of a post for a target locale',
  type: 'external',
  enabled: true,

  external: {
    url: process.env.AGENT_TRANSLATOR_URL || '',
    devUrl: process.env.AGENT_TRANSLATOR_DEV_URL,
    secret: process.env.AGENT_TRANSLATOR_SECRET,
    secretHeader: process.env.AGENT_TRANSLATOR_SECRET_HEADER || 'X-Agent-Secret',
    timeout: 60000,
  },

  scopes: [
    // Manual execution from the post editor dropdown (human-in-the-loop)
    { scope: 'dropdown', order: 30, enabled: true },
    // Per-field translation buttons (optional; enable in UI as needed)
    { scope: 'field', order: 20, enabled: true },
  ],
  openEndedContext: {
    enabled: true,
    label: 'Translation instructions',
    placeholder:
      'Example: “Use a formal tone. Keep proper nouns untranslated. Prefer Latin American Spanish.”',
    maxChars: 800,
  },

  // Create a dedicated user account for attribution (email auto-generated if omitted)
  userAccount: { enabled: true },
}

export default TranslatorAgent


