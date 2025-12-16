# Versioning Strategy

This project follows [Semantic Versioning](https://semver.org/) (SemVer).

## Current Version: 0.1.0 (Pre-Beta)

### Version Number Format: `MAJOR.MINOR.PATCH`

- **MAJOR** (0.x.x): Breaking changes, major feature additions
- **MINOR** (x.1.x): New features, backwards compatible
- **PATCH** (x.x.1): Bug fixes, backwards compatible

## Version Progression Plan

### 0.x.x Series (Pre-1.0.0)

- **0.1.0** (Current) - Initial public release, pre-beta
- **0.2.0** - Beta release with community feedback incorporated
- **0.3.0** - Additional features and improvements
- **0.9.0** - Final pre-1.0.0 release, production-ready candidate

### 1.0.0 Series (Stable)

- **1.0.0** - First stable release, production-ready
- **1.1.0** - New features (backwards compatible)
- **1.0.1** - Bug fixes and patches

## Pre-Release Labels

For releases that are not production-ready, use pre-release labels:

- `0.1.0-alpha.1` - Early development, unstable
- `0.1.0-beta.1` - Feature-complete, testing phase
- `0.1.0-rc.1` - Release candidate, near-stable

## When to Bump Versions

### Patch (0.1.0 → 0.1.1)

- Bug fixes
- Security patches
- Documentation updates
- Performance improvements (no API changes)

### Minor (0.1.0 → 0.2.0)

- New features (backwards compatible)
- New modules
- New post types
- New configuration options
- Deprecations (with migration path)

### Major (0.x.x → 1.0.0)

- Breaking API changes
- Breaking database schema changes
- Breaking configuration changes
- Removal of deprecated features

## Release Checklist

Before releasing a new version:

- [ ] Update version in `package.json`
- [ ] Update version in `README.md` (Version History section)
- [ ] Create git tag: `git tag v0.1.0`
- [ ] Push tag: `git push origin v0.1.0`
- [ ] Create GitHub release with changelog
- [ ] Update documentation if needed
- [ ] Test installation from scratch
- [ ] Verify all features work as expected

## Current Status

**Version 0.1.0** is marked as **Pre-Beta** because:

- ✅ All core features are implemented
- ✅ Code is functional and tested
- ⚠️ Undergoing final testing and documentation
- ⚠️ Not yet production-ready
- ⚠️ May have breaking changes before 1.0.0

## Next Steps

1. **0.1.0** → Initial public release (current)
2. **0.2.0** → Beta release after community feedback
3. **0.3.0+** → Iterative improvements
4. **1.0.0** → Stable, production-ready release
