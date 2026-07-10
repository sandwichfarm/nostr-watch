<script lang="ts">
    import { derived, writable, type Readable, type Writable } from 'svelte/store';
    import { Checkbox } from "$lib/components/ui/checkbox/index.js";
    import * as Table from '$lib/components/ui/table/index.js'

    import { monitorSelectionLocked, monitorsMap } from "$lib/stores/monitors.js";
    import type { IEvent, Monitor } from '@nostrwatch/route66/models';
    import { events, eventsArray } from '$lib/stores/events.js';

    import { route66 } from '$lib/stores';
    import type Route66 from '@nostrwatch/route66';
	import { onMount } from 'svelte';
	import { eventKey } from '$lib/utils/event-keys';
	import { activeMonitorChecksCount } from '$lib/stores';
    import { pauseLiveSync, type LiveSyncResumer } from '$lib/utils/live-sync';
	import { delay } from '@nostrwatch/utils';
	import type { Nip05 } from 'nostr-tools/nip05';
	import { nip05Service } from '$stores/nip05s';
	import { tabState } from '$lib/stores/app';
	import { leaderRpcCall } from '$lib/runtime/leader-tab-rpc';
	import { StateManager } from '@nostrwatch/route66';

    export let data: any;
    export let view: 'head' | 'cell' = 'cell';
    let monitor: Readable<Monitor | undefined> = derived(monitorsMap, (map) => map.get(data?.pubkey));
    
    const disabled = writable(false);

    let busy: boolean = false;

    // if(view === 'cell') {

    // }

    let toggleEnableMonitor: () => void; 

    const updateState = async (monitor: Monitor, enable: boolean) => {
        monitor.enabled = enable;
        $route66?.services?.monitors?.manager?.updateMonitor?.(monitor)

        monitorsMap.update((monitorsMap: Map<string, Monitor>) => {
            const existing = monitorsMap.get(monitor.pubkey);
            if (existing?.registration?.created_at && monitor?.registration?.created_at && existing.registration.created_at > monitor.registration.created_at) {
                return monitorsMap;
            }
            const { pubkey } = monitor
            const nip05: Nip05 | undefined = monitor?.profile?.nip05;
            monitorsMap.set(pubkey, monitor);
            if(nip05 && !$nip05Service.find(pubkey, nip05)){
                $nip05Service.check(pubkey, nip05)
            }
            return monitorsMap;
        });

		// Followers should route monitor selection changes through the leader tab so the
		// leader's MonitorService + persisted monitor cache stay authoritative.
		if ($tabState !== 'leader') {
			void leaderRpcCall('monitors.setEnabled', [monitor.pubkey, enable], { timeoutMs: 10_000 }).catch(() => {
				// Fallback: if leader RPC is unavailable, persist directly to shared storage so
				// other tabs (including the leader) can still observe the change via `storage`.
				try {
					const existing = StateManager.get('cache:monitors');
					const nextCache = Array.isArray(existing) ? existing.slice() : [];
					const idx = nextCache.findIndex((m: any) => m?.pubkey === monitor.pubkey);
					if (idx >= 0) nextCache[idx] = { ...(nextCache[idx] as any), enabled: enable };
					else if (typeof (monitor as any)?.toCache === 'function') nextCache.push({ ...(monitor as any).toCache(), enabled: enable });
					else nextCache.push({ pubkey: monitor.pubkey, enabled: enable });
					StateManager.set('cache:monitors', nextCache);
				} catch {}
			});
		}
    }

    

    onMount(() => {
        toggleEnableMonitor = async () => {
            if($monitorSelectionLocked) return;
            if(busy) return;
            busy = true;
            disabled.set(true);
            let resumer: LiveSyncResumer | undefined;
            try {
                const { publishEventsToMemoryRelay } = await import('$lib/stores/events-helpers.js');
                resumer = await pauseLiveSync();
                // console.log('monitors: toggleEnableMonitor', $monitor.enabled)
                const currentMonitor = $monitor;
                if(!currentMonitor) {
                    console.warn('Monitor not found');
                    return;
                }
                if(currentMonitor.enabled) {
                    // console.log('monitors:  disabling monitor')
                    currentMonitor.disable();
                    events.update($events => {
                        $events.entries().forEach( ([key, event]) => {
                            if(event.pubkey === currentMonitor.pubkey){
                                $events.delete(key);
                            }
                        })
                        return $events;
                    })
                    await updateState(currentMonitor, false);
                }
                else {
                    // console.log('monitors: enabling monitor')
                    currentMonitor.enable()
                    const options = {
                        filters: [ currentMonitor.checkFilter ],
                        options: {
                            stream: true,
                            returnResults: true,
                            cache: true,
                            keepAlive: false,
                            sync: true,
                            batch: 25
                        },
                        relays: [ ...($route66?.services?.monitors?.nip66Relays || []), ...currentMonitor.relays ],
                        priority: 20
                    }
                    const onevents = publishEventsToMemoryRelay
                    await ($route66?.services?.monitors as any)?.subscribe(options, { onevents })
                    await updateState(currentMonitor, true);
                }
            } finally {
                await resumer?.();
                disabled.set(false);
                busy = false;
            }
        }
    })

    $: checked = $monitor?.enabled
    $: selectionDisabled = $disabled || $monitorSelectionLocked;
</script>

{#if view === 'cell'}
    <Table.Cell>
        {#if $monitor?.pubkey}
        <Checkbox disabled={selectionDisabled} id="toggle-${$monitor.pubkey.slice(0,21)}" bind:checked aria-labelledby="terms-label" onCheckedChange={toggleEnableMonitor} />
        {/if}
    </Table.Cell>
{:else}
    <Table.Head>
        Enable
    </Table.Head>
{/if}
