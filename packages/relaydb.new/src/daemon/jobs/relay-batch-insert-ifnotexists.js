import { Relay } from '../models/index.js'
import { RelayHelpers } from '../../helpers/RelayHelpers.js'

const $RelayHelpers = new RelayHelpers(Relay)

export default async (records) => {
  const $rows = await $RelayHelpers.batch.InsertIfNotExists(Relay, records, 'id')
  return $rows.map($row => $row.id)
}