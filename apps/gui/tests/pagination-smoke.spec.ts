import { expect, test } from '@playwright/test';

test('Given paginated rows, when page changes and data refreshes, then current page stays visible', async ({
	page
}) => {
	await test.step('Given a three-page table', async () => {
		await page.goto(process.env.GUI_PAGINATION_SMOKE_URL ?? '/');
		await page.addScriptTag({
			type: 'module',
			content: `
				const target = document.createElement('div');
				target.id = 'pagination-smoke-root';
				document.body.replaceChildren(target);

				const [{ DataTable }, PaginatorModule, svelte] = await Promise.all([
					import('/src/lib/components/@Careswitch/svelte-data-table/DataTable.svelte.ts'),
					import('/src/lib/components/data-view/table/DataTablePaginator.svelte'),
					import('/node_modules/.vite/deps/svelte.js')
				]);

				const columns = [{ id: 'name', key: 'name', name: 'Name' }];
				const rows = [
					{ id: 1, name: 'one' },
					{ id: 2, name: 'two' },
					{ id: 3, name: 'three' },
					{ id: 4, name: 'four' },
					{ id: 5, name: 'five' }
				];
				const table = new DataTable({ data: rows, columns, pageSize: 2 });

				svelte.mount(PaginatorModule.default, {
					target,
					props: { tableInstance: table }
				});

				window.__paginationSmoke = {
					snapshot: () => ({
						currentPage: table.currentPage,
						rowNames: table.rows.map((row) => row.name)
					}),
					refreshRows: async () => {
						table.baseRows = [...rows, { id: 6, name: 'six' }];
						await svelte.tick();
					}
				};

				await svelte.tick();
			`
		});
		await page.waitForFunction(() => (window as any).__paginationSmoke !== undefined);
		await expect(page.locator('#pagination-smoke-root')).toContainText('page 1 of 3');
	});

	const root = page.locator('#pagination-smoke-root');
	const nextPage = root.locator('button').nth(1);

	await test.step('When user changes to page two', async () => {
		await nextPage.click();
	});

	await test.step('Then page two rows become current', async () => {
		await expect(root).toContainText('page 2 of 3');
		await expect
			.poll(() => page.evaluate(() => (window as any).__paginationSmoke.snapshot()))
			.toEqual({ currentPage: 2, rowNames: ['three', 'four'] });
	});

	await test.step('When information refreshes', async () => {
		await page.evaluate(() => (window as any).__paginationSmoke.refreshRows());
	});

	await test.step('Then table remains on page two', async () => {
		await expect(root).toContainText('page 2 of 3');
		await expect
			.poll(() => page.evaluate(() => (window as any).__paginationSmoke.snapshot()))
			.toEqual({ currentPage: 2, rowNames: ['three', 'four'] });
	});
});
