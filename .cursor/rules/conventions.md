# Code Conventions & Standards

## Core Principles

1. **Follow Framework Conventions** - Always reference official AdonisJS v6, React, and Tailwind documentation.
2. **KISS (Keep It Simple, Stupid)** - Prefer simple, readable solutions over clever, complex ones. Avoid over-engineering.
3. **YAGNI (You Ain't Gonna Need It)** - Don't implement features or abstractions until they are actually needed.
4. **DRY (Don't Repeat Yourself)** - See [DRY & Reuse](./dry-reuse.md) for detailed guidelines.

## Framework Documentation Priority

### AdonisJS

- ✅ Always reference official AdonisJS v6 documentation
- ✅ Follow AdonisJS project structure conventions
- ✅ Use AdonisJS built-in features (auth, sessions, migrations, etc.)
- ✅ Respect AdonisJS naming conventions (PascalCase for models, snake_case for migrations)
- ❌ Don't create custom solutions that replicate AdonisJS features
- ❌ Don't break established AdonisJS patterns

**Official docs:** https://docs.adonisjs.com/guides/introduction

### React & Frontend

- ✅ Use ShadCN components for Admin UI
- ✅ Follow Tailwind CSS utility-first patterns
- ✅ Prefer functional components and hooks
- ✅ Use Inertia.js conventions for data fetching and navigation

## When Proposing Solutions

1. **Check official docs first** - Is there a recommended way to do this?
2. **Follow framework patterns** - Use established conventions
3. **Don't reinvent the wheel** - Use built-in features when available
4. **Maintain consistency** - Follow existing project patterns
5. **No backwards compatibility** - Unless explicitly instructed, do not provide any backwards compatibility as this project won't yet be in production

## Before Making Changes

Ask yourself:

1. "Does this follow the official documentation?"
2. "Is this the simplest solution possible (KISS)?"
3. "Do I actually need this abstraction right now (YAGNI)?"
4. "Is there a built-in way to do this?"
5. "Does this fit the existing architecture?"

**When in doubt, check the official docs!**

## Related Guidelines

- **Actions:** See `./actions.md` for action-based controller patterns
- **Testing:** See `./testing.md` for comprehensive testing guidelines
- **Documentation:** See `./documentation.md` for documentation standards
- **UI Components:** See `./ui-components.md` for component patterns
- **DRY & Reuse:** See `./dry-reuse.md` for code reuse principles
