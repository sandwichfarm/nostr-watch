<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	import Stats from '$lib/components/blocks/Stats.svelte';
	import Console from '$lib/components/blocks/console/Console.svelte';
	
	import { Nip66Event } from '@nostrwatch/nip66/models';

	import { 
		nip11s, 
		geocodes, 
		events,
		relays, 
		softwares, versions,
		isps,
		monitors, monitorsMap, monitorChecksCount,

		eventsArray

	} from '$lib/stores/index.js';

	import { isParameterizedReplaceableKind, isReplaceableKind } from 'nostr-tools/kinds';

	let N66: any,
			NostrSqliteAdapter: any,
			NostrToolsAdapter: any,
			liveQuery: any,
			Subscription: any;

	let n66: any;

	let subscriptions: typeof Subscription[] = [];

	let val: string='';
	let timer: ReturnType<typeof setTimeout>;
	const debounce = <T>(value: T, time: number = 750, callback = () => {}) => {
		clearTimeout(timer);
		timer = setTimeout(callback, time);
	}

	onDestroy(() => {
		clearTimeout(timer);
		n66?.destroy();
	});

	onMount(async () => {
		const load = async () => {
			if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
			N66 = (await import('@nostrwatch/nip66')).default;
			//console.log(await import('@nostrwatch/nip66-cacheadapter-nostrsqlite'))
			NostrSqliteAdapter = (await import('@nostrwatch/nip66-cacheadapter-nostrsqlite')).default;
			NostrToolsAdapter = (await import('@nostrwatch/nip66-wsadapter-nostrtools')).default;

			//console.log('Initializing...');
			const adapters = {
				cacheAdapter: new NostrSqliteAdapter(),
				websocketAdapter: new NostrToolsAdapter()
			};
			n66 = new N66(adapters);
			await n66.init();

			//console.log(`state stats:`, n66.state.stats)
			setInterval(() => {
				//console.log(`state stats:`, n66.state.stats)
			}, 5000);	

			const eventAddr = ( event: any ) => {
				let { pubkey, kind } = event;
				pubkey = pubkey.slice(0,16);
				if(isParameterizedReplaceableKind(kind)) {
					const relay = event.tags.find(t => t[0] === 'd')?.[1]
					const key = `${pubkey}:${kind}:${relay}`
					return `${pubkey}:${kind}:${relay}`;
				}
				else if(isReplaceableKind(kind)) {
					const key = `${pubkey}:${kind}`
					return `${pubkey}:${kind}`;
				}
			}

			const eventKey = (event: any) =>{
				if(isReplaceableKind(event.kind)) {
					return eventAddr(event);
				}
				else if(isParameterizedReplaceableKind(event.kind)){
					return eventAddr(event);
				}
				else {
					return event.id
				}
			}

			n66.on('monitor:update', (monitor: any) => {
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

			n66.on('event', (event: any) => {
				console.log('Svelte Received event:', event.id);
				events.update((map) => {
					if(!map) return;
					const key = eventKey(event)
					if (!key) return;
					const existing = map.get(key);
					if (existing && existing.id === event.id) return;
					if (existing && existing.created_at > event.created_at) return;
					
					map.set(key, new Nip66Event(event));
					return map;
				});
			});

			n66.on('events', (_events: any) => {
				console.log('Svelte Received events:', _events.length);
				let set = 0;

				events.update((map) => {
					if(!map) return map;
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

				//console.log(`Set ${set}/${_events.length} events`);
			});

			await n66.monitorService.bootstrap();
		};
		load()
	});

	onDestroy(() => {
		subscriptions.forEach(sub => sub.unsubscribe());
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


