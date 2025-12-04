import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import string from '@adonisjs/core/helpers/string'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export default class MakeRole extends BaseCommand {
  static commandName = 'make:role'
  static description = 'Create a new role definition file'

  static options: CommandOptions = {
    startApp: false,
  }

  @args.string({ description: 'Name of the role (e.g., Reviewer, Contributor)' })
  declare name: string

  protected getRoleTemplate(roleName: string, roleKey: string): string {
    return `import type { RoleDefinition } from '#types/role_types'

const ${roleName}Role: RoleDefinition = {
  name: '${roleKey}',
  label: '${roleName}',
  description: 'TODO: Describe what this role can do.',
  permissions: [
    // TODO: Add permission keys, for example:
    // 'admin.access',
    // 'posts.edit',
  ],
}

export default ${roleName}Role
`
  }

  async run() {
    const roleName = string.pascalCase(this.name)
    const roleKey = string.snakeCase(this.name).replace(/_/g, '-')
    const fileName = `${roleKey}.ts`
    const appRoot = fileURLToPath(this.app.appRoot)

    const backendPath = join(appRoot, 'app', 'roles', fileName)
    const backendContent = this.getRoleTemplate(roleName, roleKey)
    await writeFile(backendPath, backendContent, 'utf-8')

    this.logger.success(`Created ${roleName} role`)
    this.logger.info('')
    this.logger.info('📦 Files created:')
    this.logger.info(this.colors.dim(`   Role: app/roles/${fileName}`))
    this.logger.info('')
    this.logger.info('📝 Next steps:')
    this.logger.info('  1. Fill in permissions for this role in the new file.')
    this.logger.info('  2. Ensure any controllers/services use roleRegistry.hasPermission(...) as needed.')
    this.logger.info('')
  }
}


