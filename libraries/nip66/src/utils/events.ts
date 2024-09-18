import { IEvent } from "@models/Event";

export const getUrlFromEvent = (event: IEvent): string | undefined => {
  let relay: string | undefined;
  try {
    relay = new URL(event.tags.find( t => t[0] === 'd')?.[1] ?? "").toString()
  }
  catch(e) {
    console.error('Error parsing relay from event id:', event.id, "error:", e)  
  }
  return relay
}

export const getNetworkFromEvent = (event: IEvent): string | undefined => {
  return event.tags.find( t => t[0] === 'n')?.[1]
}