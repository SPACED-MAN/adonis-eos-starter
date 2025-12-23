import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class MediaAsset extends BaseModel {
	public static table = 'media_assets'

	@column({ isPrimary: true })
	declare id: string

	@column()
	declare url: string

	@column({ columnName: 'original_filename' })
	declare originalFilename: string

	@column({ columnName: 'mime_type' })
	declare mimeType: string

	@column()
	declare size: number

	@column({ columnName: 'alt_text' })
	declare altText: string | null

	@column()
	declare caption: string | null

	@column()
	declare description: string | null

	@column({
		serialize: (value) => (Array.isArray(value) ? value : []),
		prepare: (value) => (Array.isArray(value) ? value : []),
	})
	declare categories: string[]

	@column()
	declare metadata: Record<string, any> | null

	@column({ columnName: 'optimized_url' })
	declare optimizedUrl: string | null

	@column({ columnName: 'optimized_size' })
	declare optimizedSize: number | null

	@column.dateTime({ columnName: 'optimized_at' })
	declare optimizedAt: DateTime | null

	@column.dateTime({ autoCreate: true })
	declare createdAt: DateTime

	@column.dateTime({ autoCreate: true, autoUpdate: true })
	declare updatedAt: DateTime
}
