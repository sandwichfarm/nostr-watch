<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { get, type Readable } from 'svelte/store';
    import { writable, type Writable } from 'svelte/store';

    import { Input } from '$lib/components/ui/input/index.js';
    import { Button } from '$lib/components/ui/button2/index.js';
    import MiniSearch from 'minisearch';
    import { Accordion } from 'radix-svelte';
    import * as Popover from "$lib/components/ui/popover";
    import * as Tabs from "$lib/components/ui/tabs";    
    import Badge from '$lib/components/ui/badge/badge.svelte';

    import {
        type ConsoleFilter,
        createRelayFilters,
    } from './filter-dom.js'; 

    import { debounce } from 'lodash';
	import FilterOptions from './FilterOptions.svelte';

    import type { DataTableConfig, Formatters } from './DataTableTypes';

    // **Props Passed to the Component**
    export let tableKey: string;
    export let tableData: Readable<{ data: any[] }>;
    
    export let filters: Writable<Record<string, any>>;
    export let config: any;

    const maxBadgeLength: number = 21;

    const filterOverrides: Record<string, { type: 'search' | 'badge', miniSearchOptions?: any }> = {};

    $: keysEnable = ($config.columnsShow?.length && $config.filtersShow?.length )? Array.from(new Set([...$config.columnsShow, ...$config.filtersShow])) : []
    $: filtersInclude = $config.filtersShow?.length? [ ...$config.filtersShow.filter(f => !$config.filtersDisable.includes(f)) ]: [];

    // **Accordion States**
    let rootValue: any;
    let rootType: "single" | "multiple" = "multiple"; // Allows multiple accordion items to be open
    let rootDisabled: boolean = false;
    let contentTransition: boolean = true;

    // **Inverted Index**
    type RecordData = { id: string; [key: string]: any };
    type InvertedIndex = {
        [filterKey: string]: {
            [option: string]: Set<string>;
        };
    };
    const _invertedIndex: InvertedIndex = {};
    $: invertedIndex = _invertedIndex;

    // **Relay Filters**
    const relayFilters: Writable<ConsoleFilter[]> = writable([]);

    // **Show All State per Filter Group**
    const showAllFilters = writable<Record<string, boolean>>({});

    // **Disabled Filters Store**
    const disabledFilters: Writable<Record<string, Set<string>>> = writable({});

    // **Active Filters**
    $: activeFilters = $filters;

    // **MiniSearch Instances**
    let miniSearchInstances: Record<string, MiniSearch> = {};

    // **Helper Function for Intersection**
    function intersection(setA: Set<string>, setB: Set<string>): Set<string> {
        const _intersection = new Set<string>();
        for (const elem of setA) {
            if (setB.has(elem)) {
                _intersection.add(elem);
            }
        }
        return _intersection;
    }

    const refreshIndices = () => {
        const { data } = $tableData;
        if(!data) return;
        buildInvertedIndex(data, filtersInclude);
        updateDisabledFilters($filters)
    }

    const filtersInit = () => {
        const { data } = $tableData;
        if(!data) return;
        buildInvertedIndex(data, filtersInclude);
        const initialFilters = createRelayFilters(data, filtersInclude, $config.humanReadableNames);
        relayFilters.set(initialFilters);
        const initialShowAll: Record<string, boolean> = {};
        initialFilters.forEach( (filter: any) => {
            initialShowAll[filter.key] = false;
        });
        showAllFilters.set(initialShowAll);
        updateDisabledFilters($filters)
        ////console.log('setting active filters', $config.activeFilters)
        filters.set( $config.activeFilters )
    }

    const onFilterChange = ($config: DataTableConfig) => {
        Object.entries(activeFilters).forEach( ([key]) => {
            if(!$config?.filtersShow.includes(key)) {
                clearFilter(key)
            }
        })
        filtersInit()
    }

    const tableDataUnsub = tableData.subscribe(() => {
        // debounce(filtersInit, 5000)()
    });

    onMount(filtersInit);
    onDestroy( () => {
        tableDataUnsub()
    })

    // **Build Inverted Index**
    function buildInvertedIndex(data: RecordData[], filtersInclude: string[]) {
        filtersInclude.forEach(filterKey => {
            _invertedIndex[filterKey] = {};
            data.forEach(record => {
                const value = record[filterKey];
                if (value !== undefined && value !== null) {
                    const values = Array.isArray(value) ? value : [value];
                    values.forEach(val => {
                        const option = String(val).toLowerCase();
                        if (!invertedIndex[filterKey][option]) {
                            _invertedIndex[filterKey][option] = new Set();
                        }
                        _invertedIndex[filterKey][option].add(record.id);
                    });
                }
            });
        });
    }

    // **Compute Active Record IDs Based on Active Filters**
    function computeActiveRecordIDs(activeFilters: Record<string, any>): Set<string> {
        // ////console.log('begin computeActiveRecordIDs');
        // const begin = new Date().getTime();
        let activeRecordIDs: Set<string> | null = null;

        // Iterate over each filter block
        $relayFilters.forEach(filter => {
            const filterKey = filter.key;
            const filterMode = filter.mode || 'AND'; // Default to 'AND' if mode is not set
            const filterValue = activeFilters[filterKey];

            if (filterValue === undefined || filterValue === null) {
                // No active filters in this block
                return;
            }

            let filterRecordIDs: Set<string> = new Set();

            if (filter.type === 'boolean' || filter.type === 'string' || filter.type === 'array') {
                const options = Array.isArray(filterValue) ? filterValue : [filterValue];
                options.forEach(option => {
                    const normalizedOption = String(option).toLowerCase();
                    const optionRecordIDs = invertedIndex[filterKey]?.[normalizedOption];
                    if (optionRecordIDs) {
                        optionRecordIDs.forEach(id => filterRecordIDs.add(id));
                    }
                });
            } else if (filter.type === 'number') {
                // Handle number filters based on conditions (extend as needed)
                // Example: exact match
                const value = filterValue;
                const optionRecordIDs = invertedIndex[filterKey]?.[String(value).toLowerCase()];
                if (optionRecordIDs) {
                    optionRecordIDs.forEach(id => filterRecordIDs.add(id));
                }
            }

            if (filterMode === 'OR' || filterMode === 'UNIQUE') {
                // Union within the "OR" or "UNIQUE" block
                if (activeRecordIDs === null) {
                    activeRecordIDs = new Set(filterRecordIDs);
                } else {
                    activeRecordIDs = intersection(activeRecordIDs, filterRecordIDs);
                }
            } else if (filterMode === 'AND') {
                // Intersection across all "AND" blocks
                if (activeRecordIDs === null) {
                    activeRecordIDs = new Set(filterRecordIDs);
                } else {
                    activeRecordIDs = intersection(activeRecordIDs, filterRecordIDs);
                }
            }
        });
        // ////console.log('end computeActiveRecordIDs', new Date().getTime() - begin);
        return activeRecordIDs || new Set(get(tableData).data.map(record => record.id));
    }

    // **Update Disabled Filters Based on Active Filters**
    function updateDisabledFilters(activeFilters: Record<string, any>) {
        // const begin = new Date().getTime();
        // ////console.log('begin updateDisabledFilters');
        const activeRecordIDs = computeActiveRecordIDs(activeFilters);
        const newDisabledFilters: Record<string, Set<string>> = {};

        $relayFilters.forEach(filter => {
            const filterKey = filter.key;
            const filterMode = filter.mode || 'AND';
            const filterValue = activeFilters[filter.key];

            newDisabledFilters[filterKey] = new Set();

            Object.keys(invertedIndex[filterKey]).forEach(option => {
                const normalizedOption = String(option).toLowerCase();
                const optionRecordIDs = invertedIndex[filterKey][option];

                let isDisabled = false; 

                if (filterMode === 'OR' || filterMode === 'UNIQUE') {
                    // Simulate selecting this option
                    const tempActiveFilters = structuredClone(activeFilters);

                    if (filterMode === 'UNIQUE') {
                        // Ensure only this option is selected
                        tempActiveFilters[filterKey] = [option];
                    } else if (filterMode === 'OR') {
                        if (Array.isArray(tempActiveFilters[filterKey])) {
                            if (!tempActiveFilters[filterKey].includes(option)) {
                                tempActiveFilters[filterKey].push(option);
                            }
                        } else {
                            tempActiveFilters[filterKey] = [option];
                        }
                    }

                    const tempActiveRecordIDs = computeActiveRecordIDs(tempActiveFilters);

                    // Check if selecting this option would result in at least one record
                    const hasIntersection = [...optionRecordIDs].some(id => tempActiveRecordIDs.has(id));

                    if (!hasIntersection) {
                        isDisabled = true;
                    }
                } else {
                    // In "AND" mode, use the standard disabled logic
                    const hasIntersection = [...optionRecordIDs].some(id => activeRecordIDs.has(id));
                    if (!hasIntersection) {
                        isDisabled = true;
                    }
                }

                if (isDisabled) {
                    newDisabledFilters[filterKey].add(normalizedOption);
                }
            });
        });
        // ////console.log('end updateDisabledFilters', new Date().getTime() - begin);
        disabledFilters.set(newDisabledFilters)
    }

    // **Initialize MiniSearch for Search-Enabled Filters**
    function initializeMiniSearch(filterKey: string, data: any[], options: any) {
        if (!miniSearchInstances[filterKey]) {
            const miniSearch = new MiniSearch({
                fields: [filterKey],
                storeFields: [filterKey],
                ...options
            });
            // Prepare data for MiniSearch
            const miniSearchData = data.map(item => ({
                id: item.id || JSON.stringify(item),
                [filterKey]: Array.isArray(item[filterKey]) ? item[filterKey].join(' ') : item[filterKey]
            }));
            miniSearch.addAll(miniSearchData);
            miniSearchInstances[filterKey] = miniSearch;
            // ////console.log(`Initialized MiniSearch for ${filterKey}`);
        }
    }

    // **Handle Search Input with Debounce**
    const handleSearchInput = debounce((filterKey: string, searchTerm: string) => {
        initializeMiniSearch(filterKey, get(tableData).data, filterOverrides[filterKey]?.miniSearchOptions);
        const miniSearch = miniSearchInstances[filterKey];
        const results = miniSearch.search(searchTerm);
        const matchedValues = results.map(result => result[filterKey]).filter(v => v !== undefined);

        const filter = $relayFilters.find(f => f.key === filterKey);
        if (filter) {
            if (filterOverrides[filterKey]?.type === 'search') {
                if (filter.mode === 'UNIQUE') {
                    // For UNIQUE mode, only one selection is allowed
                    filters.update(currentFilters => ({
                        ...currentFilters,
                        [filter.key]: matchedValues.length > 0 ? [matchedValues[0]] : []
                    }));
                } else {
                    // For OR and AND modes
                    filters.update(currentFilters => ({
                        ...currentFilters,
                        [filter.key]: matchedValues
                    }));
                }
            }
        }
    }, 300); // 300ms debounce

    // **Toggle Show All for Filters with Many Options**
    function toggleShowAllBadges(filterKey: string) {
        showAllFilters.update(currentShowAll => {
            return { ...currentShowAll, [filterKey]: !currentShowAll[filterKey] };
        });
    }

    // **Apply a Filter Value Based on Its Type and Mode**
    function applyFilter(filterKey: string, value: any) {
        const filter = $relayFilters.find(f => f.key === filterKey);
        if (!filter) return;

        const mode = filter.mode;

        filters.update(currentFilters => {
            const existingFilter = currentFilters[filterKey];

            if (filter.type === 'boolean') {
                // Boolean filters use UNIQUE logic (only one can be selected)
                if (existingFilter === value) {
                    const { [filterKey]: _, ...rest } = currentFilters;
                    return rest;
                } else {
                    return { ...currentFilters, [filterKey]: value };
                }
            } else if (filter.type === 'string' || filter.type === 'array') {
                if (mode === 'OR') {
                    // union
                    // console.log('filter: existing', existingFilter)
                    if (Array.isArray(existingFilter)) {
                        if (existingFilter.includes(value)) {
                            // console.log('existing filter')
                            const newValues = existingFilter.filter(v => v !== value);
                            if (newValues.length === 0) {
                                const { [filterKey]: _, ...rest } = currentFilters;
                                return rest;
                            }
                            // console.log('filter: new 1', { ...currentFilters, [filterKey]: newValues })
                            return { ...currentFilters, [filterKey]: newValues };
                        } else {
                            // console.log('filter: new 2', { ...currentFilters, [filterKey]: [...existingFilter, value] })
                            return { ...currentFilters, [filterKey]: [...existingFilter, value] };
                        }
                    } else {
                        return { ...currentFilters, [filterKey]: [value] };
                    }
                } else if (mode === 'AND') {
                    // intersection
                    if (Array.isArray(existingFilter)) {
                        if (existingFilter.includes(value)) {
                            // Deselect the value
                            const newValues = existingFilter.filter(v => v !== value);
                            if (newValues.length === 0) {
                                const { [filterKey]: _, ...rest } = currentFilters;
                                return rest;
                            }
                            return { ...currentFilters, [filterKey]: newValues };
                        } else {
                            // Select the value
                            return { ...currentFilters, [filterKey]: [...existingFilter, value] };
                        }
                    } else {
                        // Initialize with the new value
                        return { ...currentFilters, [filterKey]: [value] };
                    }
                } else if (mode === 'UNIQUE') {
                    if (filter.type === 'array') {
                        // For array filters in UNIQUE mode, maintain filterValue as an array
                        if (!Array.isArray(existingFilter)) {
                            // console.log('array type filter is no longer an array', filterKey, value, existingFilter)
                            return { ...currentFilters };
                        }
                        if (existingFilter.includes(value)) {
                            // Deselect the value
                            const { [filterKey]: _, ...rest } = currentFilters;
                            return rest;
                        } else {
                            // Select the new value, replacing any existing selections
                            return { ...currentFilters, [filterKey]: [value] };
                        }
                    } else {
                        // For string filters in UNIQUE mode, filterValue can be a single value or an array with one value
                        if (existingFilter === value) {
                            const { [filterKey]: _, ...rest } = currentFilters;
                            return rest;
                        } else {
                            return { ...currentFilters, [filterKey]: value };
                        }
                    }
                }
            } else if (filter.type === 'number') {
                // Number filters can have specific logic based on conditions
                if (typeof value === 'number') {
                    return { ...currentFilters, [filterKey]: value };
                }
            }

            return currentFilters;
        });
        // ////console.log('end applyFilter', new Date().getTime() - begin);
        debounce(refreshIndices, 100)();
    }

    // **Set the Mode for a Specific Filter Group**
    function setFilterMode(filterKey: string, mode: 'AND' | 'OR' | 'UNIQUE') {
        relayFilters.update(currentFilters => {
            return currentFilters.map(filter => {
                if (filter.key === filterKey && filter.type !== 'boolean') {
                    return { ...filter, mode };
                }
                return filter;
            });
        });

        ////console.log(`Set mode for ${filterKey} to ${mode}:`, $relayFilters.find(f => f.key === filterKey));

        // If switching to UNIQUE mode, ensure only one selection is active
        if (mode === 'UNIQUE') {
            filters.update(currentFilters => {
                const existingFilter = currentFilters[filterKey];
                if (Array.isArray(existingFilter)) {
                    // Keep only the first selection
                    return { ...currentFilters, [filterKey]: existingFilter.length > 0 ? [existingFilter[0]] : [] };
                } else if (typeof existingFilter === 'string') {
                    // Already a single value
                    return currentFilters;
                }
                return currentFilters;
            });
        }
    }

    // **Clear a Specific Filter Group or Individual Value**
    function clearFilter(filterKey: string, value?: any) {
        filters.update(currentFilters => {
            const existingFilter = currentFilters[filterKey];
            if (value !== undefined) {
                if (Array.isArray(existingFilter)) {
                    const newValues = existingFilter.filter(v => v !== value);
                    if (newValues.length > 0) {
                        return { ...currentFilters, [filterKey]: newValues };
                    }
                } else if (existingFilter === value) {
                    const { [filterKey]: _, ...rest } = currentFilters;
                    return rest;
                }
            } else {
                // Clear the entire filter group
                const { [filterKey]: _, ...rest } = currentFilters;
                return rest;
            }
            return currentFilters;
        });
        refreshIndices();
        ////console.log(`Cleared filter for ${filterKey}${value !== undefined ? `: ${value}` : '.'}`);
    }

    // **Clear All Filters**
    function clearAllFilters() {
        filters.set({});
        ////console.log('Cleared all filters.');
        refreshIndices();
    }


    const format = (key: string, values: string[], html: boolean = true) => {
        if(!html) {
            let hasHtml = false;
            const formatted = values.map((value: string) => $config.filterFormatters?.[key]?.(value) || value)
            formatted.forEach(value => {
                if (containsHTML(value)) {
                    hasHtml = true;
                }
            });
            return hasHtml? values: formatted;
        }
        else {
            return values.map((value: string) => $config.filterFormatters?.[key]?.(value) || value);
        }
    }

    function containsHTML(input: string) {
        if (!input || input.indexOf('<') === -1 || input.indexOf('>') === -1) {
            return false;
        }
        const htmlRegex = /<\/?[a-z][\s\S]*>/i;
        return htmlRegex.test(input);
    }

    // **Reactive Statements for Styling Classes**
    $: buttonClass = 'mb-2 text-sm font-bold py-1 px-2 mr-1';
    $: buttonClassSelected = 'bg-blue-500 text-white';
</script>  

<!-- <pre class="absolute top-1 left-1 bg-black border border-white p-10 z-[9999]">{JSON.stringify($disabledFilters, null, 2)}</pre> -->

<!-- **Clear All Filters Button** -->
<Button 
    size="small" 
    variant="destructive" 
    on:click={clearAllFilters} 
    class="{buttonClass} ml-2" 
    disabled={Object.keys(activeFilters).length > 0 ? false : true}
>
    {#if Object.keys(activeFilters).length > 0}
        Clear {Object.keys(activeFilters).length} Filters
    {:else}
        No Filters Applied
    {/if}
</Button>

<Popover.Root>
    <Popover.Trigger class="text-lg inline-block ml-2 relative -top-1">⚙</Popover.Trigger>
    <Popover.Content class="z-[5999] mt-3 min-w-[600px] backdrop-blur-md bg-black/50">
        <Tabs.Root value="visiblity" class="">
            <Tabs.List>
                <Tabs.Trigger value="visiblity">Visiblity</Tabs.Trigger>
                <Tabs.Trigger value="order">Order</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="visiblity"  class="py-4 px-8">
                <FilterOptions {config} {tableKey} onChange={onFilterChange} />
            </Tabs.Content>
            <Tabs.Content value="order" class=" bg-white/20 dark:bg-black/20">
                coming soon...
            </Tabs.Content>
        </Tabs.Root>
    </Popover.Content>
</Popover.Root>

<!-- **Active Filters Display (Enabled)** -->
{#if false && Object.keys(activeFilters).length > 0}
    <div class="active-filters p-2">
        <h5>Active Filters:</h5>
        <div class="active-filters-list">
            {#each Object.entries(activeFilters) as [key, value]}
                <Badge class="mb-1 mr-1 px-1 py-1 text-xs" size="small" variant="secondary">
                    {#if typeof value === 'function'}
                        [Custom Filter]
                    {:else if Array.isArray(value)}
                        {format(key, value).join(', ')}
                    {:else}
                        {format(key, [value]).join(', ')}
                    {/if}
                    <Button size="small" class="ml-1" variant="link" on:click={() => clearFilter(key)}>✕</Button>
                </Badge>
            {/each}
        </div>
        <Button size="small" variant="destructive" on:click={clearAllFilters} class="{buttonClass}">
            Clear All Filters
        </Button>
    </div>
{/if}

<!-- **Filters Accordion** -->
<Accordion.Root
    class="overflow-x-hidden"
    bind:value={rootValue}
    type={rootType}
    disabled={rootDisabled} 
>
    {#each $relayFilters as filter (filter.key)}
        <Accordion.Item class="accordion-item max-h-none overflow-x-auto" value={filter.key}>
            <Accordion.Header class="py-2 px-2 border-b-2">
                <Accordion.Trigger>
                    <!-- **Accordion Trigger Layout with Active Filters Badge and List** -->
                    <div class="flex items-center w-full text-sm py-3 px-2">
                        <!-- Filter Title -->
                        <span class="flex-shrink-0 overflow-hidden text-ellipsis">{filter.humanReadableName}</span>
                        
                        {#if activeFilters[filter.key]}
                            <!-- Badge with Count -->
                            <Badge class="ml-2 text-xs py-0.5 px-2 rounded-full">{Array.isArray(activeFilters[filter.key]) ? activeFilters[filter.key].length : 1}</Badge>
                            
                            <!-- List of Active Filters -->
                            <span class="ml-2 text-xs opacity-70">
                                {#if filter.mode === 'AND' || filter.mode === 'OR'}
                                    {#if Array.isArray(activeFilters[filter.key])}
                                        {#each activeFilters[filter.key] as value, index}
                                            {#if index > 0}
                                                {filter.mode === 'AND' ? ' AND ' : ' OR '}
                                            {/if}
                                            <span class="inline-flex items-center">
                                                {format(filter.key, [value], false)}
                                            </span>
                                        {/each}
                                    {:else}
                                        <span class="inline-flex items-center">
                                            {format(filter.key, [activeFilters[filter.key]], false)}
                                        </span>
                                    {/if}
                                {:else if filter.mode === 'UNIQUE'}
                                    {#if Array.isArray(activeFilters[filter.key]) && activeFilters[filter.key].length > 0}
                                        <span class="inline-flex items-center">
                                            {format(filter.key, [activeFilters[filter.key][0]], false)}
                                        </span>
                                    {:else if typeof activeFilters[filter.key] === 'string'}
                                        <span class="inline-flex items-center">
                                            {format(filter.key, [activeFilters[filter.key]], false)}
                                        </span>
                                    {/if}
                                {/if}
                            </span>
                        {/if}
                    </div>
                </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content class="px-4 py-4" transition={contentTransition}>
                <!-- **Search Input (if enabled)** -->
                {#if filterOverrides[filter.key]?.type === 'search'}
                    <div class="w-max-[100px] mb-2">
                        <Input
                            type="text"
                            placeholder={`Search ${filter.humanReadableName}`}
                            on:input={(e) => {
                                if (e.target instanceof HTMLInputElement) {
                                    const searchTerm = e.target.value;
                                    handleSearchInput(filter.key, searchTerm);
                                }
                            }}
                        />
                    </div>
                {/if}

                <!-- **Filter Mode Toggle Buttons** -->
                <div class="filter-mode-toggle mb-2">
                    {#if filter.type !== 'boolean'}
                        {#if filter.type === 'array'}
                            <Button size="small"
                                variant="secondary"
                                class="{buttonClass} {filter.mode === 'AND' ? 'active' : ''}"
                                on:click={() => setFilterMode(filter.key, 'AND')}
                            >
                                AND
                            </Button>
                        {/if}
                        <Button size="small"
                            variant="secondary"
                            class="{buttonClass} {filter.mode === 'OR' ? 'active' : ''}"
                            on:click={() => setFilterMode(filter.key, 'OR')}
                        >
                            OR
                        </Button>
                        <Button size="small"
                            variant="secondary"
                            class="{buttonClass} {filter.mode === 'UNIQUE' ? 'active' : ''}"
                            on:click={() => setFilterMode(filter.key, 'UNIQUE')}
                        >
                            UNIQUE
                        </Button>
                    {/if}
                    <!-- Clear Button for Each Filter Group -->
                    <Button size="small" on:click={() => clearFilter(filter.key)} class="{buttonClass}" variant="destructive">
                        Clear
                    </Button>
                </div>
                

                <!-- **Filter Options** -->
                <div class="filter-options">
                    {#if filter.type === 'boolean'}
                        <!-- Boolean Filters -->
                        <Button size="small" 
                            variant="secondary" 
                            on:click={() => applyFilter(filter.key, true)} 
                            class="{buttonClass} { ($filters[filter.key] === true) ? buttonClassSelected : '' }"
                            disabled={$disabledFilters[filter.key]?.has('true')}
                            >
                            Yes
                        </Button>
                        <Button size="small" 
                            variant="secondary" 
                            on:click={() => applyFilter(filter.key, false)} 
                            class="{buttonClass}  { ($filters[filter.key] === false) ? buttonClassSelected : '' }"
                            disabled={$disabledFilters[filter.key]?.has('false')}
                            >
                            No
                        </Button>
                    {:else if filter.type === 'string'}
                        {#if filterOverrides[filter.key]?.type !== 'search'}
                            <!-- Search Input for Non-Search Overrides -->
                            <div class="w-max-[100px] mb-2">
                                <Input
                                    type="text"
                                    placeholder={`Search ${filter.humanReadableName}`}
                                    bind:value={filter.searchTerm}
                                    on:input={(e) => {
                                        filter.searchTerm = e.target.value;
                                        filter.filteredDistinctValues = filter.distinctValues.filter(val => val.toLowerCase().includes(filter.searchTerm.toLowerCase()));
                                        ////console.log(`Filter [${filter.key}] searchTerm updated to:`, filter.searchTerm);
                                    }}
                                />
                            </div>
                            <!-- Display Filter Buttons -->
                            {#if filter.filteredDistinctValues.length > 0}
                                {#each filter.filteredDistinctValues.slice(0, $showAllFilters[filter.key] ? undefined : maxBadgeLength) as value (value)}
                                    <Button size="small"
                                        variant="secondary"
                                        on:click={() => applyFilter(filter.key, value)}
                                        class="{buttonClass} { 
                                            (Array.isArray($filters[filter.key]) && $filters[filter.key].includes(value)) ||
                                            ($filters[filter.key] === value)
                                                ? buttonClassSelected 
                                                : '' 
                                        }"
                                        disabled={$disabledFilters[filter.key]?.has(String(value).toLowerCase())}
                                    >
                                        {@html $config.filterFormatters?.[filter.key]?.(value) || value}
                                    </Button>
                                {/each}
                                {#if filter.filteredDistinctValues.length > maxBadgeLength}
                                    <a href="#" 
                                        on:click|preventDefault={() => toggleShowAllBadges(filter.key)} 
                                        class="my-3 text-sm text-center relative more-link block py-2 text-black/70 dark:text-white/70 bg-black/5 dark:bg-white/5 no-underline font-bold hover:text-white/60  hover:bg-black/10 dark:bg-white/10"
                                        >
                                        {#if $showAllFilters[filter.key]}
                                            <span class="absolute left-2">⇈</span>
                                            Less
                                            <span class="absolute right-2">⇈</span>
                                        {:else}
                                            <span class="absolute left-2">⇊</span>
                                            More
                                            <span class="absolute right-2">⇊</span>
                                        {/if}
                                    </a>
                                {/if}
                            {:else}
                                <div>No options found.</div>
                            {/if}
                        {/if}
                    {:else if filter.type === 'array'}
                        {#if filterOverrides[filter.key]?.type !== 'search'}
                            <!-- Search Input for Array Filters -->
                            <div class="w-max-[100px] mb-2">
                                <Input
                                    type="text"
                                    placeholder={`Search ${filter.humanReadableName}`}
                                    bind:value={filter.searchTerm}
                                    on:input={(e) => {
                                        filter.searchTerm = e.target.value;
                                        filter.filteredDistinctValues = filter.distinctValues.filter(val => val.toLowerCase().includes(filter.searchTerm.toLowerCase()));
                                        ////console.log(`Filter [${filter.key}] searchTerm updated to:`, filter.searchTerm);
                                    }}
                                />
                            </div>
                            <!-- Display Array Filter Buttons -->
                            {#if filter.filteredDistinctValues.length > 0}
                                {#each filter.filteredDistinctValues.slice(0, $showAllFilters[filter.key] ? undefined : maxBadgeLength) as value (value)}
                                    <Button size="small"
                                        variant="secondary"
                                        on:click={() => applyFilter(filter.key, value)}
                                        class="{buttonClass} { 
                                            (Array.isArray($filters[filter.key]) && $filters[filter.key].includes(value)) 
                                                ? buttonClassSelected 
                                                : '' 
                                        }"
                                        disabled={$disabledFilters[filter.key]?.has(String(value).toLowerCase())}
                                    >
                                        {$config.filterFormatters?.[filter.key]?.(value) || value}
                                    </Button>
                                {/each}
                                {#if filter.filteredDistinctValues.length > maxBadgeLength}
                                <a href="#" 
                                on:click|preventDefault={() => toggleShowAllBadges(filter.key)} 
                                class="my-3 text-sm text-center relative more-link block py-2 text-black/70 dark:text-white/70 bg-black/5 dark:bg-white/5 no-underline font-bold hover:text-white/60  hover:bg-black/10 dark:bg-white/10"
                                >
                                    {#if $showAllFilters[filter.key]}
                                        <span class="absolute left-2">⇈</span>
                                        Less
                                        <span class="absolute right-2">⇈</span>
                                    {:else}
                                        <span class="absolute left-2">⇊</span>
                                        More
                                        <span class="absolute right-2">⇊</span>
                                    {/if}
                                </a>
                                {/if}
                            {:else}
                                <div>No options found.</div>
                            {/if}
                        {/if}
                    {:else if filter.type === 'number'}
                        {#each filter.conditions as condition}
                            <div class="number-filter-option">
                                <Input
                                    type="number"
                                    placeholder={`${condition} ${filter.humanReadableName}`}
                                    on:input={(e) => {
                                        if (e.target instanceof HTMLInputElement) {
                                            const inputValue = parseFloat(e.target.value);
                                            if (!isNaN(inputValue)) {
                                                // Update the filter condition
                                                filters.update(currentFilters => ({
                                                    ...currentFilters,
                                                    [filter.key]: {
                                                        ...currentFilters[filter.key],
                                                        [condition]: inputValue
                                                    }
                                                }));
                                                ////console.log(`Filter [${filter.key}] condition [${condition}] set to:`, inputValue);
                                            } else {
                                                // Clear the specific condition if input is invalid
                                                filters.update(currentFilters => {
                                                    if (currentFilters[filter.key]) {
                                                        const { [condition]: _, ...rest } = currentFilters[filter.key];
                                                        return { ...currentFilters, [filter.key]: rest };
                                                    }
                                                    return currentFilters;
                                                });
                                                ////console.log(`Filter [${filter.key}] condition [${condition}] cleared.`);
                                            }
                                        }
                                    }}
                                />
                            </div>
                        {/each}
                    {/if}
                    
                </div>
            </Accordion.Content>
        </Accordion.Item>
    {/each}
</Accordion.Root>

<style>
    .active-filters {
        margin-bottom: 1rem;
    }
    .active-filters-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
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
    /* Style for clear buttons inside badges */
    .active-filters-list .badge button {
        padding: 0;
        margin-left: 0.25rem;
        font-size: 0.75rem;
    }
    /* Disabled buttons styling */
    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
