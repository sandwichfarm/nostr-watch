<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    createTable,
    Render,
    Subscribe,
  } from "svelte-headless-table";
  import {
    addPagination,
    addSortBy,
    addTableFilter,
  } from "svelte-headless-table/plugins";
  import ArrowUpDown from "lucide-svelte/icons/arrow-up-down";
  import * as Table from "$lib/components/ui/table/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { cn } from "$lib/components/utils.js";

  export let payload: any = [];
  export let searchConfig: any = {};
  export let mode: 'compact' | 'table' = 'compact';
  export let maxResults: number | undefined;
  export let autoFocus: boolean = false;

  const { searchResults, initializeIndex, performSearch, selectSuggestion } = searchConfig;

  const state = {
    query: "",
    showSuggestions: false,
    selectedIndex: -1,
    keybindUsed: false,
  };

  type Result = {
    relay: string;
    operatorPubkey: string;
    isp: string;  
    supportedNips: string[];
  };

  let inputElement: HTMLInputElement;

  onMount(async () => {
    initializeIndex(payload);
    document.addEventListener("click", handleClickOutside); 
    if(autoFocus) inputElement.focus();
  });

  onDestroy(() => {
    document.removeEventListener("click", handleClickOutside);
  });

  function handleSearch() {
    if (state.query.trim().length > 0) {
      performSearch(state.query);
      state.showSuggestions = true;
    } else {
      state.showSuggestions = false;
    }
    state.selectedIndex = -1;
    state.keybindUsed = false;
  }

  function handleKeyDown(event: KeyboardEvent) {
    const results = $searchResults;
    if (!state.showSuggestions) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (state.selectedIndex < results.length - 1) {
          state.selectedIndex++;
          state.keybindUsed = true;
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (state.selectedIndex > 0) {
          state.selectedIndex--;
          state.keybindUsed = true;
        }
        break;
      case "Enter":
        event.preventDefault();
        if (state.keybindUsed && state.selectedIndex >= 0 && state.selectedIndex < results.length) {
          selectSuggestion(results[state.selectedIndex], state);
        } else if (!state.keybindUsed && results.length > 0) {
          selectSuggestion(results[0], state);
        }
        state.showSuggestions = false;
        state.query = "";
        break;
      case "Escape":
        state.showSuggestions = false;
        break;
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (inputElement && !inputElement.contains(event.target as Node)) {
      state.showSuggestions = false;
    }
  }

  // Setting up the table using svelte-headless-table
  let table;
  let columns;
  let headerRows, pageRows, tableAttrs, tableBodyAttrs, pluginStates, rows;
  let hasNextPage, hasPreviousPage, pageIndex;

  if (mode === 'table') {
    // Initialize the table
    table = createTable(searchResults, {
      sort: addSortBy({ disableMultiSort: true }),
      page: addPagination(),
      filter: addTableFilter({
        includeHiddenColumns: true,
        fn: ({ filterValue, value }) => String(value).includes(filterValue)
      })
    });

    // Define columns
    columns = table.createColumns([
      table.column({
        header: "Relay",
        accessor: "relay",
      }),
      table.column({
        header: "Operator Pubkey",
        accessor: "operatorPubkey",
      }),
      table.column({
        header: "ISP",
        accessor: "isp",
      }),
      // table.column({
      //   header: "Supported NIPs",
      //   accessor: "supportedNips",
      //   cell: ({ value }) => value.join(", "),
      // }),
    ]);

    const viewModel = table.createViewModel(columns);

    // Destructure the necessary variables
    ({ headerRows, pageRows, tableAttrs, tableBodyAttrs, pluginStates, rows } = viewModel);

    ({ hasNextPage, hasPreviousPage, pageIndex } = pluginStates.page);
  }
</script>

<div class="relative m-4 w-full h-full">
  <!-- Input Field -->
  <input
    type="text"
    bind:this={inputElement}
    bind:value={state.query}
    on:input={handleSearch}
    on:keydown={handleKeyDown}
    placeholder="Search for relay, operator pubkey, ISP, or NIPs"
    class="w-full p-2 border border-black/10 rounded-t-md dark:bg-black/5 dark:border-black/10 dark:text-white/60 focus:border-transparent focus:ring-0"
  />

  {#if mode === 'compact'}
    <!-- Autosuggest Dropdown -->
    {#if state.showSuggestions && $searchResults.length > 0}
      <div class="shadow-md absolute top-full left-0 right-0 z-100 backdrop-blur-lg border border-white/10 dark:bg-black/60 dark:border-white/10">
        {#each $searchResults.slice(0, maxResults || undefined) as result, index}
          <div
            role="option"
            tabindex="0"
            aria-selected={index === state.selectedIndex}
            class={`m-2 p-2 backdrop-blur-lg cursor-pointer overflow-hidden overflow-ellipsis dark:hover:bg-gray-700/50 ${
              index === state.selectedIndex ? 'bg-gray-200/50 text-black dark:bg-gray-700/50 dark:text-white' : ''
            }`}
            on:click={() => {
              selectSuggestion(result, state);
              state.showSuggestions = false;
              state.query = "";
            }}
            on:keydown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                selectSuggestion(result, state);
                state.showSuggestions = false;
                state.query = "";
              }
            }}
          >
            <strong class="text-lg"> {result.relay || "N/A"} </strong><br />
            <small class="text-sm italic text-white/50">{result.operatorPubkey || "N/A"}</small>
          </div>
        {/each}
      </div>  
    {/if}

    {#if state.showSuggestions && $searchResults.length === 0}
      <div class="">
        <div class="p-2 dark:text-white">No suggestions found.</div>
      </div>
    {/if}
  {/if}

  {#if mode === 'table'}
    <!-- Data Table -->
    <div class="w-full mt-4">
      <div class="rounded-md border">
        <Table.Root {...$tableAttrs}>
          <Table.Header>
            {#each $headerRows as headerRow}
              <Subscribe rowAttrs={headerRow.attrs()}>
                <Table.Row>
                  {#each headerRow.cells as cell (cell.id)}
                    <Subscribe attrs={cell.attrs()} let:attrs props={cell.props()} let:props>
                      <Table.Head {...attrs}>
                        {#if props.sort}
                          <Button variant="ghost" on:click={props.sort.toggle}>
                            <Render of={cell.render()} />
                            <ArrowUpDown
                              class={cn(
                                props.sort.isSorted && "text-foreground",
                                "ml-2 h-4 w-4"
                              )}
                            />
                          </Button>
                        {:else}
                          <Render of={cell.render()} />
                        {/if}
                      </Table.Head>
                    </Subscribe>
                  {/each}
                </Table.Row>
              </Subscribe>
            {/each}
          </Table.Header>
          <Table.Body {...$tableBodyAttrs}>
            {#each $pageRows as row (row.id)}
              <Subscribe rowAttrs={row.attrs()} let:rowAttrs>
                <Table.Row {...rowAttrs}>
                  {#each row.cells as cell (cell.id)}
                    <Subscribe attrs={cell.attrs()} let:attrs>
                      <Table.Cell {...attrs}>
                        <Render of={cell.render()} />
                      </Table.Cell>
                    </Subscribe>
                  {/each}
                </Table.Row>
              </Subscribe>
            {/each}
          </Table.Body>
        </Table.Root>
      </div>
      <div class="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          on:click={() => ($pageIndex = $pageIndex - 1)}
          disabled={!$hasPreviousPage}
        >Previous</Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!$hasNextPage}
          on:click={() => ($pageIndex = $pageIndex + 1)}
        >Next</Button>
      </div>
    </div>
  {/if}
</div>
