# Cursor Rules Overview

This directory contains coding guidelines and conventions for the Adonis EOS project.

## Quick Reference

### 📋 Available Rules

1. **[terminology.md](./terminology.md)** - **⭐ START HERE** - Project terminology guide
   - Admin vs Public Site vs Server
   - Clear naming conventions
   - Avoiding ambiguous terms
   - Quick decision tree for code placement

2. **[conventions.md](./conventions.md)** - Core coding standards and framework conventions
   - AdonisJS patterns and best practices
   - When to check official documentation
   - Project architecture guidelines

3. **[actions.md](./actions.md)** - Action-based controller patterns
   - Single-responsibility action classes
   - Avoiding fat controllers
   - Dependency injection patterns
   - When to use actions vs services

3. **[testing.md](./testing.md)** - Comprehensive testing guidelines
   - Unit and functional test patterns
   - Test organization and structure
   - Database testing strategies
   - Common testing patterns

4. **[modules.md](./modules.md)** - Module system development guide
   - Creating content modules
   - Module architecture and rationale
   - SSR rendering patterns
   - i18n support in modules
   - Testing modules

5. **[documentation.md](./documentation.md)** - Documentation standards
   - Code documentation requirements
   - README and API documentation
   - Comment guidelines

6. **[ui-components.md](./ui-components.md)** - UI/UX patterns
   - Component structure
   - Styling conventions
   - Accessibility guidelines

## Actions Quick Start

**For complex operations, use action classes with static methods:**
```bash
# 1. Create action using Ace command
node ace make:action posts/CreatePost

# 2. Define action with static handle method
type CreatePostParams = {
  title: string
  slug: string
}

export default class CreatePostAction {
  static async handle({ title, slug }: CreatePostParams): Promise<Post> {
    // Business logic here
    return Post.create({ title, slug, status: 'draft' })
  }
}

# 3. Use in controller (call static method directly)
export default class PostsController {
  async store({ request, response }: HttpContext) {
    const post = await CreatePostAction.handle(request.all())
    return response.created({ data: post })
  }
}
```

**When to use actions:**
- ✅ Complex business logic (>30 lines)
- ✅ Multi-step operations
- ✅ Reusable logic
- ✅ Background jobs

## Module Quick Start

**Creating a content module:**
```bash
# 1. Generate module files (backend + frontend)
node ace make:module VideoEmbed --mode=react  # Interactive (default)
# OR
node ace make:module Testimonial --mode=static  # Simple/static

# Creates TWO files:
#   app/modules/video_embed.ts (backend: config, schema, validation)
#   inertia/modules/video-embed.tsx (frontend: React component)

# 2. Implement backend (app/modules/video_embed.ts)
export default class VideoEmbedModule extends BaseModule {
  getRenderingMode() {
    return 'react' as const  // or 'static'
  }

  getConfig(): ModuleConfig {
    return {
      type: 'video-embed',
      name: 'Video Embed',
      icon: 'video',
      propsSchema: {
        videoUrl: { type: 'string', required: true },
        title: { type: 'string', translatable: true },
      },
      defaultProps: { videoUrl: '', title: '' },
    }
  }
}

# 3. Implement frontend (inertia/modules/video-embed.tsx)
export default function VideoEmbed({ videoUrl, title }: VideoEmbedProps) {
  return (
    <div className="video-embed">
      <h2>{title}</h2>
      <iframe src={videoUrl} />
    </div>
  )
}

# 4. Register in start/modules.ts
import VideoEmbedModule from '#modules/video_embed'
ModuleRegistry.register(new VideoEmbedModule())

# 5. Test
node ace test tests/unit/modules/video_embed.spec.ts
```

**Module philosophy:**
- Backend defines structure (config, schema, validation)
- Frontend handles rendering (React components)
- Data lives in `post_modules.props` (JSONB)
- No migrations needed to add/update modules
- Choose static for performance, React for interactivity

## Testing Quick Start

**For every new feature:**
```bash
# 1. Create test file
node ace make:test feature_name --suite=unit

# 2. Write tests first (TDD)
test('should do something', async ({ assert }) => {
  // Write test
})

# 3. Implement feature

# 4. Run tests
node ace test unit

# 5. Verify all pass ✅
```

**Required test coverage:**
- ✅ Unit tests for all models, services, helpers, actions
- ✅ Functional tests for all API endpoints
- ✅ Both success and error cases

## Key Principles

1. **Follow Official Docs** - AdonisJS, React, Japa conventions
2. **Use Actions for Complex Logic** - Keep controllers thin
3. **Test Everything** - Write tests before or alongside code
4. **Use Built-in Features** - Don't reinvent framework features
5. **Maintain Consistency** - Follow existing patterns
6. **Document Intent** - Clear names, helpful comments

## Before Committing

- [ ] All tests pass (`node ace test`)
- [ ] No linter errors
- [ ] Code follows conventions
- [ ] Tests written for new features
- [ ] Documentation updated if needed

## Resources

- [AdonisJS Docs](https://docs.adonisjs.com)
- [Japa Testing](https://japa.dev/docs)
- [React Docs](https://react.dev)
- [Inertia.js Docs](https://inertiajs.com)

---

**These rules help maintain code quality and consistency across the project.**

