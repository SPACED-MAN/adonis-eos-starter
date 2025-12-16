import type { AgentDefinition } from '#types/agent_types'

/**
 * Form Processor Agent
 * 
 * @deprecated External agents have been moved to the Workflows system.
 * This should be converted to a workflow since it's event-driven (form.submit).
 * 
 * To migrate: Create app/workflows/form_processor.ts with:
 * - trigger: 'form.submit'
 * - webhook: { url: process.env.FORM_PROCESSOR_WEBHOOK_URL }
 * 
 * This agent is disabled. Delete this file after creating the workflow.
 */
const FormProcessorAgent: AgentDefinition = {
  id: 'form-processor',
  name: 'Form Processor',
  description: 'Processes and enriches form submissions',
  type: 'internal', // Changed from 'external' - needs proper internal config
  enabled: false, // Disabled - should be a workflow instead

  internal: {
    provider: 'openai',
    model: 'gpt-4',
    systemPrompt: 'Process form submissions.',
    options: {
      temperature: 0.7,
      maxTokens: 1000,
    },
  },

  scopes: [
    {
      scope: 'form.submit',
      order: 10,
      enabled: true,
      // Optional: specify which forms this agent should run on
      // If omitted, runs on all forms
      formSlugs: ['contact', 'newsletter'],
    },
  ],

  // Create a dedicated user account for attribution/auditing (email auto-generated if omitted)
  userAccount: { enabled: true },
}

export default FormProcessorAgent
