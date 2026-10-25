import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const guiRoot = resolve(process.cwd(), 'src');
const read = (path: string): string => readFileSync(resolve(guiRoot, path), 'utf8');

describe('tab-independent remote HTTP boundaries', () => {
	it('routes automatic NIP-11 and NIP-05 probes through the service-worker broker', () => {
		expect(read('lib/services/Nip11Service/index.ts')).toMatch(/fetchImpl:\s*fetchRemote/);
		expect(read('lib/services/Nip05Service/index.ts')).toMatch(/fetchImpl:\s*fetchRemote/);
		expect(read('routes/monitors/[pubkey]/+page.svelte')).toContain('verifyNip05Isolated');
	});

	it('does not retain the tab-owned NIP probe workers', () => {
		expect(existsSync(resolve(guiRoot, 'lib/services/Nip11Service/nip11.worker.ts'))).toBe(false);
		expect(existsSync(resolve(guiRoot, 'lib/services/Nip05Service/nip05.worker.ts'))).toBe(false);
	});
});
