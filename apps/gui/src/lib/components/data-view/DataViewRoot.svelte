<script lang="ts">
    import { onMount } from 'svelte';
    import { get, writable, derived, type Writable, type Readable, readable } from 'svelte/store';
    import * as Resizable from '$lib/components/ui/resizable';
    import Filters from './filters/DataViewFilters.svelte';
    import { applyFilters, createRelayFilters, type ConsoleFilter } from './filters/filter-dom.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import DataTable from '$lib/components/data-view/table/DataTable.svelte';
    import { StateManager } from '@nostrwatch/route66';
    import { stateManagerSet } from '$lib/runtime/state-manager-sync';

	import Button from '$lib/components/ui/button/button.svelte';
	import type { DataTableConfig } from './DataTableTypes.svelte';
	import type { DataViewColumns, DataViewData, DataViewViews } from './DataTableTypes';
	import DataViewSelector from './partials/DataViewSelector.svelte';
	import MapBasic from './map/MapBasic.svelte';
	import MapRoot from './map/MapRoot.svelte';

    export let data: Readable<any[]>;
    export let config: Writable<DataTableConfig>;
    export let enableFilters: boolean = true;
    export let key: string;
    export let enabledViews: DataViewViews[] = ['table'];
    export let onFilterChange: (config: DataTableConfig) => void = (config) => {};
    export let onPresetSave: () => void = () => {};
    export let actionsComponent: any | undefined = undefined;

    export let sidebarPaneApi: Resizable.PaneApi | null = null;

	export let showViewSelector: boolean = true;
	export let viewSelectorClass: string | undefined = undefined;
    
    let keysEnable: string[];

    $: keysEnable = ($config.columnsShow?.length && $config.filtersShow?.length )? Array.from(new Set([...$config.columnsShow, ...$config.filtersShow])) : [];
    
    // **Stores and Reactive Variables**
    const filters = writable({});

    let dataExtended: Readable<DataViewData> = readable({ data: [], columns: [] });
    let filteredData: Readable<{data: any[]; columns: any[] }> = readable({ data: [], columns: [] });
    let justData: Readable<any[]> = readable([]);
    let justColumns: Readable<any[]>  = readable([]);

    function ensureRelaysLivenessConfig() {
        if (key !== 'relays') return;
        config.update((currentConfig) => {
            if (!currentConfig) return currentConfig;

            const filtersShow = Array.isArray(currentConfig.filtersShow) ? currentConfig.filtersShow : [];
            const nextFiltersShow = filtersShow.includes('liveness') ? filtersShow : ['liveness', ...filtersShow];

            const filtersActive =
                currentConfig.filtersActive && typeof currentConfig.filtersActive === 'object'
                    ? { ...currentConfig.filtersActive }
                    : {};

            if (!filtersActive?.liveness) filtersActive.liveness = ['online'];

            return { ...currentConfig, filtersShow: nextFiltersShow, filtersActive };
        });
    }

    $: if (key === 'relays' && $config) {
        const filtersShow = Array.isArray($config.filtersShow) ? $config.filtersShow : [];
        const needsShow = !filtersShow.includes('liveness');
        const needsActive = !$config?.filtersActive?.liveness;
        if (needsShow || needsActive) ensureRelaysLivenessConfig();
    }

    onMount((): any => {
        ensureRelaysLivenessConfig();

        let syncingFilters = false;
        const safeFilters = (value: any): Record<string, any> => (value && typeof value === 'object' ? value : {});
        const jsonEquals = (a: any, b: any) => {
            try {
                return JSON.stringify(a) === JSON.stringify(b);
            } catch {
                return a === b;
            }
        };

        // Initialize `filters` from `config.filtersActive`, and keep them in sync both ways.
        try {
            const initialFilters = safeFilters(get(config)?.filtersActive);
            filters.set(initialFilters);
        } catch {}

        const unsubConfig = config.subscribe((nextConfig: any) => {
            if (syncingFilters) return;
            const nextFilters = safeFilters(nextConfig?.filtersActive);
            const current = get(filters);
            if (jsonEquals(current, nextFilters)) return;
            syncingFilters = true;
            filters.set(nextFilters);
            syncingFilters = false;
        });

        dataExtended = derived(
            [data, config],
            ([ $data, $config ]) => {

                if($config.columnsShow.length === 0) {
                    return { data: [], columns: [] };
                }

                const columns: DataViewColumns[] = $config.columnsShow.map((key: string) => ({
                    id: key,
                    key: key,
                    name: $config.prettyNames?.[key]?.short ?? key.charAt(0).toUpperCase() + key.slice(1),
                }));

                const rows = Array.isArray($data) ? $data : [];
                return { data: rows, columns };
            }
        );

        const unsubFilters = filters.subscribe((newFilters: any) => {
            if (syncingFilters) return;
            syncingFilters = true;
            config.update((currentConfig: DataTableConfig) => {
                if (!currentConfig) return currentConfig;
                if (jsonEquals(currentConfig.filtersActive, newFilters)) return currentConfig;
                return { ...currentConfig, filtersActive: newFilters };
            });
            syncingFilters = false;
        });
        
        filteredData = derived(
            [dataExtended, filters],
            ([$dataExtended, $filters]) => {
                if (!$dataExtended.data || !$dataExtended.columns || $dataExtended.columns.length === 0) {
                    return { data: [], columns: [] };
                }
                const currentRelayFilters: ConsoleFilter[] = createRelayFilters($dataExtended.data, $config.filtersShow, $config.prettyNames);
                const filteredData = applyFilters($dataExtended.data, $filters, currentRelayFilters);
                return { data: filteredData, columns: $dataExtended.columns };
            }
        );

        justData = derived(filteredData, $filteredData => $filteredData.data);
        justColumns = derived(filteredData, $filteredData => $filteredData.columns);
        
        // Migrate legacy per-view collapsed state to the global key.
        if (initialSidebarSource === 'legacyKey' || initialSidebarSource === 'legacyTableConfig') {
            let hasGlobal = false;
            try {
                hasGlobal = typeof StateManager.get(GLOBAL_SIDEBAR_COLLAPSED_KEY) === 'boolean';
            } catch {}
            if (!hasGlobal) {
                try {
                    StateManager.set(GLOBAL_SIDEBAR_COLLAPSED_KEY, initialSidebarCollapsed);
                } catch {}
                void stateManagerSet(GLOBAL_SIDEBAR_COLLAPSED_KEY, initialSidebarCollapsed);
            }
        }
        
        return () => {
            unsubConfig();
            unsubFilters();
        };
    });

    function clearAllFilters() {
        filters.set({});
    }

    // Sidebar persistence key (separate from main config to avoid expensive subscription cascades)
    // This must be global so the drawer state persists across contexts (relays/operators/monitors/etc).
    const GLOBAL_SIDEBAR_COLLAPSED_KEY = `preferences:dataView:sidebarCollapsed`;
    const LEGACY_SIDEBAR_COLLAPSED_KEY = `preferences:${key}:sidebarCollapsed`;

    const toggleSidebarPane = () => {
        // Toggle the pane - callbacks will update sidebarHidden for UI
        if(isCollapsed) {
            sidebarPaneApi.expand()
        }
        else {
            sidebarPaneApi.collapse()
        }
    }

    // Persist sidebar state separately (called from callbacks).
    const persistSidebarState = (collapsed: boolean) => {
        // Optimistic local write so "toggle then navigate" works even in follower tabs.
        try {
            StateManager.set(GLOBAL_SIDEBAR_COLLAPSED_KEY, collapsed);
        } catch {}
        void stateManagerSet(GLOBAL_SIDEBAR_COLLAPSED_KEY, collapsed);
    };

    type SidebarCollapsedSource = 'global' | 'legacyKey' | 'legacyTableConfig' | 'config' | 'default';
    function readInitialSidebarCollapsed(): { collapsed: boolean; source: SidebarCollapsedSource } {
        if (typeof window === 'undefined') return { collapsed: true, source: 'default' };

        // 1) New dedicated key (authoritative).
        try {
            const stored = StateManager.get(GLOBAL_SIDEBAR_COLLAPSED_KEY);
            if (typeof stored === 'boolean') return { collapsed: stored, source: 'global' };
        } catch {}

        // 2) Back-compat: older per-view dedicated key.
        try {
            const stored = StateManager.get(LEGACY_SIDEBAR_COLLAPSED_KEY);
            if (typeof stored === 'boolean') return { collapsed: stored, source: 'legacyKey' };
        } catch {}

        // 3) Back-compat: older persisted tableConfig value.
        try {
            const tableConfig = StateManager.get(`preferences:${key}:tableConfig`);
            const legacy = (tableConfig as any)?.sidebarCollapsed;
            if (typeof legacy === 'boolean') return { collapsed: legacy, source: 'legacyTableConfig' };
        } catch {}

        // 4) Fall back to current config value when present.
        const fromConfig = ($config as any)?.sidebarCollapsed;
        if (typeof fromConfig === 'boolean') return { collapsed: fromConfig, source: 'config' };

        // 5) Default: collapsed.
        return { collapsed: true, source: 'default' };
    }

    const initialSidebar = readInitialSidebarCollapsed();
    const initialSidebarCollapsed = initialSidebar.collapsed;
    const initialSidebarSource = initialSidebar.source;

    let sidebarHidden = initialSidebarCollapsed;
    $: isCollapsed = sidebarHidden;
    $: activeFilters = Object.keys($filters || {}).length

	export let activeView: Writable<DataViewViews> = writable("table");

	$: if (enabledViews?.length && !enabledViews.includes($activeView)) {
		activeView.set(enabledViews[0]);
	}

    let loading = false 

    // Apply initial collapsed state once the pane API exists.
    let didApplyInitialSidebarState = false;
    $: if (!didApplyInitialSidebarState && initialSidebarCollapsed && sidebarPaneApi) {
        didApplyInitialSidebarState = true;
        setTimeout(() => sidebarPaneApi?.collapse(), 1);
    }

	type LivenessCounts = { online: number; offline: number; dead: number } | null;
	let livenessCounts: LivenessCounts = null;

	$: {
		const rows: any[] = Array.isArray($dataExtended?.data) ? ($dataExtended.data as any[]) : [];
		if (rows.length && typeof rows[0]?.liveness === 'string') {
			const counts = { online: 0, offline: 0, dead: 0 };
			for (const row of rows) {
				switch (row?.liveness) {
					case 'online':
						counts.online++;
						break;
					case 'offline':
						counts.offline++;
						break;
					case 'dead':
						counts.dead++;
						break;
				}
			}
			livenessCounts = counts;
		} else {
			livenessCounts = null;
		}
	}
</script>

{#if showViewSelector}
	<DataViewSelector {enabledViews} {activeView} class={viewSelectorClass} />
{/if}

<Resizable.PaneGroup direction="horizontal" class="min-h-[100%] z-1">

    <Resizable.Pane defaultSize={75}>
        {#if $filteredData && $justColumns?.length}
            {#if $activeView === 'table'}
                <DataTable
                    dataKey={key}
                    {config}
                    data={justData}
                    columns={justColumns}
                    {sidebarPaneApi}
                    dataUnfilteredLength={$dataExtended?.data?.length}
                    {livenessCounts}
                    {actionsComponent}
                />
            {/if}

            {#if $activeView === 'grid'}
                <div>Grid</div>
            {/if}

            {#if $activeView === 'map'} 
                {#if $justData?.length}
                    <MapRoot data={justData} {filters} />
                {/if}
            {/if}
        {/if}
    
    </Resizable.Pane>
    
    {#if enableFilters}
    <Resizable.Handle withHandle />
    <Resizable.Pane
        class="min-h-[100%] overflow-hidden gradient-purple-200"
        defaultSize={25}
        collapsedSize={5}
        collapsible={true}
        onExpand={() => { sidebarHidden = false; persistSidebarState(false); }}
        onCollapse={() => { sidebarHidden = true; persistSidebarState(true); }}
        onResize={()=>{}}
        bind:pane={sidebarPaneApi}
        > <!----->

            {#if sidebarPaneApi}
                <Button 
                    class="rounded-l-none display-inline bg-black/5 dark:bg-white/5 text-white/80 hover:bg-white/15 dark:bg-black/15 text-white/90" 
                    on:click={() => toggleSidebarPane()}>
                    {#if isCollapsed}
                    ⭅
                    {:else}
                    ⭆
                    {/if}
                </Button>    

            {/if}

            {#if isCollapsed && activeFilters > 0}
                <Badge class="clear-left py-2 inline-block text-white/80 rounded-full" variant="destructive">
                    {activeFilters}
                </Badge>
            {/if}

            <!-- Always render Filters to keep it mounted (filters work while collapsed) but hide visually -->
            <div style={isCollapsed ? 'display: none !important;' : ''}>
                {#if $data?.length && enableFilters}
                    <Filters
                        bind:onFilterChange
                        dataKey={key}
                        {dataExtended}
                        {filters}
                        {config}
                        {onPresetSave}
                    />
                {/if}
            </div>
          
    </Resizable.Pane>   
    {/if}
</Resizable.PaneGroup>

<style lang="postcss" global>
    .active-filter {
        background-color: #e0e0e0;
        padding: 0.5rem;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    /* Optional: Add styles for filter buttons */
    .filter-mode-toggle button.active {
        /* Example active state styles */
        background-color: #3182ce;
        color: white;
    }
    /* Optional: Style the more-link */
    .more-link {
        color: #3182ce;
        cursor: pointer;
        text-decoration: underline;
    }

    body .data-[state=active]:bg-background[data-state="active"] {
        @apply !bg-black/10 dark:bg-white/10;
    }
</style>
