import { sequelize } from '../connect/index.js'
import { CheckStatus, Relay } from '../models/index.js'
import { relayId } from '@nostrwatch/utils'
import mapper from 'object-mapper'

export const addRelay = async (record) => {
  if(!record.url) throw new Error("No Relay URL provided, absolutely necessary!!!")

  //status checks only need the data because websocket payloads are streamlined.
  let { data } = payload
 
  const $txn = await sequelize.transaction();

  const map = {
    'url': 'relay_id',
    'checked_by': 'publisher_id',
    'connect.data': 'connect',
    'read.data': 'read',
    'write.data': 'write',
    'connect.duration': 'connectDuration',
    'read.duration': 'readDuration',
    'write.duration': 'writeDuration',
    'connect.duration + read.duration + write.duration': 'duration'
  }

  let recordMapped
  recordMapped = mapper(data, map)
  recordMapped.relay_id = relayId(recordMapped.relay_id)

  let $status

  try {
    $status = await CheckStatus.create({ ...recordMapped })
    const now = new Date()

    const $relay = Relay.select( { where: { id: recordMapped.relay_id } })
    
    let relayQuery = { last_checked: now }

    if($relay.first_seen === null)
      relayQuery = { ...relayQuery, first_seen: now }

    if(recordMapped.connect)
      relayQuery = { ...relayQuery, last_seen: now }

    await Relay.update(relayQuery, { where: { id: recordMapped.relay_id } })

    await $txn.commit();
  }
  catch(err){
    await $txn.rollback();
  }
  
  return [$status.id]
}
