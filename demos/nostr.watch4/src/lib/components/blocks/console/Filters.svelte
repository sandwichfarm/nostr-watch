<script lang="ts">
    import { get } from 'svelte/store';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Button } from '$lib/components/ui/button2/index.js';
    import MiniSearch from 'minisearch';
	import { softwares } from '$lib/stores/softwares.js';
	import { filterFormatters } from './config.js';

    export let tableData;
    export let filtersInclude: string[];
    export let humanReadableNames: Record<string, string>;
    export let filterOverrides: Record<string, { type: 'search' | 'badge', miniSearchOptions?: any }> = {};
    export let maxBadgeLength: number = 10;
    export let filters; // Writable store passed from the parent component
    
    import { Accordion } from 'radix-svelte';
    let rootValue;
	let rootType = "single";
	let rootDisabled: boolean;
	let itemValue: string;
	let contentTransition: boolean = true;


    type FilterCondition = '=' | '<' | '>' | '!=';

    interface ConsoleFilterBase {
        key: string;
        humanReadableName?: string;
        showAll?: boolean;
        searchTerm?: string;
        filteredDistinctValues?: string[];
    }

    interface BooleanFilter extends ConsoleFilterBase {
        type: 'boolean';
    }

    interface NumberFilter extends ConsoleFilterBase {
        type: 'number';
        conditions: FilterCondition[];
    }

    interface StringFilter extends ConsoleFilterBase {
        type: 'string';
        distinctValues: string[];
        showAll?: boolean;
        searchTerm?: string;
        filteredDistinctValues?: string[];
    }

    interface ConsoleFilterBase {
        key: string;
        humanReadableName?: string;
        showAll?: boolean;
        searchTerm?: string;
        filteredDistinctValues?: string[];
        mode: 'AND' | 'OR'; // Added mode property
    }


    type ConsoleFilter = BooleanFilter | NumberFilter | StringFilter;

    let relayFilters: ConsoleFilter[] = [];

    $: {
        const data = get(tableData).data;
        relayFilters = createRelayFilters(data, filtersInclude, humanReadableNames);
    }

    function createRelayFilters(
        data: any[],
        filtersInclude: string[],
        humanReadableNames: Record<string, string>
    ): ConsoleFilter[] {
        if (data.length === 0) {
            return [];
        }
        return Object.keys(data[0])
            .filter((key) => filtersInclude.includes(key))
            .map((key) => createFilter(key, data, humanReadableNames))
            .filter((filter): filter is ConsoleFilter => filter !== null);
    }

    function createFilter(
        key: string,
        data: any[],
        humanReadableNames: Record<string, string>
    ): ConsoleFilter | null {
        const firstValue = data.find((item) => item[key] !== null && item[key] !== undefined)?.[key];
        const humanReadableName = humanReadableNames[key] ?? key;

        let mode: 'AND' | 'OR' = 'OR'; // Default mode

        if (typeof firstValue === 'boolean') {
            mode = 'OR'; // Boolean filters must use OR
        }

        if (typeof firstValue === 'boolean') {
            return {
                key,
                humanReadableName,
                type: 'boolean',
                mode, // Set mode
            };
        } else if (typeof firstValue === 'number') {
            return {
                key,
                humanReadableName,
                type: 'number',
                conditions: ['=', '<', '>'],
                mode, // Set mode
            };
        } else if (typeof firstValue === 'string') {
            const distinctValues = Array.from(new Set(data.map((item) => item[key]).filter((val) => typeof val === 'string')));
            return {
                key,
                humanReadableName,
                type: 'string',
                distinctValues,
                showAll: false,
                searchTerm: '',
                filteredDistinctValues: distinctValues,
                mode, // Set mode
            };
        }

        return null;
    }


    let miniSearchInstances: Record<string, MiniSearch> = {};

    function initializeMiniSearch(filterKey: string, data: any[], options: any) {
        if (!miniSearchInstances[filterKey]) {
            const miniSearch = new MiniSearch({
                fields: [filterKey],
                storeFields: [filterKey],
                ...options

            });
            miniSearch.addAll(data);
            miniSearchInstances[filterKey] = miniSearch;
        }
    }

    function toggleShowAllBadges(filterKey: string) {
        relayFilters = relayFilters.map(filter => {
            if (filter.key === filterKey && 'distinctValues' in filter) {
                return { ...filter, showAll: !filter.showAll };
            }
            return filter;
        });
    }

    function applyFilter(filterKey: string, value: any) {
        const filter = relayFilters.find(f => f.key === filterKey);
        if (!filter) return;

        const mode = filter.mode;

        filters.update(currentFilters => {
            const existingFilter = currentFilters[filterKey];

            if (filter.type === 'boolean') {
                // Boolean filters use OR logic (single selection)
                if (existingFilter === value) {
                    const { [filterKey]: _, ...rest } = currentFilters;
                    return rest;
                } else {
                    return { ...currentFilters, [filterKey]: value };
                }
            }

            if (mode === 'OR') {
                // OR mode allows only one selection
                if (existingFilter === value) {
                    const { [filterKey]: _, ...rest } = currentFilters;
                    return rest;
                } else {
                    return { ...currentFilters, [filterKey]: [value] };
                }
            } else if (mode === 'AND') {
                // AND mode allows multiple selections
                if (Array.isArray(existingFilter)) {
                    const index = existingFilter.indexOf(value);
                    if (index === -1) {
                        return { ...currentFilters, [filterKey]: [...existingFilter, value] };
                    } else {
                        const newValues = [...existingFilter];
                        newValues.splice(index, 1);
                        if (newValues.length === 0) {
                            const { [filterKey]: _, ...rest } = currentFilters;
                            return rest;
                        }
                        return { ...currentFilters, [filterKey]: newValues };
                    }
                } else if (existingFilter !== undefined) {
                    if (existingFilter === value) {
                        const { [filterKey]: _, ...rest } = currentFilters;
                        return rest;
                    } else {
                        return { ...currentFilters, [filterKey]: [existingFilter, value] };
                    }
                } else {
                    return { ...currentFilters, [filterKey]: [value] };
                }
            }

            return currentFilters;
        });
    }


    function setFilterMode(filterKey: string, mode: 'AND' | 'OR') {
        relayFilters = relayFilters.map(filter => {
            if (filter.key === filterKey && filter.type !== 'boolean') {
                return { ...filter, mode };
            }
            return filter;
        });
        // Optionally, clear existing selections if switching to OR mode
        if (mode === 'OR') {
            filters.update(currentFilters => {
                const existingFilter = currentFilters[filterKey];
                if (Array.isArray(existingFilter) && existingFilter.length > 1) {
                    // Keep only the first selection
                    return { ...currentFilters, [filterKey]: [existingFilter[0]] };
                }
                return currentFilters;
            });
        }
    }


    function clearFilter(filterKey: string) {
        filters.update(currentFilters => {
            const { [filterKey]: _, ...rest } = currentFilters;
            return rest;
        });
    }

    function isSelected(filterKey: string, value: any) {
        const filterValues = get(filters)[filterKey];
        if (typeof filterValues === 'function') {
            return false;
        }
        return filterValues && filterValues.includes(value);
    }

    function clearAllFilters() {
        filters.set({});
    }

    const format = (key: string, values: string[]) => {
        return values.map((value: string) => filterFormatters?.[key]?.(value) || value)
    }

    $: activeFilters = $filters;
    $: buttonClass = `mb-2 mr-2 text-sm font-bold py-0 px-1`;
    $: buttonClassSelected = ``;
</script>
<br /><br /><br /><br />


{#if Object.keys(activeFilters).length > 0}
    <div class="active-filters">
        <h4>Active Filters:</h4>
        <div class="active-filters-list">
            {#each Object.entries(activeFilters) as [key, value]}
                <div class="active-filter">
                    {#if typeof value === 'function'}
                        [Custom Filter]
                    {:else}
                        {format(key, value).join(', ')}
                    {/if}
                    <Button size="small" variant="link" on:click={() => clearFilter(key)}>✕</Button>
                </div>
            {/each}
        </div>
        <Button size="small" variant="destructive" on:click={clearAllFilters} class="{buttonClass}">
            Clear All Filters
        </Button>
    </div>
{/if}

<!-- <div class="max-w-[90%] text-wrap flex-wrap"> -->
<Accordion.Root
    class="overflow-x-hidden"
    bind:value={rootValue}
    type={rootType}
    disabled={rootDisabled} >

    {#each relayFilters as filter (filter.key)}
        <!-- <div class="filter-block"> -->
        <Accordion.Item class="accordion-item max-h-none overflow-x-auto" value={filter.key}>
            <Accordion.Header class="py-2 px-2 border-b-2">
                <Accordion.Trigger>
                    <h3>{filter.humanReadableName}</h3>
                </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content class="py-1 px-2" transition={contentTransition}>
                <div class="max-w-[90%]">
                    {#if filterOverrides[filter.key]?.type === 'search'}
                        <div class="max-w-[100px]">
                            <Input
                                class="inline-block"
                                type="text"
                                placeholder={`Search ${filter.humanReadableName}`}
                                on:input={(e) => {
                                    if (e.target instanceof HTMLInputElement) {
                                        const searchTerm = e.target.value;
                                        initializeMiniSearch(filter.key, get(tableData).data, filterOverrides[filter.key]?.miniSearchOptions);
                                        const miniSearch = miniSearchInstances[filter.key];
                                        const results = miniSearch.search(searchTerm);
                                        const matchedValues = results.map(result => result[filter.key]);
                                        filters.update(currentFilters => ({ ...currentFilters, [filter.key]: matchedValues }));
                                    }
                                }}
                            />
                        </div>
                    {/if}
                </div>
                <div class="filter-mode-toggle">
                    {#if filter.type !== 'boolean'}
                        <Button size="small"
                            variant="secondary"
                            class="{buttonClass} {filter.mode === 'AND' ? 'active' : ''}"
                            on:click={() => setFilterMode(filter.key, 'AND')}
                        >
                            AND
                        </Button>
                        <Button size="small"
                            variant="secondary"
                            class="{buttonClass} {filter.mode === 'OR' ? 'active' : ''}"
                            on:click={() => setFilterMode(filter.key, 'OR')}
                        >
                            OR
                        </Button>
                    {/if}
                </div>

                <div class="filter-options">
                    {#if filter.type === 'boolean'}
                        <Button size="small" 
                            variant="secondary" 
                            on:click={() => applyFilter(filter.key, true)} 
                            class="{ isSelected(filter.key, true) ? buttonClassSelected : '' }"
                            >
                            Yes
                        </Button>
                        <Button size="small" 
                            variant="secondary" 
                            on:click={() => applyFilter(filter.key, false)} 
                            class="{ isSelected(filter.key, false) ? buttonClassSelected : '' }">
                            No
                        </Button>
                    {:else if filter.type === 'string'}
                        {#if filterOverrides[filter.key]?.type !== 'search'}
                            <!-- <Input
                                type="text"
                                placeholder={`Search ${filter.humanReadableName}`}
                                on:input={(e) => {
                                    if (e.target instanceof HTMLInputElement) {
                                        const searchTerm = e.target.value;
                                        initializeMiniSearch(filter.key, get(tableData).data, filterOverrides[filter.key]?.miniSearchOptions);
                                        const miniSearch = miniSearchInstances[filter.key];
                                        const results = miniSearch.search(searchTerm);
                                        const matchedValues = results.map(result => result[filter.key]);
                                        filters.update(currentFilters => ({ ...currentFilters, [filter.key]: matchedValues }));
                                    }
                                }}
                            />
                        {:else} -->
                            <div class="w-max-[100px]">
                                <Input
                                    type="text"
                                    placeholder={`Search ${filter.humanReadableName}`}
                                    bind:value={filter.searchTerm}
                                    on:input={(e) => {
                                        filter.searchTerm = e.target.value;
                                        filter.filteredDistinctValues = filter.distinctValues.filter(val => val.toLowerCase().includes(filter.searchTerm.toLowerCase()));
                                    }}
                                />
                            </div>
                            {#if filter.filteredDistinctValues.length > 0}
                                {#each filter.filteredDistinctValues.slice(0, filter.showAll ? undefined : maxBadgeLength) as value (value)}
                                    <Button size="small"
                                        variant="secondary"
                                        on:click={() => applyFilter(filter.key, value)}
                                        class="{buttonClass} { isSelected(filter.key, value) ? buttonClassSelected : '' }">
                                        {filterFormatters?.[filter.key]?.(value) || value}
                                    </Button>
                                {/each}
                                {#if filter.filteredDistinctValues.length > maxBadgeLength}
                                    <a href="#" on:click|preventDefault={() => toggleShowAllBadges(filter.key)} class="more-link">
                                        {filter.showAll ? 'Less' : 'More'}
                                    </a>
                                {/if}
                            {:else}
                                <div>No options found.</div>
                            {/if}
                        {/if}
                    {:else if filter.type === 'number'}
                        {#each filter.conditions || [] as condition}
                            <div class="number-filter-option">
                                <Input
                                    type="number"
                                    placeholder={`${condition} ${filter.humanReadableName}`}
                                    on:input={(e) => {
                                        if (e.target instanceof HTMLInputElement) {
                                            const inputValue = parseFloat(e.target.value);
                                            if (!isNaN(inputValue)) {
                                                filters.update(currentFilters => ({
                                                    ...currentFilters,
                                                    [filter.key]: (value) => {
                                                        if (condition === '=') return value === inputValue;
                                                        if (condition === '<') return value < inputValue;
                                                        if (condition === '>') return value > inputValue;
                                                        if (condition === '!=') return value !== inputValue;
                                                        return true;
                                                    }
                                                }));
                                            } else {
                                                clearFilter(filter.key);
                                            }
                                        }
                                    }}
                                />
                            </div>
                        {/each}
                    {/if}
                    <Button size="small" on:click={() => clearFilter(filter.key)} class="{buttonClass}" variant="destructive">
                        Clear
                    </Button>
                </div>
            </Accordion.Content>
        </Accordion.Item>
    {/each}
</Accordion.Root>
<!-- </div> -->

<style>
 /* .filters-container {
    @apply flex flex-wrap gap-4 py-4;
}
.filter-block {
    @apply border-none rounded-lg p-4 min-w-[200px];
}
.filter-title {
    @apply mb-2 font-bold;
}
.filter-options > button {
    @apply mr-2 mb-2;
} */

/* .clickable-badge {
    @apply text-xs p-1 mt-1;
}

.clickable-badge:hover {
    @apply bg-red-200;
}
.clickable-badge
.clear-filter-badge {
    @apply cursor-pointer p-2 bg-red-200;
}
.clear-all-filters {
    @apply mt-4 bg-red-300;
} */
.more-link {
    @apply cursor-pointer text-blue-500 underline mt-2;
}
.active-filters {
    @apply mt-4;
}
.active-filters-list {
    @apply flex flex-wrap gap-2;
}
.active-filter {
    @apply p-2 rounded flex items-center gap-2;
}
.filter-mode-toggle Button.active {
    @apply bg-blue-500 text-white;
}
/* button {
    @apply text-sm font-bold p-1 mt-1;
} */


/* .contents {
    --line-color: theme('colors.gray.300');

    :global(.accordion-item) {
        @apply mt-px overflow-hidden first:mt-0 first:rounded-t last:rounded-b 
        focus-within:relative focus-within:z-10 focus-within:ring-2 focus-within:ring-black;
    }

    :global(.accordion-trigger) {
        @apply flex h-12 flex-1  cursor-pointer items-center
        justify-between bg-white px-5 text-base font-medium leading-none shadow-[0_1px_0]
        shadow-[--line-color] outline-none hover:bg-gray-200;
    }

    :global(.accordion-content) {
        @apply overflow-hidden bg-gray-100 text-sm text-gray-900;
    }
} */

</style>

