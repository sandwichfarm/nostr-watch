import { normalizeRelays } from './sanitizers.js'

export const parseRelayList = (note) => {
  let parsed
  if(note.kind === 2)
    parsed = parseRelayFromKind2(note)
  if(note.kind === 3)
    parsed = parseRelayListFromKind3(note)
  if(note.kind === 10002)
    parsed = parseRelayListFromKind10002(note)

  return normalizeRelays(parsed)
}

export const parseRelayFromKind2 = (note) => {
  return [note.content]
}

export const parseRelayListFromKind3 = (note) => {
  let dirtyRelayList 
  try { 
    dirtyRelayList = Object.keys(JSON.parse(note.content))
  } catch(e) {
    return
  }
  return dirtyRelayList.length ? dirtyRelayList : [] 
}

export const parseRelayListFromKind10002 = (note) => {
  let dirtyRelayList 
  try { 
    dirtyRelayList = note?.tags
      .filter( t => t[0] === 'r' )
      .map( t => t[1] )
  } catch(e) {""}
  return dirtyRelayList ? dirtyRelayList : [] 
}