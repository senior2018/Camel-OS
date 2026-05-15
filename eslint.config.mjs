// @ts-check
import prettier from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  plugins: {
    prettier,
  },
  rules: {
    // Enable Prettier as an ESLint rule (so it runs on save)
    'prettier/prettier': 'warn',

    // Optional: disable conflicting Vue rules
    'vue/max-attributes-per-line': 'off',
  },
}).append(prettierConfig)
