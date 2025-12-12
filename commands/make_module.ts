import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import string from '@adonisjs/core/helpers/string'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export default class MakeModule extends BaseCommand {
  static commandName = 'make:module'
  static description = 'Create a new content module with backend class and frontend component'

  static options: CommandOptions = {
    startApp: false,
  }

  @args.string({ description: 'Name of the module (e.g., Gallery, Testimonial, VideoEmbed)' })
  declare name: string

  @flags.string({
    description: 'Rendering mode: "static" (default, pure SSR) or "react" for interactive',
    default: 'static',
  })
  declare mode: 'static' | 'react'

  /**
   * Generate the backend module class template
   */
  protected getModuleTemplate(moduleName: string, moduleType: string, mode: string): string {
    const renderMode = mode === 'static' ? 'static' : 'react'

    return `import BaseModule from '#modules/base'
import type { ModuleConfig } from '#types/module_types'

/**
 * ${moduleName} Module
 *
 * TODO: Add description of what this module does and when to use it
 */
export default class ${moduleName}Module extends BaseModule {
  /**
   * Rendering mode: ${renderMode === 'static' ? 'Static (pure SSR)' : 'React (SSR + hydration)'}
   */
  getRenderingMode() {
    return '${renderMode}' as const
  }

  /**
   * Get module configuration
   */
  getConfig(): ModuleConfig {
    return {
      type: '${moduleType}',
      name: '${moduleName}',
      description: 'TODO: Describe this module',
      icon: 'cube',
      allowedScopes: ['local', 'global'],
      lockable: true,
      propsSchema: {
        // TODO: Define your schema here
        // Example:
        // title: {
        //   type: 'string',
        //   required: true,
        //   description: 'Main heading text',
        //   translatable: true,
        // },
      },
      defaultProps: {
        // TODO: Define default values
      },
      allowedPostTypes: [], // Empty = available for all post types
    }
  }
}
`
  }

  /**
   * Generate the static React component template
   */
  protected getStaticComponentTemplate(moduleName: string, moduleType: string): string {
    return `/**
* ${moduleName} Module (Static)
*
* Pure SSR-friendly component (no client-side hydration required).
* Use for simple content that doesn't need interactivity.
*
* Located in inertia/modules/ (shared between admin preview and public site).
* Rendering mode (static vs React) is controlled by the backend
* module's getRenderingMode() implementation.
 */

interface ${moduleName}Props {
  // TODO: Define your props
  // Example:
  // title: string
  // content: string
}

export default function ${moduleName}({
  // TODO: Destructure your props
}: ${moduleName}Props) {
  return (
    <section className="py-12" data-module="${moduleType}">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* TODO: Add your JSX template */}
        <p>Static ${moduleName} Module</p>
      </div>
    </section>
  )
}
`
  }

  /**
   * Generate the interactive React component template
   */
  protected getReactComponentTemplate(moduleName: string, moduleType: string): string {
    return `/**
* ${moduleName} Module (React)
 *
 * Interactive React component (SSR + hydration)
 * Use for components that need client-side interactivity
 *
 * Located in inertia/modules/ (shared between admin preview and public site)
 */

import { useState } from 'react'

interface ${moduleName}Props {
  // TODO: Define your props
  // Example:
  // items: Array<{ id: string; label: string }>
}

export default function ${moduleName}({
  // TODO: Destructure your props
}: ${moduleName}Props) {
  // TODO: Add your state and event handlers
  // Example:
  // const [selected, setSelected] = useState<string | null>(null)

  return (
    <section className="py-12" data-module="${moduleType}">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* TODO: Add your JSX template with interactivity */}
        <p>Interactive ${moduleName} Module</p>
      </div>
    </section>
  )
}
`
  }

  async run() {
    const moduleName = string.pascalCase(this.name)
    const moduleType = string.snakeCase(this.name).replace(/_/g, '-')
    const backendFileName = `${string.snakeCase(this.name)}.ts`
    const appRoot = fileURLToPath(this.app.appRoot)

    // Frontend file name is always `{type}.tsx`; rendering mode is controlled
    // by the backend module's getRenderingMode(), not by filename suffixes.
    const frontendFileName = `${moduleType}.tsx`

    // Create backend module class
    const backendPath = join(appRoot, 'app', 'modules', backendFileName)
    const backendContent = this.getModuleTemplate(moduleName, moduleType, this.mode)
    await writeFile(backendPath, backendContent, 'utf-8')

    // Create frontend component
    const frontendPath = join(appRoot, 'inertia', 'modules', frontendFileName)
    const frontendContent =
      this.mode === 'static'
        ? this.getStaticComponentTemplate(moduleName, moduleType)
        : this.getReactComponentTemplate(moduleName, moduleType)
    await writeFile(frontendPath, frontendContent, 'utf-8')

    // Success output
    this.logger.success(`Created ${moduleName} module (${this.mode} mode)`)
    this.logger.info('')
    this.logger.info('📦 Files created:')
    this.logger.info(this.colors.dim(`   Backend:  app/modules/${backendFileName}`))
    this.logger.info(this.colors.dim(`   Frontend: inertia/modules/${frontendFileName}`))
    this.logger.info('')
    this.logger.info('📝 Next steps:')
    this.logger.info('  1. Implement TODOs in both files:')
    this.logger.info(
      this.colors.dim(`     - Define props schema in app/modules/${backendFileName}`)
    )
    this.logger.info(this.colors.dim(`     - Build UI in inertia/modules/${frontendFileName}`))
    this.logger.info('  2. Restart the dev server:')
    this.logger.info(this.colors.dim('     npm run dev'))
    this.logger.info(
      this.colors.dim('     (Module will be automatically discovered and registered)')
    )
    this.logger.info('  3. Create unit tests in tests/unit/modules/')
    this.logger.info('')
    this.logger.info(
      this.colors.cyan(
        '💡 Tip: Use --mode=static for simple content, --mode=react for interactivity'
      )
    )
  }
}
