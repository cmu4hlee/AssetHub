module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'no-unused-vars': [
      'warn',
      {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
      },
    ],
    'no-undef': 'error',
    'prefer-const': 'warn',
    'no-var': 'error',
    'object-shorthand': 'warn',
    'prefer-arrow-callback': 'warn',
    'prefer-template': 'warn',
    'prefer-destructuring': ['warn', { object: true, array: false }],
    'no-trailing-spaces': 'warn',
    'eol-last': ['warn', 'always'],
    'comma-dangle': ['warn', 'always-multiline'],
    semi: ['warn', 'always'],
    quotes: ['warn', 'single', { avoidEscape: true }],
  },
};
