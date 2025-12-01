import { faker } from '@faker-js/faker'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'

class ModuleInstanceFactoryBuilder {
  private _overrides: Partial<{
    type: string
    scope: 'post' | 'global'
    props: Record<string, unknown>
    globalSlug: string | null
  }> = {}

  private definition() {
    return {
      type: 'prose',
      scope: 'post' as const,
      props: {
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: faker.lorem.paragraphs(2) }],
              },
            ],
          },
        },
      },
      globalSlug: null,
    }
  }

  private clone(): ModuleInstanceFactoryBuilder {
    const clone = new ModuleInstanceFactoryBuilder()
    clone._overrides = { ...this._overrides }
    return clone
  }

  merge(overrides: Partial<{
    type: string
    scope: 'post' | 'global'
    props: Record<string, unknown>
    globalSlug: string | null
  }>): ModuleInstanceFactoryBuilder {
    const clone = this.clone()
    clone._overrides = { ...clone._overrides, ...overrides }
    return clone
  }

  prose(): ModuleInstanceFactoryBuilder {
    return this.merge({
      type: 'prose',
      props: {
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: faker.lorem.paragraphs(3) }],
              },
            ],
          },
        },
      },
    })
  }

  global(slug: string): ModuleInstanceFactoryBuilder {
    return this.merge({ scope: 'global', globalSlug: slug })
  }

  async create() {
    const attrs = { ...this.definition(), ...this._overrides }
    const id = randomUUID()

    const [row] = await db.table('module_instances').insert({
      id,
      type: attrs.type,
      scope: attrs.scope,
      props: attrs.props,
      global_slug: attrs.globalSlug,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('*')

    return { ...attrs, id: row.id }
  }

  async createMany(count: number) {
    const results = []
    for (let i = 0; i < count; i++) {
      results.push(await this.clone().create())
    }
    return results
  }
}

export const ModuleInstanceFactory = new ModuleInstanceFactoryBuilder()


