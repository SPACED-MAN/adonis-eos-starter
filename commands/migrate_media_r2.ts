import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import MediaAsset from '#models/media_asset'
import storageService from '#services/storage_service'
import findReplaceService from '#services/find_replace_service'
import path from 'node:path'
import fs from 'node:fs/promises'

import env from '#start/env'

export default class MigrateMediaR2 extends BaseCommand {
	static commandName = 'migrate:media:r2'
	static description = 'Migrate local media uploads to Cloudflare R2 and update database references'

	static options: CommandOptions = {
		startApp: true,
	}

	@flags.boolean({
		description: 'Dry run: only show what would be done without making changes',
		alias: 'd',
	})
	declare dryRun: boolean

	@flags.boolean({
		description: 'Force migration even if some checks fail',
	})
	declare force: boolean

	async run() {
		// We check for R2 driver. If not set, we can't upload.
		if (!storageService.isR2() && !this.force && !this.dryRun) {
			this.logger.error('STORAGE_DRIVER is not set to "r2" in your .env file.')
			this.logger.info(
				'Please set STORAGE_DRIVER=r2 and provide R2 credentials before running this command.'
			)
			return
		}

		const publicBaseUrl = env.get('R2_PUBLIC_BASE_URL')
		if (!publicBaseUrl && !this.dryRun) {
			this.logger.error('R2_PUBLIC_BASE_URL is not set in your .env file.')
			return
		}

		this.logger.info('Starting media migration to Cloudflare R2...')

		const assets = await MediaAsset.all()
		this.logger.info(`Found ${assets.length} media assets in database.`)

		let migratedCount = 0
		let skippedCount = 0
		let errorCount = 0

		for (const asset of assets) {
			try {
				const result = await this.migrateAsset(asset)
				if (result === 'migrated') {
					migratedCount++
				} else {
					skippedCount++
				}
			} catch (error) {
				this.logger.error(`Failed to migrate asset ${asset.id}: ${error.message}`)
				errorCount++
			}
		}

		this.logger.success('Media file migration complete!')
		this.logger.log(`- Migrated: ${migratedCount}`)
		this.logger.log(`- Skipped/Already Remote: ${skippedCount}`)
		this.logger.log(`- Errors: ${errorCount}`)

		if (migratedCount > 0 && !this.dryRun) {
			this.logger.info('Updating global references in posts and modules...')
			await this.updateGlobalReferences(publicBaseUrl!)
		} else if (this.dryRun) {
			this.logger.info('[Dry Run] Would have updated global references if not in dry-run mode.')
		}
	}

	private async findLocalFile(relativePath: string): Promise<string> {
		const cleanRel = relativePath.replace(/^\//, '')
		const possiblePaths = [
			storageService.getLocalPath(cleanRel),
			path.join(process.cwd(), 'public', cleanRel),
			path.join(process.cwd(), 'build', 'public', cleanRel),
		]

		for (const p of possiblePaths) {
			try {
				await fs.access(p)
				return p
			} catch {
				/* check next */
			}
		}
		return ''
	}

	private async migrateAsset(asset: MediaAsset): Promise<'migrated' | 'skipped'> {
		const isLocal = asset.url.startsWith('/') || asset.url.startsWith('uploads/')

		if (!isLocal) {
			return 'skipped'
		}

		const localPath = await this.findLocalFile(asset.url)

		if (!localPath) {
			this.logger.warning(`Asset ${asset.id} local file not found in any expected location.`)
			return 'skipped'
		}

		if (this.dryRun) {
			this.logger.info(`[Dry Run] Would migrate asset ${asset.id}: ${asset.url}`)
			return 'migrated'
		}

		const relativePath = asset.url.replace(/^\//, '')

		// 1. Upload main file
		// publishFile handles the "clean" path for R2 key
		const newUrl = await storageService.publishFile(localPath, relativePath)
		asset.url = newUrl

		// 2. Upload optimized file if exists
		if (
			asset.optimizedUrl &&
			(asset.optimizedUrl.startsWith('/') || asset.optimizedUrl.startsWith('uploads/'))
		) {
			const optimizedPath = await this.findLocalFile(asset.optimizedUrl)
			if (optimizedPath) {
				const newOptimizedUrl = await storageService.publishFile(
					optimizedPath,
					asset.optimizedUrl.replace(/^\//, '')
				)
				asset.optimizedUrl = newOptimizedUrl
			}
		}

		// 3. Upload variants in metadata
		if (asset.metadata && Array.isArray(asset.metadata.variants)) {
			const variants = [...asset.metadata.variants]
			for (const variant of variants) {
				if (variant.url && (variant.url.startsWith('/') || variant.url.startsWith('uploads/'))) {
					const varPath = await this.findLocalFile(variant.url)
					if (varPath) {
						variant.url = await storageService.publishFile(varPath, variant.url.replace(/^\//, ''))
					}
				}

				if (
					variant.optimizedUrl &&
					(variant.optimizedUrl.startsWith('/') || variant.optimizedUrl.startsWith('uploads/'))
				) {
					const optVarPath = await this.findLocalFile(variant.optimizedUrl)
					if (optVarPath) {
						variant.optimizedUrl = await storageService.publishFile(
							optVarPath,
							variant.optimizedUrl.replace(/^\//, '')
						)
					}
				}
			}
			asset.metadata = { ...asset.metadata, variants }
		}

		await asset.save()
		this.logger.info(`Migrated asset ${asset.id} -> ${asset.url}`)
		return 'migrated'
	}

	private async updateGlobalReferences(publicBaseUrl: string) {
		const cleanBaseUrl = publicBaseUrl.replace(/\/+$/, '')

		const tablesToSearch = [
			'posts',
			'post_modules',
			'module_instances',
			'post_custom_field_values',
			'site_settings',
		]

		// We use a more specific search to avoid double-replacing
		// We only replace if it starts with /uploads/ or is exactly uploads/ (within JSON or text)
		// Actually, Lexical stores them as "url":"/uploads/..."

		this.logger.info(`Searching for relative /uploads/ references to prepend ${cleanBaseUrl}...`)

		const result = await findReplaceService.performReplace({
			search: '"/uploads/',
			replace: `"${cleanBaseUrl}/uploads/`,
			tables: tablesToSearch,
			dryRun: false,
		})

		this.logger.info(`Updated JSON references: ${result.totalReplacements} replacements.`)

		const result2 = await findReplaceService.performReplace({
			search: 'src="/uploads/',
			replace: `src="${cleanBaseUrl}/uploads/`,
			tables: tablesToSearch,
			dryRun: false,
		})

		this.logger.info(`Updated HTML references: ${result2.totalReplacements} replacements.`)

		this.logger.success('Global reference update complete.')
	}
}
