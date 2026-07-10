import type { TabStateType } from '$lib/stores/app';
import type { SeedBootStatus } from '$lib/stores/boot-state';

export interface BootstrapRenderStateInput {
	isReady: boolean;
	hasActualData: boolean;
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
	navDisabled: boolean;
}

export function getBootstrapRenderState(input: BootstrapRenderStateInput): BootstrapRenderState {
	const seedInProgress = input.seedBootStatus === 'in_progress';
	const seedReady = input.isSeeded || input.seedBootStatus === 'complete';
	const isFreshState = !input.isBootstrapped && !input.isSeeded;
	const loadedEnough = input.hasActualData && (!isFreshState || seedReady);
	const needsSeedBootstrap = isFreshState && !seedReady;
	const showContent = input.isReady && loadedEnough && !seedInProgress;
	const showFollowerWaiting = !showContent && input.tabState === 'follower' && seedInProgress;

	return {
		seedInProgress,
		seedReady,
		isFreshState,
		loadedEnough,
		needsSeedBootstrap,
		showBootstrapLoading: !showContent && !showFollowerWaiting,
		showFollowerWaiting,
		showContent,
		navDisabled: !loadedEnough || needsSeedBootstrap || seedInProgress
	};
}
