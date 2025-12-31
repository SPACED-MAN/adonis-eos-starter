/**
 * Agent Types
 * Defines the structure for file-based agent definitions
 */

/**
 * Where the agent can be triggered from
 */
export type AgentScope =
  | 'dropdown' // Shows up in the agent dropdown menu
  | 'global' // Floating brain icon button (lower right of viewport)
  | 'field' // Per-field AI buttons (e.g. suggest/translate/generate media for a specific field)
  | 'post.publish' // Triggers on post publish
  | 'post.approve' // Triggers when approving changes (Source mode)
  | 'post.review.save' // Triggers when saving for review
  | 'post.review.approve' // Triggers when approving review draft
  | 'post.ai-review.save' // Triggers when saving AI review
  | 'post.ai-review.approve' // Triggers when approving AI review
  | 'post.create-translation' // Triggers when a translation is created
  | 'form.submit' // Triggers on form submission
  | 'feedback.created' // Triggers on feedback creation
  | 'posts.bulk' // Shows up in the "Bulk Actions" dropdown on the posts index page

/**
 * AI Provider type
 */
export type AIProvider = 'openai' | 'anthropic' | 'google'

/**
 * Configuration for agents (AI service-based)
 */
export interface AgentConfig {
  /**
   * AI provider identifier for text generation (e.g., openai, anthropic, google)
   * Fallback for 'provider' if not specified.
   */
  providerText?: AIProvider

  /**
   * Model identifier for text generation (provider-specific)
   * Examples: 'gpt-4', 'claude-3-5-sonnet', 'gemini-1.5-pro'
   * Fallback for 'model' if not specified.
   */
  modelText?: string

  /**
   * AI provider identifier for media generation (e.g., openai, nanobanana)
   */
  providerMedia?: AIProvider

  /**
   * Model identifier for media generation (provider-specific)
   * Examples: 'dall-e-3', 'imagen-3'
   */
  modelMedia?: string

  /**
   * AI provider identifier for video generation (e.g., google, openai)
   */
  providerVideo?: AIProvider

  /**
   * Model identifier for video generation (provider-specific)
   * Examples: 'veo-2', 'sora'
   */
  modelVideo?: string

  /**
   * AI provider identifier (fallback)
   */
  provider?: AIProvider

  /**
   * Model identifier (fallback)
   */
  model?: string

  /**
   * API key for the provider (or env var name)
   * If omitted, will look for env var: AI_PROVIDER_<PROVIDER>_API_KEY
   * Example: AI_PROVIDER_OPENAI_API_KEY
   */
  apiKey?: string

  /**
   * Base URL for custom providers (optional)
   */
  baseUrl?: string

  /**
   * Model-agnostic options
   */
  options?: {
    /**
     * Temperature (0-2, higher = more creative)
     */
    temperature?: number

    /**
     * Maximum tokens to generate
     */
    maxTokens?: number

    /**
     * Top-p sampling (0-1)
     */
    topP?: number

    /**
     * Stop sequences
     */
    stop?: string[]

    /**
     * Additional provider-specific options
     */
    [key: string]: any
  }

  /**
   * System prompt template
   * Supports variables: {{postType}}, {{context}}, {{agentName}}, etc.
   */
  systemPrompt?: string

  /**
   * Whether to enable MCP tool usage for this agent
   */
  useMCP?: boolean

  /**
   * MCP tool restrictions (if empty, all tools available)
   */
  allowedMCPTools?: string[]
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
   * For field scope: restrict this agent to specific field types.
   *
   * Examples: 'media', 'text', 'textarea', 'richtext', 'url', etc.
   *
   * If omitted or empty, the agent is available for all field types.
   */
  fieldTypes?: string[]

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
   * Configuration for AI service-based generation (required)
   */
  llmConfig: AgentConfig

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

  /**
   * Optional reactions to execute after agent execution
   */
  reactions?: AgentReaction[]

  /**
   * Optional style guide for media generation
   * Provides context about design preferences, color schemes, and visual style
   */
  styleGuide?: {
    /**
     * Design style preferences (e.g., "modern minimalist", "vintage", "corporate")
     */
    designStyle?: string

    /**
     * Preferred color palette or color scheme
     */
    colorPalette?: string

    /**
     * Design treatment preferences (e.g., "flat design", "gradients", "shadows")
     */
    designTreatments?: string[]

    /**
     * Additional style notes or guidelines
     */
    notes?: string
  }

  /**
   * Optional writing style preferences for text generation
   * Provides context about tone, voice, and writing conventions
   */
  writingStyle?: {
    /**
     * Writing tone (e.g., "professional", "casual", "friendly", "authoritative")
     */
    tone?: string

    /**
     * Voice characteristics (e.g., "conversational", "formal", "technical")
     */
    voice?: string

    /**
     * Writing conventions or preferences (e.g., "use active voice", "avoid jargon")
     */
    conventions?: string[]

    /**
     * Additional writing notes or guidelines
     */
    notes?: string
  }
}

/**
 * Reaction trigger condition
 */
export interface AgentReactionCondition {
  /**
   * Field path to check (e.g., 'response.status', 'data.postId')
   */
  field: string

  /**
   * Comparison operator
   */
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'matches' | 'exists'

  /**
   * Value to compare against
   */
  value?: any
}

/**
 * Agent reaction configuration
 * Reactions are executed after agent completion based on trigger conditions
 */
export interface AgentReaction {
  /**
   * Reaction type
   */
  type: 'webhook' | 'slack' | 'email' | 'mcp_tool' | 'custom'

  /**
   * When to trigger the reaction
   */
  trigger: 'always' | 'on_success' | 'on_error' | 'on_condition'

  /**
   * Condition for 'on_condition' trigger
   */
  condition?: AgentReactionCondition

  /**
   * Reaction configuration (type-specific)
   */
  config: {
    // For webhook
    url?: string
    method?: 'POST' | 'GET' | 'PUT' | 'PATCH'
    headers?: Record<string, string>
    bodyTemplate?: string // Supports {{variable}} interpolation

    // For Slack
    webhookUrl?: string
    channel?: string
    template?: string // Message template with {{variable}} interpolation

    // For email
    to?: string | string[]
    subject?: string

    // For MCP tool
    toolName?: string
    toolParams?: Record<string, any> | string // Can be template string

    // For custom handler
    handler?: string // Path to custom handler function
    [key: string]: any
  }

  /**
   * Whether this reaction is enabled
   */
  enabled?: boolean
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
