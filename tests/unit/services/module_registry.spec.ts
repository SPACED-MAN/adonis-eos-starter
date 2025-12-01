import { test } from '@japa/runner'
import moduleRegistry from '#services/module_registry'
import ProseModule from '#modules/prose'

test.group('Module Registry', (group) => {
  // Clear registry before each test
  group.each.setup(() => {
    moduleRegistry.clear()
  })

  test('should register a module', ({ assert }) => {
    const proseModule = new ProseModule()
    moduleRegistry.register(proseModule)

    assert.isTrue(moduleRegistry.has('prose'))
    assert.equal(moduleRegistry.count(), 1)
  })

  test('should throw error when registering duplicate module type', ({ assert }) => {
    const proseModule1 = new ProseModule()
    const proseModule2 = new ProseModule()

    moduleRegistry.register(proseModule1)

    assert.throws(
      () => moduleRegistry.register(proseModule2),
      "Module type 'prose' is already registered"
    )
  })

  test('should get registered module', ({ assert }) => {
    const proseModule = new ProseModule()
    moduleRegistry.register(proseModule)

    const retrieved = moduleRegistry.get('prose')
    assert.instanceOf(retrieved, ProseModule)
  })

  test('should throw error when getting unregistered module', ({ assert }) => {
    assert.throws(
      () => moduleRegistry.get('nonexistent'),
      "Module type 'nonexistent' is not registered"
    )
  })

  test('should return all module types', ({ assert }) => {
    moduleRegistry.register(new ProseModule())

    const types = moduleRegistry.getTypes()
    assert.lengthOf(types, 1)
    assert.includeMembers(types, ['prose'])
  })

  test('should return all module configurations', ({ assert }) => {
    moduleRegistry.register(new ProseModule())

    const configs = moduleRegistry.getAllConfigs()
    assert.lengthOf(configs, 1)
    assert.equal(configs[0].type, 'prose')
  })

  test('should filter modules by post type', ({ assert }) => {
    moduleRegistry.register(new ProseModule())

    // Empty allowedPostTypes means available for all post types
    const blogModules = moduleRegistry.getModulesForPostType('blog')
    assert.lengthOf(blogModules, 1)

    const pageModules = moduleRegistry.getModulesForPostType('page')
    assert.lengthOf(pageModules, 1)
  })

  test('should get module schema', ({ assert }) => {
    moduleRegistry.register(new ProseModule())

    const schema = moduleRegistry.getSchema('prose')
    assert.equal(schema.type, 'prose')
    assert.isDefined(schema.propsSchema)
    assert.isDefined(schema.defaultProps)
    assert.isArray(schema.allowedScopes)
  })

  test('should get all module schemas', ({ assert }) => {
    moduleRegistry.register(new ProseModule())

    const schemas = moduleRegistry.getAllSchemas()
    assert.lengthOf(schemas, 1)
    assert.equal(schemas[0].type, 'prose')
  })
})

