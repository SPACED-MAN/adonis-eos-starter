import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import env from '#start/env'

/**
 * Supported AI providers
 */
export type AIProvider = 'openai' | 'anthropic' | 'google' | 'nanobanana'

/**
 * Model capabilities
 */
export type ModelCapability = 'text' | 'image' | 'video'

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
        throw new Error(
          `OpenAI model '${config.model}' not found. Check if the model name is correct.`
        )
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
    // Filter out maxTokens from config.options since we use maxOutputTokens for Gemini
    const {
      maxTokens: ignoredMaxTokens,
      temperature: configTemp,
      topP: configTopP,
      stop: configStop,
      ...otherConfigOptions
    } = config.options || {}

    // Build generationConfig, ensuring maxTokens is never included
    const generationConfig: any = {
      temperature: options.temperature ?? configTemp ?? 0.7,
      topP: options.topP ?? configTopP,
      maxOutputTokens: options.maxTokens,
      stopSequences: options.stop ?? configStop,
    }

    // Only spread other options that are valid for Gemini generationConfig
    // Filter out any remaining maxTokens references
    Object.keys(otherConfigOptions).forEach((key) => {
      if (key !== 'maxTokens' && key !== 'maxOutputTokens') {
        generationConfig[key] = otherConfigOptions[key]
      }
    })

    const model = client.getGenerativeModel({
      model: config.model || 'gemini-2.0-flash',
      generationConfig,
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
        model: config.model || 'gemini-2.0-flash',
      },
    }
  }

  /**
   * List available models for a provider
   */
  async listModels(provider: AIProvider, apiKey?: string): Promise<string[]> {
    if (!apiKey) {
      // Try to get from env if not provided
      const envKey = `AI_PROVIDER_${provider.toUpperCase()}_API_KEY`
      apiKey = env.get(envKey as any)
    }

    if (!apiKey) {
      return this.getHardcodedModels(provider)
    }

    try {
      switch (provider) {
        case 'google':
          return this.listAvailableModels(apiKey)
        case 'openai':
          return this.listOpenAIModels(apiKey)
        case 'anthropic':
          return this.listAnthropicModels(apiKey)
        default:
          return []
      }
    } catch (error) {
      console.error(`Error listing models for ${provider}:`, error)
      return this.getHardcodedModels(provider)
    }
  }

  /**
   * List OpenAI models
   */
  private async listOpenAIModels(apiKey: string): Promise<string[]> {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    if (!response.ok) return this.getHardcodedModels('openai')
    const data = (await response.json()) as any
    return (data.data || [])
      .map((m: any) => m.id)
      .filter((id: string) => id.startsWith('gpt') || id.startsWith('dall-e'))
      .sort()
  }

  /**
   * List Anthropic models
   * Note: Anthropic doesn't have a public models list API in the same way,
   * but we can return their known latest models or try to fetch if they add one.
   */
  private async listAnthropicModels(_apiKey: string): Promise<string[]> {
    // Anthropic recently added a models API, let's try it
    try {
      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': _apiKey,
          'anthropic-version': '2023-06-01',
        },
      })
      if (response.ok) {
        const data = (await response.json()) as any
        return (data.data || []).map((m: any) => m.id).sort()
      }
    } catch {
      // Fallback to hardcoded
    }
    return this.getHardcodedModels('anthropic')
  }

  /**
   * Fallback hardcoded models if API fails or no key
   */
  private getHardcodedModels(provider: AIProvider): string[] {
    switch (provider) {
      case 'openai':
        return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'dall-e-3', 'dall-e-2']
      case 'anthropic':
        return [
          'claude-3-5-sonnet-latest',
          'claude-3-5-haiku-latest',
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307',
        ]
      case 'google':
        return [
          'gemini-2.0-flash',
          'gemini-1.5-pro',
          'gemini-1.5-flash',
          'nano-banana-pro-preview',
          'imagen-4.0-generate-001',
          'veo-2.0-generate-001',
          'veo-3.0-generate-001',
          'veo-3.1-generate-preview',
        ]
      default:
        return []
    }
  }

  /**
   * List available Gemini models for the given API key
   * Useful for debugging model availability issues
   * Tries both v1beta and v1 API endpoints
   */
  async listAvailableModels(apiKey: string): Promise<string[]> {
    const models: string[] = []

    // Try v1beta endpoint first
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      )
      if (response.ok) {
        const data = (await response.json()) as any
        const v1betaModels = (data.models || [])
          .map((m: any) => m.name?.replace('models/', '') || m.name)
          .filter(Boolean)
        models.push(...v1betaModels)
      }
    } catch (error) {
      // Ignore v1beta errors
    }

    // Try v1 endpoint as fallback
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
      )
      if (response.ok) {
        const data = (await response.json()) as any
        const v1Models = (data.models || [])
          .map((m: any) => m.name?.replace('models/', '') || m.name)
          .filter(Boolean)
        models.push(...v1Models)
      }
    } catch (error) {
      // Ignore v1 errors
    }

    // Return unique models
    return [...new Set(models)]
  }

  /**
   * Generate an image using the specified provider
   */
  async generateImage(
    prompt: string,
    options: {
      size?: string
      quality?: string
      n?: number
      [key: string]: any
    } = {},
    config: AIProviderConfig
  ): Promise<{ imageUrl: string; revisedPrompt?: string }> {
    switch (config.provider) {
      case 'openai':
        return this.generateImageOpenAI(prompt, options, config)
      case 'google':
        return this.generateImageGoogle(prompt, options, config)
      default:
        throw new Error(`Media generation not supported for provider: ${config.provider}`)
    }
  }

  /**
   * Generate image using OpenAI (DALL-E)
   */
  private async generateImageOpenAI(
    prompt: string,
    options: any,
    config: AIProviderConfig
  ): Promise<{ imageUrl: string; revisedPrompt?: string }> {
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    })

    const response = await client.images.generate({
      model: config.model || 'dall-e-3',
      prompt: prompt,
      n: options.n || 1,
      size: options.size || '1024x1024',
      quality: options.quality || 'standard',
      ...config.options,
    })

    const image = response.data?.[0]
    if (!image || !image.url) {
      throw new Error('OpenAI returned no image URL')
    }

    return {
      imageUrl: image.url,
      revisedPrompt: image.revised_prompt,
    }
  }

  /**
   * Generate image using Google (Imagen or Gemini Image models)
   */
  private async generateImageGoogle(
    prompt: string,
    options: any,
    config: AIProviderConfig
  ): Promise<{ imageUrl: string; revisedPrompt?: string }> {
    const client = new GoogleGenerativeAI(config.apiKey)
    const modelName = config.model || 'imagen-4.0-generate-001'

    // Check if this is a Gemini-based image model (like Nano Banana or Gemini 2.0/3.0 Image)
    // These models use generateContent instead of the :predict endpoint
    const isGeminiBased = modelName.includes('nano-banana') || modelName.includes('gemini')

    if (isGeminiBased) {
      try {
        const model = client.getGenerativeModel({ model: modelName })
        // For Gemini-based image models, we use generateContent with the prompt
        // and it returns image data in the parts
        const result = await model.generateContent(prompt)
        const response = result.response

        // Find the image part in the response
        const imagePart = response.candidates?.[0]?.content?.parts?.find(
          (part: any) => part.inlineData
        )

        if (imagePart?.inlineData?.data) {
          return {
            imageUrl: `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`,
          }
        }

        // Fallback: Check if it returned a URL in the text or metadata
        const text = response.text()
        const urlMatch = text.match(/(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|webp))/i)
        if (urlMatch) {
          return { imageUrl: urlMatch[0] }
        }

        throw new Error('Gemini-based image model returned no image data')
      } catch (error: any) {
        // If generateContent fails, we'll let it fall through to the :predict method
        // as some early models might still use it
        console.warn(
          `[generateImageGoogle] generateContent failed for ${modelName}, trying predict endpoint...`,
          error.message
        )
      }
    }

    // Standard Imagen :predict endpoint
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${config.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
              sampleCount: options.n || 1,
              aspectRatio: options.aspectRatio || '1:1',
              outputMimeType: 'image/png',
            },
          }),
        }
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Google Image Generation API error: ${response.status} ${error}`)
      }

      const data = (await response.json()) as any
      const prediction = data.predictions?.[0]

      if (prediction?.bytesBase64Encoded) {
        return {
          imageUrl: `data:image/png;base64,${prediction.bytesBase64Encoded}`,
        }
      }

      if (prediction?.url) {
        return { imageUrl: prediction.url }
      }

      throw new Error('Google returned no image data from predict endpoint')
    } catch (error: any) {
      throw new Error(`Google Image Generation failed for ${modelName}: ${error.message}`)
    }
  }

  /**
   * Generate a video using the specified provider
   */
  async generateVideo(
    prompt: string,
    options: {
      aspect_ratio?: string
      duration?: string
      [key: string]: any
    } = {},
    config: AIProviderConfig
  ): Promise<{ videoUrl: string }> {
    switch (config.provider) {
      case 'google':
        return this.generateVideoGoogle(prompt, options, config)
      default:
        throw new Error(`Video generation not supported for provider: ${config.provider}`)
    }
  }

  /**
   * Generate video using Google (Veo)
   */
  private async generateVideoGoogle(
    prompt: string,
    options: any,
    config: AIProviderConfig
  ): Promise<{ videoUrl: string }> {
    const modelName = config.model || 'veo-2.0-generate-001'

    // Use predictLongRunning endpoint for Veo models
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predictLongRunning?key=${config.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: options.aspect_ratio || '16:9',
            },
          }),
        }
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Google Video Generation API error: ${response.status} ${error}`)
      }

      let operation = (await response.json()) as any

      // Poll for operation completion
      const maxRetries = 60 // 5 minutes with 5s delay
      let retries = 0

      while (!operation.done && retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 5000))
        retries++

        const pollResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${operation.name}?key=${config.apiKey}`
        )

        if (!pollResponse.ok) {
          const error = await pollResponse.text()
          console.warn(`[generateVideoGoogle] Polling failed: ${pollResponse.status} ${error}`)
          continue
        }

        operation = await pollResponse.json()
      }

      if (!operation.done) {
        throw new Error('Google Video Generation timed out')
      }

      if (operation.error) {
        throw new Error(`Google Video Generation failed: ${operation.error.message}`)
      }

      const responseData = operation.response
      const prediction = responseData?.predictions?.[0]

      if (prediction?.bytesBase64Encoded) {
        return {
          videoUrl: `data:video/mp4;base64,${prediction.bytesBase64Encoded}`,
        }
      }

      if (prediction?.url) {
        return { videoUrl: prediction.url }
      }

      throw new Error('Google returned no video data in operation response')
    } catch (error: any) {
      throw new Error(`Google Video Generation failed for ${modelName}: ${error.message}`)
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

    const validProviders: AIProvider[] = ['openai', 'anthropic', 'google', 'nanobanana']
    if (!validProviders.includes(config.provider)) {
      throw new Error(
        `Invalid provider: ${config.provider}. Must be one of: ${validProviders.join(', ')}`
      )
    }
  }

  /**
   * Check if a model has a specific capability
   */
  hasCapability(provider: AIProvider, model: string, capability: ModelCapability): boolean {
    const m = model.toLowerCase()

    switch (provider) {
      case 'openai':
        if (capability === 'text') {
          return m.startsWith('gpt-') || m.startsWith('o1-') || m.startsWith('o3-')
        }
        if (capability === 'image') {
          return m.startsWith('dall-e-')
        }
        if (capability === 'video') {
          return m.startsWith('sora')
        }
        return false

      case 'anthropic':
        if (capability === 'text') {
          return m.startsWith('claude-')
        }
        return false

      case 'google':
        if (capability === 'text') {
          return m.includes('gemini') || m.includes('nano-banana')
        }
        if (capability === 'image') {
          return (
            m.includes('imagen') || m.includes('gemini') || m.includes('nano-banana') || m === 'veo'
          )
        }
        if (capability === 'video') {
          return m.includes('veo')
        }
        return false

      default:
        return capability === 'text' // Fallback
    }
  }
}

const aiProviderService = new AIProviderService()
export default aiProviderService
