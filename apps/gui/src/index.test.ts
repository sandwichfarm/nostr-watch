import { describe, it, expect } from 'vitest';
import { DataTable, type ColumnDef } from '$lib/DataTable.svelte.js';

describe('DataTable', () => {
	const sampleData = [
		{ id: 1, name: 'Alice', age: 30 },
		{ id: 2, name: 'Bob', age: 25 },
		{ id: 3, name: 'Charlie', age: 35 },
		{ id: 4, name: 'David', age: 28 },
		{ id: 5, name: 'Eve', age: 32 }
	];

	const columns = [
		{ id: 'id', key: 'id', name: 'ID', sortable: true },
		{ id: 'name', key: 'name', name: 'Name', sortable: true },
		{ id: 'age', key: 'age', name: 'Age', sortable: true },
		{
			id: 'ageGroup',
			key: 'age',
			name: 'Age Group',
			sortable: true,
			getValue: (row) => (row.age < 30 ? 'Young' : 'Adult')
		}
	] satisfies ColumnDef<(typeof sampleData)[0]>[];

	describe('Initialization', () => {
		it('should initialize with default settings', () => {
			const table = new DataTable({ data: sampleData, columns });
			expect(table.rows).toHaveLength(5);
			expect(table.currentPage).toBe(1);
			expect(table.totalPages).toBe(1);
		});

		it('should initialize with custom page size', () => {
			const table = new DataTable({ data: sampleData, columns, pageSize: 2 });
			expect(table.rows).toHaveLength(2);
			expect(table.totalPages).toBe(3);
		});

		it('should initialize with initial sort', () => {
			const table = new DataTable({
				data: sampleData,
				columns,
				initialSort: 'age',
				initialSortDirection: 'desc'
			});
			expect(table.rows[0].age).toBe(35);
		});

		it('should initialize with initial filters', () => {
			const table = new DataTable({
				data: sampleData,
				columns,
				initialFilters: { age: [30, 35] }
			});
			expect(table.rows).toHaveLength(2);
			expect(table.rows.every((row) => row.age === 30 || row.age === 35)).toBe(true);
		});

		it('should handle empty data set', () => {
			const table = new DataTable({ data: [], columns });
			expect(table.rows).toHaveLength(0);
			expect(table.totalPages).toBe(1);
		});

		it('should handle data with missing properties', () => {
			const incompleteData = [
				{ id: 1, name: 'Alice' },
				{ id: 2, age: 25 }
			] as any[];
			const table = new DataTable({ data: incompleteData, columns });
			expect(table.rows).toHaveLength(2);
			expect(table.rows[0].age).toBeUndefined();
			expect(table.rows[1].name).toBeUndefined();
		});

		it('should handle multiple columns with the same key', () => {
			const table = new DataTable({ data: sampleData, columns });
			expect(table.columns).toHaveLength(4);
			expect(table.columns.filter((col) => col.key === 'age')).toHaveLength(2);
		});
	});

	describe('Sorting', () => {
		it('should sort ascending', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.toggleSort('age');
			expect(table.rows[0].age).toBe(25);
			expect(table.rows[4].age).toBe(35);
		});

		it('should sort descending', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.toggleSort('age');
			table.toggleSort('age');
			expect(table.rows[0].age).toBe(35);
			expect(table.rows[4].age).toBe(25);
		});

		it('should clear sort', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.toggleSort('age');
			table.toggleSort('age');
			table.toggleSort('age');
			expect(table.getSortState('age')).toBeNull();
		});

		it('should not sort unsortable columns', () => {
			const unsortableColumns = columns.map((col) => ({ ...col, sortable: false }));
			const table = new DataTable({ data: sampleData, columns: unsortableColumns });
			table.toggleSort('age');
			expect(table.getSortState('age')).toBeNull();
		});

		it('should maintain sort state when applying filters', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.toggleSort('age');
			table.setFilter('name', ['Alice', 'Bob', 'Charlie']);
			expect(table.rows[0].name).toBe('Bob');
			expect(table.rows[2].name).toBe('Charlie');
		});

		it('should handle repeated toggling of sort', () => {
			const table = new DataTable({ data: sampleData, columns });
			for (let i = 0; i < 10; i++) {
				table.toggleSort('age');
			}
			// After 10 toggles, we should be back to 'asc'
			expect(table.getSortState('age')).toBe('asc');
		});

		it('should handle sorting on column with all null values', () => {
			const nullData = [
				{ id: 1, name: 'Alice', age: null },
				{ id: 2, name: 'Bob', age: null },
				{ id: 3, name: 'Charlie', age: null }
			] as any[];
			const table = new DataTable({ data: nullData, columns });
			table.toggleSort('age');
			expect(table.rows).toHaveLength(3);
			// The order should remain unchanged
			expect(table.rows[0].name).toBe('Alice');
			expect(table.rows[2].name).toBe('Charlie');
		});

		it('should sort independently for columns with the same key', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.toggleSort('age');
			const ageSortState = table.getSortState('age');
			const ageGroupSortState = table.getSortState('ageGroup');
			expect(ageSortState).not.toBe(ageGroupSortState);
		});

		it('should handle sorting with custom getValue returning undefined', () => {
			const customColumns: ColumnDef<any>[] = [
				{
					id: 'customSort',
					key: 'value',
					name: 'Custom Sort',
					sortable: true,
					getValue: (row) => (row.value === 3 ? undefined : row.value)
				}
			];
			const customData = [
				{ id: 1, value: 3 },
				{ id: 2, value: 1 },
				{ id: 3, value: 2 }
			];
			const table = new DataTable({ data: customData, columns: customColumns });
			table.toggleSort('customSort');
			expect(table.rows[0].value).toBe(1);
			expect(table.rows[1].value).toBe(2);
			expect(table.rows[2].value).toBe(3);
		});

		it('should maintain sort stability for equal elements', () => {
			const data = [
				{ id: 1, value: 'A', order: 1 },
				{ id: 2, value: 'B', order: 2 },
				{ id: 3, value: 'A', order: 3 },
				{ id: 4, value: 'C', order: 4 },
				{ id: 5, value: 'B', order: 5 }
			];
			const columns: ColumnDef<(typeof data)[0]>[] = [
				{ id: 'value', key: 'value', name: 'Value', sortable: true },
				{ id: 'order', key: 'order', name: 'Order', sortable: true }
			];
			const table = new DataTable({ data, columns });
			table.toggleSort('value');
			expect(table.rows.map((r) => r.id)).toEqual([1, 3, 2, 5, 4]);
		});
	});

	describe('Enhanced Sorting', () => {
		const sampleData = [
			{ id: 1, name: 'Alice', age: 30, score: 85 },
			{ id: 2, name: 'Bob', age: 25, score: 92 },
			{ id: 3, name: 'Charlie', age: 35, score: 78 },
			{ id: 4, name: 'David', age: 28, score: 88 },
			{ id: 5, name: 'Eve', age: 32, score: 95 }
		];

		const columns: ColumnDef<(typeof sampleData)[0]>[] = [
			{ id: 'id', key: 'id', name: 'ID', sortable: true },
			{ id: 'name', key: 'name', name: 'Name', sortable: true },
			{ id: 'age', key: 'age', name: 'Age', sortable: true },
			{ id: 'score', key: 'score', name: 'Score', sortable: true },
			{
				id: 'complexSort',
				key: 'score',
				name: 'Complex Sort',
				sortable: true,
				getValue: (row) => row.score,
				sorter: (a, b, rowA, rowB) => {
					// Sort by score, but if scores are equal, sort by age
					if (a === b) {
						return rowA.age - rowB.age;
					}
					return b - a; // Descending order of scores
				}
			}
		];

		it('should sort using custom sorter with access to full row data', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.toggleSort('complexSort');
			expect(table.rows[0].name).toBe('Eve'); // Highest score
			expect(table.rows[1].name).toBe('Bob'); // Second highest score
			expect(table.rows[2].name).toBe('David'); // Third highest score
			expect(table.rows[3].name).toBe('Alice'); // Equal score with Charlie, but younger
			expect(table.rows[4].name).toBe('Charlie'); // Equal score with Alice, but older
		});

		it('should handle custom sorter with reverse direction', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.toggleSort('complexSort');
			table.toggleSort('complexSort'); // Toggle twice for descending order
			expect(table.rows[0].name).toBe('Charlie');
			expect(table.rows[1].name).toBe('Alice');
			expect(table.rows[2].name).toBe('David');
			expect(table.rows[3].name).toBe('Bob');
			expect(table.rows[4].name).toBe('Eve');
		});

		it('should use custom sorter with initial sort', () => {
			const table = new DataTable({
				data: sampleData,
				columns,
				initialSort: 'complexSort',
				initialSortDirection: 'desc'
			});
			expect(table.rows[0].name).toBe('Charlie');
			expect(table.rows[4].name).toBe('Eve');
		});

		it('should maintain custom sort when applying filters', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.toggleSort('complexSort');
			table.setFilter('age', [30, 32, 35]); // Filter out Bob and David
			expect(table.rows).toHaveLength(3);
			expect(table.rows[0].name).toBe('Eve');
			expect(table.rows[1].name).toBe('Alice');
			expect(table.rows[2].name).toBe('Charlie');
		});

		it('should handle custom sorter with all equal primary values', () => {
			const equalScoreData = sampleData.map((row) => ({ ...row, score: 90 }));
			const table = new DataTable({ data: equalScoreData, columns });
			table.toggleSort('complexSort');
			expect(table.rows[0].name).toBe('Bob'); // Youngest
			expect(table.rows[4].name).toBe('Charlie'); // Oldest
		});
	});

	describe('Filtering', () => {
		it('should apply single column filter', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.setFilter('age', [30, 35]);
			expect(table.rows).toHaveLength(2);
			expect(table.rows.every((row) => row.age === 30 || row.age === 35)).toBe(true);
		});

		it('should apply multiple column filters', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.setFilter('age', [30, 35]);
			table.setFilter('name', ['Alice', 'Charlie']);
			expect(table.rows).toHaveLength(2);
			expect(
				table.rows.every(
					(row) =>
						(row.age === 30 || row.age === 35) && (row.name === 'Alice' || row.name === 'Charlie')
				)
			).toBe(true);
		});

		it('should filter derived columns', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.setFilter('ageGroup', ['Young']);
			expect(table.rows).toHaveLength(2);
			expect(table.rows.every((row) => row.age < 30)).toBe(true);
		});

		it('should clear filter', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.setFilter('age', [30]);
			table.clearFilter('age');
			expect(table.rows).toHaveLength(5);
		});

		it('should toggle filter value', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.toggleFilter('age', 30);
			expect(table.rows).toHaveLength(1);
			table.toggleFilter('age', 30);
			expect(table.rows).toHaveLength(5);
		});

		it('should apply global filter', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.globalFilter = 'ali';
			expect(table.rows).toHaveLength(1);
			expect(table.rows[0].name).toBe('Alice');
		});

		it('should handle case-insensitive global filter', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.globalFilter = 'ALICE';
			expect(table.rows).toHaveLength(1);
			expect(table.rows[0].name).toBe('Alice');
		});

		it('should handle special characters in global filter', () => {
			const specialData = [
				{ id: 1, name: 'John (Manager)', age: 40 },
				{ id: 2, name: 'Jane [HR]', age: 35 }
			];
			const table = new DataTable({ data: specialData, columns });
			table.globalFilter = '(Manager)';
			expect(table.rows).toHaveLength(1);
			expect(table.rows[0].name).toBe('John (Manager)');
		});

		it('should handle custom filter function', () => {
			const customColumns = columns.map((col) =>
				col.key === 'age'
					? {
							...col,
							filter: (value, filterValue) => value >= filterValue
						}
					: col
			) satisfies ColumnDef<(typeof sampleData)[0]>[];
			const table = new DataTable({ data: sampleData, columns: customColumns });
			table.setFilter('age', [30]);
			expect(table.rows).toHaveLength(3);
			expect(table.rows.every((row) => row.age >= 30)).toBe(true);
		});

		it('should handle multiple rapid filter changes', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.setFilter('age', [30]);
			table.setFilter('name', ['Alice']);
			table.clearFilter('age');
			table.toggleFilter('name', 'Bob');
			expect(table.rows).toHaveLength(2);
			expect(table.rows.every((row) => row.name === 'Alice' || row.name === 'Bob')).toBe(true);
		});

		it('should filter independently for columns with the same key', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.setFilter('age', [30, 35]);
			table.setFilter('ageGroup', ['Young']);
			expect(table.rows).toHaveLength(0); // No rows match both filters
		});

		it('should handle filtering with complex custom filter function', () => {
			const customColumns: ColumnDef<any>[] = [
				{
					id: 'complexFilter',
					key: 'value',
					name: 'Complex Filter',
					filter: (value, filterValue, row) => {
						return value > filterValue && row.id % 2 === 0;
					}
				}
			];
			const customData = [
				{ id: 1, value: 10 },
				{ id: 2, value: 20 },
				{ id: 3, value: 30 },
				{ id: 4, value: 40 }
			];
			const table = new DataTable({ data: customData, columns: customColumns });
			table.setFilter('complexFilter', [15]);
			expect(table.rows).toHaveLength(2);
			expect(table.rows[0].id).toBe(2);
			expect(table.rows[1].id).toBe(4);
		});

		it('should handle filtering with extremely long filter lists', () => {
			const longFilterList = Array.from({ length: 10000 }, (_, i) => i);
			const table = new DataTable({ data: sampleData, columns });
			table.setFilter('age', longFilterList);
			expect(table.rows).toHaveLength(5); // All rows should match
		});

		it('should handle global filter with special regex characters', () => {
			const data = [
				{ id: 1, name: 'Alice (Manager)' },
				{ id: 2, name: 'Bob [Developer]' }
			] as any;
			const table = new DataTable({ data, columns });
			table.globalFilter = '(Manager)';
			expect(table.rows).toHaveLength(1);
			expect(table.rows[0].name).toBe('Alice (Manager)');
		});
	});

	describe('Pagination', () => {
		it('should paginate correctly', () => {
			const table = new DataTable({ data: sampleData, columns, pageSize: 2 });
			expect(table.rows).toHaveLength(2);
			expect(table.totalPages).toBe(3);
		});

		it('should change current page', () => {
			const table = new DataTable({ data: sampleData, columns, pageSize: 2 });
			table.currentPage = 2;
			expect(table.currentPage).toBe(2);
			expect(table.rows[0].id).toBe(3);
		});

		it('should not exceed total pages', () => {
			const table = new DataTable({ data: sampleData, columns, pageSize: 2 });
			table.currentPage = 10;
			expect(table.currentPage).toBe(3);
		});

		it('should handle empty result set', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.setFilter('age', [100]);
			expect(table.rows).toHaveLength(0);
			expect(table.totalPages).toBe(1);
			expect(table.currentPage).toBe(1);
		});

		it('should adjust current page when filters reduce total pages', () => {
			const table = new DataTable({ data: sampleData, columns, pageSize: 2 });
			table.currentPage = 3;
			table.setFilter('age', [30, 32]);
			expect(table.currentPage).toBe(1);
			expect(table.totalPages).toBe(1);
		});

		it('should handle page size larger than data set', () => {
			const table = new DataTable({ data: sampleData, columns, pageSize: 10 });
			expect(table.rows).toHaveLength(5);
			expect(table.totalPages).toBe(1);
		});

		it('should handle setting page size to 0', () => {
			const table = new DataTable({ data: sampleData, columns, pageSize: 0 });
			expect(table.rows).toHaveLength(5); // Should default to showing all rows
		});

		it('should handle navigation near total page count', () => {
			const table = new DataTable({ data: sampleData, columns, pageSize: 2 });
			table.currentPage = 3;
			expect(table.canGoForward).toBe(false);
			expect(table.canGoBack).toBe(true);
			table.currentPage = 2;
			expect(table.canGoForward).toBe(true);
			expect(table.canGoBack).toBe(true);
		});
	});

	describe('baseRows', () => {
		it('should return the original data when getting baseRows', () => {
			const table = new DataTable({ data: sampleData, columns });
			expect(table.baseRows).toEqual(sampleData);
		});

		it('should update the data when setting baseRows', () => {
			const table = new DataTable({ data: sampleData, columns });
			const newData = [
				{ id: 4, name: 'David', age: 40 },
				{ id: 5, name: 'Eve', age: 45 }
			];
			table.baseRows = newData;
			expect(table.baseRows).toEqual(newData);
			expect(table.rows).toEqual(newData);
		});

		it('should reset currentPage to 1 when setting baseRows', () => {
			const table = new DataTable({ data: sampleData, columns, pageSize: 1 });
			table.currentPage = 2;
			table.baseRows = [{ id: 4, name: 'David', age: 40 }];
			expect(table.currentPage).toBe(1);
		});

		it('should maintain existing filters when setting baseRows', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.setFilter('age', [30]);
			const newData = [
				{ id: 4, name: 'David', age: 30 },
				{ id: 5, name: 'Eve', age: 45 },
				{ id: 6, name: 'Frank', age: 30 }
			];
			table.baseRows = newData;
			expect(table.rows).toHaveLength(2);
			expect(table.rows.every((row) => row.age === 30)).toBe(true);
		});

		it('should apply existing filters to new baseRows', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.setFilter('age', [40, 45]);
			const newData = [
				{ id: 4, name: 'David', age: 40 },
				{ id: 5, name: 'Eve', age: 45 },
				{ id: 6, name: 'Frank', age: 50 }
			];
			table.baseRows = newData;
			expect(table.rows).toHaveLength(2);
			expect(table.rows.every((row) => row.age === 40 || row.age === 45)).toBe(true);
		});

		it('should maintain sort state when setting baseRows', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.toggleSort('age');
			const newData = [
				{ id: 4, name: 'David', age: 50 },
				{ id: 5, name: 'Eve', age: 45 }
			];
			table.baseRows = newData;
			expect(table.rows[0].name).toBe('Eve');
			expect(table.rows[1].name).toBe('David');
		});

		it('should handle setting baseRows to an empty array', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.baseRows = [];
			expect(table.baseRows).toEqual([]);
			expect(table.rows).toEqual([]);
			expect(table.totalPages).toBe(1);
		});

		it('should handle setting baseRows with different data structure', () => {
			const table = new DataTable({ data: sampleData, columns });
			const newData = [
				{ id: 4, name: 'David', age: 40, newField: 'value' },
				{ id: 5, name: 'Eve', age: 45, newField: 'another value' }
			];
			table.baseRows = newData;
			expect(table.baseRows).toEqual(newData);
			expect(table.rows).toEqual(newData);
		});

		it('should update global filter results when setting baseRows', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.globalFilter = 'Alice';
			expect(table.rows).toHaveLength(1);
			table.baseRows = [
				{ id: 4, name: 'David', age: 40 },
				{ id: 5, name: 'Alice Smith', age: 45 }
			];
			expect(table.rows).toHaveLength(1);
			expect(table.rows[0].name).toBe('Alice Smith');
		});

		it('should handle setting baseRows multiple times', () => {
			const table = new DataTable({ data: sampleData, columns });
			table.baseRows = [{ id: 4, name: 'David', age: 40 }];
			table.baseRows = [{ id: 5, name: 'Eve', age: 45 }];
			table.baseRows = [{ id: 6, name: 'Frank', age: 50 }];
			expect(table.baseRows).toHaveLength(1);
			expect(table.baseRows[0].name).toBe('Frank');
		});
	});

	describe('allRows', () => {
		const sampleData = [
			{ id: 1, name: 'Alice', age: 30 },
			{ id: 2, name: 'Bob', age: 25 },
			{ id: 3, name: 'Charlie', age: 35 },
			{ id: 4, name: 'David', age: 28 },
			{ id: 5, name: 'Eve', age: 32 }
		];

		const columns = [
			{ id: 'id', key: 'id', name: 'ID', sortable: true },
			{ id: 'name', key: 'name', name: 'Name', sortable: true },
			{ id: 'age', key: 'age', name: 'Age', sortable: true }
		] satisfies ColumnDef<(typeof sampleData)[0]>[];

		it('should return all rows when no filtering or sorting is applied', () => {
			const table = new DataTable({ data: sampleData, columns, pageSize: 2 });
			expect(table.allRows).toHaveLength(5);
			expect(table.allRows).toEqual(sampleData);
		});

		it('should return all filtered rows regardless of pagination', () => {
			const table = new DataTable({ data: sampleData, columns, pageSize: 2 });
			table.setFilter('age', [30, 35]);
			expect(table.rows).toHaveLength(2); // Due to pagination
			expect(table.allRows).toHaveLength(2); // All matching rows
			expect(table.allRows.every((row) => row.age === 30 || row.age === 35)).toBe(true);
		});

		it('should return all sorted rows', () => {
			const table = new DataTable({ data: sampleData, columns, pageSize: 2 });
			table.toggleSort('age');
			expect(table.allRows).toHaveLength(5);
			expect(table.allRows[0].age).toBe(25);
			expect(table.allRows[4].age).toBe(35);
		});

		it('should return all filtered and sorted rows', () => {
			const table = new DataTable({ data: sampleData, columns, pageSize: 2 });
			table.setFilter('age', [30, 32, 35]);
			table.toggleSort('age');
			expect(table.allRows).toHaveLength(3);
			expect(table.allRows[0].age).toBe(30);
			expect(table.allRows[1].age).toBe(32);
			expect(table.allRows[2].age).toBe(35);
		});

		it('should update when global filter is applied', () => {
			const table = new DataTable({ data: sampleData, columns, pageSize: 2 });
			table.globalFilter = 'a'; // Matches 'Alice' and 'Charlie' and 'David'
			expect(table.allRows).toHaveLength(3);
			expect(table.allRows.every((row) => ['Alice', 'Charlie', 'David'].includes(row.name))).toBe(
				true
			);
		});

		it('should return an empty array when no rows match the filters', () => {
			const table = new DataTable({ data: sampleData, columns, pageSize: 2 });
			table.setFilter('age', [100]); // No rows have age 100
			expect(table.allRows).toHaveLength(0);
		});

		it('should reflect changes when baseRows is updated', () => {
			const table = new DataTable({ data: sampleData, columns, pageSize: 2 });
			const newData = [
				{ id: 6, name: 'Frank', age: 40 },
				{ id: 7, name: 'Grace', age: 45 }
			];
			table.baseRows = newData;
			expect(table.allRows).toHaveLength(2);
			expect(table.allRows).toEqual(newData);
		});

		it('should contain all filtered and sorted rows while rows respects pagination', () => {
			const table = new DataTable({ data: sampleData, columns, pageSize: 2 });

			table.setFilter('age', [30, 32, 35]);
			table.toggleSort('age');

			expect(table.allRows).toHaveLength(3);
			expect(table.allRows.map((row) => row.age)).toEqual([30, 32, 35]);

			expect(table.rows).toHaveLength(2);
			expect(table.rows.map((row) => row.age)).toEqual([30, 32]);

			table.currentPage = 2;

			expect(table.allRows).toHaveLength(3);
			expect(table.allRows.map((row) => row.age)).toEqual([30, 32, 35]);

			expect(table.rows).toHaveLength(1);
			expect(table.rows.map((row) => row.age)).toEqual([35]);
		});
	});
});
