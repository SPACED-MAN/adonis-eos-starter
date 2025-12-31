# Architecture: Services & Actions

Adonis EOS follows a clean architecture pattern, separating business logic from controllers into **Services** and **Actions**.

---

## 1. Services (`app/services/`)

Services are singleton classes (or object exports) responsible for domain-specific logic, data retrieval, and complex calculations. They are intended to be **stateful** (within the request lifecycle) or provide **utility registries**.

### Key Patterns

- **Registries**: Many services act as registries for code-first definitions (e.g., `ModuleRegistry`, `PostTypeRegistry`).
- **Dependency Injection**: Services are typically imported directly. Since they are often singletons, they provide a consistent API across the application.
- **Cross-Service Communication**: Services often call each other (e.g., `PostRenderingService` uses `TokenService`).

### Common Services

| Service | Responsibility |
| :--- | :--- |
| `PostTypeRegistry` | Manages registration and configuration of post types. |
| `ModuleRenderer` | Handles the server-side rendering logic for modules. |
| `MediaService` | Manages file uploads, variant generation, and storage providers. |
| `AuthorizationService` | Centralizes RBAC and permission checks. |
| `TokenService` | Resolves `{template_tokens}` in content strings. |

---

## 2. Actions (`app/actions/`)

Actions are **stateless, single-purpose classes** that represent a "unit of work" or a specific mutation in the system. They typically follow the "Command" pattern.

### Why use Actions?

- **Auditability**: Actions make it easy to see every possible mutation in the system.
- **Transactionality**: Actions often wrap their logic in a database transaction.
- **Reusability**: An action like `CreatePostAction` can be called from a REST controller, a CLI command, or an AI Agent.

### Implementation Example

```typescript
// app/actions/posts/approve_review_draft.ts
export default class ApproveReviewDraftAction {
  async handle(postId: string, userId: string) {
    return await db.transaction(async (trx) => {
      // 1. Fetch post and review draft
      // 2. Promote review draft to source fields
      // 3. Promote module staging
      // 4. Create a 'published' revision snapshot
      // 5. Trigger 'post.published' workflow
    })
  }
}
```

---

## 3. Recommended Flow

When adding a new feature:

1.  **Identify the Domain**: Does it belong in an existing service, or do you need a new one?
2.  **Stateless Mutation?**: If you are changing data, create an **Action**.
3.  **Complex Retrieval?**: If you are fetching or transforming data for display, add a method to a **Service**.
4.  **Keep Controllers Thin**: Controllers should only handle request validation, calling the appropriate Service/Action, and returning the response.

---

## 4. Lifecycle Hooks

Many actions trigger events that are picked up by the [Workflows](../../developers/04-automation-and-ai/06a-workflows-and-webhooks.md) system. Always ensure that major mutations trigger the corresponding event to maintain system-wide automation.

