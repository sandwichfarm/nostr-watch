import { ParseSelect, helperHandler} from '../utils.js'
import { RelayCheckWebsocket, RelayCheckInfo, RelayCheckDns, RelayCheckGeo, RelayCheckSsl } from '../schemas.js'
import { IDS } from "lmdb-oql";

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
  const schema = Schema.name
  return (DataObj) => {
    self.validate(DataObj)
    const hash = DataObj.hash
    delete DataObj.hash
    return self.db.$.put(`${schema}@${hash}`, new Schema(DataObj))
  }
}

const check_get = (self, key) => {
  const Schema = inferSchema(key)
  const schema = Schema.name
  const parseSelect = ParseSelect({relay_id: '', hash: '', data: {}}, schema)
  
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