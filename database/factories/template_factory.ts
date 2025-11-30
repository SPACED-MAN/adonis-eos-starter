import { faker } from '@faker-js/faker'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'

class TemplateFactoryBuilder {
  private _overrides: Partial<{
    name: string
    postType: string
    description: string | null
    locked: boolean
  }> = {}

  private definition() {
    return {
      name: faker.lorem.slug(),
      postType: 'blog',
      description: faker.lorem.sentence(),
      locked: false,
    }
  }

  private clone(): TemplateFactoryBuilder {
    const clone = new TemplateFactoryBuilder()
    clone._overrides = { ...this._overrides }
    return clone
  }

  merge(overrides: Partial<{
    name: string
    postType: string
    description: string | null
    locked: boolean
  }>): TemplateFactoryBuilder {
    const clone = this.clone()
    clone._overrides = { ...clone._overrides, ...overrides }
    return clone
  }

  locked(): TemplateFactoryBuilder {
    return this.merge({ locked: true })
  }

  forType(postType: string): TemplateFactoryBuilder {
    return this.merge({ postType })
  }

  async create() {
    const attrs = { ...this.definition(), ...this._overrides }
    const id = randomUUID()

    const [row] = await db.table('templates').insert({
      id,
      name: attrs.name,
      post_type: attrs.postType,
      description: attrs.description,
      locked: attrs.locked,
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

export const TemplateFactory = new TemplateFactoryBuilder()


