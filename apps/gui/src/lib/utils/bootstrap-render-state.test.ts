import { describe, expect, it } from 'vitest';

import { getBootstrapRenderState } from './bootstrap-render-state';

describe('getBootstrapRenderState', () => {
	it('keeps first-run users out of the app when seed finishes without data', () => {
		const state = getBootstrapRenderState({
			isReady: true,
			hasActualData: false,
			hasUsableCache: false,
			isBootstrapped: false,
			isSeeded: false,
			seedBootStatus: 'complete',
			tabState: 'leader'
		});

		expect(state.needsSeedBootstrap).toBe(false);
		expect(state.loadedEnough).toBe(false);
		expect(state.showContent).toBe(false);
		expect(state.showBootstrapLoading).toBe(false);
		expect(state.showFollowerWaiting).toBe(false);
		expect(state.navDisabled).toBe(true);
	});

	it('shows the seed bootstrap checklist only while a leader needs seed bootstrap', () => {
		const state = getBootstrapRenderState({
			isReady: false,
			hasActualData: false,
			hasUsableCache: false,
			isBootstrapped: false,
			isSeeded: false,
			seedBootStatus: 'in_progress',
			tabState: 'leader'
		});

		expect(state.needsSeedBootstrap).toBe(true);
		expect(state.showBootstrapLoading).toBe(true);
		expect(state.showContent).toBe(false);
	});

	it('shows content after first-run bootstrap has actual relay-check data', () => {
		const state = getBootstrapRenderState({
			isReady: true,
			hasActualData: true,
			hasUsableCache: false,
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
			hasUsableCache: false,
			isBootstrapped: true,
			isSeeded: true,
			seedBootStatus: 'complete',
			tabState: 'leader'
		});

		expect(state.loadedEnough).toBe(true);
		expect(state.showContent).toBe(false);
		expect(state.showBootstrapLoading).toBe(false);
	});

	it('keeps follower tabs on the follower wait screen until content is ready', () => {
		const state = getBootstrapRenderState({
			isReady: true,
			hasActualData: false,
			hasUsableCache: false,
			isBootstrapped: false,
			isSeeded: false,
			seedBootStatus: 'complete',
			tabState: 'follower'
		});

		expect(state.showContent).toBe(false);
		expect(state.showFollowerWaiting).toBe(true);
		expect(state.showBootstrapLoading).toBe(false);
	});

	it('shows cached content during an in-progress cached resync', () => {
		const state = getBootstrapRenderState({
			isReady: true,
			hasActualData: false,
			hasUsableCache: true,
			isBootstrapped: false,
			isSeeded: false,
			seedBootStatus: 'in_progress',
			tabState: 'leader'
		});

		expect(state.needsSeedBootstrap).toBe(false);
		expect(state.loadedEnough).toBe(true);
		expect(state.showBootstrapLoading).toBe(false);
		expect(state.showContent).toBe(true);
		expect(state.navDisabled).toBe(false);
	});
});
