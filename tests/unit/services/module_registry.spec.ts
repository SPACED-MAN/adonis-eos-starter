import { test } from '@japa/runner'
import moduleRegistry from '#services/module_registry'
import HeroModule from '#modules/hero'
import ProseModule from '#modules/prose'

test.group('Module Registry', (group) => {
  // Clear registry before each test
  group.each.setup(() => {
    moduleRegistry.clear()
  })

  test('should register a module', ({ assert }) => {
    const heroModule = new HeroModule()
    moduleRegistry.register(heroModule)

    assert.isTrue(moduleRegistry.has('hero'))
    assert.equal(moduleRegistry.count(), 1)
  })

  test('should throw error when registering duplicate module type', ({ assert }) => {
    const heroModule1 = new HeroModule()
    const heroModule2 = new HeroModule()

    moduleRegistry.register(heroModule1)

    assert.throws(
      () => moduleRegistry.register(heroModule2),
      "Module type 'hero' is already registered"
    )
  })

  test('should get registered module', ({ assert }) => {
    const heroModule = new HeroModule()
    moduleRegistry.register(heroModule)

    const retrieved = moduleRegistry.get('hero')
    assert.instanceOf(retrieved, HeroModule)
  })

  test('should throw error when getting unregistered module', ({ assert }) => {
    assert.throws(
      () => moduleRegistry.get('nonexistent'),
      "Module type 'nonexistent' is not registered"
    )
  })

  test('should return all module types', ({ assert }) => {
    moduleRegistry.register(new HeroModule())
    moduleRegistry.register(new ProseModule())

    const types = moduleRegistry.getTypes()
    assert.lengthOf(types, 2)
    assert.includeMembers(types, ['hero', 'prose'])
  })

  test('should return all module configurations', ({ assert }) => {
    moduleRegistry.register(new HeroModule())
    moduleRegistry.register(new ProseModule())

    const configs = moduleRegistry.getAllConfigs()
    assert.lengthOf(configs, 2)
    assert.equal(configs[0].type, 'hero')
    assert.equal(configs[1].type, 'prose')
  })

  test('should filter modules by post type', ({ assert }) => {
    moduleRegistry.register(new HeroModule())
    moduleRegistry.register(new ProseModule())

    // Both modules have empty allowedPostTypes, so they should be available for all
    const blogModules = moduleRegistry.getModulesForPostType('blog')
    assert.lengthOf(blogModules, 2)

    const pageModules = moduleRegistry.getModulesForPostType('page')
    assert.lengthOf(pageModules, 2)
  })

  test('should get module schema', ({ assert }) => {
    moduleRegistry.register(new HeroModule())

    const schema = moduleRegistry.getSchema('hero')
    assert.equal(schema.type, 'hero')
    assert.equal(schema.name, 'Hero Section')
    assert.isDefined(schema.propsSchema)
    assert.isDefined(schema.defaultProps)
    assert.isArray(schema.allowedScopes)
  })

  test('should get all module schemas', ({ assert }) => {
    moduleRegistry.register(new HeroModule())
    moduleRegistry.register(new ProseModule())

    const schemas = moduleRegistry.getAllSchemas()
    assert.lengthOf(schemas, 2)
    assert.equal(schemas[0].type, 'hero')
    assert.equal(schemas[1].type, 'prose')
  })
})

