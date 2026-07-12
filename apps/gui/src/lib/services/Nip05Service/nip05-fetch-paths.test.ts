import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(process.cwd(), 'src');

const sourceFiles = (directory: string): string[] =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = `${directory}/${entry.name}`;
		if (entry.isDirectory()) return sourceFiles(path);
		return /\.(?:ts|svelte)$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : [];
	});

describe('NIP-05 network boundaries', () => {
	it('routes every NIP-05 HTTP lookup through the hardened verifier', () => {
		const unsafe = sourceFiles(sourceRoot)
			.filter((path) => !path.endsWith('/verify-nip05.ts'))
			.filter((path) =>
				/\.well-known\/nostr\.json|nip05\.isValid\s*\(/.test(readFileSync(path, 'utf8'))
			)
			.map((path) => path.slice(sourceRoot.length));

		expect(unsafe).toEqual([]);
	});
});
