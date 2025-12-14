# Starter Kit Publishing Checklist

Use this checklist before publishing your starter kit to ensure everything is ready.

## Pre-Publication Checklist

### Repository Setup
- [ ] Update `package.json` repository URL with your actual GitHub username/repo
- [ ] Create public GitHub repository
- [ ] Push code to repository
- [ ] Add repository description: "A high-performance, SEO-first CMS starter kit built with AdonisJS 6"
- [ ] Add repository topics: `adonisjs`, `cms`, `starter-kit`, `headless-cms`, `inertia`, `react`
- [ ] Verify `.env.example` is committed (not in `.gitignore`)

### Documentation
- [ ] Review `README.md` - update any placeholder URLs
- [ ] Review `STARTER-KIT.md` - update any placeholder URLs
- [ ] Verify all installation instructions are accurate
- [ ] Test the installation process from scratch:
  ```bash
  npm init adonisjs@latest test-install -- --kit=your-username/adonis-eos-starter
  cd test-install
  npm install
  cp .env.example .env
  node ace generate:key
  # Configure database and Redis
  node ace migration:run
  node ace db:seed
  npm run dev
  ```

### Code Review
- [ ] Verify no sensitive data in codebase
- [ ] Check seed data is generic (no real user data)
- [ ] Verify default passwords are documented and security warning included
- [ ] Review `.gitignore` - ensure all sensitive files are excluded
- [ ] Verify `PROMPT-HISTORY.md` is in `.gitignore` (already done)

### License
- [ ] Verify `LICENSE` file exists (Apache 2.0)
- [ ] Verify `package.json` license field matches (`Apache-2.0`)
- [ ] Verify `NOTICE` file includes copyright information
- [ ] Update `NOTICE` if needed with current year

### Testing
- [ ] Test fresh installation on clean system
- [ ] Verify all default users can log in
- [ ] Test creating a new post
- [ ] Test adding modules to a post
- [ ] Verify admin panel loads correctly
- [ ] Test public site rendering

## Post-Publication

### Announcement
- [ ] Share on AdonisJS Discord/community
- [ ] Create GitHub release with version tag
- [ ] Update README with actual installation command
- [ ] Consider adding to AdonisJS starter kits list (if applicable)

### Maintenance
- [ ] Set up issue templates (optional)
- [ ] Enable GitHub Discussions (optional)
- [ ] Monitor for issues and questions
- [ ] Plan for updates as AdonisJS evolves

## Installation Command

Once published, users will install with:

```bash
npm init adonisjs@latest my-cms-project -- --kit=your-username/adonis-eos-starter
```

Replace `your-username` with your actual GitHub username.

## Quick Test Script

Run this to verify the starter kit works:

```bash
# Create test project
npm init adonisjs@latest test-cms -- --kit=your-username/adonis-eos-starter

# Navigate and install
cd test-cms
npm install

# Setup environment
cp .env.example .env
node ace generate:key

# Update .env with your test database credentials
# Then run:
node ace migration:run
node ace db:seed
npm run dev

# Visit http://localhost:3333/admin
# Login: admin@example.com / supersecret
```

If all steps complete without errors, your starter kit is ready!

