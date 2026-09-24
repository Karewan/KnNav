import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

const banner = `/**
 * KnNav v${pkg.version} (${new Date().toISOString()})
 * Copyright (c) 2022 - ${new Date().getFullYear()} Florent VIALATTE
 * Released under the MIT license
 */`;

// KnHttp is not bundled (peer dependency), the IIFE builds use the global KnHttp object
const globals = {
	'kn-http': 'KnHttp'
};

export default defineConfig({
	define: {
		__KN_NAV_VERSION__: JSON.stringify(pkg.version)
	},
	build: {
		target: 'es2022',
		outDir: 'dist',
		emptyOutDir: true,
		copyPublicDir: false,
		minify: false,
		lib: {
			entry: 'src/kn-nav.ts',
			name: 'KnNav'
		},
		rolldownOptions: {
			external: ['kn-http'],
			output: [
				{
					format: 'es',
					entryFileNames: 'kn-nav.js',
					postBanner: banner
				},
				{
					format: 'iife',
					name: 'KnNav',
					entryFileNames: 'kn-nav.iife.js',
					exports: 'default',
					globals: globals,
					postBanner: banner
				},
				{
					format: 'iife',
					name: 'KnNav',
					entryFileNames: 'kn-nav.iife.min.js',
					exports: 'default',
					globals: globals,
					minify: {
						compress: {
							dropConsole: true,
							dropDebugger: true
						},
						mangle: true,
						codegen: true
					},
					postBanner: banner
				}
			]
		}
	}
});
