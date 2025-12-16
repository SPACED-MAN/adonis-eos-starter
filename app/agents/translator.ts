import type { AgentDefinition } from '#types/agent_types'

/**
 * Translator Agent
 *
 * @deprecated External agents have been moved to the Workflows system.
 * This agent is disabled and needs to be migrated to an internal agent.
 *
 * Recommended workflow:
 * - Use MCP `create_translation_ai_review` (or `create_translations_ai_review_bulk`) to create the translation post(s)
 * - Then use MCP `run_field_agent` on specific fields/modules to translate content and stage into AI Review
 * - Submit AI Review to Review for human approval
 *
 * To re-enable, convert this to an internal agent with proper AI provider configuration.
 */
const TranslatorAgent: AgentDefinition = {
  id: 'translator',
  name: 'Translator',
  description: 'Generates translation variants of a post for a target locale',
  type: 'internal', // Changed from 'external' - needs proper internal config
  enabled: false, // Disabled until migrated

  internal: {
    provider: 'openai',
    model: 'gpt-4',
    systemPrompt:
      'You are a professional translator. Translate content accurately while preserving tone and meaning.',
    options: {
      temperature: 0.7,
      maxTokens: 2000,
    },
    useMCP: true,
    allowedMCPTools: ['get_post_context', 'save_post_ai_review', 'update_post_module_ai_review'],
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
