import { ParseSelect, helperHandler} from '../utils.js'
import { RelayCheckWebsocket, RelayCheckInfo, RelayCheckDns, RelayCheckGeo, RelayCheckSsl } from '../schemas.js'
import { operators, IDS } from "lmdb-oql";

const { $isDefined } = operators

import transform from '@nostrwatch/transform'
// const { $eq, $gte, $and, $isDefined, $type, $isUndefined, $includes, $in, $nin, $matches } = operators

export default class CheckMixin {
  constructor(db) {
    this.db = db;
    this.init()
  }

  init(){
    ['websocket', 'info', 'dns', 'geo','ssl'].forEach(check => {
      this[check] = {}
      this[check].get = check_get(this.db, check)
      this[check].insert = check_insert(this, check)
    })
  }

  validate(RelayObj){
    // console.log(RelayObj)
    if(!RelayObj?.url)
      throw new Error("Relay object must have a url property")
  }
}

const check_insert = (self, key) => {
  const Schema = inferSchema(key)
  // const schema = Schema.name
  return (DataObj) => {
    self.validate(DataObj)
    const RdbDataObj = maybeTransform(DataObj, key)
    return self.db.$.put(null, new Schema(RdbDataObj))
  }
}

const check_get = (self, key) => {
  const Schema = inferSchema(key)
  const schema = Schema.name
  const transformer = new transform[key]() 
  const parseSelect = ParseSelect(transformer.toJson(), transformer.constructor.name)
  
  const fns = {
    one(relayUrl, select=null){
      select = parseSelect( select )
      return [...self.db.$.select(select).from( Schema ).where( { [schema]: { 'relay_id': self.db.relay.id(relayUrl) } } )][0] || false
    },
    mostRecent(relayUrl, select=null) {
      select = parseSelect( select )
      return [...self.db.$.select( select ).from( Schema ).where({ [schema]: { '#': `${schema}@` } })][0] || false
    },
    all(select=null) {
      select = parseSelect( select )
      // return [...this.db.$.select(select).from( Relay ).where({ Relay: { url: (value) => value?.length  } })] || []
      return [...self.$.select( select ).from( Schema ).where({ [schema]: { '#': `${schema}@` } })] || []
      // return [...self.$.select( select ).from( Schema ).where({ [schema]: { relay_id: $isDefined() } })] || []
    },
    allIds(){
      const result = self.all(IDS).flat()
      return result || []
    }
  }
  return helperHandler(fns)
}

const maybeTransform = (data, key) => {
  // console.log(data)
  //relaydb data format
  if(data?.relay_id && data.relay_id !== null && data.relay_id.length)
    return data

  // console.log(key, Object.keys(transform))

  const ToRdbData = new transform[key]()

  //event 
  if(data?.sig && data?.tags && data?.pubkey)
    return ToRdbData.fromEvent(data)

  //nocap
  if(data?.adapters instanceof Array)
    return ToRdbData.fromNocap(data)

  throw new Error(`Data provided for ${key} did not match any known formats: ${JSON.stringify(data)}`)
}

const inferSchema = (key) => {
  switch(key){
    case 'info':
      return RelayCheckInfo
    case 'dns':
      return RelayCheckDns
    case 'geo':
      return RelayCheckGeo
    case'ssl':
      return RelayCheckSsl
    case 'websocket':
    default:
      return RelayCheckWebsocket
  }
}