# Code Conventions & Standards

## Core Principle
**Follow official framework documentation and established conventions.**

## Framework Documentation Priority

### AdonisJS
- ✅ Always reference official AdonisJS v6 documentation
- ✅ Follow AdonisJS project structure conventions
- ✅ Use AdonisJS built-in features (auth, sessions, migrations, etc.)
- ✅ Respect AdonisJS naming conventions (PascalCase for models, snake_case for migrations)
- ❌ Don't create custom solutions that replicate AdonisJS features
- ❌ Don't break established AdonisJS patterns

**Official docs:** https://docs.adonisjs.com/guides/introduction

## When Proposing Solutions

1. **Check official docs first** - Is there a recommended way to do this?
2. **Follow framework patterns** - Use established conventions
3. **Don't reinvent the wheel** - Use built-in features when available
4. **Maintain consistency** - Follow existing project patterns
5. **No backwards compatibility** - Unless explicitly instructed, do not provide any backwards compatibility as this project won't yet be in production

## Before Making Changes

Ask yourself:
1. "Does this follow the official documentation?"
2. "Am I breaking any established conventions?"
3. "Is there a built-in way to do this?"
4. "Does this fit the existing architecture?"
5. "Do I need to write tests for this?" (Answer: Yes!)

**When in doubt, check the official docs!**

## Related Guidelines

- **Actions:** See `.cursor/rules/actions.md` for action-based controller patterns
- **Testing:** See `.cursor/rules/testing.md` for comprehensive testing guidelines
- **Documentation:** See `.cursor/rules/documentation.md` for documentation standards
- **UI Components:** See `.cursor/rules/ui-components.md` for component patterns

