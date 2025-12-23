import db from '@adonisjs/lucid/services/db'

async function run() {
  try {
    const assets = await db.from('media_assets').select('id', 'url').limit(5)
    console.log('Media Assets:', assets)
    
    const modules = await db.from('module_instances').where('type', 'hero-with-media').limit(5)
    console.log('Hero with Media Modules:', modules.map(m => ({ id: m.id, props: m.props })))
  } catch (e) {
    console.error(e)
  } finally {
    process.exit()
  }
}

run()





