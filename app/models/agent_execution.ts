import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Post from './post.js'
import User from './user.js'

export type ViewMode = 'source' | 'review' | 'ai-review'

export default class AgentExecution extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare postId: string | null

  @column()
  declare agentId: string

  @column()
  declare viewMode: ViewMode

  @column()
  declare userId: number | null

  @column()
  declare request: string | null

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) => {
      if (!value) return null
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      }
      return value
    },
  })
  declare response: {
    rawResponse?: string
    summary?: string
    applied?: string[]
    [key: string]: any
  } | null

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) => {
      if (!value) return null
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      }
      return value
    },
  })
  declare context: Record<string, any> | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => Post, {
    foreignKey: 'postId',
  })
  declare post: BelongsTo<typeof Post> | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}