module.exports = {
	root: true,
	extends: [
		'next/core-web-vitals',
		'@lynxtaa/eslint-config',
		'@lynxtaa/eslint-config/requires-typechecking',
	],
	parserOptions: {
		tsconfigRootDir: __dirname,
		project: ['./tsconfig.json'],
	},
}
