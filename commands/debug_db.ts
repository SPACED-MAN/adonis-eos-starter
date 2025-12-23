import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'

export default class DebugDb extends BaseCommand {
	static commandName = 'debug:db'
	static description = 'Debug database state'

	static options = {
		startApp: true,
	}

	async run() {
		this.logger.info('Querying module_instances for hero-with-media...')
		const modules = await db
			.from('module_instances')
			.where('type', 'hero-with-media')
			.select('id', 'type', 'props', 'review_props', 'ai_review_props')
			.limit(5)

		this.logger.info(`Found ${modules.length} modules`)
		for (const m of modules) {
			this.logger.info(`--- Module ID: ${m.id} ---`)
			this.logger.info(`Type: ${m.type}`)
			this.logger.info(`Props: ${JSON.stringify(m.props, null, 2)}`)

			const mediaId = m.props?.image
			if (mediaId) {
				if (typeof mediaId === 'string') {
					this.logger.info(`Attempting to resolve media ID: ${mediaId}`)
					try {
						const asset = await db.from('media_assets').where('id', mediaId).first()
						if (asset) {
							this.logger.success(`Found media asset: ${JSON.stringify(asset, null, 2)}`)
						} else {
							this.logger.error(`Media asset NOT FOUND in DB for ID: ${mediaId}`)
						}
					} catch (e: any) {
						this.logger.error(`Error querying media_assets: ${e.message}`)
					}
				} else if (typeof mediaId === 'object') {
					this.logger.info(`Media is already an object: ${JSON.stringify(mediaId, null, 2)}`)
				}
			}
		}

		this.logger.info('--- Media Assets Table (first 5) ---')
		try {
			const typeQuery = await db.rawQuery(`
        SELECT column_name, data_type, udt_name 
        FROM information_schema.columns 
        WHERE table_name = 'media_assets' AND column_name = 'id'
      `)
			this.logger.info(`Column Info: ${JSON.stringify(typeQuery.rows, null, 2)}`)

			const assets = await db.from('media_assets').limit(5)
			for (const a of assets) {
				this.logger.info(`ID: ${a.id}, URL: ${a.url}, Original: ${a.original_filename}`)
			}
		} catch (e: any) {
			this.logger.error(`Error querying media_assets: ${e.message}`)
		}
	}
}

