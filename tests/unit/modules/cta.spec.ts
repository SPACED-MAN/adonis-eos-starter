import { test } from '@japa/runner'
import CtaModule from '#modules/cta'

test.group('CTA Module', () => {
  test('should have correct configuration', ({ assert }) => {
    const ctaModule = new CtaModule()
    const config = ctaModule.getConfig()

    assert.equal(config.type, 'cta')
    assert.equal(config.name, 'Call to Action')
    assert.includeMembers(config.allowedScopes, ['local', 'global'])
    assert.isTrue(config.lockable)
    assert.isDefined(config.fieldSchema)
    assert.isDefined(config.defaultValues?.title)
    assert.isDefined(config.defaultValues?.ctas)
  })

  test('should specify hybrid rendering mode', ({ assert }) => {
    const ctaModule = new CtaModule()
    assert.equal(ctaModule.getRenderingMode(), 'hybrid')
  })

  test('should get correct component name', ({ assert }) => {
    const ctaModule = new CtaModule()
    assert.equal(ctaModule.getComponentName(), 'cta')
  })

  test('should validate required fields', ({ assert }) => {
    const ctaModule = new CtaModule()

    assert.doesNotThrow(() => {
      ctaModule.validate({
        title: 'Valid Title',
      })
    })

    assert.throws(() => {
      ctaModule.validate({})
    }, 'Missing required field: title')
  })
})

