import { BaseSeeder } from '@adonisjs/lucid/seeders'
import UserSeeder from './user_seeder.js'
import MenuSeeder from './menu_seeder.js'
import TaxonomySeeder from './taxonomy_seeder.js'
import HomepageSeeder from './homepage_seeder.js'
import SupportSeeder from './support_seeder.js'

/**
 * Main seeder that runs all other seeders in the correct order
 */
export default class extends BaseSeeder {
  async run() {
    console.log('🌱 Running all seeders...\n')

    // Users must be seeded first (referenced by other seeders)
    await new UserSeeder(this.client).run()

    // Menu structure
    await new MenuSeeder(this.client).run()

    // Taxonomies (categories, tags, etc.)
    await new TaxonomySeeder(this.client).run()

    // Homepage
    await new HomepageSeeder(this.client).run()

    // Support documentation
    await new SupportSeeder(this.client).run()

    console.log('\n✅ All seeders completed!')
  }
}
