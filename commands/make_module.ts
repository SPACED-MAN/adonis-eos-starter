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
    description: 'Rendering mode: "static" for pure SSR or "react" for interactive',
    default: 'react',
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
      allowedScopes: ['local', 'global', 'static'],
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
 * ${moduleName} Module - Static Variant
 *
 * Pure SSR component (no hydration, max performance)
 * Use for simple content that doesn't need interactivity
 *
 * Located in inertia/modules/ (shared between admin preview and public site)
 * Naming convention: -static suffix indicates pure SSR rendering
 */

interface ${moduleName}StaticProps {
  // TODO: Define your props
  // Example:
  // title: string
  // content: string
}

export default function ${moduleName}Static({
  // TODO: Destructure your props
}: ${moduleName}StaticProps) {
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
 * ${moduleName} Module - React Variant
 *
 * Interactive React component (SSR + hydration)
 * Use for components that need client-side interactivity
 *
 * Located in inertia/modules/ (shared between admin preview and public site)
 * No -static suffix = React component with full interactivity
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

    // Determine frontend file name based on mode
    const frontendFileName =
      this.mode === 'static' ? `${moduleType}-static.tsx` : `${moduleType}.tsx`

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
    this.logger.info('  2. Register in start/modules.ts:')
    this.logger.info(
      this.colors.dim(
        `     import ${moduleName}Module from '#modules/${string.snakeCase(this.name)}'`
      )
    )
    this.logger.info(this.colors.dim(`     ModuleRegistry.register(new ${moduleName}Module())`))
    this.logger.info('  3. Create unit tests in tests/unit/modules/')
    this.logger.info('')
    this.logger.info(
      this.colors.cyan(
        '💡 Tip: Use --mode=static for simple content, --mode=react for interactivity'
      )
    )
  }
}
