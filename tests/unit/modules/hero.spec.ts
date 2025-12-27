import { test } from '@japa/runner'
import HeroModule from '#modules/hero'

test.group('Hero Module', () => {
  test('should have correct configuration', ({ assert }) => {
    const heroModule = new HeroModule()
    const config = heroModule.getConfig()

    assert.equal(config.type, 'hero')
    assert.equal(config.name, 'Hero')
    assert.includeMembers(config.allowedScopes, ['local', 'global'])
    assert.isTrue(config.lockable)
    assert.isDefined(config.fieldSchema)
    assert.isDefined(config.defaultValues?.title)
  })

  test('should specify hybrid rendering mode', ({ assert }) => {
    const heroModule = new HeroModule()
    assert.equal(heroModule.getRenderingMode(), 'hybrid')
  })

  test('should get correct component name', ({ assert }) => {
    const heroModule = new HeroModule()
    assert.equal(heroModule.getComponentName(), 'hero')
  })

  test('should validate required fields', ({ assert }) => {
    const heroModule = new HeroModule()

    assert.doesNotThrow(() => {
      heroModule.validate({
        title: 'Valid Title',
      })
    })

    assert.throws(() => {
      heroModule.validate({})
    }, 'Missing required field: title')
  })
})

