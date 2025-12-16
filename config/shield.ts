import { defineConfig } from '@adonisjs/shield'
import env from '#start/env'

const isTest = env.get('NODE_ENV') === 'test'

const shieldConfig = defineConfig({
  /**
   * Configure CSP policies for your app. Refer documentation
   * to learn more
   *
   * CSP is enabled in production for security. The configuration allows:
   * - Self-hosted resources (scripts, styles, images, fonts)
   * - fonts.bunny.net for web fonts
   * - Inline scripts (required for theme detection)
   * - Data URIs and blob URIs for images/media
   * - CDN domains can be added via CSP_CDN_DOMAINS env var (comma-separated)
   */
  csp: {
    enabled: env.get('NODE_ENV') === 'production',
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for theme detection script in inertia_layout.edge
        // Add CDN domains if using external script CDN
        ...(env.get('CSP_CDN_DOMAINS', '')
          ? env
              .get('CSP_CDN_DOMAINS', '')
              .split(',')
              .map((d) => d.trim())
              .filter(Boolean)
              .map((d) => (d.startsWith('http') ? d : `https://${d}`))
          : []),
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for inline styles in inertia_layout.edge
        'https://fonts.bunny.net', // Web fonts
        ...(env.get('CSP_CDN_DOMAINS', '')
          ? env
              .get('CSP_CDN_DOMAINS', '')
              .split(',')
              .map((d) => d.trim())
              .filter(Boolean)
              .map((d) => (d.startsWith('http') ? d : `https://${d}`))
          : []),
      ],
      fontSrc: [
        "'self'",
        'https://fonts.bunny.net',
        'data:', // For font data URIs if any
      ],
      imgSrc: [
        "'self'",
        'data:', // For data URI images
        'blob:', // For blob URIs (media uploads)
        ...(env.get('R2_PUBLIC_BASE_URL')
          ? [new URL(env.get('R2_PUBLIC_BASE_URL')!).origin]
          : []),
        ...(env.get('CSP_CDN_DOMAINS', '')
          ? env
              .get('CSP_CDN_DOMAINS', '')
              .split(',')
              .map((d) => d.trim())
              .filter(Boolean)
              .map((d) => (d.startsWith('http') ? d : `https://${d}`))
          : []),
      ],
      connectSrc: [
        "'self'",
        // Allow connections to same origin for API calls
      ],
      frameSrc: ["'none'"], // No iframes allowed (X-Frame-Options already set to DENY)
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"], // Redundant with X-Frame-Options but good practice
      ...(env.get('NODE_ENV') === 'production' ? { upgradeInsecureRequests: true } : {}), // Upgrade HTTP to HTTPS in production
    },
    reportOnly: false,
  },

  /**
   * Configure CSRF protection options. Refer documentation
   * to learn more
   */
  csrf: {
    enabled: !isTest,
    exceptRoutes: ['/api/forms/:slug'],
    enableXsrfCookie: true,
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  },

  /**
   * Control how your website should be embedded inside
   * iFrames
   */
  xFrame: {
    enabled: true,
    action: 'DENY',
  },

  /**
   * Force browser to always use HTTPS
   */
  hsts: {
    enabled: true,
    maxAge: '180 days',
  },

  /**
   * Disable browsers from sniffing the content type of a
   * response and always rely on the "content-type" header.
   */
  contentTypeSniffing: {
    enabled: true,
  },
})

export default shieldConfig
