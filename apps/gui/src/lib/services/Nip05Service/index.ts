import { get } from 'svelte/store';
import type { Nip05 } from 'nostr-tools/nip05';

import {
	generateNip05MapKey,
	type INip05Map,
	type INip05Result,
	nip05s
} from '$lib/stores/nip05s.js';
import { fetchRemote } from '$lib/utils/remote-fetch.js';
import { verifyNip05 } from './verify-nip05.js';

export type PubkeyNip05PairsType = {
	pubkey: string;
	nip05: Nip05;
};

type Nip05CheckOptions = {
	timeoutMs?: number;
};

export type Nip05Verifier = (
	pubkey: string,
	nip05: Nip05,
	options: Nip05CheckOptions
) => Promise<boolean>;

const verifyNip05Isolated: Nip05Verifier = (pubkey, nip05, options) =>
	verifyNip05(pubkey, nip05, {
		...options,
		fetchImpl: fetchRemote
	});

const normalizeNip05 = (nip05: Nip05): Nip05 =>
	(nip05.includes('@') ? nip05 : `_@${nip05}`) as Nip05;

export class Nip05Service {
	private pending = new Map<string, Promise<INip05Result>>();

	constructor(private readonly verify: Nip05Verifier = verifyNip05Isolated) {}

	find(pubkey: string, nip05: Nip05): INip05Result | undefined {
		return get(nip05s).get(generateNip05MapKey(pubkey, normalizeNip05(nip05)));
	}

	async check(
		pubkey: string,
		nip05: Nip05,
		options: Nip05CheckOptions = {}
	): Promise<INip05Result> {
		const normalizedNip05 = normalizeNip05(nip05);
		const key = generateNip05MapKey(pubkey, normalizedNip05);
		const existing = this.find(pubkey, normalizedNip05);
		if (existing) return existing;

		const inFlight = this.pending.get(key);
		if (inFlight) return inFlight;

		const timeoutMs = options.timeoutMs ?? 10_000;
		const pending = this.verify(pubkey, normalizedNip05, { timeoutMs })
			.catch(() => false)
			.then((valid): INip05Result => ({ pubkey, nip05: normalizedNip05, valid }))
			.then((result) => {
				nip05s.update((map: INip05Map) => {
					map.set(key, result);
					return map;
				});
				return result;
			})
			.finally(() => this.pending.delete(key));

		this.pending.set(key, pending);
		return pending;
	}

	async valid(pubkey: string, nip05: Nip05): Promise<boolean> {
		const existing = this.find(pubkey, nip05);
		if (existing) return existing.valid;
		return (await this.check(pubkey, nip05)).valid;
	}
}
