import { parseSelect, helperHandler } from "../utils.js"
import { RelayCheckWebsocket, RelayCheckInfo, RelayCheckDns, RelayCheckGeo, RelayCheckSsl } from './schemas.js'
import { operators, IDS } from "lmdb-oql";

const { $eq, $gte, $and, $isDefined, $type, $isUndefined, $includes, $in, $nin, $matches } = operators

export default class RelayMixin {
  constructor(db) {
    this.db = db;
    this.checks = ['websocket', 'info', 'dns', 'geo','ssl']
  }

  init(){
    this.checks.forEach(check => {
      this[check] = {}
      this[check].get = check_get(this.db, check, this.schema(check))
    })
  }

  async insert(RelayCheckObj, key){
    this.validate(RelayCheckObj)
    const Schema = this.schema(key)
    return this.db.$.put(null, new Schema(RelayCheckObj))
  }

  schema(key){
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

  validate(RelayObj){
    if(!RelayObj?.url)
      throw new Error("Relay object must have a url property")
  }
}

const check_get = (db, key, Schema) => {
  const schema = Schema.name
  const fns = {
    db,
    mostRecent(relayUrl, select=null) {
      return this.db.$.select(select).from( Schema ).where('')[0] || false
    },
    all(select=null) {
      select = parseSelect(select)
      // return [...this.db.$.select(select).from( Relay ).where({ Relay: { url: (value) => value?.length  } })] || []
      return [...this.db.$.select(select).from( Schema ).where({ [schema]: { '#': `${schema}@` } })] || []
    },
    allIds(){
      const result = this.all(IDS).flat()
      return result || []
    }
  }
  return helperHandler(fns)
}

