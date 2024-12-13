<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import Nocap, { type CheckKey } from '@nostrwatch/nocap';
    import WebsocketAdapter from '@nostrwatch/nocap-websocket-adapter-default/web';
    import { onMount, onDestroy } from 'svelte';
    import { writable, type Writable } from 'svelte/store';
    import Speedometer from "svelte-speedometer";

    export let relayUrl: string;

    const speed: Writable<number | null> = writable(null);
    const success: Writable<boolean | null> = writable(null);
    const speedometerWidth: Writable<number> = writable(400);

    let nocap: Nocap | null ;
    let container: HTMLElement | null = null;
    let resizeObserver: ResizeObserver;

    onMount(async () => {
        nocap = new Nocap(relayUrl);
        nocap.on('change', (value: any) => {
            console.log('onchange value', value);
        });
        nocap.useAdapters([WebsocketAdapter]);
        const result = await nocap.check('open' as CheckKey);
        speed.set(result.open.duration);
        success.set(result.open.data)
        nocap = null;

        if (container) {
            resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    if (entry.target === container) {
                        const newWidth = entry.contentRect.width;
                        speedometerWidth.set(newWidth);
                    }
                }
            });
            resizeObserver.observe(container);
            speedometerWidth.set(container.clientWidth);
        }
    });

    onDestroy(() => {
        if (resizeObserver && container) {
            resizeObserver.unobserve(container);
        }
        nocap = null;
    });

    $: value = $speed ? Math.round($speed) : null;
    $: width = $speedometerWidth;
</script>

<style>
    .speedometer-container {
        width: 100%;
    }
</style>

<Card.Root>
    <Card.Header>
        <Card.Title>Speed</Card.Title>
    </Card.Header>
    <Card.Content class="speedometer-container">
        {#if $success}
        <div bind:this={container}>
            {#if value}
                <Speedometer {value} {width} />
                <div>{value}ms</div>
            {:else}
                <div>connecting...</div>
            {/if}
        </div>
        {:else}
        Could not connect.
        {/if}
    </Card.Content>
    <Card.Footer>
    </Card.Footer>
</Card.Root>
