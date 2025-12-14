import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import env from '#start/env'

/**
 * Supported AI providers
 */
export type AIProvider = 'openai' | 'anthropic' | 'google'

/**
 * AI Provider Configuration
 */
export interface AIProviderConfig {
  /**
   * Provider identifier
   */
  provider: AIProvider

  /**
   * API key for the provider
   */
  apiKey: string

  /**
   * Model identifier (provider-specific)
   * Examples: 'gpt-4', 'claude-3-opus-20240229', 'gemini-pro'
   */
  model: string

  /**
   * Base URL for custom providers (optional)
   */
  baseUrl?: string

  /**
   * Additional provider-specific options
   */
  options?: Record<string, any>
}

/**
 * AI Message for chat completion
 */
export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Model-agnostic completion options
 */
export interface AICompletionOptions {
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
   * Stop sequences (array of strings)
   */
  stop?: string[]

  /**
   * Additional provider-specific options
   */
  [key: string]: any
}

/**
 * AI Completion Result
 */
export interface AICompletionResult {
  /**
   * Generated text content
   */
  content: string

  /**
   * Usage statistics
   */
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }

  /**
   * Provider-specific metadata
   */
  metadata?: Record<string, any>
}

/**
 * AI Provider Service
 *
 * Model-agnostic abstraction layer for multiple AI providers.
 * Supports OpenAI, Anthropic (Claude), and Google (Gemini).
 */
class AIProviderService {
  /**
   * Complete a chat conversation using the specified provider
   */
  async complete(
    messages: AIMessage[],
    options: AICompletionOptions = {},
    config: AIProviderConfig
  ): Promise<AICompletionResult> {
    switch (config.provider) {
      case 'openai':
        return this.completeOpenAI(messages, options, config)
      case 'anthropic':
        return this.completeAnthropic(messages, options, config)
      case 'google':
        return this.completeGoogle(messages, options, config)
      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`)
    }
  }

  /**
   * Complete using OpenAI
   */
  private async completeOpenAI(
    messages: AIMessage[],
    options: AICompletionOptions,
    config: AIProviderConfig
  ): Promise<AICompletionResult> {
    try {
      const client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      })

      // Convert messages format
      const openAIMessages = messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
        content: msg.content,
      }))

      // Filter out camelCase options that might conflict (like maxTokens -> max_tokens)
      // Extract known options to prevent them from being spread with wrong names
      const { maxTokens, topP, temperature: temp, stop, ...otherOptions } = config.options || {}
      
      // Build request params, only including defined values
      const requestParams: any = {
        model: config.model,
        messages: openAIMessages as any,
        temperature: options.temperature ?? temp ?? 0.7,
      }
      
      // Only add max_tokens if provided (OpenAI doesn't like undefined)
      const maxTokensValue = options.maxTokens ?? maxTokens
      if (maxTokensValue !== undefined) {
        requestParams.max_tokens = maxTokensValue
      }
      
      // Only add top_p if provided
      const topPValue = options.topP ?? topP
      if (topPValue !== undefined) {
        requestParams.top_p = topPValue
      }
      
      // Only add stop if provided
      const stopValue = options.stop ?? stop
      if (stopValue !== undefined) {
        requestParams.stop = stopValue
      }
      
      // Spread other options (excluding the ones we handled above)
      Object.assign(requestParams, otherOptions)
      
      const response = await client.chat.completions.create(requestParams)

      const choice = response.choices[0]
      if (!choice || !choice.message) {
        throw new Error('OpenAI returned empty response')
      }

      return {
        content: choice.message.content || '',
        usage: {
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
        },
        metadata: {
          finishReason: choice.finish_reason,
          model: response.model,
        },
      }
    } catch (error: any) {
      // Provide more helpful error messages
      if (error?.status === 401) {
        throw new Error('OpenAI API key is invalid or expired')
      }
      if (error?.status === 404) {
        throw new Error(`OpenAI model '${config.model}' not found. Check if the model name is correct.`)
      }
      if (error?.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please try again later.')
      }
      if (error?.message) {
        throw new Error(`OpenAI API error: ${error.message}`)
      }
      throw error
    }
  }

  /**
   * Complete using Anthropic (Claude)
   */
  private async completeAnthropic(
    messages: AIMessage[],
    options: AICompletionOptions,
    config: AIProviderConfig
  ): Promise<AICompletionResult> {
    const client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    })

    // Separate system message from user/assistant messages
    const systemMessage = messages.find((m) => m.role === 'system')
    const conversationMessages = messages.filter((m) => m.role !== 'system')

    // Convert to Anthropic format
    const anthropicMessages = conversationMessages.map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    })) as any

    const response = await client.messages.create({
      model: config.model,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP,
      stop_sequences: options.stop,
      system: systemMessage?.content,
      messages: anthropicMessages,
      ...config.options,
    })

    const contentBlock = response.content[0]
    if (!contentBlock || contentBlock.type !== 'text') {
      throw new Error('Anthropic returned non-text response')
    }

    return {
      content: contentBlock.text,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      metadata: {
        stopReason: response.stop_reason,
        model: response.model,
      },
    }
  }

  /**
   * Complete using Google (Gemini)
   */
  private async completeGoogle(
    messages: AIMessage[],
    options: AICompletionOptions,
    config: AIProviderConfig
  ): Promise<AICompletionResult> {
    const client = new GoogleGenerativeAI(config.apiKey)

    // Get the model
    const model = client.getGenerativeModel({
      model: config.model,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        topP: options.topP,
        maxOutputTokens: options.maxTokens,
        stopSequences: options.stop,
        ...config.options,
      },
    })

    // Separate system message
    const systemMessage = messages.find((m) => m.role === 'system')
    const conversationMessages = messages.filter((m) => m.role !== 'system')

    // Build prompt (Gemini doesn't support system messages in the same way)
    let prompt = ''
    if (systemMessage) {
      prompt += `System: ${systemMessage.content}\n\n`
    }

    // Convert messages to prompt format
    for (const msg of conversationMessages) {
      if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n\n`
      } else if (msg.role === 'assistant') {
        prompt += `Assistant: ${msg.content}\n\n`
      }
    }
    prompt += 'Assistant:'

    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()

    return {
      content: text,
      usage: {
        // Gemini doesn't provide detailed usage in the same way
        totalTokens: response.usageMetadata?.totalTokenCount,
      },
      metadata: {
        finishReason: response.candidates?.[0]?.finishReason,
        model: config.model,
      },
    }
  }

  /**
   * Validate provider configuration
   */
  validateConfig(config: AIProviderConfig): void {
    if (!config.provider) {
      throw new Error('AI provider is required')
    }

    if (!config.apiKey) {
      throw new Error(`API key is required for provider: ${config.provider}`)
    }

    if (!config.model) {
      throw new Error(`Model is required for provider: ${config.provider}`)
    }

    const validProviders: AIProvider[] = ['openai', 'anthropic', 'google']
    if (!validProviders.includes(config.provider)) {
      throw new Error(`Invalid provider: ${config.provider}. Must be one of: ${validProviders.join(', ')}`)
    }
  }
}

const aiProviderService = new AIProviderService()
export default aiProviderService

