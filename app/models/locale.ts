import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Locale extends BaseModel {
  public static table = 'locales'
  @column({ isPrimary: true })
  declare code: string

  @column()
  declare isEnabled: boolean

  @column()
  declare isDefault: boolean
}



