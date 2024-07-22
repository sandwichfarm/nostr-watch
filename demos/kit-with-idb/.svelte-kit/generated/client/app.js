export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8'),
	() => import('./nodes/9'),
	() => import('./nodes/10')
];

export const server_loads = [];

export const dictionary = {
		"/": [2],
		"/relays/by/country/[countryCode]": [4],
		"/relays/by/follows/[pubkey]": [5],
		"/relays/by/monitor/[monitorPubkey]": [6],
		"/relays/by/nip/[nip]": [7],
		"/relays/by/operator-pubkey/[pubkey]": [8],
		"/relays/by/software/[software]": [9],
		"/relay/[protocol]/[...relay]": [3],
		"/stream": [10]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),

	reroute: (() => {})
};

export { default as root } from '../root.svelte';