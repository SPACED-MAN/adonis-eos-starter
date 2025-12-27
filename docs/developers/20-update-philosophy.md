# Update Philosophy

Adonis EOS follows the same philosophy as **AdonisJS** itself: this is a **full application**, not a plugin. That means the codebase is expected to be **owned and maintained by your engineering team** over time.

## No In-App “Update Core” Button

There is intentionally **no built-in CMS UI for updating the core**. Updates are applied the same way you would update any other AdonisJS app:

- Review upstream changes (AdonisJS, dependencies, and this repo if you forked it).
- Apply updates via `npm`/`pnpm` and Git.
- Run migrations, tests, and smoke tests.
- Deploy through your existing CI/CD pipeline.

This keeps the operational model simple and predictable, and avoids surprising changes being pushed into production without review.

## Aligned With AdonisJS Conventions

The project structure, configuration, and providers closely follow AdonisJS conventions so that:

- Framework upgrades feel familiar if you already know AdonisJS.
- You can rely on the official AdonisJS documentation and ecosystem when evolving the app.
- New team members with AdonisJS experience can onboard quickly.

## Team-Owned Lifecycle

Your team is responsible for the lifecycle of this application:

- **Tracking changes**:
  - Watch AdonisJS and key dependency changelogs.
  - Track your own fork’s changes if you diverge from upstream EOS.
- **Applying updates safely**:
  - Use feature branches / PRs for upgrades.
  - Run test suites and linters.
  - Validate critical flows (admin, publishing, webhooks) in staging.
- **Operating the system**:
  - Monitor logs and metrics.
  - Plan and execute rollbacks if needed.

## Recommended Upgrade Approach

- Maintain **staging and production** environments; apply upgrades to staging first.
- **Pin dependency versions** and bump them intentionally with a short review of release notes.
- Keep a simple **upgrade runbook**, for example:

1. Pull latest changes from your main branch or upstream.
2. Update dependencies (`npm install`, `npm outdated`, deliberate bumps).
3. Run migrations in a safe environment.
4. Run automated tests and smoke tests.
5. Deploy to staging, verify, then promote to production.
6. Have a clear rollback strategy (revert commit, rollback DB if needed).

Treat this repository like any other **core service** in your stack: changes should be deliberate, reviewed, and deployed through your normal engineering processes rather than via in-app buttons.

## Syncing Fixes from the Starter Repository

If you're maintaining multiple projects based on this starter kit, you'll want to sync bug fixes and improvements from the starter repository to your projects. The recommended approach uses **Git Subtree Merge** to selectively pull changes.

### Best Practice Workflow

1. **Make fixes in the starter repo**
   - Commit with clear messages (e.g., `fix: resolve media upload bug`)
   - Tag releases (e.g., `v0.1.1`, `v0.1.2`) for easy reference

2. **In each project, sync the changes**

   ```bash
   # Sync latest from main branch
   npm run sync:starter

   # Or sync a specific tagged version
   npm run sync:starter:commit v0.1.1
   ```

3. **Review changes and resolve conflicts**
   - The sync script will show you what files changed
   - Resolve any merge conflicts manually
   - Review the diff to ensure no unexpected changes

4. **Test and commit**
   - Run your test suite
   - Test critical flows (admin, publishing, webhooks)
   - Commit the sync once verified

### How It Works

The sync script uses `git subtree pull` to merge changes from the starter repository into your project. This approach:

- ✅ Preserves your project's git history
- ✅ Allows selective syncing (you choose when to pull)
- ✅ Shows you exactly what changed before applying
- ✅ Handles conflicts gracefully (you resolve them manually)

### Privacy Considerations

**Starter → Projects**: The starter repository has no visibility into projects that pull from it.

**Projects → Starter**: Some linkage is visible:

- The remote URL is stored in `.git/config` (visible via `git remote -v`)
- Merge commits in git history reference the starter
- Commit messages may mention the starter

If privacy is a concern, you can remove the remote after syncing:

```bash
git remote remove starter
```

### Troubleshooting

**Uncommitted changes**: The script requires a clean working directory. Commit or stash changes first.

**Merge conflicts**: If conflicts occur, resolve them manually:

```bash
# See conflicted files
git status

# Resolve conflicts in your editor
# Then:
git add <resolved-files>
git commit
```

**First-time sync**: If this is your first sync, the script will set up the starter remote automatically.

### Alternative: Manual Git Subtree

If you prefer to run the git commands manually:

```bash
# Add starter as remote (first time only)
git remote add starter https://github.com/spaced-man/adonis-eos-starter.git

# Fetch latest
git fetch starter

# Merge specific version
git subtree pull --prefix=. starter v0.1.1 --squash -m "Sync fixes from starter v0.1.1"
```

The sync script automates this process and adds helpful error checking and conflict detection.
