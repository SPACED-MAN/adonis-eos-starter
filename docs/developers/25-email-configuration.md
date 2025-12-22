# Email Configuration

Adonis EOS uses the first-party `@adonisjs/mail` package to handle email delivery. This is used for critical features like **Password Resets** and can be extended for other notifications.

## 1. Setup

Email support is pre-installed in the starter kit. To enable it, you must configure a mail provider in your `.env` file.

### SMTP (Recommended for general use)

To use a standard SMTP server (like Mailtrap, Gmail, or your own server):

```env
SMTP_HOST=your-smtp-host.com
SMTP_PORT=587
SMTP_USERNAME=your-username
SMTP_PASSWORD=your-password
MAIL_FROM_ADDRESS=info@yourdomain.com
MAIL_FROM_NAME="Adonis EOS"
```

### Resend (Recommended for high deliverability)

To use [Resend](https://resend.com):

1. Set the default mailer to `resend` in `config/mail.ts`.
2. Add your API key to `.env`:

```env
RESEND_API_KEY=re_123456789
MAIL_FROM_ADDRESS=onboarding@resend.dev # Or your verified domain
MAIL_FROM_NAME="Adonis EOS"
```

## 2. Password Reset Flow

The password reset system is fully implemented and consists of the following components:

- **Database**: The `password_reset_tokens` table stores secure, expiring tokens.
- **Mailer**: `app/mails/forgot_password_mail.ts` defines the email content and recipient.
- **Template**: `resources/views/emails/forgot_password.edge` is the HTML template for the email.
- **Controller**: `app/controllers/auth/password_resets_controller.ts` handles the logic for requesting resets and applying new passwords.

### Configuration

Tokens are valid for **60 minutes** by default. You can adjust this logic in the `PasswordResetsController`.

## 3. Creating New Emails

To send a new type of email (e.g., a "Welcome" email or "Content Approved" notification):

### Step 1: Create a Mailer Class

Create a new class in `app/mails/`:

```typescript
import { BaseMail } from '@adonisjs/mail'
import User from '#models/user'

export default class WelcomeMail extends BaseMail {
  constructor(private user: User) {
    super()
  }

  async prepare() {
    this.message
      .to(this.user.email)
      .subject('Welcome to Adonis EOS!')
      .htmlView('emails/welcome', { user: this.user })
  }
}
```

### Step 2: Create the Template

Create an Edge template in `resources/views/emails/welcome.edge`:

```html
<h1>Welcome, {{ user.fullName }}!</h1>
<p>Your account is now active.</p>
```

### Step 3: Send the Email

You can send the email from any controller or action:

```typescript
import mail from '@adonisjs/mail/services/main'
import WelcomeMail from '#mails/welcome_mail'

// ...
await mail.send(new WelcomeMail(user))
```

## 4. Development & Testing

During development, we recommend using a service like **Mailtrap** or **Mailhog** to catch outgoing emails without sending them to real addresses.

Alternatively, you can use the `preview` mode in AdonisJS to see the rendered email in your terminal or a browser.

For more advanced mail configurations, refer to the [official AdonisJS Mail documentation](https://docs.adonisjs.com/guides/digging-deeper/mail).

