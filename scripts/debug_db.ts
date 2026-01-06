import 'reflect-metadata'
import { Ignitor } from '@adonisjs/core'

/**
 * Debug database state.
 *
 * Usage:
 *   tsx scripts/debug_db.ts
 */

const appRoot = new URL('../', import.meta.url)

new Ignitor(appRoot, { logger: true })
  .tap((app) => {
    app.booting(async () => {
      await app.init()
      await app.boot()
    })
  })
  .run(async (app) => {
    const db = await app.container.make('lucid.db')

    console.log('Querying module_instances for hero-with-media...')
    const modules = await db
      .from('module_instances')
      .where('type', 'hero-with-media')
      .select('id', 'type', 'props', 'review_props', 'ai_review_props')
      .limit(5)

    console.log(`Found ${modules.length} modules`)
    for (const m of modules) {
      console.log(`--- Module ID: ${m.id} ---`)
      console.log(`Type: ${m.type}`)
      console.log(`Props: ${JSON.stringify(m.props, null, 2)}`)

      const mediaId = m.props?.image
      if (mediaId) {
        if (typeof mediaId === 'string') {
          console.log(`Attempting to resolve media ID: ${mediaId}`)
          try {
            const asset = await db.from('media_assets').where('id', mediaId).first()
            if (asset) {
              console.log(`Found media asset: ${JSON.stringify(asset, null, 2)}`)
            } else {
              console.error(`Media asset NOT FOUND in DB for ID: ${mediaId}`)
            }
          } catch (e: any) {
            console.error(`Error querying media_assets: ${e.message}`)
          }
        } else if (typeof mediaId === 'object') {
          console.log(`Media is already an object: ${JSON.stringify(mediaId, null, 2)}`)
        }
      }
    }

    console.log('--- Media Assets Table (first 5) ---')
    try {
      const typeQuery = await db.rawQuery(`
        SELECT column_name, data_type, udt_name 
        FROM information_schema.columns 
        WHERE table_name = 'media_assets' AND column_name = 'id'
      `)
      console.log(`Column Info: ${JSON.stringify(typeQuery.rows, null, 2)}`)

      const assets = await db.from('media_assets').limit(5)
      for (const a of assets) {
        console.log(`ID: ${a.id}, URL: ${a.url}, Original: ${a.original_filename}`)
      }
    } catch (e: any) {
      console.error(`Error querying media_assets: ${e.message}`)
    }
  })





