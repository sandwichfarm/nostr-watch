import { NostrEvent } from "@models/NostrEvent";

export const getUrlFromEvent = (event: NostrEvent): string | undefined => {
  let relay: string | undefined;
  try {
    relay = new URL(event.tags.find( t => t[0] === 'd')?.[1] ?? "").toString()
  }
  catch(e) {
    console.error('Error parsing relay from event id:', event.id, "error:", e)  
  }
  return relay
}

export const getNetworkFromEvent = (event: NostrEvent): string | undefined => {
  return event.tags.find( t => t[0] === 'n')?.[1]
}