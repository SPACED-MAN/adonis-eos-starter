import type { AgentDefinition } from '#types/agent_types'
import { buildSystemPrompt } from '#services/agent_prompt_service'

/**
 * Translator Agent
 *
 * Specializes in multi-lingual content management.
 * Can create new post translations, clone module structures, and translate copy.
 */
const TranslatorAgent: AgentDefinition = {
  id: 'translator',
  name: 'Translator',
  description: 'Create translations and manage multi-lingual content.',
  enabled: true,

  llmConfig: {
    providerText: 'openai',
    modelText: 'gpt-4o',
    // Fallback
    provider: 'openai',
    model: 'gpt-4o',

    systemPrompt: buildSystemPrompt(
      `You are a professional multi-lingual translator and content assistant. Your role is to help users manage content across different locales.`,
      ['AGENT_CAPABILITIES', 'TRANSLATION_PROTOCOL']
    ),

    options: {
      temperature: 0.3, // Lower temperature for more accurate translations
      maxTokens: 8000,
    },

    useMCP: true,
    allowedMCPTools: [
      'list_posts',
      'get_post_context',
      'create_translation_ai_review',
      'create_translations_ai_review_bulk',
      'save_post_ai_review',
      'update_post_module_ai_review',
      'list_post_types',
    ],
  },

  writingStyle: {
    tone: 'accurate',
    voice: 'natural',
    conventions: ['maintain original formatting', 'use culturally appropriate idioms'],
    notes: 'Ensure translations are contextually accurate and culturally sensitive.',
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
      fieldTypes: ['text', 'textarea', 'richtext'],
    },
    {
      scope: 'post.create-translation',
      order: 1,
      enabled: true,
    },
  ],

  openEndedContext: {
    enabled: true,
    label: 'Translation Instructions',
    placeholder:
      'Example: "Translate this post to French, keeping the technical terms in English."',
    maxChars: 5000,
  },

  userAccount: {
    enabled: true,
  },
}

export default TranslatorAgent
