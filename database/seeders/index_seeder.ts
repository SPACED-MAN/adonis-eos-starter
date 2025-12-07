import { BaseSeeder } from '@adonisjs/lucid/seeders'
import UserSeeder from './user_seeder.js'
import MenuSeeder from './menu_seeder.js'
import TaxonomySeeder from './taxonomy_seeder.js'
import HomepageSeeder from './homepage_seeder.js'
import DocumentationModuleGroupSeeder from './documentation_module_group_seeder.js'
import DocumentationSeeder from './documentation_seeder.js'
import DocumentationMenuSeeder from './documentation_menu_seeder.js'

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

    // Documentation module group (must run before documentation posts)
    await new DocumentationModuleGroupSeeder(this.client).run()

    // Documentation (must run before homepage so posts can be referenced)
    await new DocumentationSeeder(this.client).run()

    // Documentation menu (dynamic menu for docs)
    await new DocumentationMenuSeeder(this.client).run()

    // Homepage (references documentation posts, so must run after)
    await new HomepageSeeder(this.client).run()

    console.log('\n✅ All seeders completed!')
  }
}
