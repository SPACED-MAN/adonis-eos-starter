# Actions Pattern Guidelines

This document outlines the conventions for implementing the Actions pattern in Adonis EOS using the `@adocasts.com/actions` package.

## Core Principle
**Use single-responsibility action classes with static methods to avoid fat controllers. Actions keep your code organized, testable, and reusable.**

## Package Information
- **Package:** `@adocasts.com/actions` v1.0.5
- **Repository:** https://github.com/adocasts/package-actions
- **Docs:** https://adocasts.com/lessons/creating-our-own-actions-package

## What are Actions?

Actions are plain TypeScript classes with a static `handle` method that encapsulate a single business operation. They provide:
- **Single Responsibility** - Each action does one thing
- **Reusability** - Use in controllers, CLI, jobs, etc.
- **Testability** - Easy to test in isolation
- **Maintainability** - Business logic separate from HTTP concerns

## Key Conventions

### 1. Static Methods
Actions use **static** methods, not instance methods:

```typescript
// ✅ CORRECT: Static method
export default class CreatePostAction {
  static async handle(params: CreatePostParams): Promise<Post> {
    // business logic
  }
}

// ❌ WRONG: Instance method with dependency injection
@inject()
export default class CreatePostAction {
  constructor(private service: SomeService) {}
  
  async handle(params: CreatePostParams): Promise<Post> {
    // Don't do this
  }
}
```

### 2. Type Definitions
Use `type` for parameters, not interfaces:

```typescript
// ✅ CORRECT: Type definition
type CreatePostParams = {
  title: string
  slug: string
  type: string
}

// ❌ WRONG: Interface
interface CreatePostParams {
  title: string
  slug: string
}
```

### 3. Direct Imports
Import services and models directly, no constructor injection:

```typescript
// ✅ CORRECT: Direct imports
import Post from '#models/post'
import localeService from '#services/locale_service'

export default class CreatePostAction {
  static async handle(params: CreatePostParams): Promise<Post> {
    localeService.isLocaleSupported(params.locale)
    return Post.create(params)
  }
}

// ❌ WRONG: Constructor injection
@inject()
export default class CreatePostAction {
  constructor(private localeService: LocaleService) {}
}
```

## Action Structure

### Basic Template

```bash
# Always start by generating the action
node ace make:action posts/CreatePost
```

```typescript
// app/actions/posts/create_post.ts
import Post from '#models/post'

/**
 * Parameters for creating a post
 */
type CreatePostParams = {
  title: string
  slug: string
  type: string
}

/**
 * Action to create a new blog post
 */
export default class CreatePost {
  /**
   * Create a new blog post
   * 
   * @param params - Post creation parameters
   * @returns The newly created post
   */
  static async handle({ title, slug, type }: CreatePostParams): Promise<Post> {
    // Business logic here
    return Post.create({ title, slug, type, status: 'draft' })
  }
}
```

### Action with Private Methods

```typescript
export default class CreateTranslation {
  static async handle({ postId, locale, title, slug }: CreateTranslationParams): Promise<Post> {
    // Step 1: Find and validate base post
    const basePost = await this.getBasePost(postId)
    
    // Step 2: Validate locale
    this.validateLocale(locale)
    
    // Step 3: Check for duplicates
    await this.checkDuplicateTranslation(basePost, locale)
    
    // Step 4: Create translation
    return this.createTranslation(basePost, { locale, title, slug })
  }

  /**
   * Private helper methods
   */
  private static async getBasePost(postId: string): Promise<Post> {
    const post = await Post.find(postId)
    if (!post) {
      throw new CreateTranslationException('Post not found', 404)
    }
    return post.isTranslation() ? await post.getOriginal() : post
  }

  private static validateLocale(locale: string): void {
    if (!localeService.isLocaleSupported(locale)) {
      throw new CreateTranslationException('Unsupported locale', 400)
    }
  }

  private static async checkDuplicateTranslation(post: Post, locale: string): Promise<void> {
    const existing = await post.getTranslation(locale)
    if (existing) {
      throw new CreateTranslationException('Translation already exists', 409)
    }
  }

  private static async createTranslation(
    basePost: Post,
    data: { locale: string; title: string; slug: string }
  ): Promise<Post> {
    return Post.create({
      type: basePost.type,
      ...data,
      translationOfId: basePost.id,
      status: 'draft',
    })
  }
}
```

## When to Use Actions

### ✅ USE Actions When:
- **Complex business logic** - Operation involves multiple steps (>30 lines)
- **Reusability needed** - Logic used in controllers, CLI, jobs, etc.
- **Transaction management** - Operation requires database transaction
- **Multiple data sources** - Operation involves multiple models/services
- **Background jobs** - Operation might be moved to queue later
- **Testing important** - Need isolated unit tests for business logic

### ❌ AVOID Actions When:
- **Simple CRUD** - Basic `Post.find(id)` or `Post.all()`
- **Purely HTTP concerns** - Request parsing, response formatting
- **View rendering** - Simple Inertia renders
- **One-line operations** - Trivial operations that don't need abstraction

## Error Handling

Actions should throw custom exceptions for business logic errors:

```typescript
// app/actions/translations/exceptions.ts
export class CreateTranslationException extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public meta?: Record<string, any>
  ) {
    super(message)
    this.name = 'CreateTranslationException'
  }
}

// In action:
if (!localeService.isLocaleSupported(locale)) {
  throw new CreateTranslationException(
    `Unsupported locale: ${locale}`,
    400,
    { locale }
  )
}

// In controller:
try {
  const translation = await CreateTranslationAction.handle(params)
  return response.created({ data: translation })
} catch (error) {
  if (error instanceof CreateTranslationException) {
    return response.status(error.statusCode).json({
      error: error.message,
      ...error.meta,
    })
  }
  throw error // Re-throw unknown errors
}
```

## Using Actions in Controllers

Controllers should call actions directly (static method):

```typescript
// app/controllers/translations_controller.ts
import CreateTranslationAction, {
  CreateTranslationException,
} from '#actions/translations/create_translation_action'

export default class TranslationsController {
  async store({ params, request, response }: HttpContext) {
    const { locale, slug, title } = request.only(['locale', 'slug', 'title'])

    try {
      const translation = await CreateTranslationAction.handle({
        postId: params.id,
        locale,
        slug,
        title,
      })

      return response.created({ data: translation })
    } catch (error) {
      if (error instanceof CreateTranslationException) {
        return response.status(error.statusCode).json({
          error: error.message,
          ...error.meta,
        })
      }
      throw error
    }
  }
}
```

## Testing Actions

Actions are ideal for unit testing:

```typescript
// tests/unit/actions/create_translation_action.spec.ts
import { test } from '@japa/runner'
import CreateTranslationAction, {
  CreateTranslationException,
} from '#actions/translations/create_translation_action'
import Post from '#models/post'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('CreateTranslationAction', (group) => {
  group.each.setup(async () => {
    await testUtils.db().truncate()
  })

  test('should create translation for a post', async ({ assert }) => {
    const originalPost = await Post.create({
      type: 'blog',
      slug: `test-post-${Date.now()}`,
      title: 'Test Post',
      status: 'draft',
      locale: 'en',
    })

    const translation = await CreateTranslationAction.handle({
      postId: originalPost.id,
      locale: 'es',
      slug: `publicacion-${Date.now()}`,
      title: 'Publicación',
    })

    assert.isNotNull(translation.id)
    assert.equal(translation.locale, 'es')
    assert.equal(translation.translationOfId, originalPost.id)
  })

  test('should throw exception when post not found', async ({ assert }) => {
    try {
      await CreateTranslationAction.handle({
        postId: '00000000-0000-0000-0000-000000000000',
        locale: 'es',
        slug: 'test',
        title: 'Test',
      })
      assert.fail('Should have thrown CreateTranslationException')
    } catch (error) {
      assert.instanceOf(error, CreateTranslationException)
      assert.equal(error.message, 'Post not found')
      assert.equal(error.statusCode, 404)
    }
  })
})
```

## File Organization

```
app/actions/
├── translations/
│   ├── create_translation.ts        (CreateTranslation class)
│   ├── delete_translation.ts        (DeleteTranslation class)
│   └── exceptions.ts
├── posts/
│   ├── create_post.ts               (CreatePost class)
│   ├── update_post.ts               (UpdatePost class)
│   ├── publish_post.ts              (PublishPost class)
│   └── exceptions.ts
└── modules/
    ├── create_module.ts             (CreateModule class)
    ├── attach_module.ts             (AttachModule class)
    └── exceptions.ts
```

## Naming Conventions

### Action Classes
- Use verb-noun pattern: `CreatePost`, `UpdateUser`, `DeleteComment`
- No `Action` suffix needed (Ace command handles this)
- Use PascalCase

### Files
- Use snake_case for files: `create_post.ts`, `delete_comment.ts`
- Generated automatically by `node ace make:action` command
- Group related actions in directories (e.g., `app/actions/posts/`)

### Methods
- Main method: `static async handle(params: TypeName): Promise<ReturnType>`
- Private helpers: `private static async helperName()`
- All methods should be async if they do I/O

## Best Practices

### 1. Keep Actions Focused
```typescript
// ✅ GOOD: Single responsibility
class CreatePostAction {
  static async handle(params: CreatePostParams): Promise<Post> {
    return Post.create(params)
  }
}

// ❌ BAD: Multiple responsibilities
class PostAction {
  static async create() {}
  static async update() {}
  static async delete() {}
}
```

### 2. Use Descriptive Types
```typescript
// ✅ GOOD: Clear parameter types
type CreateTranslationParams = {
  postId: string
  locale: string
  slug: string
  title: string
  metaTitle?: string | null
  metaDescription?: string | null
}

// ❌ BAD: Generic or unclear types
type Params = {
  id: string
  data: any
}
```

### 3. Document Public Methods
```typescript
/**
 * Create a new translation for a post
 *
 * @param params - Translation creation parameters
 * @returns The newly created translation post
 * @throws CreateTranslationException if validation fails
 */
static async handle(params: CreateTranslationParams): Promise<Post> {
  // implementation
}
```

### 4. Extract Complex Logic to Private Methods
```typescript
static async handle(params: CreateTranslationParams): Promise<Post> {
  const basePost = await this.getBasePost(params.postId)
  this.validateLocale(params.locale)
  await this.checkDuplicates(basePost, params.locale)
  return this.createTranslation(basePost, params)
}

private static async getBasePost(postId: string): Promise<Post> {
  // Complex logic extracted
}
```

## Creating New Actions

### ⚠️ Always Use the Ace Command

**IMPORTANT:** Always create actions using `node ace make:action` to ensure correct naming:

```bash
# Create action for translations
node ace make:action translations/CreateTranslation
# Generates: app/actions/translations/create_translation.ts
# Class name: CreateTranslation

# Create action for posts
node ace make:action posts/UpdatePost
# Generates: app/actions/posts/update_post.ts
# Class name: UpdatePost
```

### Workflow
1. **Generate action:** `node ace make:action feature/ActionName`
2. **Define parameter type:** `type ActionNameParams = { ... }`
3. **Define custom exception (if needed):** `export class ActionNameException extends Error { ... }`
4. **Implement business logic** in the `static async handle()` method
5. **Extract complex logic** to private static methods
6. **Write unit tests** in `tests/unit/actions/`
7. **Use in controller** by calling `ActionName.handle(params)`

### Example Workflow

```bash
# Step 1: Generate action
node ace make:action posts/CreatePost

# Step 2: Implement the action
# File: app/actions/posts/create_post.ts
```

```typescript
import Post from '#models/post'

type CreatePostParams = {
  title: string
  slug: string
  content: string
}

export class CreatePostException extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message)
    this.name = 'CreatePostException'
  }
}

export default class CreatePost {
  static async handle({ title, slug, content }: CreatePostParams): Promise<Post> {
    // Business logic
    return Post.create({ title, slug, content, status: 'draft' })
  }
}
```

```bash
# Step 3: Write tests
# File: tests/unit/actions/create_post.spec.ts

# Step 4: Use in controller
# File: app/controllers/posts_controller.ts
```

```typescript
import CreatePost from '#actions/posts/create_post'

export default class PostsController {
  async store({ request, response }: HttpContext) {
    const post = await CreatePost.handle(request.all())
    return response.created({ data: post })
  }
}
```

## Migration Strategy

### Current Status
- ✅ Actions package installed
- ✅ Import path configured (`#actions/*`)
- ✅ Documentation complete
- ✅ 2 refactorings complete (Translations controller)

### For New Features (Milestone 4+)
- Start with actions for complex operations
- Keep simple CRUD in controllers
- Use actions for multi-step workflows

### For Existing Code
- Refactor as needed when adding features
- No rush to refactor working code
- Focus on pain points (fat controllers, hard to test)

## Examples in Codebase

### Completed Refactorings

#### 1. CreateTranslation
**File:** `app/actions/translations/create_translation.ts`
**Class:** `CreateTranslation`
- Creates post translations
- Validates locale support
- Checks for duplicates
- Handles nested translations

#### 2. DeleteTranslation
**File:** `app/actions/translations/delete_translation.ts`
**Class:** `DeleteTranslation`
- Deletes translations
- Protects original posts
- Proper error handling

## Common Patterns

### Pattern 1: Multi-Step Operation
```typescript
static async handle(params: Params): Promise<Result> {
  const step1 = await this.doStep1(params)
  const step2 = await this.doStep2(step1)
  const step3 = await this.doStep3(step2)
  return step3
}
```

### Pattern 2: Validation Before Action
```typescript
static async handle(params: Params): Promise<Result> {
  this.validateInput(params)
  await this.checkPreconditions(params)
  return this.performAction(params)
}
```

### Pattern 3: Transaction Wrapper
```typescript
static async handle(params: Params): Promise<Result> {
  const trx = await db.transaction()
  try {
    const result = await this.performInTransaction(params, trx)
    await trx.commit()
    return result
  } catch (error) {
    await trx.rollback()
    throw error
  }
}
```

## FAQs

**Q: Why static methods instead of instance methods?**
A: Static methods keep actions stateless and simple. No need for dependency injection or complex setup.

**Q: Can I use dependency injection?**
A: No, the Adocasts Actions convention uses direct imports instead of constructor injection.

**Q: How do I share logic between actions?**
A: Create utility functions or services that multiple actions can import and use.

**Q: Should I always use actions?**
A: No, simple CRUD operations can stay in controllers. Use actions for complex logic.

**Q: Can actions call other actions?**
A: Yes, actions can call other actions: `await OtherAction.handle(params)`

**Q: How do I test actions that use external services?**
A: Mock the service imports in your tests, or create test doubles.

## Related Documentation

- **Testing:** See `.cursor/rules/testing.md` for testing guidelines
- **Conventions:** See `.cursor/rules/conventions.md` for general patterns
- **Package:** https://github.com/adocasts/package-actions

---

**Last Updated:** 2025-11-09  
**Package Version:** @adocasts.com/actions@1.0.5  
**Status:** Active (Milestone 3+)
