// **Filter Types and Interfaces**
export type FilterCondition = '=' | '<' | '>' | '!=';

export interface ConsoleFilterBase {
    key: string;
    humanReadableName: string;
    mode: 'AND' | 'OR' | 'UNIQUE'; // Modes based on filter type
}

export interface BooleanFilter extends ConsoleFilterBase {
    type: 'boolean';
}

export interface NumberFilter extends ConsoleFilterBase {
    type: 'number';
    conditions: FilterCondition[];
    inputValues: Record<FilterCondition, number | null>; // Stores input values for conditions
}

export interface StringFilter extends ConsoleFilterBase {
    type: 'string';
    distinctValues: string[];
    searchTerm: string;
    filteredDistinctValues: string[];
}

export interface ArrayFilter extends ConsoleFilterBase {
    type: 'array';
    distinctValues: string[];
    searchTerm: string;
    filteredDistinctValues: string[];
}

export type ConsoleFilter = BooleanFilter | NumberFilter | StringFilter | ArrayFilter;

// **Function to Create Filters Based on Data with Mode Preservation**
export function createRelayFilters(
    data: any[],
    filtersInclude: string[],
    humanReadableNames: Record<string, string>,
    existingFilters: ConsoleFilter[] = []
): ConsoleFilter[] {
    if (data.length === 0) {
        return [];
    }

    // Remove duplicate keys
    const uniqueKeys = Array.from(new Set(filtersInclude));

    return uniqueKeys
        .map((key) => {
            const existingFilter = existingFilters.find(f => f.key === key);
            const filter = createFilter(key, data, humanReadableNames, existingFilter);
            return filter;
        })
        .filter((filter): filter is ConsoleFilter => filter !== null);
}

// **Function to Create a Single Filter with Mode Preservation**
export function createFilter(
    key: string,
    data: any[],
    humanReadableNames: Record<string, string>,
    existingFilter?: ConsoleFilter
): ConsoleFilter | null {
    const firstValue = data.find((item) => item[key] !== null && item[key] !== undefined)?.[key];
    const humanReadableName = humanReadableNames[key] ?? key;

    let mode: 'AND' | 'OR' | 'UNIQUE' = 'OR'; // Default mode

    // Determine Mode Based on Filter Type
    if (typeof firstValue === 'boolean') {
        mode = 'UNIQUE'; // Boolean filters allow only one selection
    }

    if (Array.isArray(firstValue)) {
        mode = 'AND'; // Array filters typically use AND
    }

    // Preserve existing mode if filter already exists
    if (existingFilter) {
        mode = existingFilter.mode;
    }

    // Return the appropriate filter object
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
            searchTerm: '',
            filteredDistinctValues: distinctValues,
            mode,
        };
    }

    ////console.log(`nofilter: Filter type not supported for key "${key}"`);

    return null;
}

// **Function to Apply Filters to Data**
export function applyFilters(
    data: any[],
    activeFilters: Record<string, any>,
    relayFilters: ConsoleFilter[]
): any[] {
    return data.filter(item => {
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
                if (typeof filterValue === 'object' && filterValue !== null) {
                    // Handle range conditions
                    let result = true;
                    for (const [condition, value] of Object.entries(filterValue)) {
                        if (value === null) continue;
                        switch (condition) {
                            case '=':
                                result = result && itemValue === value;
                                break;
                            case '<':
                                result = result && itemValue < value;
                                break;
                            case '>':
                                result = result && itemValue > value;
                                break;
                            case '!=':
                                result = result && itemValue !== value;
                                break;
                            default:
                                break;
                        }
                    }
                    return result;
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
                    console.warn(`Expected array for key "${key}", but got:`, itemValue);
                    return false;
                }
                if (filter.mode === 'OR') {
                    const orResult = (filterValue as string[]).some(val => itemValue.includes(val));
                    return orResult;
                } else if (filter.mode === 'AND') {
                    const andResult = (filterValue as string[]).every(val => itemValue.includes(val));
                    return andResult;
                } else if (filter.mode === 'UNIQUE') {
                    const uniqueResult = (
                        Array.isArray(filterValue) &&
                        filterValue.length === 1 &&
                        itemValue.includes(filterValue[0])
                    );
                    return uniqueResult;
                }
            }

            return true;
        });
    });
}
