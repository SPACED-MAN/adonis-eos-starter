import { test } from '@japa/runner'
import ProseModule from '#modules/prose'

test.group('Prose Module', () => {
  test('should have correct configuration', ({ assert }) => {
    const proseModule = new ProseModule()
    const config = proseModule.getConfig()

    assert.equal(config.type, 'prose')
    assert.equal(config.name, 'Prose')
    assert.includeMembers(config.allowedScopes, ['local', 'global'])
    assert.isTrue(config.lockable)
    assert.isDefined(config.propsSchema?.content)
    assert.isDefined(config.defaultProps?.content)
  })

  test('should specify static rendering mode', ({ assert }) => {
    const proseModule = new ProseModule()
    assert.equal(proseModule.getRenderingMode(), 'static')
  })

  test('should get correct component name', ({ assert }) => {
    const proseModule = new ProseModule()
    assert.equal(proseModule.getComponentName(), 'prose')
  })

  test('should validate content structure', ({ assert }) => {
    const proseModule = new ProseModule()

    assert.doesNotThrow(() => {
      proseModule.validate({
        content: {
          root: {
            type: 'root',
            children: [],
          },
        },
      })
    })

    assert.throws(() => {
      proseModule.validate({ content: 'invalid' })
    })

    assert.throws(() => {
      proseModule.validate({ content: { invalid: 'structure' } })
    })
  })
})
