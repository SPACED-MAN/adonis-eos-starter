# Cursor Rules Overview

This directory contains coding guidelines and conventions for the Adonis EOS project.

## Quick Reference

### 📋 Available Rules

1. **[conventions.md](./conventions.md)** - Core coding standards and framework conventions
   - AdonisJS patterns and best practices
   - When to check official documentation
   - Project architecture guidelines

2. **[testing.md](./testing.md)** - Comprehensive testing guidelines
   - Unit and functional test patterns
   - Test organization and structure
   - Database testing strategies
   - Common testing patterns

3. **[documentation.md](./documentation.md)** - Documentation standards
   - Code documentation requirements
   - README and API documentation
   - Comment guidelines

4. **[ui-components.md](./ui-components.md)** - UI/UX patterns
   - Component structure
   - Styling conventions
   - Accessibility guidelines

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
- ✅ Unit tests for all models, services, helpers
- ✅ Functional tests for all API endpoints
- ✅ Both success and error cases

## Key Principles

1. **Follow Official Docs** - AdonisJS, React, Japa conventions
2. **Test Everything** - Write tests before or alongside code
3. **Use Built-in Features** - Don't reinvent framework features
4. **Maintain Consistency** - Follow existing patterns
5. **Document Intent** - Clear names, helpful comments

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

