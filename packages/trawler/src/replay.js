import rcache from "./relaydb.js"
import { relaysFromRelayList } from "./trawler.js"

export const replay = async () => {
  const notes = await rcache.note.get.allIds()
  for (const noteid of notes) {
    const note = await rcache.note.get(noteid)
    const persistedIds = relaysFromRelayList(note)
    console.log('ids', persistedIds)x
  }
}