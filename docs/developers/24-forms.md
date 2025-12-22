# Forms

Adonis EOS uses a **code-first approach** for defining frontend forms. Forms are defined in TypeScript files and their fields use the unified **Custom Field system**.

## Architecture

1.  **Definitions**: Forms are defined in `app/forms/*.ts`.
2.  **Registry**: The `FormRegistry` service (`app/services/form_registry.ts`) automatically discovers and manages these definitions.
3.  **Submissions**: Form entries are stored in the `form_submissions` table.
4.  **Admin UI**: A dedicated "Forms" view allows editors to see and delete submissions.

## Creating a Form

To create a new form, add a file to `app/forms/`:

```typescript
// app/forms/contact.ts
import type { FormConfig } from '#types/form_types'

const contactForm: FormConfig = {
  slug: 'contact',
  title: 'Contact us',
  description: 'Use this form to reach out to our team.',
  fields: [
    { slug: 'name', label: 'Name', type: 'text', required: true },
    { slug: 'email', label: 'Email', type: 'text', required: true },
    { slug: 'company', label: 'Company', type: 'text', required: false },
    { slug: 'message', label: 'Message', type: 'textarea', required: true },
  ],
  successMessage: 'Thank you for your message! We will get back to you shortly.',
}

export default contactForm
```

### Form Configuration

- `slug`: Unique identifier for the form.
- `title`: Display name for the form.
- `description`: Optional text describing the form's purpose.
- `fields`: An array of `CustomFieldDefinition` objects.
- `successMessage`: Optional message displayed to the user after a successful submission.
- `thankYouPostId`: Optional ID of a Post to redirect to after submission.
- `subscriptions`: Optional array of Webhook IDs to notify on submission.

## Rendering a Form

Forms are typically rendered using the `Form` or `Prose with Form` modules. These modules allow you to select a code-first form by its slug.

## Handling Submissions

When a form is submitted:
1.  **Validation**: The backend validates fields based on their type and `required` status.
2.  **Storage**: Valid submissions are saved to the database.
3.  **Webhooks**: Global and per-form webhooks are dispatched.
4.  **Response**: The user receives a success message or is redirected.

## Admin Access

Editors can view all submissions in the admin area under **Forms**. Each submission includes the full JSON payload, IP address, and timestamp.

