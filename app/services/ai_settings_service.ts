import AISetting from '#models/ai_setting'

export type AISettings = {
  defaultTextProvider: string | null
  defaultTextModel: string | null
  defaultMediaProvider: string | null
  defaultMediaModel: string | null
  options: any | null
}

class AISettingsService {
  private cache: AISettings | null = null
  private lastLoadedAt = 0
  private ttlMs = 10000

  async get(): Promise<AISettings> {
    const now = Date.now()
    if (this.cache && now - this.lastLoadedAt < this.ttlMs) {
      return this.cache
    }
    const row = await AISetting.query().first()
    const settings: AISettings = {
      defaultTextProvider: row?.defaultTextProvider || 'openai',
      defaultTextModel: row?.defaultTextModel || 'gpt-4o',
      defaultMediaProvider: row?.defaultMediaProvider || 'openai',
      defaultMediaModel: row?.defaultMediaModel || 'dall-e-3',
      options: row?.options || {},
    }
    this.cache = settings
    this.lastLoadedAt = now
    return settings
  }

  clearCache() {
    this.cache = null
    this.lastLoadedAt = 0
  }

  async upsert(payload: Partial<AISettings>): Promise<AISettings> {
    const currentRow = await AISetting.query().first()
    if (currentRow) {
      currentRow.merge(payload)
      await currentRow.save()
    } else {
      await AISetting.create(payload)
    }
    this.clearCache()
    return await this.get()
  }
}

const aiSettingsService = new AISettingsService()
export default aiSettingsService
