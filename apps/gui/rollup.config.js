import { spawn } from 'child_process';
import svelte from 'rollup-plugin-svelte';
import commonjs from '@rollup/plugin-commonjs' ;
import terser from '@rollup/plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import livereload from 'rollup-plugin-livereload';
import css from 'rollup-plugin-css-only';
// import { cleandir } from "rollup-plugin-cleandir";

const production = !process.env.ROLLUP_WATCH;
const OUT_DIR = 'public/build';

function serve() {
	let server;

	function toExit() {
		if (server) server.kill(0);
	}

	return {
		writeBundle() {
			if (server) return;
			server = spawn('npm', ['run', 'start', '--', '--dev'], {
				stdio: ['ignore', 'inherit', 'inherit'],
				shell: true
			});
			process.on('SIGTERM', toExit);
			process.on('exit', toExit);
		}
	};
}

export default [
	{
		treeshake: production,
		input: 'src/main.js',
		output: {
			sourcemap: true,
			format: 'esm',
			dir: OUT_DIR,
			entryFileNames: '[name].[hash].js'
		},
		plugins: [
			// cleandir(OUT_DIR),
			svelte({
				compilerOptions: {
					dev: !production
				}
			}),
			css({ output: 'bundle.css' }),
			resolve({
				browser: true,
				dedupe: ['svelte', '@nostrwatch/route66', '@nostrwatch/route66-cacheadapter-dexieetl', '@nostrwatch/route66-wsadapter-nostrtools'],
				exportConditions: ['svelte']
			}),
			commonjs({
				include: 'node_modules/**',
				debug: true
			}),
			!production && serve(),
			!production && livereload('public'),
			production && terser()
		],
		watch: {
			clearScreen: false
		}
	}
];
