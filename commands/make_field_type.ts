import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import string from '@adonisjs/core/helpers/string'
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export default class MakeFieldType extends BaseCommand {
  static commandName = 'make:field-type'
  static description = 'Scaffold a new custom field type (backend config + admin component)'

  static options: CommandOptions = {
    startApp: false,
  }

  @args.string({ description: 'Slug of the field type (e.g., select, rating)' })
  declare slug: string

  protected getFieldTemplate(fieldType: string, className: string): string {
    return `import { z } from 'zod'
import fieldTypeRegistry from '#services/field_type_registry'
import type { FieldTypeConfig } from './base_field.js'

const ${className}: FieldTypeConfig = {
  type: '${fieldType}',
  label: '${string.titleCase(fieldType)}',
  icon: 'lucide:sparkles',
  scope: ['site', 'post', 'post-type'],
  configSchema: z.object({
    // TODO: add config options (e.g., options, placeholder, required)
  }),
  valueSchema: z.any(), // TODO: tighten this schema
  adminComponent: 'admin/fields/${string.pascalCase(fieldType)}Field',
}

fieldTypeRegistry.register(${className})

export default ${className}
`
  }

  protected getAdminComponentTemplate(className: string, fieldType: string): string {
    return `type Props = {
  value: any
  onChange: (val: any) => void
  // TODO: add config props (from configSchema)
}

export default function ${className}Field({ value, onChange }: Props) {
  return (
    <div className="border border-dashed border-line-low p-3 rounded text-sm text-neutral-medium">
      <p className="font-medium mb-1">${className} (field type: ${fieldType})</p>
      <p>Implement UI in inertia/admin/fields/${className}Field.tsx</p>
      <input
        className="mt-2 block w-full border border-line-low rounded bg-backdrop-low px-2 py-1"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
`
  }

  async run() {
    const appRoot = fileURLToPath(this.app.appRoot)
    const fieldType = string.snakeCase(this.slug).replace(/_/g, '-')
    const className = string.pascalCase(fieldType)

    const fieldPath = join(appRoot, 'app', 'fields', `${fieldType}.ts`)
    const adminComponentPath = join(appRoot, 'inertia', 'admin', 'fields', `${className}Field.tsx`)
    const startFieldsPath = join(appRoot, 'start', 'fields.ts')

    await mkdir(join(appRoot, 'app', 'fields'), { recursive: true })
    await mkdir(join(appRoot, 'inertia', 'admin', 'fields'), { recursive: true })

    await writeFile(fieldPath, this.getFieldTemplate(fieldType, `${className}FieldConfig`), 'utf-8')
    await writeFile(adminComponentPath, this.getAdminComponentTemplate(className, fieldType), 'utf-8')

    // Ensure start/fields.ts imports the new field
    try {
      const startContent = await readFile(startFieldsPath, 'utf-8')
      const importLine = `import '#fields/${fieldType}'`
      if (!startContent.includes(importLine)) {
        const next = `${startContent.trim()}\n${importLine}\n`
        await writeFile(startFieldsPath, next, 'utf-8')
        this.logger.info(this.colors.dim(`Updated start/fields.ts with ${importLine}`))
      }
    } catch (e) {
      this.logger.warning(
        `Could not update start/fields.ts automatically. Please add: import '#fields/${fieldType}'`
      )
    }

    this.logger.success(`Created field type '${fieldType}'`)
    this.logger.info(this.colors.dim(`  Backend: app/fields/${fieldType}.ts`))
    this.logger.info(this.colors.dim(`  Admin component: inertia/admin/fields/${className}Field.tsx`))
    this.logger.info('Next steps:')
    this.logger.info('  - Update configSchema/valueSchema to match your field requirements')
    this.logger.info('  - Implement the admin component UI')
    this.logger.info('  - Import start/fields.ts to register new field types (autoload on boot)')
  }
}

