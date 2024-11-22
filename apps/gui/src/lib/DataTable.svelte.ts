type ValueGetter<T, V> = (row: T) => V;
type Sorter<T, V> = (a: V, b: V, rowA: T, rowB: T) => number;
type Filter<T, V> = (value: V, filterValue: V, row: T) => boolean;
type Formatter<T, V> = (value: V, row: T) => any;

/**
 * Represents a data table with sorting, filtering, and pagination capabilities.
 * @template T The type of data items in the table.
 */
export interface ColumnDef<T, V = any> {
  id: string;
  key: keyof T;
  name: string;
  sortable?: boolean;
  getValue?: ValueGetter<T, V>;
  sorter?: Sorter<T, V>;
  filter?: Filter<T, V>;
  formatter?: Formatter<T, V>;
}

type SortDirection = 'asc' | 'desc' | null;

type TableConfig<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  pageSize?: number;
  initialSort?: string;
  initialSortDirection?: SortDirection;
  initialFilters?: { [id: string]: any[] };
};

/**
 * Represents a data table with sorting, filtering, and pagination capabilities.
 * @template T The type of data items in the table.
 */
export class DataTable<T> {
  #columns: ColumnDef<T>[];
  #pageSize: number;

  #originalData = $state<T[]>([]);
  #currentPage = $state(1);
  #sortState = $state<{ columnId: string | null; direction: SortDirection }>({
    columnId: null,
    direction: null
  });
  #filterState = $state<{ [id: string]: Set<any> }>({});
  #globalFilter = $state<string>('');

  #globalFilterRegex: RegExp | null = null;
  #isFilterDirty = true;
  #isSortDirty = true;
  #filteredData: T[] = [];
  #sortedData: T[] = [];

  /**
   * Creates a new DataTable instance.
   * @param {TableConfig<T>} config - The configuration object for the data table.
   */
  constructor(config: TableConfig<T>) {
    this.#originalData = [...config.data];
    this.#columns = config.columns;
    this.#pageSize = config.pageSize || 10;
    if (config.initialSort) {
      this.#sortState = {
        columnId: config.initialSort,
        direction: config.initialSortDirection || 'asc'
      };
    }
    this.#initializeFilterState(config.initialFilters);
  }

  #initializeFilterState(initialFilters?: { [id: string]: any[] }) {
    this.#columns.forEach((column) => {
      const initialFilterValues = initialFilters?.[column.id];
      if (initialFilterValues) {
        this.#filterState[column.id] = new Set(initialFilterValues);
      } else {
        this.#filterState[column.id] = new Set();
      }
    });
  }

  #getColumnDef(id: string): ColumnDef<T> | undefined {
    return this.#columns.find((col) => col.id === id);
  }

  #getValue(row: T, columnId: string): any {
    const colDef = this.#getColumnDef(columnId);
    if (!colDef) return undefined;
    return colDef.getValue ? colDef.getValue(row) : row[colDef.key];
  }

  #getFormattedValue(row: T, columnId: string): any {
    const colDef = this.#getColumnDef(columnId);
    if (!colDef) return undefined;
    const value = this.#getValue(row, columnId);
    return colDef.formatter ? colDef.formatter(value, row) : value;
  }

  #matchesGlobalFilter = (row: T): boolean => {
    if (!this.#globalFilterRegex) return true;

    return this.#columns.some((col) => {
      const value = this.#getValue(row, col.id);
      return typeof value === 'string' && this.#globalFilterRegex!.test(value);
    });
  };

  #matchesFilters = (row: T): boolean => {
    return Object.entries(this.#filterState).every(([columnId, filterSet]) => {
      if (!filterSet || filterSet.size === 0) return true;

      const colDef = this.#getColumnDef(columnId);
      if (!colDef) return true;

      const value = this.#getValue(row, columnId);

      if (colDef.filter) {
        for (const filterValue of filterSet) {
          if (colDef.filter(value, filterValue, row)) {
            return true;
          }
        }
        return false;
      }

      return filterSet.has(value);
    });
  };

  #applyFilters() {
    if (!this.#isFilterDirty) return;

    this.#filteredData = this.#originalData.filter(
      (row) => this.#matchesGlobalFilter(row) && this.#matchesFilters(row)
    );
    this.#isFilterDirty = false;
    this.#isSortDirty = true;
  }

  #applySort() {
    if (!this.#isSortDirty) return;

    const { columnId, direction } = this.#sortState;
    if (columnId && direction) {
      const colDef = this.#getColumnDef(columnId);
      this.#sortedData = [...this.#filteredData].sort((a, b) => {
        const aVal = this.#getValue(a, columnId);
        const bVal = this.#getValue(b, columnId);

        if (aVal === undefined || aVal === null) return direction === 'asc' ? 1 : -1;
        if (bVal === undefined || bVal === null) return direction === 'asc' ? -1 : 1;

        if (colDef && colDef.sorter) {
          return direction === 'asc'
            ? colDef.sorter(aVal, bVal, a, b)
            : colDef.sorter(bVal, aVal, b, a);
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }

        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      this.#sortedData = [...this.#filteredData];
    }
    this.#isSortDirty = false;
  }

  /**
   * Returns all filtered and sorted rows without pagination.
   * @returns {T[]} An array of all filtered and sorted rows.
   */
  get allRows() {
    // React to changes in original data, filter state, and sort state
    this.#originalData;
    this.#sortState;
    this.#filterState;
    this.#globalFilter;

    this.#applyFilters();
    this.#applySort();

    return this.#sortedData;
  }

  /**
   * The current page of rows based on applied filters and sorting.
   * @returns {T[]} An array of rows for the current page.
   */
  get rows() {
    const startIndex = (this.#currentPage - 1) * this.#pageSize;
    const endIndex = startIndex + this.#pageSize;
    return this.allRows.slice(startIndex, endIndex);
  }

  /**
   * The column definitions for the table.
   * @returns {ColumnDef<T>[]} An array of column definitions.
   */
  get columns() {
    return this.#columns;
  }

  /**
   * The current filter state for all columns.
   * @returns {{ [K in keyof T]: Set<any> }} An object representing the filter state that maps column keys to filter values.
   */
  get filterState() {
    return this.#filterState;
  }

  /**
   * Gets or sets the global filter string.
   * @returns {string} The current global filter string.
   */
  get globalFilter() {
    return this.#globalFilter;
  }

  /**
   * @param {string} value - The global filter string to set.
   */
  set globalFilter(value: string) {
    this.#globalFilter = value;

    try {
      this.#globalFilterRegex = value.trim() !== '' ? new RegExp(`(?:${value})`, 'i') : null;
    } catch (error) {
      console.error('Invalid regex pattern:', error);
      this.#globalFilterRegex = null;
    }

    this.#currentPage = 1;
    this.#isFilterDirty = true;
  }

  /**
   * Toggles the sort direction for the specified column.
   * @param {string} columnId - The column id to toggle sorting for.
   */
  toggleSort = (columnId: string) => {
    const colDef = this.#getColumnDef(columnId);
    if (!colDef || colDef.sortable === false) return;

    this.#isSortDirty = true;
    if (this.#sortState.columnId === columnId) {
      this.#sortState = {
        columnId,
        direction:
          this.#sortState.direction === 'asc'
            ? 'desc'
            : this.#sortState.direction === 'desc'
            ? null
            : 'asc'
      };
    } else {
      this.#sortState = { columnId, direction: 'asc' };
    }
  };

  /**
   * Returns the formatted value for a given row and column.
   * @param {T} row - The data row.
   * @param {string} columnId - The column id.
   * @returns {any} The formatted value.
   */
  getFormattedValue = (row: T, columnId: string): any => {
    return this.#getFormattedValue(row, columnId);
  };
}