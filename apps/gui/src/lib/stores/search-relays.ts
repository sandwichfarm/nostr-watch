import MiniSearch, { type SearchResult } from "minisearch";
import { writable, type Writable } from "svelte/store";
import { goto } from '$app/navigation';
import { formatRelayUrl } from '$lib/utils/routing.js';

export const searchResults: Writable<SearchResult[]> = writable([]);

const miniSearch = new MiniSearch({
  fields: ["relay", "operatorPubkey", "isp", "supportedNips"],
  storeFields: ["relay", "operatorPubkey", "isp", "supportedNips"],
  searchOptions: {
    boost: { relay: 3, operatorPubkey: 3, supportedNips: 2, isp: 1},
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

export function initializeIndex(data) {
  if(miniSearch.documentCount === 0) {
    miniSearch.addAll(data);
  }
  else {
    for(const entry of data) {
      if(!miniSearch.has(entry.id)) {
        miniSearch.add(entry);
      }
    } 
  }
}

export function performSearch(query: string) {
  const results: SearchResult[] = miniSearch.search(query);
  searchResults.set(results);
}

export function selectSuggestion(result: SearchResult, state: any) {
  goto(`/relays/${formatRelayUrl(result.relay)}`);
  state.showSuggestions = false;
} 