import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Post from '#models/post'
import User from '#models/user'

export default class Feedback extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare postId: string

  @column()
  declare userId: number | null

  @column()
  declare mode: 'approved' | 'review' | 'ai-review'

  @column()
  declare content: string

  @column()
  declare type: string

  @column()
  declare status: 'pending' | 'resolved'

  @column()
  declare context: any

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Post)
  declare post: BelongsTo<typeof Post>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}

