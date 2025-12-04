/**
 * Barrel file for database factories.
 *
 * This keeps `#database/factories` working while actual
 * factory definitions live in `database/factories/*.ts`,
 * matching `node ace make:factory` conventions.
 */

export * from './factories/user_factory.js'
export * from './factories/post_factory.js'
export * from './factories/module_instance_factory.js'
export * from './factories/template_factory.js'
