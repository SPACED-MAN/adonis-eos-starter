import type { AgentDefinition, AgentExecutionContext, AIProvider, AgentConfig } from '#types/agent_types'
import aiProviderService from '#services/ai_provider_service'
import type {
  AIProviderConfig,
  AICompletionOptions,
  AIMessage,
} from '#services/ai_provider_service'
import mcpClientService from '#services/mcp_client_service'
import reactionExecutorService from '#services/reaction_executor_service'
import agentDesignContextService from '#services/agent_design_context_service'
import env from '#start/env'

/**
 * Agent Executor Service
 *
 * Executes agents using AI providers and optionally MCP tools.
 * Handles message building, AI completion, MCP tool integration, and reactions.
 */
class AgentExecutor {
  /**
   * Execute an agent
   */
  async execute(
    agent: AgentDefinition,
    context: AgentExecutionContext,
    payload: any
  ): Promise<{
    success: boolean
    data?: any
    error?: Error
    lastCreatedPostId?: string | null
  }> {
    if (!agent.llmConfig) {
      throw new Error('Agent is not configured with LLM capabilities')
    }

    const startTime = Date.now()
    const isDebug = env.get('AI_AGENT_DEBUG') === true
    try {
      // 1. Build initial messages
      const messages = await this.buildMessages(agent, context, payload, isDebug)

      // 2. Get AI provider configuration
      const aiConfig = await this.getAIConfig(agent.llmConfig)
      aiProviderService.validateConfig(aiConfig)

      // 3. Get completion options
      const completionOptions = this.getCompletionOptions(agent.llmConfig)

      // 4. First AI completion
      let aiResult = await aiProviderService.complete(messages, completionOptions, aiConfig)
      let finalContent = aiResult.content

      // Track usage and model info
      const executionMeta: any = {
        model: aiResult.metadata?.model || aiConfig.model,
        provider: aiConfig.provider,
        totalTurns: 1,
        durationMs: 0, // Will be set at end
        usage: {
          promptTokens: aiResult.usage?.promptTokens || 0,
          completionTokens: aiResult.usage?.completionTokens || 0,
          totalTokens: aiResult.usage?.totalTokens || 0,
        },
      }

      if (isDebug) {
        executionMeta.debug = {
          ingestion: {
            systemPrompt: messages.find((m) => m.role === 'system')?.content,
            conversation: messages
              .filter((m) => m.role !== 'system')
              .map((m) => ({
                role: m.role,
                content: m.content,
              })),
            currentPayload: payload,
          },
          configuration: {
            provider: aiConfig.provider,
            model: aiConfig.model,
            options: completionOptions,
          },
        }
      }

      // 5. Handle multi-turn tool execution if MCP is enabled
      let lastCreatedPostId: string | null = null
      const allToolResults: any[] = []
      const transcript: any[] = []

      if (agent.llmConfig.useMCP) {
        let currentTurn = 1
        const maxTurns = 10 // Increased from 6 to 10 for complex workflows

        while (currentTurn < maxTurns) {
          let parsed: any
          try {
            const jsonStr = this.extractJSON(aiResult.content)
            parsed = JSON.parse(jsonStr)
          } catch {
            // Not JSON or no tool calls in this turn
            break
          }

          if (
            parsed?.tool_calls &&
            Array.isArray(parsed.tool_calls) &&
            parsed.tool_calls.length > 0
          ) {
            // Determine target mode for tool execution
            const targetMode =
              context.scope === 'field' ? (context.data?.viewMode || 'source') : 'ai-review'

            // Execute tools for this turn
            const toolResults = await this.executeTools(agent, parsed.tool_calls, targetMode)
            allToolResults.push(...toolResults)

            transcript.push({
              turn: currentTurn,
              summary: parsed.summary || null,
              toolCalls: parsed.tool_calls,
              toolResults: toolResults,
              determination: isDebug ? parsed.determination || parsed.reasoning || 'No explicit reasoning provided in tool turn.' : undefined,
              rawResponse: isDebug ? aiResult.content : undefined,
            })

            // Check if any tool was create_post_ai_review or create_translation_ai_review
            const creationTool = toolResults.find(
              (r: any) =>
                (r.tool === 'create_post_ai_review' || r.tool === 'create_translation_ai_review') &&
                r.success &&
                (r.result?.postId || r.result?.translationId)
            )

            if (creationTool) {
              lastCreatedPostId = creationTool.result.postId || creationTool.result.translationId
            }

            // Add assistant's response to history
            messages.push({
              role: 'assistant',
              content: aiResult.content,
            })

            // Build user prompt for next turn with tool results
            let nextTurnPrompt = `Tool execution results (Turn ${currentTurn}):\n${JSON.stringify(toolResults, null, 2)}\n\n`

            if (creationTool) {
              const newPostId = lastCreatedPostId
              nextTurnPrompt += `IMPORTANT: Post/Translation created (ID: ${newPostId}). To fulfill the user's request, you MUST now:
1. Use get_post_context(postId: "${newPostId}") to see the seeded or cloned modules and their current IDs.
2. For each module or field that needs content:
   - Use update_post_module_ai_review with the specific postModuleId and overrides.
   - Use save_post_ai_review for post-level fields like title and excerpt.
3. Once all translations/edits are finished, provide a final response with "redirectPostId": "${newPostId}" so the user can be taken to the new version.

RESPOND WITH YOUR NEXT TOOL CALLS IN JSON FORMAT.`
            } else {
              nextTurnPrompt += `Analyze the results above. If you need more tools to complete the user's request, include a "tool_calls" array. If the task is finished, provide your final response with a "summary". RESPOND IN JSON FORMAT.`
            }

            messages.push({
              role: 'user',
              content: nextTurnPrompt,
            })

            // Get next AI completion
            aiResult = await aiProviderService.complete(messages, completionOptions, aiConfig)
            finalContent = aiResult.content
            currentTurn++

            // Update meta
            executionMeta.totalTurns = currentTurn
            executionMeta.usage.promptTokens += aiResult.usage?.promptTokens || 0
            executionMeta.usage.completionTokens += aiResult.usage?.completionTokens || 0
            executionMeta.usage.totalTokens += aiResult.usage?.totalTokens || 0
          } else {
            // No more tool calls, we're done
            break
          }
        }

        // If we hit the turn limit, add a warning to the content
        if (currentTurn >= maxTurns) {
          console.warn(`Agent ${agent.id} reached max turns (${maxTurns})`)
          // Try to wrap the last response in a JSON that includes a warning summary if it's not already helpful
          try {
            const lastJson = JSON.parse(this.extractJSON(finalContent))
            if (lastJson.tool_calls) {
              lastJson.summary =
                (lastJson.summary || '') +
                ' (Note: Reached maximum execution turns. Some tasks may be incomplete.)'
              finalContent = JSON.stringify(lastJson)
            }
          } catch {
            // ignore
          }
        }
      }

      // 6. Parse final result
      let parsedResult: any
      try {
        const jsonStr = this.extractJSON(finalContent)
        parsedResult = JSON.parse(jsonStr)

        // Inject all tool results from all turns into the final data
        // This allows the controller to see generated media IDs from Turn 1 or 2
        // even if the agent didn't repeat them in the final JSON.
        if (allToolResults.length > 0) {
          parsedResult.toolResults = allToolResults
        }

        // If the AI returned just a post object directly, wrap it
        if (parsedResult.title || parsedResult.slug || parsedResult.excerpt) {
          parsedResult = { post: parsedResult }
        }

        // Ensure we have a post object in the response
        if (!parsedResult.post && Object.keys(parsedResult).length > 0) {
          const postFields = [
            'title',
            'slug',
            'excerpt',
            'metaTitle',
            'metaDescription',
            'status',
            'featuredImageId',
          ]
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
        parsedResult = { content: finalContent }
      }

      // Handle case where AI wrapped the response in a "content" field
      if (parsedResult.content && typeof parsedResult.content === 'string') {
        try {
          const unwrapped = JSON.parse(parsedResult.content)
          parsedResult = { ...parsedResult, ...unwrapped }
          delete parsedResult.content
        } catch {
          // If content is not JSON, leave it as is
        }
      }

      // Extract summary
      let summary = parsedResult.summary || null
      const determination = isDebug ? parsedResult.determination || parsedResult.reasoning || null : null
      if (summary) {
        delete parsedResult.summary
      }
      if (isDebug && determination) {
        delete parsedResult.determination
        delete parsedResult.reasoning
      }

      executionMeta.durationMs = Date.now() - startTime

      // 7. Execute reactions
      const result = {
        success: true,
        data: parsedResult,
        rawResponse: finalContent,
        summary: summary || this.extractNaturalSummary(finalContent, parsedResult),
        determination,
        lastCreatedPostId,
        executionMeta,
        transcript,
      }

      if (agent.reactions && agent.reactions.length > 0) {
        await reactionExecutorService.executeReactions(agent.reactions, context, result)
      }

      return result
    } catch (error: any) {
      console.error('Internal agent execution error:', {
        agentId: agent.id,
        error: error?.message || String(error),
        stack: error?.stack,
      })

      const errorResult = {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }

      if (agent.reactions && agent.reactions.length > 0) {
        await reactionExecutorService.executeReactions(agent.reactions, context, errorResult)
      }

      return errorResult
    }
  }

  /**
   * Extract JSON string from raw text (handles markdown code blocks)
   */
  private extractJSON(text: string): string {
    const jsonMatch =
      text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || text.match(/(\{[\s\S]*\})/)

    if (jsonMatch) {
      return jsonMatch[1]
    }
    return text
  }

  /**
   * Execute MCP tools and return results
   */
  private async executeTools(agent: AgentDefinition, toolCalls: any[], mode?: string): Promise<any[]> {
    const results: any[] = []
    const mediaTools = ['generate_image', 'generate_video']
    
    // Sort tool calls so that media generation happens first.
    // This allows placeholders like GENERATED_IMAGE_ID to be resolved for other tools in the SAME turn.
    const sortedToolCalls = [...toolCalls].sort((a, b) => {
      const aIsMedia = mediaTools.includes(a.tool || a.tool_name)
      const bIsMedia = mediaTools.includes(b.tool || b.tool_name)
      if (aIsMedia && !bIsMedia) return -1
      if (!aIsMedia && bIsMedia) return 1
      return 0
    })

    // We'll map the results back to the original order at the end if needed,
    // but the transcript usually follows execution order.
    // For simplicity, we just execute them in the sorted order.

    for (const toolCall of sortedToolCalls) {
      const tool = toolCall.tool || toolCall.tool_name
      let params = toolCall.params || toolCall.arguments
      if (!tool || !params) continue

      try {
        // Check if tool is allowed
        if (agent.llmConfig?.allowedMCPTools && agent.llmConfig.allowedMCPTools.length > 0) {
          if (!agent.llmConfig.allowedMCPTools.includes(tool)) {
            results.push({
              tool,
              error: `Tool '${tool}' is not in the allowed list`,
            })
            continue
          }
        }

        // Automatic placeholder replacement for tool parameters
        // This allows agents to use results from previous tool calls in the SAME turn.
        // E.g. generate_image followed by update_post_module_ai_review with the new media ID.
        if (results.length > 0) {
          // Collect ALL generated media IDs from this turn
          const generatedMediaMap = new Map<string, string>()
          results.forEach((r, idx) => {
            if (
              (r.tool === 'generate_image' || r.tool_name === 'generate_image') &&
              r.success &&
              r.result?.mediaId
            ) {
              generatedMediaMap.set(`GENERATED_IMAGE_ID_${idx}`, r.result.mediaId)
              // Also support the generic one for the most recent image
              generatedMediaMap.set('GENERATED_IMAGE_ID', r.result.mediaId)
              generatedMediaMap.set('mediaId from generate_image result', r.result.mediaId)
            }
            if (
              (r.tool === 'generate_video' || r.tool_name === 'generate_video') &&
              r.success &&
              r.result?.mediaId
            ) {
              generatedMediaMap.set(`GENERATED_VIDEO_ID_${idx}`, r.result.mediaId)
              generatedMediaMap.set('GENERATED_VIDEO_ID', r.result.mediaId)
            }
          })

          if (generatedMediaMap.size > 0) {
            const replaceId = (obj: any): any => {
              if (typeof obj === 'string') {
                let out = obj
                generatedMediaMap.forEach((mediaId, placeholder) => {
                  out = out.replace(new RegExp(placeholder, 'g'), mediaId)
                })
                return out
              } else if (Array.isArray(obj)) {
                return obj.map(replaceId)
              } else if (obj && typeof obj === 'object') {
                const out: any = {}
                for (const k in obj) out[k] = replaceId(obj[k])
                return out
              }
              return obj
            }
            params = replaceId(params)
          }
        }

        // Execute the tool
        const result = await mcpClientService.callTool(tool, params, agent.id, mode)
        results.push({
          tool,
          success: true,
          result,
        })
      } catch (error: any) {
        results.push({
          tool,
          success: false,
          error: error?.message || 'Tool execution failed',
        })
      }
    }

    return results
  }

  /**
   * Build messages for AI completion
   */
  private async buildMessages(
    agent: AgentDefinition,
    context: AgentExecutionContext,
    payload: any,
    isDebug: boolean = false
  ): Promise<AIMessage[]> {
    const messages: AIMessage[] = []

    // System prompt
    if (agent.llmConfig?.systemPrompt) {
      const styleGuide = agent.styleGuide
        ? `\n\nSTYLE GUIDE & GUARDRAILS:
- Design Style: ${agent.styleGuide.designStyle || 'N/A'}
- Color Palette: ${agent.styleGuide.colorPalette || 'N/A'}
- Design Treatments: ${agent.styleGuide.designTreatments?.join(', ') || 'N/A'}
- Notes: ${agent.styleGuide.notes || 'N/A'}`
        : ''

      const writingStyle = agent.writingStyle
        ? `\n\nWRITING STYLE:
- Tone: ${agent.writingStyle.tone || 'N/A'}
- Voice: ${agent.writingStyle.voice || 'N/A'}
- Conventions: ${agent.writingStyle.conventions?.join(', ') || 'N/A'}
- Notes: ${agent.writingStyle.notes || 'N/A'}`
        : ''

      let systemPrompt = this.interpolateTemplate(agent.llmConfig.systemPrompt + styleGuide + writingStyle, {
        agent: agent.name,
        scope: context.scope,
        targetMode: context.scope === 'field' ? (context.data?.viewMode || 'source') : 'ai-review',
        ...context.data,
        ...payload,
      })

      // Add dynamic design context if agent is Media-scoped
      const isMediaScoped =
        agent.scopes?.some((s) => s.fieldTypes?.includes('media')) ||
        !!agent.llmConfig.providerMedia ||
        !!agent.llmConfig.modelMedia ||
        agent.id.toLowerCase().includes('media') ||
        agent.id.toLowerCase().includes('graphic-designer') ||
        agent.id.toLowerCase().includes('videographer')

      if (isMediaScoped) {
        const designContext = await agentDesignContextService.getDesignContext()
        if (designContext) {
          systemPrompt += `\n\n${designContext}`
        }
      }

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
        systemPrompt += `\n\n${writingStyleText}\n\nWhen writing or editing text content, follow the writing style preferences above. Additionally, NEVER leave module copy fields with their default "Lorem Ipsum" values; always replace them with high-quality, relevant content.`
      }

      // Add format instructions to ensure proper JSON response
      const debugInstructions = isDebug
        ? '\n\nDEBUG MODE ENABLED: Please include a "determination" field in your JSON responses explaining your reasoning, what you gathered from context/tools, and why you are taking the next steps.'
        : ''

      const historyInstructions = context.history && context.history.length > 0
        ? '\n\nNOTE: Conversation history is provided above. Treat each user request as the primary directive. If the current request represents a "new task" or a significant departure from previous turns, prioritize the new instructions and do not let previous context restrict the scope of the current request unless explicitly asked to do so.'
        : ''

      const formatInstructions = `

IMPORTANT: You must respond with a JSON object. If you need to use tools, include a "tool_calls" array. If you are providing a final response, include a "summary".${debugInstructions}${historyInstructions}

Format for tool calls:
{
  "determination": "...",
  "tool_calls": [
    { "tool": "tool_name", "params": { "key": "value", "mode": "{{targetMode}}" } }
  ]
}

Format for final response:
{
  "determination": "...",
  "summary": "A brief natural language description of what you've done",
  "post": { "title": "..." },
  "modules": [ { "type": "...", "props": { "..." } } ]
}

Only include fields/modules that you are actually changing. Do not include any text outside the JSON object.`

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

Only include fields that you are actually changing. NEVER leave module copy fields with their default "Lorem Ipsum" values; always replace them with high-quality, relevant content.`,
      })
    }

    // Add conversation history if available
    if (context.history && context.history.length > 0) {
      messages.push({
        role: 'system',
        content: '--- PREVIOUS CONVERSATION HISTORY (FOR CONTEXT ONLY) ---',
      })
      for (const item of context.history) {
        messages.push({
          role: item.role as any,
          content: item.content,
        })
      }
      messages.push({
        role: 'system',
        content: '--- END OF PREVIOUS HISTORY. THE FOLLOWING IS THE CURRENT REQUEST. ---',
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

    if (payload.openEndedContext) {
      parts.push(`\n\n========================================================================`)
      parts.push(`CURRENT USER INSTRUCTIONS (PRIORITY):`)
      parts.push(`${payload.openEndedContext}`)
      parts.push(`========================================================================\n`)
      parts.push(
        `Please fulfill the CURRENT USER INSTRUCTIONS above using the tools provided below. If these instructions represent a new task, ignore irrelevant previous conversation history.`
      )
      parts.push(`\nRESPONSE FORMAT:`)
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

    // Add technical context below user instructions
    parts.push('\n--- TECHNICAL CONTEXT ---')
    parts.push(
      'IMPORTANT: Use the following technical context to inform your tool calls, but PRIORITIZE the USER INSTRUCTIONS above for your creative decisions.'
    )

    // Add scope-specific context
    switch (context.scope) {
      case 'dropdown':
        parts.push('Scope: Manual execution requested by user on an existing post.')
        break
      case 'global':
        parts.push('Scope: Global execution (System-wide).')
        parts.push('- You are NOT currently editing a specific post.')
        parts.push('- Focus on media generation or creating NEW posts.')
        parts.push('- Use "list_post_types" first if you need to create a post to see what is available.')
        parts.push('- Do NOT assume you are creating a "blog post" unless explicitly asked for that type.')
        break
      case 'field':
        parts.push(`Scope: Per-field AI assistance for: ${context.data?.fieldKey || 'unknown'}`)
        parts.push('- Your primary goal is to provide a value for this specific field.')
        break
      default:
        parts.push(`Scope: ${context.scope}`)
    }

    parts.push('\nNOTE ON HISTORY: If you see previous tool failures or "restrictions" in the conversation history, IGNORE THEM. The system has been updated and tools are now available. Try again if the user is asking for the same thing.')

    // Add payload context
    if (payload) {
      if (payload.post && context.scope !== 'global') {
        parts.push(`\nTarget Post ID: ${payload.post.id}`)
        parts.push(`Current post data:\n${JSON.stringify(payload.post, null, 2)}`)
      }
      if (payload.modules && context.scope !== 'global') {
        parts.push(`\nCurrent modules (${payload.modules.length} total):`)
        // Show all modules with their type, orderIndex, and key props
        payload.modules.forEach((m: any, idx: number) => {
          const moduleInfo: any = {
            postModuleId: m.postModuleId,
            type: m.type,
            orderIndex: m.orderIndex || idx,
            props: m.props || {},
          }
          parts.push(
            `\n${idx + 1}. ${m.type} (postModuleId: "${m.postModuleId}", orderIndex: ${moduleInfo.orderIndex}):`
          )
          parts.push(JSON.stringify(moduleInfo.props, null, 2))
        })
        parts.push(
          `\nIMPORTANT: If asked to update "all modules" or "all copy", you MUST include entries for all relevant modules in your response array. Use "postModuleId" to ensure your changes apply to the correct instance.`
        )
        parts.push(
          `CRITICAL: NEVER leave module copy fields with their default "Lorem Ipsum" values. Always replace them with high-quality, relevant content.`
        )
        const hasProse = payload.modules.some((m: any) =>
          String(m.type || '')
            .toLowerCase()
            .includes('prose')
        )
        if (hasProse) {
          parts.push(
            `\nNOTICE: This post contains "Prose" modules. When writing copy for these modules, ensure you provide a substantial amount of content (multiple paragraphs, headings, etc.) to meet user expectations for high-quality, detailed copy.`
          )
        }
      }
      if (payload.context) {
        parts.push(`\nAdditional context:\n${JSON.stringify(payload.context, null, 2)}`)
      }
    }

    // Add MCP tools info if enabled
    if (agent.llmConfig?.useMCP) {
      const availableTools = await mcpClientService.listTools()
      const allowedTools =
        agent.llmConfig?.allowedMCPTools && agent.llmConfig.allowedMCPTools.length > 0
          ? availableTools.filter((t) => agent.llmConfig?.allowedMCPTools?.includes(t.name))
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
  private async getAIConfig(
    config: AgentConfig,
    type: 'text' | 'media' = 'text'
  ): Promise<AIProviderConfig> {
    // Determine provider and model based on type
    let provider: AIProvider | undefined
    let model: string | undefined

    if (type === 'media') {
      provider = config.providerMedia || config.provider
      model = config.modelMedia || config.model
    } else {
      provider = config.providerText || config.provider
      model = config.modelText || config.model
    }

    // Fallback to global defaults if not in agent config
    if (!provider || !model) {
      const { default: aiSettingsService } = await import('#services/ai_settings_service')
      const globalSettings = await aiSettingsService.get()

      if (type === 'media') {
        provider = (provider || globalSettings.defaultMediaProvider) as AIProvider
        model = model || globalSettings.defaultMediaModel || undefined
      } else {
        provider = (provider || globalSettings.defaultTextProvider) as AIProvider
        model = model || globalSettings.defaultTextModel || undefined
      }
    }

    if (!provider) {
      throw new Error(`AI provider not specified for ${type} generation`)
    }

    if (!model) {
      throw new Error(`AI model not specified for ${type} generation`)
    }

    // Get API key from config or environment
    let apiKey = config.apiKey
    const envKey = `AI_PROVIDER_${provider.toUpperCase()}_API_KEY`
    if (!apiKey) {
      // Try environment variable
      apiKey = process.env[envKey] || ''
    }

    if (!apiKey) {
      throw new Error(
        `API key not found for provider ${provider}. Set apiKey in agent config or ${envKey} environment variable.`
      )
    }

    return {
      provider,
      apiKey,
      model,
      baseUrl: config.baseUrl,
      options: config.options,
    }
  }

  /**
   * Get completion options from agent config
   */
  private getCompletionOptions(
    config: AgentConfig
  ): AICompletionOptions {
    return {
      temperature: config.options?.temperature ?? 0.7,
      maxTokens: config.options?.maxTokens,
      topP: config.options?.topP,
      stop: config.options?.stop,
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

const agentExecutor = new AgentExecutor()
export default agentExecutor
