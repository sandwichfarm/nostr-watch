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
        console.log('speedcard result', result)
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
    $: isMaximum = (value || 0) > 3000;
    $: width = $speedometerWidth;
</script>

<style>
    .speedometer-container {
        width: 100%;
    }
</style>

<Card.Root class="relay-card">
    <Card.Header>
        <Card.Title>Speed</Card.Title>
    </Card.Header>
    <Card.Content class="speedometer-container">
        {#if $success}
        <div bind:this={container} class="text-center">
            {#if value}
                <Speedometer 
                    value={value<=3000? value: 3000} 
                    {width} 
                    startColor="green"
                    endColor="red"
                    needleColor="purple"
                    labelFontSize="30px"
                    currentValueText=" "
                    valueTextFontSize="50px"
                    textColor="#FFF"
                    minValue="0"
                    maxValue="3000"
                    customSegmentLabels={[
                        {
                          text: "🔥 ",
                          position: "OUTSIDE"
                        },
                        {
                          text: "",
                          position: "INSIDE"
                        },
                        {
                          text: "",
                          position: "INSIDE",
                          color: "#555",
                          fontSize: "19px",
                        },
                        {
                          text: "",
                          position: "INSIDE",
                          color: "#555",
                        },
                        {
                          text: "🐢",
                          position: "OUTSIDE",
                          color: "#555",
                        }
                    ]}
                    />
                <span class="inline-block text-white/90 font-bold text-6xl">
                    {value}ms
                </span>
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
