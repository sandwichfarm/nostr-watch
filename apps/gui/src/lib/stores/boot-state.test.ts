import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('SEED_BOOT_STATE_KEY', () => {
	it('uses v2 key bumped in v2.5.1 to drop poisoned aggregate caches from pre-9df89519 builds', () => {
		// Lock the module-private constant without broadening the runtime API. The bump is the
		// cache-invalidation mechanism for visitors carrying poisoned localStorage from before
		// commit 9df89519; see the SECURITY comment in boot-state.ts.
		const sourcePath = resolve(__dirname, 'boot-state.ts');
		const source = readFileSync(sourcePath, 'utf8');

		expect(source).toMatch(/const SEED_BOOT_STATE_KEY = 'boot:seed:v2';/);
		expect(source).not.toMatch(/const SEED_BOOT_STATE_KEY = 'boot:seed:v1';/);
	});
});
