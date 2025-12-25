import db from '@adonisjs/lucid/services/db'

async function run() {
	try {
		const res = await db.rawQuery("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'media_assets' AND column_name = 'id'")
		console.log('ID Column Info:', res.rows)
	} catch (e) {
		console.error(e)
	} finally {
		process.exit()
	}
}

run()









