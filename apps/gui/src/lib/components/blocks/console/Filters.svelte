<script lang="ts">
    import { get } from 'svelte/store';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Button } from '$lib/components/ui/button2/index.js';
    import MiniSearch from 'minisearch';
    import { Accordion } from 'radix-svelte';
    import type { Writable } from 'svelte/store';

    import { filterFormatters } from './config.js';
    import Badge from '$lib/components/ui/badge/badge.svelte';

    // **Props Passed to the Component**
    export let tableData: Writable<{ data: any[] }>;
    export let filtersInclude: string[];
    export let humanReadableNames: Record<string, string>;
    export let filterOverrides: Record<string, { type: 'search' | 'badge', miniSearchOptions?: any }> = {};
    export let maxBadgeLength: number = 10;
    export let filters: Writable<Record<string, any>>; // Writable store passed from the parent component

    // **Accordion States**
    let rootValue;
    let rootType: "single" | "multiple" = "multiple"; // Allows multiple accordion items to be open
    let rootDisabled: boolean = false;
    let contentTransition: boolean = true;

    // **Filter Conditions for Number Filters**
    type FilterCondition = '=' | '<' | '>' | '!=';

    // **Base Interface for All Filters**
    interface ConsoleFilterBase {
        key: string;
        humanReadableName: string;
        showAll?: boolean;
        searchTerm?: string;
        filteredDistinctValues?: string[];
        mode: 'AND' | 'OR' | 'UNIQUE'; // Modes based on filter type
    }

    // **Specific Filter Types**
    interface BooleanFilter extends ConsoleFilterBase {
        type: 'boolean';
    }

    interface NumberFilter extends ConsoleFilterBase {
        type: 'number';
        conditions: FilterCondition[];
        inputValues: Record<FilterCondition, number | null>; // Stores input values for conditions
    }

    interface StringFilter extends ConsoleFilterBase {
        type: 'string';
        distinctValues: string[];
    }

    interface ArrayFilter extends ConsoleFilterBase {
        type: 'array';
        distinctValues: string[];
    }

    type ConsoleFilter = BooleanFilter | NumberFilter | StringFilter | ArrayFilter;

    let relayFilters: ConsoleFilter[] = [];

    // **Initialize relayFilters Whenever tableData or filtersInclude Changes**
    $: {
        const data = get(tableData).data;
        relayFilters = createRelayFilters(data, filtersInclude, humanReadableNames);
    }

    // **Function to Create Filters Based on Data**
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

    // **Function to Create a Single Filter Based on Key and Data**
    function createFilter(
        key: string,
        data: any[],
        humanReadableNames: Record<string, string>
    ): ConsoleFilter | null {
        const firstValue = data.find((item) => item[key] !== null && item[key] !== undefined)?.[key];
        const humanReadableName = humanReadableNames[key] ?? key;

        let mode: 'AND' | 'OR' | 'UNIQUE' = 'OR'; // Default mode

        // **Determine Mode Based on Filter Type**
        if (typeof firstValue === 'boolean') {
            mode = 'UNIQUE'; // Boolean filters allow only one selection
        }

        if (Array.isArray(firstValue)) {
            mode = 'AND'; // Array filters typically use AND
        }

        // **Return the Appropriate Filter Object**
        if (typeof firstValue === 'boolean') {
            return {
                key,
                humanReadableName,
                type: 'boolean',
                mode,
            };
        } else if (typeof firstValue === 'number') {
            return {
                key,
                humanReadableName,
                type: 'number',
                conditions: ['=', '<', '>', '!='],
                inputValues: {
                    '=': null,
                    '<': null,
                    '>': null,
                    '!=': null,
                },
                mode,
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
                mode,
            };
        } else if (Array.isArray(firstValue)) {
            const distinctValues = Array.from(
                new Set(
                    data
                        .flatMap((item) => item[key])
                        .filter((val) => typeof val === 'string')
                )
            );
            return {
                key,
                humanReadableName,
                type: 'array',
                distinctValues,
                showAll: false,
                searchTerm: '',
                filteredDistinctValues: distinctValues,
                mode,
            };
        }

        return null;
    }

    let miniSearchInstances: Record<string, MiniSearch> = {};

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
                id: item.id || JSON.stringify(item), // Ensure each document has a unique ID
                [filterKey]: Array.isArray(item[filterKey]) ? item[filterKey].join(' ') : item[filterKey]
            }));
            miniSearch.addAll(miniSearchData);
            miniSearchInstances[filterKey] = miniSearch;
        }
    }

    // **Toggle Show All for Filters with Many Options**
    function toggleShowAllBadges(filterKey: string) {
        relayFilters = relayFilters.map(filter => {
            if (filter.key === filterKey && 'showAll' in filter) {
                return { ...filter, showAll: !filter.showAll };
            }
            return filter;
        });
    }

    // **Apply a Filter Value Based on Its Type and Mode**
    function applyFilter(filterKey: string, value: any) {
        const filter = relayFilters.find(f => f.key === filterKey);
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
                    // OR mode allows multiple selections
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
                } else if (mode === 'AND') {
                    // AND mode requires all selected values to be present
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
                        if (Array.isArray(existingFilter) && existingFilter.includes(value)) {
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
                // This example assumes exact match; extend as needed
                if (typeof value === 'number') {
                    return { ...currentFilters, [filterKey]: value };
                }
            }

            return currentFilters;
        });
    }

    // **Set the Mode for a Specific Filter Group**
    function setFilterMode(filterKey: string, mode: 'AND' | 'OR' | 'UNIQUE') {
        relayFilters = relayFilters.map(filter => {
            if (filter.key === filterKey && filter.type !== 'boolean') {
                return { ...filter, mode };
            }
            return filter;
        });

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

    // **Clear a Specific Filter Group**
    function clearFilter(filterKey: string) {
        filters.update(currentFilters => {
            const { [filterKey]: _, ...rest } = currentFilters;
            return rest;
        });
    }

    // **Clear All Filters**
    function clearAllFilters() {
        filters.set({});
    }

    // **Format Filter Values Using Provided Formatters**
    const format = (key: string, values: string[]) => {
        return values.map((value: string) => filterFormatters?.[key]?.(value) || value);
    }

    // **Reactive Statement to Track Active Filters**
    $: activeFilters = $filters;

    // **Button Styling (Classes Only, No Styles Added)**
    $: buttonClass = `mb-2 mr-2 text-sm font-bold py-0 px-1`;
    $: buttonClassSelected = `bg-blue-500 text-white`;
    
    // **Helper Function to Format Active Filters List**
    function formatFiltersList(filter: ConsoleFilter): string {
        const filterValue = activeFilters[filter.key];
        if (!filterValue) return '';
        
        if (filter.type === 'boolean') {
            return filterValue ? 'Yes' : 'No';
        }
        
        if (filter.mode === 'OR' || filter.mode === 'AND') {
            const separator = filter.mode === 'AND' ? ' AND ' : ' OR ';
            if (Array.isArray(filterValue)) {
                return filterValue.map(val => format(filter.key, [val])[0]).join(separator);
            } else {
                return format(filter.key, [filterValue])[0];
            }
        }
        
        if (filter.mode === 'UNIQUE') {
            if (Array.isArray(filterValue)) {
                return filterValue.length > 0 ? format(filter.key, [filterValue[0]])[0] : '';
            } else {
                return format(filter.key, [filterValue])[0];
            }
        }
        
        return '';
    }

    // **Reactive Statement to Compute Filtered Data**
    $: filteredData = $tableData.data.filter(item => {
        return Object.entries(activeFilters).every(([key, filterValue]) => {
            const filter = relayFilters.find(f => f.key === key);
            if (!filter) return true;

            const itemValue = item[key];

            // **Boolean Filters**
            if (filter.type === 'boolean') {
                return itemValue === filterValue;
            }

            // **Number Filters**
            if (filter.type === 'number') {
                if (typeof filterValue === 'number') {
                    // Exact match; extend logic as needed
                    return itemValue === filterValue;
                }
                return true; // If no filter is applied
            }

            // **String Filters**
            if (filter.type === 'string') {
                if (filter.mode === 'OR' || filter.mode === 'UNIQUE') {
                    if (Array.isArray(filterValue)) {
                        return filterValue.includes(itemValue);
                    } else {
                        return itemValue === filterValue;
                    }
                } else if (filter.mode === 'AND') {
                    // Typically not applicable for string filters unless itemValue is an array
                    if (Array.isArray(filterValue) && Array.isArray(itemValue)) {
                        return filterValue.every(val => itemValue.includes(val));
                    }
                }
            }

            // **Array Filters**
            if (filter.type === 'array') {
                if (!Array.isArray(itemValue)) {
                    console.warn(`Expected itemValue to be an array for key "${key}", but got:`, itemValue);
                    return false; // Exclude items with invalid itemValue
                }
                if (filter.mode === 'OR') {
                    // At least one selected value is present
                    return (filterValue as string[]).some(val => itemValue.includes(val));
                } else if (filter.mode === 'AND') {
                    // All selected values must be present
                    return (filterValue as string[]).every(val => itemValue.includes(val));
                } else if (filter.mode === 'UNIQUE') {
                    // Exactly one selected value must be present
                    return (filterValue as string[]).length === 1 && itemValue.includes(filterValue[0]);
                }
            }

            return true;
        });
    });

    // **Watch and Log Filter Changes for Debugging**
    $: {
        console.log('Active Filters:', activeFilters);
        console.log('Filtered Data Count:', filteredData.length);
    }
</script>

<!-- IMPORTANT: SPACER -->
<div class="h-20"></div>    

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

<!-- **Active Filters Display** -->
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

    {#each relayFilters as filter (filter.key)}
        <Accordion.Item class="accordion-item max-h-none overflow-x-auto" value={filter.key}>
            <Accordion.Header class="py-2 px-2 border-b-2">
                <Accordion.Trigger>
                    <!-- **Modified Accordion Trigger Layout** -->
                    <div class="flex items-center w-full text-sm">
                        <!-- Filter Title -->
                        <span class="flex-shrink-0 overflow-hidden text-ellipsis">{filter.humanReadableName}</span>
                        
                        {#if activeFilters[filter.key]}
                            <!-- Badge with Count -->
                            <Badge class="ml-2 text-xs py-0.5 px-2 rounded-full">{Array.isArray(activeFilters[filter.key]) ? activeFilters[filter.key].length : 1}</Badge>
                            
                            <!-- List of Active Filters -->
                            <span class="ml-2 text-xs opacity-30">
                                {#if filter.mode === 'AND' || filter.mode === 'OR'}
                                    {#if Array.isArray(activeFilters[filter.key])}
                                        {#each activeFilters[filter.key] as value, index}
                                            {#if index > 0}
                                                {filter.mode === 'AND' ? ' AND ' : ' OR '}
                                            {/if}
                                            {format(filter.key, [value])}
                                        {/each}
                                    {:else}
                                        {format(filter.key, [activeFilters[filter.key]])}
                                    {/if}
                                {:else if filter.mode === 'UNIQUE'}
                                    {#if Array.isArray(activeFilters[filter.key]) && activeFilters[filter.key].length > 0}
                                        {format(filter.key, [activeFilters[filter.key][0]])}
                                    {:else if typeof activeFilters[filter.key] === 'string'}
                                        {format(filter.key, [activeFilters[filter.key]])}
                                    {/if}
                                {/if}
                            </span>
                        {/if}
                    </div>
                </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content class="py-1 px-2" transition={contentTransition}>
                <!-- **Search Input (if enabled)** -->
                {#if filterOverrides[filter.key]?.type === 'search'}
                    <div class="w-max-[100px] mb-2">
                        <Input
                            type="text"
                            placeholder={`Search ${filter.humanReadableName}`}
                            on:input={(e) => {
                                if (e.target instanceof HTMLInputElement) {
                                    const searchTerm = e.target.value;
                                    initializeMiniSearch(filter.key, get(tableData).data, filterOverrides[filter.key]?.miniSearchOptions);
                                    const miniSearch = miniSearchInstances[filter.key];
                                    const results = miniSearch.search(searchTerm);
                                    const matchedValues = results.map(result => result[filter.key]).filter(v => v !== undefined);
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
                </div>

                <!-- **Filter Options** -->
                <div class="filter-options">
                    {#if filter.type === 'boolean'}
                        <Button size="small" 
                            variant="secondary" 
                            on:click={() => applyFilter(filter.key, true)} 
                            class="{ ($filters[filter.key] === true) ? buttonClassSelected : '' }"
                            >
                            Yes
                        </Button>
                        <Button size="small" 
                            variant="secondary" 
                            on:click={() => applyFilter(filter.key, false)} 
                            class="{ ($filters[filter.key] === false) ? buttonClassSelected : '' }">
                            No
                        </Button>
                    {:else if filter.type === 'string'}
                        {#if filterOverrides[filter.key]?.type !== 'search'}
                            <!-- **Search Input for Non-Search Overrides** -->
                            <div class="w-max-[100px] mb-2">
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
                            <!-- **Display Filter Buttons** -->
                            {#if filter.filteredDistinctValues.length > 0}
                                {#each filter.filteredDistinctValues.slice(0, filter.showAll ? undefined : maxBadgeLength) as value (value)}
                                    <Button size="small"
                                        variant="secondary"
                                        on:click={() => applyFilter(filter.key, value)}
                                        class="{buttonClass} { 
                                            (Array.isArray($filters[filter.key]) && $filters[filter.key].includes(value)) ||
                                            ($filters[filter.key] === value)
                                                ? buttonClassSelected 
                                                : '' 
                                        }">
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
                    {:else if filter.type === 'array'}
                        {#if filterOverrides[filter.key]?.type !== 'search'}
                            <!-- **Search Input for Array Filters** -->
                            <div class="w-max-[100px] mb-2">
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
                            <!-- **Display Array Filter Buttons** -->
                            {#if filter.filteredDistinctValues.length > 0}
                                {#each filter.filteredDistinctValues.slice(0, filter.showAll ? undefined : maxBadgeLength) as value (value)}
                                    <Button size="small"
                                        variant="secondary"
                                        on:click={() => applyFilter(filter.key, value)}
                                        class="{buttonClass} { 
                                            (Array.isArray($filters[filter.key]) && $filters[filter.key].includes(value)) 
                                                ? buttonClassSelected 
                                                : '' 
                                        }">
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
                                            } else {
                                                // Clear the specific condition if input is invalid
                                                filters.update(currentFilters => {
                                                    if (currentFilters[filter.key]) {
                                                        const { [condition]: _, ...rest } = currentFilters[filter.key];
                                                        return { ...currentFilters, [filter.key]: rest };
                                                    }
                                                    return currentFilters;
                                                });
                                            }
                                        }
                                    }}
                                />
                            </div>
                        {/each}
                    {/if}
                    <!-- **Clear Button for Each Filter Group** -->
                    <Button size="small" on:click={() => clearFilter(filter.key)} class="{buttonClass}" variant="destructive">
                        Clear
                    </Button>
                </div>
            </Accordion.Content>
        </Accordion.Item>
    {/each}
</Accordion.Root>
