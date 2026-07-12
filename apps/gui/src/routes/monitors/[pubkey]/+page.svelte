<script lang="ts">
    import { page } from '$app/stores';
    import { onMount, onDestroy } from 'svelte';
    import { derived, get, writable, type Readable } from 'svelte/store';
    import { goto } from '$app/navigation';
    import * as Card from '$lib/components/ui/card';
    import { Badge } from '$lib/components/ui/badge';
    import Button from '$lib/components/ui/button/button.svelte';
    import PageHeader from '$lib/components/layout/PageHeader.svelte';
    import { monitorsMap, monitorRows, monitorRelayLivenessCounts } from '$lib/stores/monitors';
    import { relayCheckAggregates } from '$lib/stores/checks';
    import { formatSeconds, timeAgo } from '$lib/utils/time';
    import { PFP } from '$lib/utils/pfp';
    import { truncateWithEllipsis } from '$lib/utils/strings';
    import { clickToCopy } from '$lib/utils/ux';
    import Chart from 'chart.js/auto';
    import { decodeGeohash } from '$lib/utils/geohash';
    import { browser } from '$app/environment';
    import { verifyNip05 } from '$lib/services/Nip05Service/verify-nip05';
    import 'leaflet/dist/leaflet.css';

    export const prerender = false;

    // Get pubkey from URL
    $: pubkey = $page.params.pubkey;

    // Find the monitor data
    $: monitorData = $monitorRows.find((m: any) => m.pubkey === pubkey);
    $: monitor = $monitorsMap.get(pubkey);
    $: liveness = $monitorRelayLivenessCounts[pubkey] ?? { online: 0, offline: 0, dead: 0 };

    // Header data
    $: title = monitorData?.name || truncateWithEllipsis(pubkey, 21);
    $: photo = monitorData?.photo || PFP.generate(pubkey);
    $: banner = monitor?.profile?.banner || undefined;

    // Compute derived metrics
    $: totalRelays = liveness.online + liveness.offline + liveness.dead;

    // Monitor health: is it publishing checks on schedule?
    // Compare lastActive to frequency with some leniency
    $: monitorFrequency = monitorData?.frequency || 43200; // default 12h
    $: lastActiveTimestamp = monitorData?.lastActive || 0;

    // Use a stable timestamp that only updates once on mount
    let nowSeconds = Math.floor(Date.now() / 1000);

    $: timeSinceLastActive = lastActiveTimestamp > 0 ? nowSeconds - lastActiveTimestamp : Infinity;
    $: expectedInterval = monitorFrequency * 1.2; // 20% leniency
    $: isOnSchedule = timeSinceLastActive <= expectedInterval;
    $: isSlightlyBehind = timeSinceLastActive > expectedInterval && timeSinceLastActive <= expectedInterval * 2;
    $: monitorHealthStatus = isOnSchedule ? 'healthy' : isSlightlyBehind ? 'behind' : 'overdue';

    // Decode geohash to lat/lon for map
    $: monitorLocation = monitorData?.geohash ? decodeGeohash(monitorData.geohash) : null;

    // NIP-05 validation
    let nip05Status: 'pending' | 'valid' | 'invalid' | null = null;

    // Validate NIP-05 when monitor data is available
    $: if (browser && monitorData?.nip05 && pubkey) {
        nip05Status = 'pending';
        verifyNip05(pubkey, monitorData.nip05).then(valid => {
            nip05Status = valid ? 'valid' : 'invalid';
        });
    }

    // Leaflet map action - handles initialization and cleanup automatically
    function leafletMap(node: HTMLElement, options: { lat: number; lon: number; zoom: number }) {
        let map: any = null;
        let L: any = null;

        const tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

        async function init() {
            if (!browser) return;

            // Import Leaflet fresh each time
            L = await import('leaflet');

            map = L.map(node, {
                center: [options.lat, options.lon],
                zoom: options.zoom,
                zoomControl: false,
                attributionControl: false
            });

            L.tileLayer(tileUrl, { subdomains: 'abcd' }).addTo(map);

            L.circleMarker([options.lat, options.lon], {
                radius: 8,
                color: '#4ade80',
                fillColor: '#4ade80',
                fillOpacity: 0.8
            }).addTo(map);

            // Fix rendering after mount
            setTimeout(() => map?.invalidateSize(), 100);
        }

        init();

        return {
            update(newOptions: { lat: number; lon: number; zoom: number }) {
                if (map && L) {
                    map.setView([newOptions.lat, newOptions.lon], newOptions.zoom);
                }
            },
            destroy() {
                if (map) {
                    map.remove();
                    map = null;
                }
            }
        };
    }

    // Get relays checked by this monitor from the cache-backed store
    // This uses the same data source as the count/donut, ensuring consistency
    $: relaysCheckedByMonitor = $relayCheckAggregates
        .filter((relay: any) => relay?.seenBy?.includes(pubkey))
        .map((relay: any) => ({
            url: relay.relay,
            liveness: relay.liveness,
            lastSeen: relay.lastSeen,
            rtt: relay.rtt,
            software: relay.software,
            geocode: relay.geocode,
        }))
        .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));

    // Chart
    let chartCanvas: HTMLCanvasElement;
    let chart: any = null;

    function createChart() {
        if (!chartCanvas || totalRelays === 0) return;

        if (chart) {
            chart.destroy();
        }

        const ctx = chartCanvas.getContext('2d');
        if (!ctx) return;

        chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Online', 'Offline', 'Dead'],
                datasets: [{
                    data: [liveness.online, liveness.offline, liveness.dead],
                    backgroundColor: [
                        'rgba(74, 222, 128, 0.8)',  // green
                        'rgba(251, 146, 60, 0.8)',  // orange
                        'rgba(248, 113, 113, 0.8)', // red
                    ],
                    borderColor: [
                        'rgba(74, 222, 128, 1)',
                        'rgba(251, 146, 60, 1)',
                        'rgba(248, 113, 113, 1)',
                    ],
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: 'rgba(255, 255, 255, 0.8)',
                            padding: 20,
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'rgba(255, 255, 255, 0.9)',
                        bodyColor: 'rgba(255, 255, 255, 0.8)',
                    }
                }
            }
        });
    }

    $: if (chartCanvas && totalRelays > 0) {
        createChart();
    }

    onDestroy(() => {
        if (chart) {
            chart.destroy();
            chart = null;
        }
    });

    // Format relay URL for display
    function formatRelayUrl(url: string): string {
        try {
            const parsed = new URL(url);
            return parsed.host;
        } catch {
            return url;
        }
    }

    // Get liveness color class
    function getLivenessColor(status: string): string {
        switch (status) {
            case 'online': return 'text-green-400';
            case 'offline': return 'text-orange-400';
            case 'dead': return 'text-red-400';
            default: return 'text-gray-400';
        }
    }

    // Country code to flag emoji
    function countryCodeToFlag(code: string): string {
        if (!code || code.length !== 2) return '';
        const offset = 127397;
        return String.fromCodePoint(
            ...code.toUpperCase().split('').map(c => c.charCodeAt(0) + offset)
        );
    }

    // OpenStreetMap tile URL
    const tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const tileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';


</script>

<svelte:head>
    <title>{monitorData?.name || 'Monitor'} | nostr.watch</title>
</svelte:head>

{#if !monitorData}
    <main class="pt-24 px-10 pb-20">
        <div class="text-center py-20">
            <h1 class="text-2xl text-white/60">Monitor not found</h1>
            <p class="text-white/40 mt-2">The monitor with pubkey {pubkey} could not be found.</p>
            <Button class="mt-4" on:click={() => goto('/monitors')}>
                Back to Monitors
            </Button>
        </div>
    </main>
{:else}
    <PageHeader
        {title}
        icon={photo}
        {banner}
        bgOpacity={0.5}
        copyable={false}
    >
        <!-- Status badges and info below title -->
        <div class="flex items-center gap-2 mt-2 ml-3">
            {#if monitorData.active}
                <Badge variant="default" class="bg-green-500/20 text-green-400 border-green-500/30">
                    Active
                </Badge>
            {:else}
                <Badge variant="secondary" class="bg-red-500/20 text-red-400 border-red-500/30">
                    Inactive
                </Badge>
            {/if}

            {#if monitorData.enabled}
                <Badge variant="outline" class="border-blue-500/30 text-blue-400">
                    Enabled
                </Badge>
            {:else}
                <Badge variant="outline" class="border-gray-500/30 text-gray-400">
                    Disabled
                </Badge>
            {/if}

            {#if monitorData.nip05}
                <span class="text-sm ml-2 inline-flex items-center gap-1">
                    <span class="{nip05Status === 'valid' ? 'text-purple-400' : nip05Status === 'invalid' ? 'text-red-400' : 'text-white/50'}">
                        {monitorData.nip05}
                    </span>
                    {#if nip05Status === 'pending'}
                        <span class="text-white/30 text-xs">...</span>
                    {:else if nip05Status === 'valid'}
                        <svg class="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                        </svg>
                    {:else if nip05Status === 'invalid'}
                        <svg class="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20" title="NIP-05 verification failed">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                    {/if}
                </span>
            {/if}
        </div>

        <!-- Map in header (desktop only) - positioned in visible area (below site header) -->
        <svelte:fragment slot="absolute">
            {#if monitorLocation}
                {#key pubkey}
                    <div class="hidden lg:block absolute right-[10px] w-[500px] h-[160px] z-20" style="top: calc(96px + ((100% - 96px - 40px - 160px) / 2));">
                        <div class="w-full h-full rounded-lg overflow-hidden bg-black/40 border border-white/10 relative">
                            <div use:leafletMap={{ lat: monitorLocation.lat, lon: monitorLocation.lon, zoom: 6 }} class="w-full h-full"></div>
                            <div class="absolute bottom-2 right-2 text-xs text-white/80 bg-black/60 px-2 py-1 rounded z-[1000]">
                                <span class="font-mono">{monitorData.geohash}</span>
                                <span class="ml-2 text-white/60">
                                    {monitorLocation.lat.toFixed(3)}, {monitorLocation.lon.toFixed(3)}
                                </span>
                            </div>
                        </div>
                    </div>
                {/key}
            {/if}
        </svelte:fragment>
    </PageHeader>

    <main class="px-10 pb-20 pt-8">

        <!-- Metrics Grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <!-- Monitor Status -->
            <Card.Root class="bg-black/30 border-white/10">
                <Card.Content class="pt-6">
                    <div class="text-center">
                        {#if monitorHealthStatus === 'healthy'}
                            <div class="text-3xl font-bold text-green-400">On Schedule</div>
                            <div class="text-white/50 text-sm mt-1">Publishing checks</div>
                        {:else if monitorHealthStatus === 'behind'}
                            <div class="text-3xl font-bold text-orange-400">Behind</div>
                            <div class="text-white/50 text-sm mt-1">Slightly overdue</div>
                        {:else}
                            <div class="text-3xl font-bold text-red-400">Overdue</div>
                            <div class="text-white/50 text-sm mt-1">No recent checks</div>
                        {/if}
                    </div>
                </Card.Content>
            </Card.Root>

            <!-- Relays Monitored -->
            <Card.Root class="bg-black/30 border-white/10">
                <Card.Content class="pt-6">
                    <div class="text-center">
                        <div class="text-3xl font-bold text-white">{totalRelays}</div>
                        <div class="text-white/50 text-sm mt-1">Relays Monitored</div>
                    </div>
                </Card.Content>
            </Card.Root>

            <!-- Check Frequency -->
            <Card.Root class="bg-black/30 border-white/10">
                <Card.Content class="pt-6">
                    <div class="text-center">
                        <div class="text-2xl font-bold text-white">
                            {monitorData.frequency ? formatSeconds(monitorData.frequency) : '-'}
                        </div>
                        <div class="text-white/50 text-sm mt-1">Check Interval</div>
                    </div>
                </Card.Content>
            </Card.Root>

            <!-- Last Active -->
            <Card.Root class="bg-black/30 border-white/10">
                <Card.Content class="pt-6">
                    <div class="text-center">
                        <div class="text-xl font-bold {monitorHealthStatus === 'healthy' ? 'text-green-400' : monitorHealthStatus === 'behind' ? 'text-orange-400' : 'text-red-400'}">
                            {monitorData.lastActive > 0 ? timeAgo(monitorData.lastActive * 1000) : 'Never'}
                        </div>
                        <div class="text-white/50 text-sm mt-1">Last Check</div>
                    </div>
                </Card.Content>
            </Card.Root>
        </div>

        <!-- Charts and Details Row -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <!-- Relay Network Status (as seen by this monitor) -->
            <Card.Root class="bg-black/30 border-white/10">
                <Card.Header>
                    <Card.Title class="text-white/80">Relay Network Status</Card.Title>
                    <Card.Description class="text-white/50">
                        Status of relays as reported by this monitor
                    </Card.Description>
                </Card.Header>
                <Card.Content>
                    {#if totalRelays > 0}
                        <div class="h-64">
                            <canvas bind:this={chartCanvas}></canvas>
                        </div>
                        <div class="grid grid-cols-3 gap-4 mt-4 text-center">
                            <div>
                                <div class="text-2xl font-bold text-green-400">{liveness.online}</div>
                                <div class="text-xs text-white/50">Reporting Online</div>
                            </div>
                            <div>
                                <div class="text-2xl font-bold text-orange-400">{liveness.offline}</div>
                                <div class="text-xs text-white/50">Reporting Offline</div>
                            </div>
                            <div>
                                <div class="text-2xl font-bold text-red-400">{liveness.dead}</div>
                                <div class="text-xs text-white/50">Likely Dead</div>
                            </div>
                        </div>
                    {:else}
                        <div class="h-64 flex items-center justify-center text-white/40">
                            No relay data available
                        </div>
                    {/if}
                </Card.Content>
            </Card.Root>

            <!-- Monitor Details -->
            <Card.Root class="bg-black/30 border-white/10">
                <Card.Header>
                    <Card.Title class="text-white/80">Monitor Details</Card.Title>
                    <Card.Description class="text-white/50">
                        Configuration and capabilities
                    </Card.Description>
                </Card.Header>
                <Card.Content class="space-y-4">
                    <!-- Networks -->
                    <div>
                        <div class="text-white/50 text-sm mb-1">Networks</div>
                        <div class="flex gap-2 flex-wrap">
                            {#if monitorData.networks?.length}
                                {#each monitorData.networks as network}
                                    <Badge variant="secondary" class="bg-white/10">
                                        {network}
                                    </Badge>
                                {/each}
                            {:else}
                                <span class="text-white/30">Not specified</span>
                            {/if}
                        </div>
                    </div>

                    <!-- Check Types -->
                    <div>
                        <div class="text-white/50 text-sm mb-1">Check Types</div>
                        <div class="flex gap-2 flex-wrap">
                            {#if monitorData.checks?.length}
                                {#each monitorData.checks as check}
                                    <Badge variant="outline" class="border-white/20">
                                        {check}
                                    </Badge>
                                {/each}
                            {:else}
                                <span class="text-white/30">Not specified</span>
                            {/if}
                        </div>
                    </div>

                    <!-- Published to Relays -->
                    <div>
                        <div class="text-white/50 text-sm mb-1">Publishes to</div>
                        <div class="text-white/80">
                            {monitorData.relays?.length || 0} relay{monitorData.relays?.length !== 1 ? 's' : ''}
                        </div>
                        {#if monitorData.relays?.length}
                            <div class="mt-2 space-y-1 max-h-32 overflow-y-auto">
                                {#each monitorData.relays.slice(0, 5) as relay}
                                    <div class="text-xs text-white/40 font-mono">{formatRelayUrl(relay)}</div>
                                {/each}
                                {#if monitorData.relays.length > 5}
                                    <div class="text-xs text-white/30">+{monitorData.relays.length - 5} more</div>
                                {/if}
                            </div>
                        {/if}
                    </div>

                    <!-- Location -->
                    {#if monitorData.geohash}
                        <div>
                            <div class="text-white/50 text-sm mb-1">Location</div>
                            <div class="text-white/80 font-mono text-sm">
                                {monitorData.geohash}
                            </div>
                        </div>
                    {/if}

                    <!-- Priority -->
                    <div>
                        <div class="text-white/50 text-sm mb-1">Priority</div>
                        <div class="text-white/80">{monitorData.priority}</div>
                    </div>
                </Card.Content>
            </Card.Root>
        </div>

        <!-- Monitor Location Map (mobile only - desktop shows in header) -->
        {#if monitorLocation}
            {#key pubkey}
                <Card.Root class="bg-black/30 border-white/10 mb-8 lg:hidden">
                    <Card.Header>
                        <Card.Title class="text-white/80">Monitor Location</Card.Title>
                        <Card.Description class="text-white/50">
                            Approximate geographic location
                        </Card.Description>
                    </Card.Header>
                    <Card.Content>
                        <div class="h-56 rounded-lg overflow-hidden">
                            <div use:leafletMap={{ lat: monitorLocation.lat, lon: monitorLocation.lon, zoom: 5 }} class="w-full h-full"></div>
                        </div>
                        <div class="mt-3 text-sm text-white/50">
                            <span class="font-mono bg-white/10 px-2 py-1 rounded">
                                {monitorData.geohash}
                            </span>
                            <span class="ml-2">
                                {monitorLocation.lat.toFixed(3)}, {monitorLocation.lon.toFixed(3)}
                            </span>
                        </div>
                    </Card.Content>
                </Card.Root>
            {/key}
        {/if}

        <!-- Monitored Relays Table -->
        <Card.Root class="bg-black/30 border-white/10">
            <Card.Header>
                <Card.Title class="text-white/80">Monitored Relays</Card.Title>
                <Card.Description class="text-white/50">
                    Relays being checked by this monitor ({relaysCheckedByMonitor.length} relays)
                </Card.Description>
            </Card.Header>
            <Card.Content>
                {#if relaysCheckedByMonitor.length > 0}
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead>
                                <tr class="border-b border-white/10 text-left text-white/50 text-sm">
                                    <th class="pb-3 pr-4">Relay</th>
                                    <th class="pb-3 px-4 text-center">Status</th>
                                    <th class="pb-3 px-4 text-center">RTT</th>
                                    <th class="pb-3 px-4">Software</th>
                                    <th class="pb-3 px-4 text-center">Location</th>
                                    <th class="pb-3 pl-4">Last Seen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each relaysCheckedByMonitor.slice(0, 50) as relay}
                                    <tr class="border-b border-white/5 hover:bg-white/5">
                                        <td class="py-3 pr-4">
                                            <a
                                                href="/relays/wss/{formatRelayUrl(relay.url)}"
                                                class="text-blue-400 hover:text-blue-300 font-mono text-sm"
                                            >
                                                {formatRelayUrl(relay.url)}
                                            </a>
                                        </td>
                                        <td class="py-3 px-4 text-center">
                                            <span class="{getLivenessColor(relay.liveness)} font-medium capitalize">
                                                {relay.liveness || '-'}
                                            </span>
                                        </td>
                                        <td class="py-3 px-4 text-center text-white/60">
                                            {relay.rtt ? `${relay.rtt}ms` : '-'}
                                        </td>
                                        <td class="py-3 px-4 text-white/60 text-sm">
                                            {relay.software || '-'}
                                        </td>
                                        <td class="py-3 px-4 text-center">
                                            {relay.geocode ? countryCodeToFlag(relay.geocode) : '-'}
                                        </td>
                                        <td class="py-3 pl-4 text-white/50 text-sm">
                                            {relay.lastSeen ? timeAgo(relay.lastSeen * 1000) : '-'}
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                        {#if relaysCheckedByMonitor.length > 50}
                            <div class="text-center py-4 text-white/40">
                                Showing 50 of {relaysCheckedByMonitor.length} relays
                            </div>
                        {/if}
                    </div>
                {:else}
                    <div class="text-center py-12 text-white/40">
                        No relay check data available for this monitor yet.
                    </div>
                {/if}
            </Card.Content>
        </Card.Root>
    </main>
{/if}

<style lang="postcss" global>
    canvas {
        width: 100% !important;
        height: 100% !important;
    }

    /* Leaflet map container sizing */
    .leaflet-container {
        width: 100%;
        height: 100%;
        background: transparent;
    }
</style>
