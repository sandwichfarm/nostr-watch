<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	import Stats from '$lib/components/blocks/Stats.svelte';
	import Console from '$lib/components/blocks/console/Console.svelte';
	import { Nip66Event } from '@nostrwatch/nip66/models';
	import routineRemoveStaleChecks from '$lib/routines/remove-stale-checks-from-store';
	import { eventKey } from '$lib/utils/event-keys.js';

	import { nip66 } from '$lib/stores/nip66.js';

	import { 
		events,
		monitorsMap,
		eventsArray
	} from '$lib/stores/index.js';

	

	export const prerender = true;

	let N66: any,
			NostrSqliteAdapter: any,
			NostrToolsAdapter: any,
			liveQuery: any,
			Subscription: any;

	let subscriptions: typeof Subscription[] = [];

	let val: string='';
	let timer: ReturnType<typeof setTimeout>;
	const debounce = <T>(value: T, time: number = 750, callback = () => {}) => {
		clearTimeout(timer);
		timer = setTimeout(callback, time);
	}

	onMount(async () => {
		const load = async () => {
			if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
			N66 = (await import('@nostrwatch/nip66')).default;
			NostrSqliteAdapter = (await import('@nostrwatch/nip66-cacheadapter-nostrsqlite')).default;
			NostrToolsAdapter = (await import('@nostrwatch/nip66-wsadapter-nostrtools')).default;
			const adapters = {
				cacheAdapter: new NostrSqliteAdapter(),
				websocketAdapter: new NostrToolsAdapter()
			};
			nip66.set(new N66(adapters));
			await $nip66.init();
			console.log('nip66 initialized');
			$nip66.on('monitor:update', (monitor: any) => {
				//console.log('Svelte Received monitor:', monitor.registration.pubkey);
				monitorsMap.update((monitorsMap) => {
					const existing = monitorsMap.get(monitor.registration.pubkey);
					if (existing) {
						if (existing.registration.created_at > monitor.registration.created_at) return monitorsMap;
					} else {
						monitorsMap.set(monitor.registration.pubkey, monitor);
					}
					return monitorsMap;
				});
			});
			$nip66.on('events', (_events: any) => {
				console.log('Svelte Received events:', _events.length);
				let set = 0;
				events.update((map) => {
					console.log('onevents map', map)
					_events.forEach((event: any) => {
						const key = eventKey(event);
						if (!key) return;

						const existing = map.get(key);
						if (existing && existing.id === event.id) return;
						if (existing && existing.created_at > event.created_at) return;

						set++;
						map.set(key, new Nip66Event(event));
					});

					return map;
				});
			});
			await $nip66.monitorService.bootstrap();
			$nip66.on('event', (event: any) => {
				console.log('Svelte Received event:', event.id);
				const key = eventKey(event);
				if (!key) return map;
				const existing = $events.get(key);
				if (existing && existing.id === event.id) return map; // Explicitly return the existing map
				if (existing && existing.created_at > event.created_at) return map; // Explicitly return the existing map
				$events.set(key, new Nip66Event(event));
				return map;
			});			
		};
		load()
	});

	onDestroy(() => {
		clearTimeout(timer);
		$nip66?.destroy();
	});
</script>

<main>
	<Stats />
	<Console />
</main>

<!-- <h1>Monitors</h1>
{#if $monitors.length > 0}
  <p>{$monitors.length}</p>
  {#each $monitors as monitor (monitor?.registration?.pubkey)}
    <p>
      {monitor?.registration?.pubkey} [{$monitorChecksCount[monitor?.registration?.pubkey]}]
    </p>
  {/each}
{:else}
  <p>No monitors found.</p>
{/if} -->


