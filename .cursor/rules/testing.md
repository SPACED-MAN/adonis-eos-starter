# Testing Guidelines

## Core Principle

**Write tests using AdonisJS + Japa conventions. Tests are mandatory for new features and critical flows.**

## Testing Framework

- **Test Runner:** Japa (built into AdonisJS)
- **Official Docs:** https://docs.adonisjs.com/guides/testing/introduction
- **Japa Docs:** https://japa.dev/docs

## Test Organization

### Test Location

```
tests/
├── unit/           # Unit tests (models, services, helpers)
├── functional/     # API/HTTP endpoint tests
└── bootstrap.ts    # Test configuration
```

### Test Suites

- **Unit Tests** - Test individual components in isolation
  - Models (methods, relationships, scopes)
  - Services (business logic)
  - Helpers (utility functions)
  - Validators
- **Functional Tests** - Test HTTP endpoints end-to-end
  - API routes
  - Authentication flows
  - Request/response validation

## Writing Tests

### ✅ DO: Follow AdonisJS Conventions

**Unit Test Example:**

```typescript
import { test } from '@japa/runner'
import Post from '#models/post'

test.group('Post Model', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })

  group.each.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('should create post with translations', async ({ assert }) => {
    const post = await Post.create({
      type: 'blog',
      slug: 'test-post',
      title: 'Test Post',
      locale: 'en',
    })

    assert.exists(post.id)
    assert.equal(post.locale, 'en')
  })
})
```

**Functional Test Example:**

```typescript
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('API - Posts', (group) => {
  group.each.setup(async () => {
    await testUtils.db().truncate()
  })

  test('GET /api/posts should return posts', async ({ client, assert }) => {
    const response = await client.get('/api/posts')

    response.assertStatus(200)
    assert.isArray(response.body().data)
  })
})
```

### ❌ DON'T: Create Custom Test Commands

**Bad:**

```typescript
// DON'T create custom ace commands for testing
node ace test:feature
node ace test:api
```

**Good:**

```bash
# Use standard Japa test commands
node ace test
node ace test unit
node ace test functional
```

## Test Creation Process

### 1. Create Test Files

Use `make:test` command:

```bash
# Create unit test
node ace make:test user --suite=unit

# Create functional test
node ace make:test posts/list --suite=functional
```

### 2. Write Tests Following TDD

1. **Write test first** (Red)
2. **Implement feature** (Green)
3. **Refactor** (Refactor)

### 3. Use Test Groups

```typescript
test.group('Feature Name', (group) => {
  // Setup before each test
  group.each.setup(async () => {
    // Setup code
  })

  // Cleanup after each test
  group.each.teardown(async () => {
    // Cleanup code
  })

  test('should do something', async ({ assert }) => {
    // Test code
  })
})
```

### 4. Use Lifecycle Hooks

- `group.setup()` - Run once before all tests in group
- `group.teardown()` - Run once after all tests in group
- `group.each.setup()` - Run before each test
- `group.each.teardown()` - Run after each test

## Database Testing

### Use Transactions for Unit Tests

```typescript
group.each.setup(async () => {
  await db.beginGlobalTransaction()
})

group.each.teardown(async () => {
  await db.rollbackGlobalTransaction()
})
```

### Use Truncate for Functional Tests

```typescript
group.each.setup(async () => {
  await testUtils.db().truncate()
})
```

## Running Tests

### Standard Commands

```bash
# Run all tests
node ace test

# Run specific suite
node ace test unit
node ace test functional

# Watch mode (re-run on changes)
node ace test --watch

# Run specific file
node ace test --files="i18n"

# Filter by test name
node ace test --tests="should create post"

# Filter by tags
node ace test --tags="@slow,@integration"
```

### Test Environment

- Use `.env.test` for test-specific configuration
- Set `SESSION_DRIVER=memory` for faster tests
- Use in-memory or separate test database

## Assertions

### Available Assertions

```typescript
// Basic assertions
assert.equal(actual, expected)
assert.notEqual(actual, expected)
assert.isTrue(value)
assert.isFalse(value)
assert.exists(value)
assert.isNull(value)
assert.isNotNull(value)

// Type assertions
assert.isArray(value)
assert.isObject(value)
assert.isString(value)
assert.isNumber(value)

// Collection assertions
assert.lengthOf(array, expected)
assert.include(string, substring)
assert.includeMembers(array, subset)

// Async assertions
await assert.rejects(async () => {
  // Code that should throw
})
```

### HTTP Assertions

```typescript
response.assertStatus(200)
response.assertBody({ data: [] })
response.assertBodyContains({ meta: { total: 10 } })
response.assertHeader('content-type', 'application/json')
response.assertCookie('session', 'value')
response.assertRedirectsTo('/login')
```

## Authentication in Tests

### Using loginAs()

```typescript
const user = await User.create({
  email: 'test@example.com',
  password: 'supersecret',
})

const response = await client.get('/api/protected').loginAs(user)

response.assertStatus(200)
```

## Quality & Automation

- **Mandatory for PRs:** CI should run `node ace test` on each PR to `main`.
- **Idempotency:** Ensure tests are idempotent and clean up any data they create. Use transactions (`db.beginGlobalTransaction()`) for unit tests and truncate (`testUtils.db().truncate()`) for functional tests.
- **Coverage Goals:**
  - Models: 100% of public methods
  - Services: 100% of business logic
  - Controllers: All API endpoints
  - Helpers: All utility functions

## What to Test

✅ **Critical Flows & Security:**

- Core services (e.g., `ActivityLogService`)
- Critical flows (e.g., scheduling auto-publish, code-first config behaviors)
- RBAC-sensitive operations (e.g., destructive routes, restricted fields)
- Authentication/authorization logic

✅ **Data & Logic:**

- Model methods and relationships
- Service business logic
- API endpoints (success and error cases)
- Validation rules
- Helper functions
- Query scopes

❌ **DON'T Test:**

- Framework internals
- Third-party libraries
- Simple getters/setters
- Configuration files

## Test Data

### Use Factories (When Available)

```typescript
// Future: Use factories for test data
const post = await PostFactory.create()
```

### Unique Test Data

For tests that run in parallel, use unique data:

```typescript
// Good: Unique slugs
const post = await Post.create({
  slug: `test-post-${Date.now()}`,
  title: 'Test Post',
})

// Good: Unique emails
const user = await User.create({
  email: `test-${Date.now()}@example.com`,
  password: 'secret',
})
```

## When Adding New Features

### Checklist

- [ ] Write unit tests for models/services
- [ ] Write functional tests for API endpoints
- [ ] Test both success and error cases
- [ ] Test edge cases
- [ ] Verify authentication/authorization
- [ ] Test with different locales (if applicable)
- [ ] Run `node ace test` to ensure all tests pass

### Test Coverage Requirements

- **Unit tests:** Required for all models, services, helpers
- **Functional tests:** Required for all public API endpoints
- **Integration tests:** Required for complex features

## Common Patterns

### Testing Model Relationships

```typescript
test('should have translations relationship', async ({ assert }) => {
  const post = await Post.create({
    type: 'blog',
    slug: 'test-post',
    title: 'Test Post',
    locale: 'en',
  })

  await post.related('translations').create({
    type: 'blog',
    slug: 'test-post-es',
    title: 'Publicación de Prueba',
    locale: 'es',
  })

  await post.load('translations')
  assert.lengthOf(post.translations, 1)
  assert.equal(post.translations[0].locale, 'es')
})
```

### Testing Query Scopes

```typescript
test('should filter by locale using scope', async ({ assert }) => {
  await Post.create({ slug: 'post-1', locale: 'en', title: 'Post 1' })
  await Post.create({ slug: 'post-2', locale: 'es', title: 'Post 2' })

  const enPosts = await Post.query().apply((scopes) => scopes.byLocale('en'))

  assert.lengthOf(enPosts, 1)
  assert.equal(enPosts[0].locale, 'en')
})
```

### Testing API Error Cases

```typescript
test('should return 404 for non-existent resource', async ({ client }) => {
  const response = await client.get('/api/posts/invalid-id')

  response.assertStatus(404)
  response.assertBodyContains({
    error: 'Post not found',
  })
})

test('should return 401 for unauthenticated request', async ({ client }) => {
  const response = await client.get('/api/admin/posts')

  // Should redirect or return 401/403
  assert.isTrue(response.status() === 302 || response.status() === 401 || response.status() === 403)
})
```

## Documentation

### Document Test Purpose

```typescript
// Good: Clear test purpose
test('should prevent deleting original post via translations endpoint', async ({ client }) => {
  // Original posts should only be deleted directly, not via translation API
  const response = await client.delete(`/api/posts/${post.id}/translations/en`).loginAs(user)

  response.assertStatus(400)
})
```

### Group Related Tests

```typescript
test.group('i18n - Post Model Translations', (group) => {
  // All translation-related tests grouped together
  test('should create translation')
  test('should get all translations')
  test('should detect if post is translation')
  test('should get translation by locale')
})
```

## Remember

1. **Tests are documentation** - Write clear, descriptive test names
2. **Test behavior, not implementation** - Focus on what, not how
3. **One assertion per test** (when possible) - Makes failures clear
4. **Keep tests fast** - Use transactions and avoid unnecessary I/O
5. **Make tests deterministic** - No random data, always same result
6. **Follow AdonisJS conventions** - Use official testing patterns

## Resources

- [AdonisJS Testing Guide](https://docs.adonisjs.com/guides/testing/introduction)
- [Japa Documentation](https://japa.dev/docs)
- [HTTP Tests](https://docs.adonisjs.com/guides/testing/http-tests)
- [Database Tests](https://docs.adonisjs.com/guides/testing/database)

---

**When in doubt, check the official AdonisJS testing documentation!**
