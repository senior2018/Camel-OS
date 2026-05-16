// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', 'nuxt-auth-utils', 'nuxt-security'],

  devtools: {
    enabled: true,
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
    authEncryptionKey: process.env.NUXT_AUTH_ENCRYPTION_KEY,
    redisUrl: process.env.REDIS_URL,
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    },
  },

  routeRules: {
    '/': { prerender: true },
  },

  compatibilityDate: '2025-01-15',

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
        'script-src': ["'self'", "'nonce-{{nonce}}'", "'strict-dynamic'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'https:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': ["'self'", process.env.SUPABASE_URL ?? ''],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'upgrade-insecure-requests': true,
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
