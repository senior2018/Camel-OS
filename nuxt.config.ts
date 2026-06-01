// https://nuxt.com/docs/api/configuration/nuxt-config
const isDev = process.env.NODE_ENV !== 'production'

export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', 'nuxt-auth-utils', 'nuxt-security'],

  devtools: {
    enabled: true,
  },

  app: {
    head: {
      titleTemplate: '%s',
      title: 'Camel OS',
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      ],
      meta: [{ name: 'theme-color', content: '#f05100' }],
    },
  },

  css: ['~/assets/css/main.css'],

  // Lock the app to its designed light theme — Nuxt UI v4 skips its color-mode plugin entirely
  // and the `@custom-variant dark` rule in main.css blocks Tailwind's prefers-color-scheme fallback.
  ui: {
    colorMode: false,
  },

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
    authEncryptionKey: process.env.NUXT_AUTH_ENCRYPTION_KEY,
    redisUrl: process.env.REDIS_URL,
    brevoApiKey: process.env.BREVO_API_KEY,
    brevoFromEmail: process.env.BREVO_FROM_EMAIL,
    appUrl: process.env.APP_URL,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    },
  },

  // `/` is a server-side redirect to /login or /dashboard, not a renderable page.

  compatibilityDate: '2025-01-15',

  // Nitro tasks for scheduled background jobs. Tasks live in `server/tasks/`.
  // Production cron only fires when the host supports it (Cloudflare cron
  // triggers, Vercel cron, or a long-running Node server). Admins can also
  // trigger any task manually via the API (see /api/admin/tasks/*).
  nitro: {
    experimental: {
      tasks: true,
    },
    scheduledTasks: {
      // Daily at 08:00 UTC — opportunity deadlines (OM-07), donor grant
      // deadlines (CR-09), and partnership renewal windows (CR-11). All three
      // are date-only so once-a-day cadence is enough.
      '0 8 * * *': [
        'opportunities:deadline-reminders',
        'clients:grants',
        'clients:partnership-renewals',
      ],
      // Every 5 minutes — client follow-up reminders (CR-05). Reminders carry a
      // time-of-day, so we want the email to arrive close to the set time without
      // building a per-reminder job queue. Worst-case delivery latency: ~5 min.
      // The `notified_at` stamp guarantees each reminder is emailed exactly once.
      '*/5 * * * *': ['clients:reminders'],
    },
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs',
      },
    },
  },

  security: {
    // Using our own ioredis token-bucket rate limiter on auth routes
    rateLimiter: false,

    headers: {
      // Prevent clickjacking
      xFrameOptions: 'DENY',

      // Prevent MIME-type sniffing
      xContentTypeOptions: 'nosniff',

      // Don't send Referer header across origins
      referrerPolicy: 'strict-origin-when-cross-origin',

      // Enforce HTTPS for 1 year (set only in production via runtime check)
      strictTransportSecurity: {
        maxAge: 31536000,
        includeSubdomains: true,
        preload: true,
      },

      // Content Security Policy — tuned for Nuxt UI v4 + Tailwind
      contentSecurityPolicy: {
        'default-src': ["'none'"],
        // Dev: allow Vite HMR / devtools inline scripts. Prod: nonce + strict-dynamic.
        'script-src': isDev
          ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
          : ["'self'", "'nonce-{{nonce}}'", "'strict-dynamic'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'https:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': isDev
          ? ["'self'", 'ws:', 'wss:', process.env.SUPABASE_URL ?? '']
          : ["'self'", process.env.SUPABASE_URL ?? ''],
        'frame-ancestors': ["'none'"],
        'frame-src': isDev ? ["'self'"] : ["'none'"],
        'worker-src': isDev ? ["'self'", 'blob:'] : ["'self'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'upgrade-insecure-requests': !isDev,
      },

      // Disable features the app doesn't need
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
      },

      // Disable COEP — would block Google OAuth iframes / third-party content
      crossOriginEmbedderPolicy: false,
    },
  },
})
