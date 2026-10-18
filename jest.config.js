/** @type {import('jest').Config} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/tests'],
	moduleNameMapper: {
		'^vscode$': '<rootDir>/tests/mocks/vscode.ts'
	},
	transform: {
		'^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tests/tsconfig.json' }]
	}
};
