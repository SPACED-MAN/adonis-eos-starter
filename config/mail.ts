import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'

const mailConfig = defineConfig({
  default: 'smtp',

  /**
   * The mailers object can be used to configure multiple mailers
   * each using a different transport or the same transport with different
   * options.
   */
  mailers: {
    smtp: transports.smtp({
      host: env.get('SMTP_HOST', '127.0.0.1'),
      port: env.get('SMTP_PORT', 587),
      auth: {
        type: 'login',
        user: env.get('SMTP_USERNAME', ''),
        pass: env.get('SMTP_PASSWORD', ''),
      },
    }),

    resend: transports.resend({
      key: env.get('RESEND_API_KEY', ''),
      baseUrl: 'https://api.resend.com',
    }),
  },

  /**
   * The from object is used to set the default from address and name
   * for all the emails sent by the application.
   */
  from: {
    address: env.get('MAIL_FROM_ADDRESS', 'info@example.com'),
    name: env.get('MAIL_FROM_NAME', 'Adonis EOS'),
  },

  /**
   * The replyTo object is used to set the default replyTo address and name
   * for all the emails sent by the application.
   */
  replyTo: {
    address: env.get('MAIL_FROM_ADDRESS', 'info@example.com'),
    name: env.get('MAIL_FROM_NAME', 'Adonis EOS'),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}

