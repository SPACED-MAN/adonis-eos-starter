# User Interaction (Forms & Email)

Adonis EOS handles user interaction through a code-first **Form System** and integrated **Email Delivery**.

---

## 1. Form System

Forms are defined in TypeScript, providing type-safety and automatic validation.

### Creating a Form

Add a definition to `app/forms/` (e.g., `app/forms/contact.ts`):

```typescript
import type { FormConfig } from '#types/form_types'

const contactForm: FormConfig = {
  slug: 'contact',
  title: 'Contact Us',
  fields: [
    { slug: 'name', label: 'Name', type: 'text', required: true },
    { slug: 'email', label: 'Email', type: 'text', required: true },
    { slug: 'message', label: 'Message', type: 'textarea', required: true },
  ],
  successMessage: 'Thank you for your message!',
}

export default contactForm
```

### Rendering & Submissions
- **Rendering**: Use the `Form` or `Prose with Form` modules in the editor.
- **Validation**: Automatically enforced based on the `fields` definition.
- **Storage**: Submissions are stored in the `form_submissions` table and viewable in the Admin UI.

---

## 2. Email Configuration

Adonis EOS uses `@adonisjs/mail` for transactional emails like password resets and notifications.

### Setup

Configure your provider in `.env`:

```env
# SMTP
SMTP_HOST=your-host.com
SMTP_PORT=587
SMTP_USERNAME=your-user
SMTP_PASSWORD=your-pass

# Or Resend
RESEND_API_KEY=re_12345
```

### Sending Emails

1. **Create a Mailer**: Add a class to `app/mails/`.
2. **Define Template**: Create an Edge template in `resources/views/emails/`.
3. **Send**: Use the `mail` service in your controllers or actions.

```typescript
import mail from '@adonisjs/mail/services/main'
import WelcomeMail from '#mails/welcome_mail'

await mail.send(new WelcomeMail(user))
```

### Password Resets
The system includes a fully functional password reset flow using the `password_reset_tokens` table and `PasswordResetsController`.

