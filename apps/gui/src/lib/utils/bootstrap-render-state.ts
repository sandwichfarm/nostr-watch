import type { TabStateType } from '$lib/stores/app';
import type { SeedBootStatus } from '$lib/stores/boot-state';

export interface BootstrapRenderStateInput {
	isReady: boolean;
	hasActualData: boolean;
	hasUsableCache: boolean;
	isBootstrapped: boolean;
	isSeeded: boolean;
	seedBootStatus: SeedBootStatus;
	tabState: TabStateType;
}

export interface BootstrapRenderState {
	seedInProgress: boolean;
	seedReady: boolean;
	isFreshState: boolean;
	loadedEnough: boolean;
	needsSeedBootstrap: boolean;
	showBootstrapLoading: boolean;
	showFollowerWaiting: boolean;
	showContent: boolean;
	showInitialBootFallback: boolean;
	navDisabled: boolean;
}

export function getBootstrapRenderState(input: BootstrapRenderStateInput): BootstrapRenderState {
	const seedInProgress = input.seedBootStatus === 'in_progress';
	const seedReady = input.isSeeded || input.seedBootStatus === 'complete';
	const hasRenderableData = input.hasActualData || input.hasUsableCache;
	const isFreshState = !input.isBootstrapped && !input.isSeeded && !input.hasUsableCache;
	const loadedEnough = hasRenderableData && (!isFreshState || seedReady);
	const needsSeedBootstrap = isFreshState && !seedReady;
	const showContent = input.isReady && loadedEnough;
	const showFollowerWaiting = !showContent && input.tabState === 'follower';
	const showBootstrapLoading = needsSeedBootstrap && input.tabState === 'leader';

	return {
		seedInProgress,
		seedReady,
		isFreshState,
		loadedEnough,
		needsSeedBootstrap,
		showBootstrapLoading,
		showFollowerWaiting,
		showContent,
		showInitialBootFallback:
			!showBootstrapLoading && !showFollowerWaiting && !showContent && !input.hasUsableCache,
		navDisabled: !loadedEnough || needsSeedBootstrap
	};
}
