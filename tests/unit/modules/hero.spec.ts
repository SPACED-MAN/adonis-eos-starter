import { test } from '@japa/runner'
import HeroModule from '#modules/hero'

test.group('Hero Module', () => {
  test('should have correct configuration', ({ assert }) => {
    const heroModule = new HeroModule()
    const config = heroModule.getConfig()

    assert.equal(config.type, 'hero')
    assert.equal(config.name, 'Hero Section')
    assert.includeMembers(config.allowedScopes, ['local', 'global'])
    assert.isTrue(config.lockable)
    assert.isDefined(config.propsSchema.title)
    assert.isDefined(config.defaultProps.title)
  })

  test('should specify static rendering mode', ({ assert }) => {
    const heroModule = new HeroModule()
    assert.equal(heroModule.getRenderingMode(), 'static')
  })

  test('should get correct component name', ({ assert }) => {
    const heroModule = new HeroModule()
    assert.equal(heroModule.getComponentName(), 'hero-static')
  })

  test('should validate required fields', ({ assert }) => {
    const heroModule = new HeroModule()

    assert.doesNotThrow(() => {
      heroModule.validate({
        title: 'Test Title',
      })
    })

    assert.throws(() => {
      heroModule.validate({})
    })
  })

  test('should merge props correctly', ({ assert }) => {
    const heroModule = new HeroModule()
    const props = { title: 'My Title', subtitle: 'My Subtitle' }
    const overrides = { subtitle: 'Overridden Subtitle' }

    const merged = heroModule.mergeProps(props, overrides)

    assert.equal(merged.title, 'My Title')
    assert.equal(merged.subtitle, 'Overridden Subtitle')
  })
})
