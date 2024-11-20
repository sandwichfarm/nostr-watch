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

export const isPRE = (ev: IEvent): boolean => {
  return ev.kind >= 30000 && ev.kind < 40000
}

export const isRE = (ev: IEvent): boolean => {
  const legacyReplaceableKinds = [0, 3, 41];
  return (ev.kind >= 10000 && ev.kind < 20000) || legacyReplaceableKinds.includes(ev.kind)
}

export const isEphemeral = (ev: IEvent): boolean => {
  return ev.kind >= 20000 && ev.kind < 30000
}