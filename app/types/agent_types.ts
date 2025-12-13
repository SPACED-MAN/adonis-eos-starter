/**
 * Agent Types
 * Defines the structure for file-based agent definitions
 */

/**
 * Type of agent service
 */
export type AgentServiceType = 'external' | 'internal'

/**
 * Where the agent can be triggered from
 */
export type AgentScope =
  | 'dropdown' // Shows up in the agent dropdown menu
  | 'field' // Per-field AI buttons (e.g. suggest/translate/generate media for a specific field)
  | 'post.publish' // Triggers on post publish
  | 'post.approve' // Triggers when approving changes (Approved mode)
  | 'post.review.save' // Triggers when saving for review
  | 'post.review.approve' // Triggers when approving review draft
  | 'post.ai-review.save' // Triggers when saving AI review
  | 'post.ai-review.approve' // Triggers when approving AI review
  | 'form.submit' // Triggers on form submission

/**
 * Configuration for external (webhook-based) agents
 */
export interface ExternalAgentConfig {
  /**
   * Production webhook URL
   */
  url: string

  /**
   * Development webhook URL (optional, falls back to url)
   */
  devUrl?: string

  /**
   * Authentication secret/token
   */
  secret?: string

  /**
   * Custom header name for the secret
   * If omitted, uses Authorization: Bearer <secret>
   */
  secretHeader?: string

  /**
   * Request timeout in milliseconds (default: 30000)
   */
  timeout?: number
}

/**
 * Configuration for internal (AI service-based) agents
 * Placeholder for future internal AI implementation
 */
export interface InternalAgentConfig {
  /**
   * Internal service identifier
   */
  serviceId: string

  /**
   * Model or configuration parameters
   */
  model?: string

  /**
   * Additional configuration for the internal service
   */
  options?: Record<string, any>
}

/**
 * Scope-specific configuration
 */
export interface AgentScopeConfig {
  /**
   * The scope where this agent is available
   */
  scope: AgentScope

  /**
   * Execution order (lower numbers execute first)
   * Default: 100
   */
  order?: number

  /**
   * For form.submit scope: specific form slug(s) to trigger on
   * If omitted, triggers on all forms
   */
  formSlugs?: string[]

  /**
   * For field scope: restrict this agent to specific field keys.
   *
   * Recommended format:
   * - Core fields: "post.title", "post.excerpt", "post.metaTitle", ...
   * - Module props: "module.<moduleType>.<propKey>" (e.g. "module.hero.title")
   *
   * If omitted or empty, the agent is available for all fields.
   */
  fieldKeys?: string[]

  /**
   * Whether this agent is enabled for this scope
   * Default: true
   */
  enabled?: boolean
}

/**
 * Complete agent definition
 */
export interface AgentDefinition {
  /**
   * Unique identifier for the agent
   */
  id: string

  /**
   * Human-readable name
   */
  name: string

  /**
   * Description of what the agent does
   */
  description?: string

  /**
   * Agent service type
   */
  type: AgentServiceType

  /**
   * Configuration for external agents (required if type is 'external')
   */
  external?: ExternalAgentConfig

  /**
   * Configuration for internal agents (required if type is 'internal')
   */
  internal?: InternalAgentConfig

  /**
   * List of scopes where this agent is available
   */
  scopes: AgentScopeConfig[]

  /**
   * Whether the agent is globally enabled
   * Default: true
   */
  enabled?: boolean

  /**
   * Optional "Open-Ended Context" capability.
   *
   * If enabled, the admin UI should prompt the user for freeform instructions
   * when running this agent, and the backend will pass it to the agent payload.
   *
   * This is intentionally explicit to avoid accidental prompt injection surfaces.
   */
  openEndedContext?: {
    /**
     * Whether the agent accepts freeform user context.
     */
    enabled: boolean
    /**
     * Optional UI label (e.g. "Instructions", "What do you want to change?")
     */
    label?: string
    /**
     * Optional UI placeholder text.
     */
    placeholder?: string
    /**
     * Optional max character count to enforce in the UI.
     */
    maxChars?: number
  }

  /**
   * Optional user account configuration for this agent.
   *
   * If enabled, the system will create/update a dedicated `users` row for the agent
   * at boot time (role: `ai_agent`). This enables per-agent attribution (author_id/user_id)
   * while keeping least-privilege permissions.
   *
   * Note: `users.email` is non-null + unique in this project. If you do not provide an email,
   * a deterministic internal email will be generated (e.g. agent+translator@agents.local).
   */
  userAccount?: {
    /**
     * Enable per-agent user account creation.
     * Default: true (if userAccount object is present)
     */
    enabled?: boolean
    /**
     * Optional email to use for the user. If omitted, a generated internal email is used.
     */
    email?: string
    /**
     * Optional username. If omitted, a generated username is used (e.g. agent:translator).
     */
    username?: string
    /**
     * Whether this account should be created at boot time.
     * Default: true
     */
    createAtBoot?: boolean
  }
}

/**
 * Runtime agent context for execution
 */
export interface AgentExecutionContext {
  /**
   * The agent being executed
   */
  agent: AgentDefinition

  /**
   * The scope that triggered the execution
   */
  scope: AgentScope

  /**
   * User who triggered the agent
   */
  userId?: number

  /**
   * Additional context data
   */
  data?: Record<string, any>
}
