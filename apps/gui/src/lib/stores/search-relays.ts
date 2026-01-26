import MiniSearch, { type SearchResult } from "minisearch";
import { writable, type Writable } from "svelte/store";
import { goto } from '$app/navigation';
import { generateRelayPathFromUrl } from '$lib/utils/routing.js';

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

function uniqueById(data: any[]) {
  const unique: any[] = [];
  const seen = new Set<string>();

  for (const entry of data || []) {
    const id = entry?.id;
    if (typeof id !== "string" || id.length === 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(entry);
  }

  return unique;
}

export function initializeIndex(data) {
  const unique = uniqueById(data);

  if(miniSearch.documentCount === 0) {
    miniSearch.addAll(unique);
    return;
  }

  for(const entry of unique) {
    if(!miniSearch.has(entry.id)) {
      miniSearch.add(entry);
    }
  }
}

export function performSearch(query: string) {
  const results: SearchResult[] = miniSearch.search(query);
  searchResults.set(results);
}

export function selectSuggestion(result: SearchResult, state: any) {
  goto(`/reload/relays/${generateRelayPathFromUrl(result.relay)}`);
  state.showSuggestions = false;
} 
