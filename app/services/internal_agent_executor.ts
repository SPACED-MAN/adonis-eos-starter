import type { AgentDefinition, AgentExecutionContext, AIMessage } from '#types/agent_types'
import aiProviderService from '#services/ai_provider_service'
import type { AIProviderConfig, AICompletionOptions } from '#services/ai_provider_service'
import mcpClientService from '#services/mcp_client_service'
import reactionExecutorService from '#services/reaction_executor_service'
import env from '#start/env'

/**
 * Internal Agent Executor Service
 *
 * Executes internal agents using AI providers and optionally MCP tools.
 * Handles message building, AI completion, MCP tool integration, and reactions.
 */
class InternalAgentExecutor {
  /**
   * Execute an internal agent
   */
  async execute(
    agent: AgentDefinition,
    context: AgentExecutionContext,
    payload: any
  ): Promise<{
    success: boolean
    data?: any
    error?: Error
  }> {
    if (!agent.internal) {
      throw new Error('Agent is not configured as internal')
    }

    try {
      // 1. Build messages from context and payload
      const messages = await this.buildMessages(agent, context, payload)

      // 2. Get AI provider configuration
      const aiConfig = this.getAIConfig(agent.internal)

      // Validate config
      aiProviderService.validateConfig(aiConfig)

      // 3. Get completion options
      const completionOptions = this.getCompletionOptions(agent.internal)

      // 4. Execute AI completion
      const aiResult = await aiProviderService.complete(messages, completionOptions, aiConfig)

      // Log raw AI response for debugging
      console.log('AI Raw Response:', {
        agentId: agent.id,
        content: aiResult.content,
        length: aiResult.content.length,
      })

      // 5. If MCP is enabled, allow agent to use tools
      let finalResult = aiResult.content
      if (agent.internal.useMCP) {
        finalResult = await this.executeWithMCP(agent, messages, aiResult.content, context, payload)
      }

      // 6. Parse result (could be JSON or plain text)
      let parsedResult: any
      try {
        parsedResult = JSON.parse(finalResult)

        // If the AI returned just a post object directly, wrap it
        if (parsedResult.title || parsedResult.slug || parsedResult.excerpt) {
          parsedResult = { post: parsedResult }
        }

        // Ensure we have a post object in the response
        if (!parsedResult.post && Object.keys(parsedResult).length > 0) {
          // If we have other keys but no post, try to extract post-like fields
          const postFields = ['title', 'slug', 'excerpt', 'metaTitle', 'metaDescription', 'status']
          const hasPostFields = postFields.some((field) => parsedResult[field] !== undefined)
          if (hasPostFields) {
            const post: any = {}
            postFields.forEach((field) => {
              if (parsedResult[field] !== undefined) {
                post[field] = parsedResult[field]
                delete parsedResult[field]
              }
            })
            parsedResult = { post, ...parsedResult }
          }
        }
      } catch {
        // If JSON parsing fails, try to extract JSON from markdown code blocks
        const jsonMatch =
          finalResult.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) ||
          finalResult.match(/(\{[\s\S]*\})/)
        if (jsonMatch) {
          try {
            parsedResult = JSON.parse(jsonMatch[1])
            if (parsedResult.title || parsedResult.slug) {
              parsedResult = { post: parsedResult }
            }
          } catch {
            parsedResult = { content: finalResult }
          }
        } else {
          parsedResult = { content: finalResult }
        }
      }

      // Handle case where AI wrapped the response in a "content" field (string JSON)
      if (parsedResult.content && typeof parsedResult.content === 'string') {
        try {
          const unwrapped = JSON.parse(parsedResult.content)
          // Merge unwrapped content into parsedResult, preserving other fields
          parsedResult = { ...parsedResult, ...unwrapped }
          delete parsedResult.content
        } catch {
          // If content is not JSON, leave it as is
        }
      }

      // Extract summary if present (for natural language display) - do this BEFORE logging
      // so we can see if summary was found
      let summary = parsedResult.summary || null
      if (summary) {
        // Remove summary from parsedResult so it doesn't interfere with data processing
        delete parsedResult.summary
      }

      // Log parsed result for debugging
      console.log('AI Parsed Result:', {
        agentId: agent.id,
        parsedResult,
        hasPost: !!parsedResult.post,
        postKeys: parsedResult.post ? Object.keys(parsedResult.post) : [],
        hasModules: !!parsedResult.modules,
        modulesCount: parsedResult.modules?.length || 0,
        hasSummary: !!summary,
        summary: summary?.substring(0, 100),
      })

      // 7. Execute reactions
      const result = {
        success: true,
        data: parsedResult,
        // Include raw response for UI preview
        rawResponse: aiResult.content,
        // Include summary for natural language display
        summary: summary || this.extractNaturalSummary(aiResult.content, parsedResult),
      }

      if (agent.reactions && agent.reactions.length > 0) {
        await reactionExecutorService.executeReactions(agent.reactions, context, result)
      }

      return result
    } catch (error: any) {
      // Log the full error for debugging
      console.error('Internal agent execution error:', {
        agentId: agent.id,
        error: error?.message || String(error),
        stack: error?.stack,
        cause: error?.cause,
      })

      const errorResult = {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }

      // Execute error reactions
      if (agent.reactions && agent.reactions.length > 0) {
        await reactionExecutorService.executeReactions(agent.reactions, context, errorResult)
      }

      return errorResult
    }
  }

  /**
   * Build messages for AI completion
   */
  private async buildMessages(
    agent: AgentDefinition,
    context: AgentExecutionContext,
    payload: any
  ): Promise<AIMessage[]> {
    const messages: AIMessage[] = []

    // System prompt
    if (agent.internal?.systemPrompt) {
      let systemPrompt = this.interpolateTemplate(agent.internal.systemPrompt, {
        agent: agent.name,
        scope: context.scope,
        ...context.data,
        ...payload,
      })

      // Add style guide for media generation if configured
      if (agent.styleGuide) {
        const styleGuideText = [
          'STYLE GUIDE FOR MEDIA GENERATION:',
          agent.styleGuide.designStyle ? `- Design Style: ${agent.styleGuide.designStyle}` : null,
          agent.styleGuide.colorPalette
            ? `- Color Palette: ${agent.styleGuide.colorPalette}`
            : null,
          agent.styleGuide.designTreatments && agent.styleGuide.designTreatments.length > 0
            ? `- Design Treatments: ${agent.styleGuide.designTreatments.join(', ')}`
            : null,
          agent.styleGuide.notes ? `- Additional Notes: ${agent.styleGuide.notes}` : null,
        ]
          .filter(Boolean)
          .join('\n')
        systemPrompt += `\n\n${styleGuideText}\n\nWhen generating images, follow the style guide above.`
      }

      // Add writing style preferences if configured
      if (agent.writingStyle) {
        const writingStyleText = [
          'WRITING STYLE PREFERENCES:',
          agent.writingStyle.tone ? `- Tone: ${agent.writingStyle.tone}` : null,
          agent.writingStyle.voice ? `- Voice: ${agent.writingStyle.voice}` : null,
          agent.writingStyle.conventions && agent.writingStyle.conventions.length > 0
            ? `- Conventions: ${agent.writingStyle.conventions.join(', ')}`
            : null,
          agent.writingStyle.notes ? `- Additional Notes: ${agent.writingStyle.notes}` : null,
        ]
          .filter(Boolean)
          .join('\n')
        systemPrompt += `\n\n${writingStyleText}\n\nWhen writing or editing text content, follow the writing style preferences above.`
      }

      // Add format instructions to ensure proper JSON response
      const formatInstructions = `

IMPORTANT: You must respond with a JSON object that includes both a natural language summary and the structured changes. Your response should be in this format:
{
  "summary": "A brief, natural language description of what changes you made. For example: 'I've replaced all copy with Lorem Ipsum text across all modules, updating titles, subtitles, descriptions, and other text fields while preserving the structure and formatting.'",
  "post": {
    "title": "Updated title",
    "excerpt": "Updated excerpt",
    "metaTitle": "Updated meta title",
    "metaDescription": "Updated meta description",
    // ... other post fields you want to change
  },
  "modules": [
    {
      "type": "hero",
      "props": {
        "title": "Updated module title",
        // ... other module props you want to change
      }
    }
  ]
}

The "summary" field should be a clear, human-readable explanation of your changes. The "post" and "modules" fields contain the actual structured changes.

For modules: You can identify modules by their "type" (e.g., "hero", "prose", "gallery"). 
- If you want to update ALL modules of a type, include the module in the array WITHOUT "orderIndex"
- If you want to update a SPECIFIC module, include "orderIndex" (0-based) to target that exact one
- If you want to update ALL modules regardless of type, you can include multiple entries in the array, one for each type
- IMPORTANT: When asked to "replace all copy" or update "all modules", you MUST include ALL modules in the response, not just the first one
- You can include multiple modules in the array to update multiple modules at once
- Only include the props you are actually changing - all other props will be preserved automatically
Only include fields/modules that you are actually changing. Do not include fields that should remain unchanged.`

      messages.push({
        role: 'system',
        content: systemPrompt + formatInstructions,
      })
    } else {
      // Default system prompt if none provided
      messages.push({
        role: 'system',
        content: `You are a helpful content assistant. You must respond with valid JSON only in this format:
{
  "post": {
    "title": "Updated title",
    // ... other fields you want to change
  }
}

Only include fields that you are actually changing.`,
      })
    }

    // User message with context
    const userMessage = await this.buildUserMessage(agent, context, payload)
    messages.push({
      role: 'user',
      content: userMessage,
    })

    return messages
  }

  /**
   * Build user message from context
   */
  private async buildUserMessage(
    agent: AgentDefinition,
    context: AgentExecutionContext,
    payload: any
  ): Promise<string> {
    const parts: string[] = []

    // Add scope-specific context
    switch (context.scope) {
      case 'dropdown':
        parts.push('Manual execution requested by user.')
        break
      case 'global':
        parts.push('Global execution - you can create new posts or work with general content.')
        parts.push('If the user asks you to create a post, use the create_post_ai_review tool.')
        break
      case 'post.publish':
        parts.push('Post has been published.')
        break
      case 'post.review.save':
        parts.push('Post has been saved for review.')
        break
      case 'field':
        parts.push(`Field-level execution for: ${context.data?.fieldKey || 'unknown'}`)
        break
      default:
        parts.push(`Execution triggered by scope: ${context.scope}`)
    }

    // Add payload context
    if (payload) {
      if (payload.post) {
        parts.push(`\nCurrent post data:\n${JSON.stringify(payload.post, null, 2)}`)
      }
      if (payload.modules) {
        parts.push(`\n\nCurrent modules (${payload.modules.length} total):`)
        // Show all modules with their type, orderIndex, and key props
        payload.modules.forEach((m: any, idx: number) => {
          const moduleInfo: any = {
            type: m.type,
            orderIndex: m.orderIndex || idx,
            props: m.props || {},
          }
          parts.push(`\n${idx + 1}. ${m.type} (orderIndex: ${moduleInfo.orderIndex}):`)
          parts.push(JSON.stringify(moduleInfo.props, null, 2))
        })
        parts.push(
          `\n\nIMPORTANT: If asked to update "all modules" or "all copy", you MUST include ALL ${payload.modules.length} modules in your response array, not just the first one!`
        )
      }
      if (payload.openEndedContext) {
        parts.push(`\n\nUser instructions: ${payload.openEndedContext}`)
        parts.push(
          `\n\nPlease make the requested changes and return ONLY a JSON object with the format:`
        )
        parts.push(`{`)
        parts.push(`  "post": { "fieldName": "newValue" },`)
        parts.push(`  "modules": [`)
        parts.push(`    { "type": "hero", "props": { "title": "New title" } },`)
        parts.push(`    { "type": "prose", "props": { "content": "New content" } }`)
        parts.push(`    // Include ALL modules you want to update - one entry per module type`)
        parts.push(`  ]`)
        parts.push(`}`)
        parts.push(
          `\n\nCRITICAL: If the user asks to update "all modules" or "all copy", you MUST include entries for ALL module types shown above.`
        )
        parts.push(
          `Do NOT include "orderIndex" unless you want to update only a specific instance of that type.`
        )
        parts.push(`Without "orderIndex", your changes will apply to ALL modules of that type.`)
      }
      if (payload.context) {
        parts.push(`\nAdditional context:\n${JSON.stringify(payload.context, null, 2)}`)
      }
    }

    // Add MCP tools info if enabled
    if (agent.internal?.useMCP) {
      const availableTools = await mcpClientService.listTools()
      const allowedTools =
        agent.internal?.allowedMCPTools && agent.internal.allowedMCPTools.length > 0
          ? availableTools.filter((t) => agent.internal?.allowedMCPTools?.includes(t.name))
          : availableTools

      parts.push('\n\nYou have access to the following MCP tools:')
      for (const tool of allowedTools) {
        parts.push(`- ${tool.name}: ${tool.description}`)
      }
      parts.push(
        '\nTo use a tool, include a "tool_calls" array in your JSON response with tool name and params.'
      )
    }

    return parts.join('\n')
  }

  /**
   * Get AI provider configuration from agent config
   */
  private getAIConfig(internal: NonNullable<AgentDefinition['internal']>): AIProviderConfig {
    // Get API key from config or environment
    let apiKey = internal.apiKey
    if (!apiKey) {
      // Try environment variable
      const envKey = `AI_PROVIDER_${internal.provider.toUpperCase()}_API_KEY`
      apiKey = process.env[envKey] || ''
    }

    if (!apiKey) {
      throw new Error(
        `API key not found for provider ${internal.provider}. Set apiKey in agent config or ${envKey} environment variable.`
      )
    }

    return {
      provider: internal.provider,
      apiKey,
      model: internal.model,
      baseUrl: internal.baseUrl,
      options: internal.options,
    }
  }

  /**
   * Get completion options from agent config
   */
  private getCompletionOptions(
    internal: NonNullable<AgentDefinition['internal']>
  ): AICompletionOptions {
    return {
      temperature: internal.options?.temperature ?? 0.7,
      maxTokens: internal.options?.maxTokens,
      topP: internal.options?.topP,
      stop: internal.options?.stop,
    }
  }

  /**
   * Execute agent with MCP tool support
   * Parses tool calls from AI response, executes them, and returns the final result
   */
  private async executeWithMCP(
    agent: AgentDefinition,
    messages: AIMessage[],
    aiResponse: string,
    context: AgentExecutionContext,
    payload: any
  ): Promise<string> {
    try {
      // Try to parse the AI response as JSON to look for tool calls
      let parsed: any
      try {
        // Extract JSON from markdown code blocks if present
        // Try multiple patterns to extract JSON (greedy match to get the full object)
        let jsonStr = aiResponse
        const jsonMatch =
          aiResponse.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) ||
          aiResponse.match(/```(?:json)?\s*(\{[\s\S]*)/) || // Match even if incomplete (no closing ```)
          aiResponse.match(/(\{[\s\S]*\})/) // Fallback to any JSON object

        if (jsonMatch) {
          jsonStr = jsonMatch[1]
          // Try to complete incomplete JSON if it ends with an incomplete string
          if (!jsonStr.trim().endsWith('}')) {
            // Try to find the last complete property and close the JSON
            const lastCompleteProp = jsonStr.lastIndexOf('",')
            if (lastCompleteProp > 0) {
              jsonStr = jsonStr.substring(0, lastCompleteProp + 1) + '}'
            } else {
              // If we can't find a good place to close, try to close arrays/objects
              let openBraces = (jsonStr.match(/\{/g) || []).length
              let closeBraces = (jsonStr.match(/\}/g) || []).length
              let openBrackets = (jsonStr.match(/\[/g) || []).length
              let closeBrackets = (jsonStr.match(/\]/g) || []).length

              // Close any open brackets first
              while (closeBrackets < openBrackets) {
                jsonStr += ']'
                closeBrackets++
              }
              // Close any open braces
              while (closeBraces < openBraces) {
                jsonStr += '}'
                closeBraces++
              }
            }
          }
        }

        console.log('[MCP] Attempting to parse JSON for tool calls:', {
          hasJsonMatch: !!jsonMatch,
          jsonStrLength: jsonStr.length,
          jsonStrPreview: jsonStr.substring(0, 300),
          responseLength: aiResponse.length,
        })
        parsed = JSON.parse(jsonStr)
        console.log('[MCP] Successfully parsed JSON:', {
          hasToolCalls: !!parsed.tool_calls,
          toolCallsCount: parsed.tool_calls?.length || 0,
          hasPost: !!parsed.post,
          hasModules: !!parsed.modules,
          keys: Object.keys(parsed),
        })
      } catch (parseError: any) {
        // If not JSON, return as-is (agent might be responding naturally)
        console.log('[MCP] Failed to parse JSON, returning as-is:', {
          error: parseError?.message,
          responsePreview: aiResponse.substring(0, 300),
          responseLength: aiResponse.length,
        })
        return aiResponse
      }

      // Check if the response contains tool calls
      if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
        const toolResults: any[] = []

        // Execute each tool call
        for (const toolCall of parsed.tool_calls) {
          // Support both 'tool' and 'tool_name' formats
          const tool = toolCall.tool || toolCall.tool_name
          const params = toolCall.params || toolCall.arguments
          if (!tool || !params) continue

          try {
            // Check if tool is allowed
            if (agent.internal?.allowedMCPTools && agent.internal.allowedMCPTools.length > 0) {
              if (!agent.internal.allowedMCPTools.includes(tool)) {
                toolResults.push({
                  tool,
                  error: `Tool '${tool}' is not in the allowed list`,
                })
                continue
              }
            }

            // Execute the tool
            const result = await mcpClientService.callTool(tool, params, agent.id)
            toolResults.push({
              tool,
              success: true,
              result,
            })
          } catch (error: any) {
            toolResults.push({
              tool,
              success: false,
              error: error?.message || 'Tool execution failed',
            })
          }
        }

        // If we have tool results, merge them into the response
        // For generate_image, we can automatically update modules if the agent provided module updates
        const response: any = {
          summary: parsed.summary || `Executed ${toolResults.length} tool call(s)`,
          toolResults,
        }

        // If the original response had other fields, include them
        if (parsed.post) response.post = parsed.post
        if (parsed.modules) response.modules = parsed.modules

        // For generate_image tool, if we have a successful result and module updates,
        // we can automatically inject the mediaId into the module props
        const generateImageResult = toolResults.find(
          (r: any) => (r.tool === 'generate_image' || r.tool_name === 'generate_image') && r.success
        )

        // Debug logging
        if (toolResults.length > 0) {
          console.log('[MCP Tool Results]', {
            count: toolResults.length,
            results: toolResults.map((r: any) => ({
              tool: r.tool || r.tool_name,
              success: r.success,
              hasResult: !!r.result,
              resultKeys: r.result ? Object.keys(r.result) : [],
              error: r.error,
            })),
          })
        }

        if (generateImageResult && response.modules && Array.isArray(response.modules)) {
          const result = generateImageResult.result
          const mediaId = result?.mediaId
          const mediaUrl = result?.url
          const altText = result?.altText
          const description = result?.description

          console.log('[MCP Image Generation]', {
            hasMediaId: !!mediaId,
            mediaId,
            mediaUrl,
            altText,
            description,
            modulesCount: response.modules.length,
          })

          if (mediaId) {
            // Find modules that need the image and inject the mediaId
            for (const module of response.modules) {
              if (module.props?.image && typeof module.props.image === 'object') {
                // Check if ID is missing, is a placeholder, or needs to be replaced
                const currentId = module.props.image.id
                const isPlaceholder =
                  !currentId ||
                  (typeof currentId === 'string' &&
                    (currentId.includes('<mediaId') ||
                      currentId.includes('from generate_image') ||
                      currentId.includes('mediaId') ||
                      currentId === ''))

                console.log('[MCP Module Update]', {
                  moduleType: module.type,
                  currentId,
                  isPlaceholder,
                  willReplace: isPlaceholder && mediaId,
                })

                if (isPlaceholder && mediaId) {
                  // Inject the generated mediaId
                  module.props.image.id = mediaId
                  if (mediaUrl) {
                    module.props.image.url = mediaUrl
                  }
                  // Use tool result alt/description if not already set or if they're placeholders
                  if (altText && (!module.props.image.alt || module.props.image.alt === altText)) {
                    module.props.image.alt = altText
                  }
                  if (
                    description &&
                    (!module.props.image.description ||
                      module.props.image.description === description)
                  ) {
                    module.props.image.description = description
                  }
                }
              }
            }
          }
        }

        return JSON.stringify(response)
      }

      // No tool calls, return the original response
      return aiResponse
    } catch (error: any) {
      console.error('MCP execution error:', error)
      // On error, return the original response
      return aiResponse
    }
  }

  /**
   * Extract natural language summary from AI response
   * Falls back to generating a summary from the changes if not provided
   */
  private extractNaturalSummary(rawResponse: string, parsedResult: any): string | null {
    // If summary was already extracted, return it
    if (parsedResult.summary) {
      return parsedResult.summary
    }

    // Try to extract summary from raw response if it's in a readable format
    // Look for text before JSON or in markdown
    const beforeJson = rawResponse.match(/^([^{]+?)(?:\s*\{|\s*```)/s)
    if (beforeJson && beforeJson[1].trim().length > 20) {
      return beforeJson[1].trim()
    }

    // Generate a simple summary from the changes
    const changes: string[] = []
    if (parsedResult.post && Object.keys(parsedResult.post).length > 0) {
      changes.push(`Updated ${Object.keys(parsedResult.post).length} post field(s)`)
    }
    if (parsedResult.modules && Array.isArray(parsedResult.modules)) {
      changes.push(`Updated ${parsedResult.modules.length} module(s)`)
    }
    if (changes.length > 0) {
      return changes.join('. ') + '.'
    }

    return null
  }

  /**
   * Interpolate template string with variables
   */
  private interpolateTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = this.getNestedValue(variables, key)
      return value !== undefined && value !== null ? String(value) : match
    })
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }
}

const internalAgentExecutor = new InternalAgentExecutor()
export default internalAgentExecutor
