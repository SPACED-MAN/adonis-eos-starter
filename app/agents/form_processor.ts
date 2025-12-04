import type { AgentDefinition } from '#types/agent_types'

/**
 * Form Processor Agent
 * External webhook-based agent that processes form submissions
 */
const FormProcessorAgent: AgentDefinition = {
  id: 'form-processor',
  name: 'Form Processor',
  description: 'Processes and enriches form submissions',
  type: 'external',
  enabled: true,

  external: {
    url: process.env.AGENT_FORM_PROCESSOR_URL || '',
    devUrl: process.env.AGENT_FORM_PROCESSOR_DEV_URL,
    secret: process.env.AGENT_FORM_PROCESSOR_SECRET,
    timeout: 15000,
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
}

export default FormProcessorAgent

