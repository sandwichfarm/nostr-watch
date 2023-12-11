import { Relay } from '../models/index.js'
import { relayId } from '@nostrwatch/utils'

export const addRelay = async (payload) => {
  if(!payload.url) throw new Error("No Relay URL provided, absolutely necessary!!!")
  let { url, data } = payload
  const $row = await Relay.create({ ...data, id: relayId(url) })
  return [$row.id]
}s