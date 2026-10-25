import { get } from 'svelte/store';

import type { Route66 } from '@nostrwatch/route66';
import { type Nip11 as Nip11Type, type RelayInformation } from '@nostrwatch/route66/models';
import PQueue from 'p-queue';

import { nip11sLocal } from '$lib/stores/nip11s-local.js';
import { setRelayError } from '$lib/stores/relay-errors.js';
import { fetchRemote } from '$lib/utils/remote-fetch.js';
import { fetchRelayInformation } from './fetch-relay-information.js';

const queue = new PQueue({ concurrency: 10 });

type Nip11Constructor = new (info: RelayInformation) => Nip11Type;

type Nip11CheckOptions = {
	timeoutMs?: number;
};

export type Nip11Fetcher = (relay: string, options: Nip11CheckOptions) => Promise<RelayInformation>;

const fetchRelayInformationIsolated: Nip11Fetcher = (relay, options) =>
	fetchRelayInformation(relay, {
		...options,
		fetchImpl: fetchRemote
	});

export class Nip11Service {
	private pending = new Map<string, Promise<Nip11Type | undefined>>();
	private nip11Ctor: Nip11Constructor | null = null;
	private nip11CtorPromise: Promise<Nip11Constructor> | null = null;

	constructor(private readonly fetchRelay: Nip11Fetcher = fetchRelayInformationIsolated) {}

	find(relay: string): Nip11Type | undefined {
		return get(nip11sLocal).get(relay);
	}

	async check(relay: string, options: Nip11CheckOptions = {}): Promise<Nip11Type | undefined> {
		const existing = this.find(relay);
		if (existing) return existing;

		const inFlight = this.pending.get(relay);
		if (inFlight) return inFlight;

		const timeoutMs = options.timeoutMs ?? 5_000;
		const pending = queue
			.add(() => this.load(relay, { timeoutMs }))
			.then((result) => result ?? undefined)
			.catch((error: unknown) => {
				setRelayError(
					relay,
					'schema',
					'nip11',
					error instanceof Error ? error.message : String(error)
				);
				return undefined;
			})
			.finally(() => this.pending.delete(relay));

		this.pending.set(relay, pending);
		return pending;
	}

	private async load(relay: string, options: Nip11CheckOptions): Promise<Nip11Type | undefined> {
		const existing = this.find(relay);
		if (existing) return existing;

		const relayInformation = await this.fetchRelay(relay, options);
		const Nip11Ctor = await this.getNip11Ctor();
		const nip11 = new Nip11Ctor(relayInformation);

		nip11sLocal.update((map: Map<string, Nip11Type>) => {
			map.set(relay, nip11);
			return map;
		});

		void import('$lib/utils/lifecycle')
			.then(({ instance }) => instance())
			.then(($route66: Route66) =>
				$route66?.adapters?.cacheAdapter?.upsertNip11?.(relay, nip11.json)
			)
			.catch(() => {});

		return nip11;
	}

	private async getNip11Ctor(): Promise<Nip11Constructor> {
		if (this.nip11Ctor) return this.nip11Ctor;
		if (!this.nip11CtorPromise) {
			this.nip11CtorPromise = import('@nostrwatch/route66/models')
				.then(({ Nip11 }) => {
					this.nip11Ctor = Nip11 as unknown as Nip11Constructor;
					return this.nip11Ctor;
				})
				.catch((error) => {
					console.error('Error importing Nip11:', error);
					throw error;
				});
		}
		return this.nip11CtorPromise;
	}
}
