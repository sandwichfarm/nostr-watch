import rcache from "./relaydb.js"
import { relaysFromRelayList } from "./crawler.js"

export const replay = async () => {
  const notes = await rcache.note.get.all()
  for (const note of notes) {
    const ids = relaysFromRelayList(note)
    console.log('ids', ids)
  }
}