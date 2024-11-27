<script lang="ts">

    export const prerender = false;

    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { Batcher } from '@nostrwatch/nip66/core';
    import { eventKey } from '$lib/utils/event-keys';
    
    let data = [];
    let loading = true;
    let error = false;
    let pubkey: string;

    let n66: any,
        N66: any,
        NostrSqliteAdapter: any,
        NostrToolsAdapter: any,
        liveQuery: any,
        Subscription: any;
    
    const monitorData = derived([pubkey, page], ([$pubkey, $page], set) => {
        monitor($pubkey, $page)
        .then((res) => {
            data = res;
            loading = false;
            error = false;
            set(data);
        })
        .catch((err) => {
            console.error(err);
            loading = false;
            error = true;
        });
    });
    
    onMount(async () => {
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
		await n66.monitorService.bootstrapMonitorRegistrations();
		await n66.monitorService.bootstrapMonitorData();
    	await n66.monitorService.ensureMonitorsActive();
    	await n66.monitorService.prioritizeMonitors();
		const _monitorData = await n66.cacheAdapter.REQ([{authors: [pubkey], kinds: [] }]);
		// const _events = await n66.cacheAdapter.REQ(n66.monitorService.getMonitorCheckFilters());
		events.set(new Set(_events));
		n66.monitorService.addHook('onMonitorCheckEvent', (event: any) => {
			events.update((events) => {
				events.add(event);
				return events;
			});
		});
        monitorData.subscribe();
    });
    
    $: pubkey.subscribe((value) => {
        if (value) {
        monitorData.subscribe();
        }
    });
    
    $: page.subscribe((value) => {
        if (value) {
        monitorData.subscribe();
        }
    });
    
    $: if (error) {
        goto('/404');
    }
</script>