import MiniSearch, { type SearchResult } from "minisearch";
import { writable, type Writable } from "svelte/store";
import { goto } from '$app/navigation';
import { formatRelayUrl } from '$lib/utils/routing.js';

// Create a writable store for the search results
export const searchResults: Writable<SearchResult[]> = writable([]);

// Create and configure the MiniSearch index
const miniSearch = new MiniSearch({
  fields: ["relay", "operatorPubkey", "isp", "supportedNips"], // Fields to index
  storeFields: ["relay", "operatorPubkey", "isp", "supportedNips"], // Fields to store in search results
  searchOptions: {
    boost: { relay: 3, operatorPubkey: 3, isp: 2, supportedNips: 2 },
    fuzzy: 0,
    prefix: true,
  },
  extractField: (document, fieldName) => {
    if (fieldName === "supportedNips" && Array.isArray(document[fieldName])) {
      return document[fieldName].flatMap((nip) => [`nip-${nip}`, `nip${nip}`]);
    }
    return document[fieldName];
  },
});

// Function to initialize the index with data
export function initializeIndex(data) {
  miniSearch.addAll(data);
}

// Function to perform a search and update the store
export function performSearch(query: string) {
  const results: SearchResult[] = miniSearch.search(query);
  searchResults.set(results);
}

export function selectSuggestion(result: SearchResult, state: any) {
  // state.query = result.relay || result.operatorPubkey || result.isp || "";
  goto(`/relays/${formatRelayUrl(result.relay)}`);

  state.showSuggestions = false;
} 