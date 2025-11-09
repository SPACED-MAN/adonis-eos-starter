# Actions Pattern

## Core Principle
**Use single-responsibility action classes to avoid fat controllers. Actions keep your code organized, testable, and maintainable.**

## Package
- **Package:** `@adocasts.com/actions`
- **Repository:** https://github.com/adocasts/package-actions
- **Docs:** https://adocasts.com/lessons/creating-our-own-actions-package

## What Are Actions?

Actions are single-purpose classes that handle a specific operation or use case. Instead of having large controller methods with complex logic, actions encapsulate that logic into focused, reusable classes.

**Traditional Controller (Fat Controller):**
```typescript
// ❌ BAD: Fat controller with business logic
export default class PostsController {
  async store({ request, response, auth }: HttpContext) {
    // Validation
    const data = await request.validateUsing(createPostValidator)
    
    // Business logic
    const post = await Post.create({
      ...data,
      userId: auth.user!.id,
    })
    
    // Send notifications
    await notificationService.notifyFollowers(post)
    
    // Update search index
    await searchService.indexPost(post)
    
    // Return response
    return response.created({ data: post })
  }
}
```

**Action-Based (Thin Controller):**
```typescript
// ✅ GOOD: Thin controller delegates to action
export default class PostsController {
  async store({ request, response }: HttpContext) {
    const post = await CreatePostAction.handle(request)
    return response.created({ data: post })
  }
}
```

## When to Use Actions

### ✅ USE Actions For:
- **Complex business logic** - Multi-step operations
- **Reusable operations** - Logic used in multiple places
- **API endpoints** - Each endpoint can have its own action
- **Background jobs** - Actions can be called from queues
- **Command handlers** - CLI commands can use actions
- **Testing** - Actions are easier to test in isolation

### ❌ DON'T Use Actions For:
- **Simple CRUD** - Basic show/index methods can stay in controllers
- **One-line operations** - No need for action if it's trivial
- **View rendering only** - Inertia renders don't need actions

## Action Structure

### Basic Action
```typescript
// app/actions/posts/create_post_action.ts
import { inject } from '@adonisjs/core'
import Post from '#models/post'
import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class CreatePostAction {
  /**
   * Create a new blog post with all associated data
   */
  async handle(request: HttpContext['request']): Promise<Post> {
    // Validation
    const data = await request.validateUsing(createPostValidator)
    
    // Business logic
    const post = await Post.create(data)
    
    // Additional operations
    await this.notifyFollowers(post)
    await this.indexForSearch(post)
    
    return post
  }
  
  private async notifyFollowers(post: Post): Promise<void> {
    // Notification logic
  }
  
  private async indexForSearch(post: Post): Promise<void> {
    // Search indexing logic
  }
}
```

### Action with Dependencies
```typescript
// app/actions/posts/create_post_action.ts
import { inject } from '@adonisjs/core'
import Post from '#models/post'
import NotificationService from '#services/notification_service'
import SearchService from '#services/search_service'

@inject()
export default class CreatePostAction {
  constructor(
    private notificationService: NotificationService,
    private searchService: SearchService
  ) {}

  async handle(data: CreatePostData): Promise<Post> {
    const post = await Post.create(data)
    
    // Dependencies are injected
    await this.notificationService.notifyFollowers(post)
    await this.searchService.indexPost(post)
    
    return post
  }
}
```

## File Organization

```
app/
├── actions/
│   ├── auth/
│   │   ├── login_action.ts
│   │   ├── register_action.ts
│   │   └── logout_action.ts
│   ├── posts/
│   │   ├── create_post_action.ts
│   │   ├── update_post_action.ts
│   │   ├── delete_post_action.ts
│   │   └── publish_post_action.ts
│   └── translations/
│       ├── create_translation_action.ts
│       └── sync_translations_action.ts
├── controllers/
│   ├── auth_controller.ts      # Thin - delegates to actions
│   ├── posts_controller.ts     # Thin - delegates to actions
│   └── translations_controller.ts
└── services/
    ├── notification_service.ts  # Can be injected into actions
    └── search_service.ts
```

## Controller Usage

### Basic Usage
```typescript
// app/controllers/posts_controller.ts
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import CreatePostAction from '#actions/posts/create_post_action'
import UpdatePostAction from '#actions/posts/update_post_action'

@inject()
export default class PostsController {
  constructor(
    private createPost: CreatePostAction,
    private updatePost: UpdatePostAction
  ) {}

  async store({ request, response }: HttpContext) {
    const post = await this.createPost.handle(request)
    return response.created({ data: post })
  }

  async update({ request, response, params }: HttpContext) {
    const post = await this.updatePost.handle(params.id, request)
    return response.ok({ data: post })
  }
}
```

### Static Usage (for simple cases)
```typescript
// app/controllers/posts_controller.ts
import CreatePostAction from '#actions/posts/create_post_action'

export default class PostsController {
  async store({ request, response }: HttpContext) {
    // Can also use static methods
    const post = await CreatePostAction.handle(request)
    return response.created({ data: post })
  }
}
```

## Testing Actions

Actions are much easier to test than fat controllers:

```typescript
// tests/unit/actions/create_post_action.spec.ts
import { test } from '@japa/runner'
import CreatePostAction from '#actions/posts/create_post_action'
import Post from '#models/post'

test.group('CreatePostAction', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })

  group.each.teardown(async () => {
    await db.rollbackGlobalTransaction()
  })

  test('should create post with valid data', async ({ assert }) => {
    const action = new CreatePostAction()
    
    const post = await action.handle({
      title: 'Test Post',
      slug: 'test-post',
      type: 'blog',
      locale: 'en',
    })

    assert.exists(post.id)
    assert.equal(post.title, 'Test Post')
  })

  test('should notify followers after creating post', async ({ assert }) => {
    // Test the notification logic
  })

  test('should index post in search', async ({ assert }) => {
    // Test the search indexing
  })
})
```

## Migration Strategy

### Refactoring Existing Controllers

**Before (Fat Controller):**
```typescript
// app/controllers/translations_controller.ts
export default class TranslationsController {
  async store({ params, request, response }: HttpContext) {
    const { id } = params
    
    // Find original post
    const originalPost = await Post.find(id)
    if (!originalPost) {
      return response.notFound({ error: 'Post not found' })
    }

    // Get base post
    const basePost = originalPost.isTranslation()
      ? await originalPost.getOriginal()
      : originalPost

    // Validate
    const { locale, slug, title, metaTitle, metaDescription } = request.only([
      'locale', 'slug', 'title', 'metaTitle', 'metaDescription'
    ])

    // Validate locale
    if (!localeService.isLocaleSupported(locale)) {
      return response.badRequest({ error: 'Unsupported locale', locale })
    }

    // Check existing
    const existingTranslation = await basePost.getTranslation(locale)
    if (existingTranslation) {
      return response.conflict({
        error: 'Translation already exists',
        locale,
        translationId: existingTranslation.id,
      })
    }

    // Create translation
    const translation = await Post.create({
      type: basePost.type,
      slug,
      title,
      status: 'draft',
      locale,
      translationOfId: basePost.id,
      templateId: basePost.templateId,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
    })

    return response.created({ data: translation })
  }
}
```

**After (Thin Controller with Action):**
```typescript
// app/actions/translations/create_translation_action.ts
import { inject } from '@adonisjs/core'
import Post from '#models/post'
import localeService from '#services/locale_service'
import { CreateTranslationException } from '#exceptions/translation_exceptions'

export default class CreateTranslationAction {
  async handle(postId: string, data: CreateTranslationData): Promise<Post> {
    // Find and validate post
    const basePost = await this.getBasePost(postId)
    
    // Validate locale
    this.validateLocale(data.locale)
    
    // Check for duplicates
    await this.checkDuplicateTranslation(basePost, data.locale)
    
    // Create translation
    return this.createTranslation(basePost, data)
  }

  private async getBasePost(postId: string): Promise<Post> {
    const post = await Post.find(postId)
    if (!post) {
      throw new CreateTranslationException('Post not found', 404)
    }
    
    return post.isTranslation() ? await post.getOriginal() : post
  }

  private validateLocale(locale: string): void {
    if (!localeService.isLocaleSupported(locale)) {
      throw new CreateTranslationException(`Unsupported locale: ${locale}`, 400)
    }
  }

  private async checkDuplicateTranslation(basePost: Post, locale: string): Promise<void> {
    const existing = await basePost.getTranslation(locale)
    if (existing) {
      throw new CreateTranslationException(
        `Translation already exists for locale: ${locale}`,
        409,
        { translationId: existing.id }
      )
    }
  }

  private async createTranslation(
    basePost: Post,
    data: CreateTranslationData
  ): Promise<Post> {
    return Post.create({
      type: basePost.type,
      slug: data.slug,
      title: data.title,
      status: 'draft',
      locale: data.locale,
      translationOfId: basePost.id,
      templateId: basePost.templateId,
      metaTitle: data.metaTitle || null,
      metaDescription: data.metaDescription || null,
    })
  }
}

// app/controllers/translations_controller.ts
import { inject } from '@adonisjs/core'
import CreateTranslationAction from '#actions/translations/create_translation_action'

@inject()
export default class TranslationsController {
  constructor(private createTranslation: CreateTranslationAction) {}

  async store({ params, request, response }: HttpContext) {
    try {
      const data = request.only([
        'locale', 'slug', 'title', 'metaTitle', 'metaDescription'
      ])
      
      const translation = await this.createTranslation.handle(params.id, data)
      
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

## Benefits

### 1. **Single Responsibility**
Each action does one thing and does it well.

### 2. **Testability**
Actions can be tested in isolation without HTTP context.

### 3. **Reusability**
Actions can be called from controllers, commands, jobs, or other actions.

### 4. **Maintainability**
Complex logic is organized and easy to find.

### 5. **Dependency Injection**
Actions can inject services cleanly using AdonisJS container.

### 6. **Readability**
Controllers become simple routing layers.

## Best Practices

### ✅ DO:
- Use actions for complex business logic
- Name actions as verbs (CreatePost, SendEmail, ProcessPayment)
- Keep actions focused on one task
- Inject dependencies through constructor
- Return domain objects (models, DTOs)
- Throw exceptions for error cases
- Write unit tests for each action

### ❌ DON'T:
- Don't access HTTP context directly in actions (pass what's needed)
- Don't return HTTP responses from actions
- Don't make actions too granular (not every method needs an action)
- Don't put view rendering logic in actions
- Don't forget to add actions to imports in package.json

## Package.json Import

Add actions to your imports:

```json
{
  "imports": {
    "#actions/*": "./app/actions/*.js",
    "#controllers/*": "./app/controllers/*.js",
    // ... other imports
  }
}
```

## When to Refactor

**Immediate candidates for actions:**
- Controllers with methods > 30 lines
- Logic used in multiple places
- Complex validation or business rules
- Multi-step operations
- Background job logic

**Can wait:**
- Simple CRUD operations
- Single database queries
- Basic Inertia renders

## Resources

- [Adocasts Actions Package](https://github.com/adocasts/package-actions)
- [Adocasts Lesson](https://adocasts.com/lessons/creating-our-own-actions-package)
- [AdonisJS Dependency Injection](https://docs.adonisjs.com/guides/concepts/dependency-injection)

---

**Use actions to keep controllers thin and business logic organized!**

