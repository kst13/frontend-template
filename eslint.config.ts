import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from '@vue/eslint-config-typescript'

export default [
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  ...tseslint(),
  {
    rules: {
      'vue/multi-word-component-names': 'off'
    }
  }
]
