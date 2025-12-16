/**
 * Workflow Types
 * Defines the structure for file-based workflow definitions
 */

/**
 * Workflow trigger events
 */
export type WorkflowTrigger =
  | 'post.created' // Post is created
  | 'post.updated' // Post is updated
  | 'post.published' // Post is published
  | 'post.approved' // Post changes are approved (Source mode)
  | 'post.review.save' // Post is saved for review
  | 'post.review.approve' // Review draft is approved
  | 'post.ai-review.save' // AI review draft is saved
  | 'post.ai-review.approve' // AI review is approved
  | 'form.submit' // Form is submitted
  | 'agent.completed' // AI agent execution completes
  | 'workflow.completed' // Another workflow completes
  | 'manual' // Manual trigger only (via UI)

/**
 * Configuration for webhook-based workflows
 */
export interface WebhookWorkflowConfig {
  /**
   * Production webhook URL
   */
  url: string

  /**
   * Development webhook URL (optional, falls back to url)
   */
  devUrl?: string

  /**
   * HTTP method (default: POST)
   */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

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
   * Custom headers to include in the request
   */
  headers?: Record<string, string>

  /**
   * Request timeout in milliseconds (default: 30000)
   */
  timeout?: number

  /**
   * Whether to retry on failure (default: false)
   */
  retryOnFailure?: boolean

  /**
   * Number of retry attempts (default: 3)
   */
  retryAttempts?: number

  /**
   * Retry delay in milliseconds (default: 1000)
   */
  retryDelay?: number
}

/**
 * Trigger-specific configuration
 */
export interface WorkflowTriggerConfig {
  /**
   * The trigger event
   */
  trigger: WorkflowTrigger

  /**
   * Execution order (lower numbers execute first)
   * Default: 100
   */
  order?: number

  /**
   * For form.submit trigger: specific form slug(s) to trigger on
   * If omitted, triggers on all forms
   */
  formSlugs?: string[]

  /**
   * For post triggers: specific post type(s) to trigger on
   * If omitted, triggers on all post types
   */
  postTypes?: string[]

  /**
   * For agent.completed trigger: specific agent ID(s) to trigger on
   * If omitted, triggers on all agent completions
   */
  agentIds?: string[]

  /**
   * For workflow.completed trigger: specific workflow ID(s) to trigger on
   * If omitted, triggers on all workflow completions
   */
  workflowIds?: string[]

  /**
   * Condition function (optional)
   * If provided, workflow only executes if this function returns true
   * Receives the event payload as parameter
   */
  condition?: (payload: any) => boolean | Promise<boolean>

  /**
   * Whether this trigger is enabled
   * Default: true
   */
  enabled?: boolean
}

/**
 * Complete workflow definition
 */
export interface WorkflowDefinition {
  /**
   * Unique identifier for the workflow
   */
  id: string

  /**
   * Human-readable name
   */
  name: string

  /**
   * Description of what the workflow does
   */
  description?: string

  /**
   * Workflow type (currently only webhook is supported)
   */
  type: 'webhook'

  /**
   * Webhook configuration (required if type is 'webhook')
   */
  webhook: WebhookWorkflowConfig

  /**
   * List of triggers that activate this workflow
   */
  triggers: WorkflowTriggerConfig[]

  /**
   * Whether the workflow is globally enabled
   * Default: true
   */
  enabled?: boolean

  /**
   * Optional payload transformation
   * If provided, the payload will be transformed before sending to webhook
   */
  transformPayload?: (payload: any) => any | Promise<any>

  /**
   * Optional user account configuration for this workflow.
   *
   * If enabled, the system will create/update a dedicated `users` row for the workflow
   * at boot time (role: `workflow`). This enables per-workflow attribution.
   */
  userAccount?: {
    /**
     * Enable per-workflow user account creation.
     * Default: true (if userAccount object is present)
     */
    enabled?: boolean
    /**
     * Optional email to use for the user. If omitted, a generated internal email is used.
     */
    email?: string
    /**
     * Optional username. If omitted, a generated username is used (e.g. workflow:slack-notifier).
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
 * Runtime workflow context for execution
 */
export interface WorkflowExecutionContext {
  /**
   * The workflow being executed
   */
  workflow: WorkflowDefinition

  /**
   * The trigger that activated the workflow
   */
  trigger: WorkflowTrigger

  /**
   * User who triggered the workflow (if applicable)
   */
  userId?: number

  /**
   * Event payload data
   */
  payload: Record<string, any>
}

