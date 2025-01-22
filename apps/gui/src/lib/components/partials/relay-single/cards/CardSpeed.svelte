<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import Nocap, { type CheckKey } from '@nostrwatch/nocap';
    import WebsocketAdapter from '@nostrwatch/nocap-websocket-adapter-default/web';
    import { onMount, onDestroy } from 'svelte';
    import { writable, type Writable } from 'svelte/store';
    import Speedometer from "svelte-speedometer";

    export let relayUrl: string;

    const busy: Writable<boolean> = writable(false);
    const speed: Writable<number | null> = writable(null);
    // const success: Writable<boolean | null> = writable(null);
    const result: Writable<any | null> = writable(null);
    const speedometerWidth: Writable<number> = writable(400);

    let nocap: Nocap | null ;
    let container: HTMLElement | null = null;
    let resizeObserver: ResizeObserver;

    onMount(async () => {
        busy.set(true);
        nocap = new Nocap(relayUrl);
        nocap.on('change', (value: any) => {
            ////console.log('onchange value', value);
        });
        nocap.useAdapter(WebsocketAdapter);
        const res = await nocap.check(['open', 'read']);
        ////console.log('speedcard result', res)
        busy.set(false);
        speed.set(res.open.duration);
        // success.set(res.open.data)
        result.set(res);
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

    $: error = $result?.open?.message ?? false;
    $: success = $result?.open?.data ?? false
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
        <!-- <pre>{JSON.stringify($result, null, 2)}</pre> -->

        {#if success === true && $busy === false}
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
            {#if $busy}
                <div>Speed test commencing...</div>
            {:else}
                {#if error}
                    <div>Error: {error}</div>
                {:else}
                    <div>Could not connect.</div>
                {/if}
            {/if}
        {/if}
    </Card.Content>
    <Card.Footer>
    </Card.Footer>
</Card.Root>
