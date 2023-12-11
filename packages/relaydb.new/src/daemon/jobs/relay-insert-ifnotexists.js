import { Relay } from '../models/index.js'
import { relayId } from '@nostrwatch/utils'
import { RelayHelpers } from '../../helpers/RelayHelpers.js'

const $RelayHelpers = new RelayHelpers(Relay)

export default async (payload) => {
  if(!payload.url) throw new Error("No Relay URL provided in payload")

  const { url, data } = payload

  const $row = await $RelayHelpers.insertIfNotExists(Relay, { ...data, id: relayId(url) })
  return [$row.id]
}