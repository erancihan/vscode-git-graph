import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		ignores: ['out/**', 'media/**', 'node_modules/**', '**/*.d.ts']
	},
	...tseslint.configs.recommended,
	{
		files: ['src/**/*.ts', 'web/**/*.ts'],
		rules: {
			'eqeqeq': 'error',
			'prefer-const': ['warn', { destructuring: 'all' }],
			'no-throw-literal': 'error',
			'quotes': ['warn', 'single', { avoidEscape: true }],
			'semi': ['warn', 'always'],
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-this-alias': ['error', { allowedNames: ['that'] }],
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/explicit-member-accessibility': ['warn', { accessibility: 'explicit', overrides: { constructors: 'no-public' } }]
		}
	},
	{
		// The webview is compiled as plain scripts and concatenated, so top-level
		// declarations are shared across files and look unused to the linter.
		files: ['web/**/*.ts'],
		rules: {
			'@typescript-eslint/no-unused-vars': 'off'
		}
	}
);
