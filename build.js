const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const webOnly = process.argv.includes('--web-only');

const nodeBuildOptions = {
	entryPoints: ['src/extension.ts'],
	bundle: true,
	outfile: 'out/extension.js',
	platform: 'node',
	format: 'cjs',
	target: ['node16'],
	minify: production,
	sourcemap: production ? false : 'external',
	external: ['vscode'],
	logLevel: 'info'
};

const webBuildOptions = {
	entryPoints: ['src/browserExtension.ts'],
	bundle: true,
	outfile: 'out/browserExtension.js',
	platform: 'browser',
	format: 'cjs',
	target: ['es2022'],
	minify: production,
	sourcemap: production ? false : 'external',
	external: ['vscode'],
	logLevel: 'info'
};

async function main() {
	console.log('[build] build started');

	if (watch) {
		const buildOptions = webOnly ? [webBuildOptions] : [nodeBuildOptions, webBuildOptions];
		const contexts = await Promise.all(buildOptions.map(options => esbuild.context(options)));
		await Promise.all(contexts.map(context => context.watch()));
		console.log('[build] watching for changes...');

		process.on('SIGINT', async () => {
			await Promise.all(contexts.map(context => context.dispose()));
			process.exit(0);
		});
		return;
	}

	const buildOptions = webOnly ? [webBuildOptions] : [nodeBuildOptions, webBuildOptions];
	await Promise.all(buildOptions.map(options => esbuild.build(options)));
	console.log('[build] build finished');
}

main().catch(error => {
	console.error(error);
	process.exit(1);
});
