const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const buildOptions = {
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

async function main() {
	console.log('[build] build started');

	if (watch) {
		const context = await esbuild.context(buildOptions);
		await context.watch();
		console.log('[build] watching for changes...');

		process.on('SIGINT', async () => {
			await context.dispose();
			process.exit(0);
		});
		return;
	}

	await esbuild.build(buildOptions);
	console.log('[build] build finished');
}

main().catch(error => {
	console.error(error);
	process.exit(1);
});
