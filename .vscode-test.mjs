import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	version: '1.74.0',
	files: 'tests/extension.test.cjs',
	workspaceFolder: '.',
});
