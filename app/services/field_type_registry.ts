import type { FieldTypeConfig } from '#fields/base_field'

/**
 * Field Type Registry
 *
 * Code-first registry for custom field types (text, select, media, etc.).
 * Keeps Inertia component names and validation schemas discoverable.
 */
class FieldTypeRegistry {
  private types: Map<string, FieldTypeConfig> = new Map()

  register(config: FieldTypeConfig): void {
    if (this.types.has(config.type)) {
      throw new Error(`Field type '${config.type}' is already registered`)
    }
    this.types.set(config.type, config)
  }

  get(type: string): FieldTypeConfig {
    const cfg = this.types.get(type)
    if (!cfg) {
      throw new Error(`Field type '${type}' is not registered`)
    }
    return cfg
  }

  list(): FieldTypeConfig[] {
    return Array.from(this.types.values())
  }
}

const fieldTypeRegistry = new FieldTypeRegistry()
export default fieldTypeRegistry
