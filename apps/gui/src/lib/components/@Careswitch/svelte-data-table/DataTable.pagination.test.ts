import { describe, expect, it } from 'vitest';
import { DataTable, type ColumnDef } from './DataTable.svelte';

type Row = {
	id: number;
	name: string;
};

const columns: ColumnDef<Row>[] = [
	{
		id: 'name',
		key: 'name',
		name: 'Name'
	}
];

const rows: Row[] = [
	{ id: 1, name: 'one' },
	{ id: 2, name: 'two' },
	{ id: 3, name: 'three' },
	{ id: 4, name: 'four' },
	{ id: 5, name: 'five' }
];

const createTable = () =>
	new DataTable<Row>({
		data: rows,
		columns,
		pageSize: 2
	});

describe('Given a paginated data table', () => {
	it('when the page changes, then it exposes rows from the requested page', () => {
		const table = createTable();

		table.currentPage = 2;

		expect(table.currentPage).toBe(2);
		expect(table.rows.map((row) => row.name)).toEqual(['three', 'four']);
	});

	it('when row data refreshes, then it stays on the current page', () => {
		const table = createTable();
		table.currentPage = 2;

		table.baseRows = [...rows, { id: 6, name: 'six' }];

		expect(table.currentPage).toBe(2);
		expect(table.rows.map((row) => row.name)).toEqual(['three', 'four']);
	});

	it('when refresh removes the current page, then it clamps to the last available page', () => {
		const table = createTable();
		table.currentPage = 3;

		table.baseRows = rows.slice(0, 3);

		expect(table.currentPage).toBe(2);
		expect(table.rows.map((row) => row.name)).toEqual(['three']);
	});
});
