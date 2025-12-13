import { BaseSeeder } from '@adonisjs/lucid/seeders'
import UserSeeder from './user_seeder.js'
import DevelopmentImportSeeder from './development_import_seeder.js'
import ProductionImportSeeder from './production_import_seeder.js'
import DocumentationModuleGroupSeeder from './documentation_module_group_seeder.js'
import DocumentationSeeder from './documentation_seeder.js'
import DocumentationMenuSeeder from './documentation_menu_seeder.js'

/**
 * Main seeder that runs all other seeders in the correct order
 */
export default class extends BaseSeeder {
  async run() {
    console.log('🌱 Running all seeders...\n')

    const isDevelopment =
      process.env.NODE_ENV === 'development' || process.env.APP_ENV === 'development'
    const isProduction =
      process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production'

    // In development, prefer full database import from the JSON export.
    if (isDevelopment) {
      console.log('🧩 Development environment detected – importing development-export.json')
      await new DevelopmentImportSeeder(this.client).run()
      console.log('✅ Completed development import seeder\n')

      // Always (re)seed documentation from markdown so new docs files are reflected
      // even if the development export is stale.
      await new DocumentationModuleGroupSeeder(this.client).run()
      await new DocumentationSeeder(this.client).run()
      await new DocumentationMenuSeeder(this.client).run()
      console.log('✅ Completed documentation seeders (markdown-based)\n')
      return
    }

    // In production, use the production import seeder for first-fill.
    if (isProduction) {
      console.log('🚀 Production environment detected – running production import seeder')
      await new ProductionImportSeeder(this.client).run()
      console.log('✅ Completed production import seeder\n')
      return
    }

    // Default (e.g., staging): minimal seeds from markdown-based docs.
    // Users must be seeded first (referenced by other seeders)
    await new UserSeeder(this.client).run()

    // Documentation module group (must run before documentation posts)
    await new DocumentationModuleGroupSeeder(this.client).run()

    // Documentation (must run before homepage so posts can be referenced)
    await new DocumentationSeeder(this.client).run()

    // Documentation menu (dynamic menu for docs)
    await new DocumentationMenuSeeder(this.client).run()

    console.log('\n✅ All seeders completed!')
  }
}
