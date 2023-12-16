import hash from 'object-hash'

import { sequelize } from '../connect/index.js'
import { CheckMeta, Info, Dns, Geo, Ssl } from '../../models/index.js'
// import { insertIfNotExists } from '../../helpers/index.js'  
import { BaseHelpers } from '../../helpers/RelayHelpers.js'

import { relayId } from '@nostrwatch/utils'

const route = (type) => {
  switch(type){
    case 'info': return Info
    case 'dns': return Dns
    case 'geo': return Geo
    case 'ssl': return Ssl
  }
}

export default async (payload) => {
  if(!payload.url) return { "status": "error", "message": "Normalized relay url was not provided in job data." }
  if(!payload.type) return { "status": "error", "message": "No `type` provided in job data. (info, dns, geo, ssl...)" }
  if(!payload.data) return { "status": "error", "message": "No `data` provided in job data. (nocap result for respective type)" }
  
  let { url, checked_by:publisher_id, data, status, message } = payload
  let $meta, $checkmeta

  const Model = route(data.type)
  const ModelHelpers = BaseHelpers(Model)
  const relay_id = relayId(url)
  const id = hash(data)

  const $txn = await sequelize.transaction();

  try {
    $meta = ModelHelpers.insertIfNotExists(Model, {
      id,
      relay_id, 
      data
    })
  
    if(!$meta) return []
  
    $checkmeta = await CheckMeta.create({ 
      relay_id, 
      publisher_id,
      data,
      status,
      message,
      meta_type: data.type, 
      meta_id: $meta.id,
    });

    $txn.commit();  
  }
  catch(err){
    await $txn.rollback();
    return []
  }

  return [$meta.id, $checkmeta.id]
}