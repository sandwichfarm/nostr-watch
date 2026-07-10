import { describe, expect, it } from 'vitest';

import { getBootstrapRenderState } from './bootstrap-render-state';

describe('getBootstrapRenderState', () => {
	it('keeps first-run users in the bootstrap UI when seed finishes without data', () => {
		const state = getBootstrapRenderState({
			isReady: true,
			hasActualData: false,
			isBootstrapped: false,
			isSeeded: false,
			seedBootStatus: 'complete',
			tabState: 'leader'
		});

		expect(state.needsSeedBootstrap).toBe(false);
		expect(state.loadedEnough).toBe(false);
		expect(state.showContent).toBe(false);
		expect(state.showBootstrapLoading).toBe(true);
		expect(state.navDisabled).toBe(true);
	});

	it('shows content after first-run bootstrap has actual relay-check data', () => {
		const state = getBootstrapRenderState({
			isReady: true,
			hasActualData: true,
			isBootstrapped: false,
			isSeeded: false,
			seedBootStatus: 'complete',
			tabState: 'leader'
		});

		expect(state.loadedEnough).toBe(true);
		expect(state.showBootstrapLoading).toBe(false);
		expect(state.showContent).toBe(true);
		expect(state.navDisabled).toBe(false);
	});

	it('does not show content before the app boot function is ready', () => {
		const state = getBootstrapRenderState({
			isReady: false,
			hasActualData: true,
			isBootstrapped: true,
			isSeeded: true,
			seedBootStatus: 'complete',
			tabState: 'leader'
		});

		expect(state.loadedEnough).toBe(true);
		expect(state.showContent).toBe(false);
		expect(state.showBootstrapLoading).toBe(true);
	});

	it('keeps follower tabs on the follower wait screen while seed import is active', () => {
		const state = getBootstrapRenderState({
			isReady: true,
			hasActualData: false,
			isBootstrapped: false,
			isSeeded: false,
			seedBootStatus: 'in_progress',
			tabState: 'follower'
		});

		expect(state.showContent).toBe(false);
		expect(state.showFollowerWaiting).toBe(true);
		expect(state.showBootstrapLoading).toBe(false);
	});
});
