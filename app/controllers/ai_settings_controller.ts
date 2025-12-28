import type { HttpContext } from '@adonisjs/core/http'
import aiSettingsService from '#services/ai_settings_service'
import aiProviderService from '#services/ai_provider_service'
import roleRegistry from '#services/role_registry'
import type { AIProvider } from '#types/agent_types'

export default class AISettingsController {
  /**
   * GET /api/ai-settings
   */
  async index({ response }: HttpContext) {
    const settings = await aiSettingsService.get()

    // Get available models for each provider
    const providers: AIProvider[] = ['openai', 'anthropic', 'google']
    const models: Record<string, string[]> = {}
    const textModels: Record<string, string[]> = {}
    const imageModels: Record<string, string[]> = {}
    const videoModels: Record<string, string[]> = {}

    for (const provider of providers) {
      const allModels = await aiProviderService.listModels(provider)
      models[provider] = allModels
      textModels[provider] = allModels.filter((m) =>
        aiProviderService.hasCapability(provider, m, 'text')
      )
      imageModels[provider] = allModels.filter((m) =>
        aiProviderService.hasCapability(provider, m, 'image')
      )
      videoModels[provider] = allModels.filter((m) =>
        aiProviderService.hasCapability(provider, m, 'video')
      )
    }

    return response.ok({
      data: {
        settings,
        models,
        textModels,
        imageModels,
        videoModels,
        providers,
      },
    })
  }

  /**
   * PATCH /api/ai-settings
   */
  async update({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'admin.settings.update')) {
      return response.forbidden({ error: 'Not allowed to update AI settings' })
    }

    const payload = request.only([
      'defaultTextProvider',
      'defaultTextModel',
      'defaultMediaProvider',
      'defaultMediaModel',
      'defaultVideoProvider',
      'defaultVideoModel',
      'options',
    ])

    const updated = await aiSettingsService.upsert(payload)
    return response.ok({ data: updated })
  }
}
