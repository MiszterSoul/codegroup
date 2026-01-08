const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
	console.log('[watch] build started');

	const result = await Bun.build({
		entrypoints: ['src/extension.ts'],
		outdir: 'out',
		target: 'node',
		format: 'cjs',
		minify: production,
		sourcemap: production ? 'none' : 'external',
		external: ['vscode'],
		naming: {
			entry: 'extension.js'
		}
	});

	if (!result.success) {
		console.error('[watch] build failed');
		result.logs.forEach(log => {
			console.error(`✘ [ERROR] ${log.message}`);
		});
		process.exit(1);
	}

	console.log('[watch] build finished');

	if (watch) {
		console.log('[watch] watching for changes...');
		// Bun doesn't have built-in watch mode like esbuild.context
		// You can use Bun's --watch flag when running the script instead
		// Or implement file watching manually
		const fs = await import('fs');
		const path = await import('path');

		const watchDir = path.resolve('src');
		const watcher = fs.watch(watchDir, { recursive: true }, async (eventType, filename) => {
			if (filename && filename.endsWith('.ts')) {
				console.log(`[watch] file changed: ${filename}`);
				await main();
			}
		});

		process.on('SIGINT', () => {
			watcher.close();
			process.exit(0);
		});
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
