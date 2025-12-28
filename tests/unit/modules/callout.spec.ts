import { test } from '@japa/runner'
import CalloutModule from '#modules/callout'

test.group('Callout Module', () => {
  test('should have correct configuration', ({ assert }) => {
    const calloutModule = new CalloutModule()
    const config = calloutModule.getConfig()

    assert.equal(config.type, 'callout')
    assert.equal(config.name, 'Callout')
    assert.includeMembers(config.allowedScopes, ['local', 'global'])
    assert.isTrue(config.lockable)
    assert.isDefined(config.fieldSchema)
    assert.isDefined(config.defaultValues?.title)
    assert.isDefined(config.defaultValues?.ctas)
  })

  test('should specify hybrid rendering mode', ({ assert }) => {
    const calloutModule = new CalloutModule()
    assert.equal(calloutModule.getRenderingMode(), 'hybrid')
  })

  test('should get correct component name', ({ assert }) => {
    const calloutModule = new CalloutModule()
    assert.equal(calloutModule.getComponentName(), 'callout')
  })

  test('should validate required fields', ({ assert }) => {
    const calloutModule = new CalloutModule()

    assert.doesNotThrow(() => {
      calloutModule.validate({
        title: 'Valid Title',
      })
    })

    assert.throws(() => {
      calloutModule.validate({})
    }, 'Missing required field: title')
  })
})

