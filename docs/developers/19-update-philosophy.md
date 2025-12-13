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


