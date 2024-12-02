<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  export let payload: any = [];
  export let searchConfig: any = {};

  const { searchResults, initializeIndex, performSearch, selectSuggestion } = searchConfig;

  const state = {
    query: "",
    showSuggestions: false,
    selectedIndex: -1,
    keybindUsed: false,
  };

  let results: any[] = [];
  let inputElement: HTMLInputElement;
  let unsubscribe: any;

  $: searchResults.subscribe((res: any) => (results = res));

  onMount(() => {
  initializeIndex(payload);
    document.addEventListener("click", handleClickOutside);

    unsubscribe = searchResults.subscribe((res: any) => {
      results = res;
    });
  });

  onDestroy(() => {
    document.removeEventListener("click", handleClickOutside);
    if (unsubscribe) {
      unsubscribe();
    }
  });

  function handleSearch() {
    if (state.query.trim().length > 0) {
      performSearch(state.query);
      state.showSuggestions = true;
    } else {
      state.showSuggestions = false;
      results = [];
    }
    state.selectedIndex = -1;
    state.keybindUsed = false;
  }

  function handleKeyDown(event: KeyboardEvent) {
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
          selectSuggestion(results[0]), state;
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
</script>

<div class="relative m-4 w-full h-full max-w-md ">
  <!-- Input Field -->
  <input
    type="text"
    bind:this={inputElement}
    bind:value={state.query}
    on:input={handleSearch}
    on:keydown={handleKeyDown}
    placeholder="Search for relay, operator pubkey, ISP, or NIPs"
    class="w-full p-2 border border-black/10 rounded-t-md dark:bg-white/5 dark:border-white/10 dark:text-white/60 focus:border-transparent focus:ring-0"
  />
  <!-- Autosuggest Dropdown -->
  {#if state.showSuggestions && results.length > 0}
    <div class="shadow-md absolute top-full left-0 z-100 backdrop-blur-lg border border-white/10 dark:bg-white/5 dark:border-white/10 ">
      {#each results as result, index}
        <div
          role="option"
          tabindex="0"
          aria-selected={index === state.selectedIndex}
          class={`p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
            index === state.selectedIndex ? 'bg-gray-200 text-black dark:bg-gray-700 dark:text-white' : ''
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
          <strong class="text-sm"> {result.relay || "N/A"} </strong><br />
          <small class="text-sm italic text-white/50">{result.operatorPubkey || "N/A"}</small>
        </div>
      {/each}
    </div>  
  {/if}

  {#if state.showSuggestions && results.length === 0}
    <div class="">
      <div class="p-2 dark:text-white">No suggestions found.</div>
    </div>
  {/if}
</div>