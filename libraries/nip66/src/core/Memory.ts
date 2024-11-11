// import { ICheck, IRelay } from '@base/models'
// import MiniSearch from 'minisearch'

// export class Memory {
//   private _relays: IRelay[]
//   private _checks: ICheck[]

//   constructor(data: any) {
//     this.data = data
//     this.search = new MiniSearch({
//       fields: ['name', 'description'],
//       storeFields: ['name', 'description'],
//     })
//     this.search.addAll(data)
//   }

//   public async searchByQuery(query: string) {
//     return this.search.search(query)
//   }
// }