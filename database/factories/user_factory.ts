import factory from '@adonisjs/lucid/factories'
import User from '#models/user'

export const UserFactory = factory
  .define(User, ({ faker }) => {
    return {
      email: faker.internet.email().toLowerCase(),
      password: 'supersecret',
      fullName: faker.person.fullName(),
      role: 'editor' as const,
    }
  })
  .state('admin', (user) => {
    user.role = 'admin'
  })
  .state('editor', (user) => {
    user.role = 'editor'
  })
  .state('translator', (user) => {
    user.role = 'translator'
  })
  .build()


