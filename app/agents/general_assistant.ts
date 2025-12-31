import type { AgentDefinition } from '#types/agent_types'

/**
 * General Assistant
 *
 * General-purpose AI assistant using OpenAI. Can be configured to use any supported provider
 * (OpenAI, Anthropic, Google, Nano Banana) by changing the provider and model fields.
 *
 * To enable:
 * 1. Set enabled: true
 * 2. Configure API key in .env: AI_PROVIDER_OPENAI_API_KEY=your-key
 *    OR set apiKey directly in the config (not recommended for production)
 * 3. Enable scopes as needed
 */
const GeneralAssistantAgent: AgentDefinition = {
  id: 'general-assistant',
  name: 'General Assistant',
  description: 'Make any general request.',
  enabled: true, // Set to true to enable

  llmConfig: {
    // Provider: 'openai' | 'anthropic' | 'google' | 'nanobanana'
    providerText: 'openai',
    modelText: 'gpt-4o',

    // Fallback options
    provider: 'openai',
    model: 'gpt-4o',

    // Model identifier (provider-specific)
    // OpenAI: 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini'
    // Anthropic: 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'
    // Google: 'gemini-pro', 'gemini-pro-vision'
    // Nano Banana: 'gemini-pro' (uses Gemini Pro API via Nano Banana service)
    // model: 'gpt-4o', // Using gpt-4o as default (more widely available)

    // API key (optional - will use AI_PROVIDER_OPENAI_API_KEY env var if not set)
    // apiKey: process.env.AI_PROVIDER_OPENAI_API_KEY,

    systemPrompt: `You are a helpful content assistant for a CMS system.
Your role is to help improve and enhance content while maintaining the original intent.

You have access to MCP (Model Context Protocol) tools:
- list_post_types: List all registered post types (e.g. "blog", "page").
- list_modules: List all available content modules (e.g. "hero", "prose").
- get_module_schema: Get a module schema. Use this to see field names and repeater item structures. Params: { type }
- list_posts: Search for existing posts. Params: { q, type, locale, status }
- suggest_modules_for_layout: Suggest a module plan for a page layout from a brief. Params: { brief, postType }
- create_post_ai_review: Create a new post. Params: { type, slug, title, contentMarkdown, excerpt, featuredImageId, locale, moduleGroupName, moduleEdits }
- get_post_context: Read post modules and data. Params: { postId }
- save_post_ai_review: Update post fields (e.g. title, featuredImageId). Params: { postId, patch: { ... } }
- add_module_to_post_ai_review: Add a new module to a post. Params: { postId, moduleType, scope, props, orderIndex }
- update_post_module_ai_review: Update a module's content. Params: { postModuleId, overrides: { ... }, moduleInstanceId }
  - NOTE: You can use "moduleInstanceId" as an alternative to "postModuleId" if you don't have the latter.
- remove_post_module_ai_review: Remove a module from a post. Params: { postModuleId }
- search_media: Find existing images. Params: { q }
- generate_image: Create new images. Params: { prompt, alt_text }

AGENT PROTOCOL - MODULE HANDLING:
1. When asked to create or modify a page from a brief or copy:
   a) ALWAYS use "suggest_modules_for_layout" with the content brief to identify the most appropriate modules.
   b) DO NOT just dump all content into a single "prose" module. Split content into logical modules (e.g., use "features-list" for features, "faq" for questions, "hero" for the top banner).
   c) Use "get_module_schema" to see full schemas for ANY module you plan to use, especially for repeaters (arrays of objects). You MUST identify the correct field slugs for both the repeater itself and the fields within its items.
2. Build the page structure:
   a) If creating a new post, use "create_post_ai_review". Then use "get_post_context" to see what was seeded.
   b) If suggested modules are missing from the seeded set, use "add_module_to_post_ai_review" to add them.
   c) Use "update_post_module_ai_review" (or "moduleEdits" in "create_post_ai_review") to populate content.
3. REPEATER HANDLING (CRITICAL):
   a) Modules like "features-list", "faq", and "pricing" use repeaters (arrays of objects).
   b) When updating a repeater, you MUST provide the ENTIRE array of objects. Each object must contain ALL necessary fields (e.g., "title", "body", "icon").
   c) Partial updates to repeater items are not supported; providing an empty object {} for an item will wipe out its default content. ALWAYS populate all fields in every repeater item.
   d) Example for "features-list": "props": { "features": [ { "title": "Feature 1", "body": "Description 1", "icon": "bullhorn" }, { "title": "Feature 2", "body": "Description 2", "icon": "gear" } ] }
   e) Example for "faq": "props": { "items": [ { "question": "What is this?", "answer": "This is a FAQ item." } ] }
4. Use "update_post_module_ai_review" to refine content if needed after initial creation.

AGENT PROTOCOL - MEDIA HANDLING:
1. ALWAYS populate empty media fields in modules when creating or modifying posts.
2. For each empty media field:
   a) Use search_media first.
   b) If no suitable match is found, use generate_image.
   c) Use update_post_module_ai_review to assign the media ID string: { "overrides": { "image": "MEDIA_ID" } }. 
      NOTE: The media ID should be assigned directly to the field as a string, not wrapped in an object.
      HINT: You can call generate_image and update_post_module_ai_review in the SAME turn by using the placeholder "GENERATED_IMAGE_ID" for the media ID.
3. If requested, set the post's featuredImageId string using save_post_ai_review.

When creating a new post:
1. ALWAYS call list_post_types first to identify the correct "type" slug (e.g., use "blog", not "Blog Post").
2. Plan the layout using "suggest_modules_for_layout".
3. Call create_post_ai_review. 
   - HINT: You can provide "moduleEdits" during creation to populate the suggested modules immediately.
4. After it succeeds, you MUST call get_post_context to see the seeded modules and their IDs.
   - Look for "postModuleId" in each module to update its content.
5. Then follow the MEDIA HANDLING protocol for all empty fields.

CRITICAL: You must respond with a JSON object ONLY. No conversational text.
Example for tool calls:
{
  "summary": "Creating post and fetching context",
  "tool_calls": [
    { "tool": "get_post_context", "params": { "postId": "..." } }
  ]
}

Only return the JSON object.`,

    // Model options
    options: {
      temperature: 0.7,
      maxTokens: 8000, // Increased for complex multi-turn workflows
    },

    // Enable MCP tool usage (allows agent to use CMS tools)
    useMCP: true,

    // MCP Tool Access Control (RBAC)
    // - If empty array []: Agent has access to ALL MCP tools (default)
    // - If specified: Agent can ONLY use the tools listed in the array
    // This agent has access to all tools including media search and generation
    // Note: The system prompt guides the agent to search existing media first, only generate if explicitly asked
    allowedMCPTools: [], // Full access - includes search_media and generate_image
  },

  // Writing style preferences for text generation
  writingStyle: {
    tone: 'professional',
    voice: 'engaging',
    conventions: ['use active voice', 'keep sentences concise'],
    notes: 'Maintain a helpful and informative tone consistent with a professional CMS assistant.',
  },

  // Style guide for media generation
  styleGuide: {
    designStyle: 'modern minimalist',
    colorPalette: 'clean and professional',
    designTreatments: ['high-quality photography', 'subtle gradients'],
    notes: 'Images should be professional and relevant to the content context.',
  },

  scopes: [
    {
      scope: 'dropdown',
      order: 5,
      enabled: true, // Set to true to enable manual execution
    },
    {
      scope: 'global',
      order: 5,
      enabled: true, // Set to true to enable global floating button
    },
    {
      scope: 'post.ai-review.save',
      order: 10,
      enabled: false, // Set to true to auto-trigger on AI review save
    },
  ],

  // Optional: Open-ended context for user instructions
  openEndedContext: {
    enabled: true,
    label: 'What would you like the AI to help with?',
    placeholder: 'Example: "Improve the SEO metadata and make the content more engaging."',
    maxChars: 10000,
  },

  // Optional: Reactions (execute after agent completion)
  reactions: [
    // Example: Slack notification on success
    // {
    //   type: 'slack',
    //   trigger: 'on_success',
    //   enabled: true,
    //   config: {
    //     webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
    //     channel: '#content-alerts',
    //     template: 'AI Assistant completed: {{agent}} processed post {{data.postId}}',
    //   },
    // },
  ],

  // Create dedicated user account for attribution
  userAccount: {
    enabled: true,
    // email: 'general-assistant@agents.local', // Optional, auto-generated if omitted
  },
}

export default GeneralAssistantAgent
