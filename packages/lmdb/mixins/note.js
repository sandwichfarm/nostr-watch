import { noteId } from '../../utils/index.js'
import { operators, IDS } from "lmdb-oql";
import { Note } from '../schemas.js'

const { $eq, $gte, $isDefined, $matches } = operators 

export default class NoteMixin { 
  constructor(db) {
    this.db = db;
    this.set = new NoteSetters(db)
    this.get = new NoteGetters(db)
    this.count = new NoteCounters(db)
  }

  exists(input) {
    if(this.db.note.get.one(input))
      return true
    return false
  }
}

class NoteGetters {
  constructor(db) {
    this.db = db;
  }

  one(noteid){
    if(noteid?.id)
      noteid = noteid.id
    if(!noteid.includes('Note@'))
      noteid = noteId(noteid)
    return this.db.$.get(noteid)
  }

  all(){
    return [...this.db.$.select().from( Note ).where({ Note: { "#": "Note" } })].flat()
  }

  allIds(){
    return [...this.db.$.select(IDS).from( Note ).where({ Note: { "#": "Note" } })].flat()
  }
}

class NoteSetters {
  constructor(db) {
    this.db = db;
  }

  async one(note) {
    if(!note?.id)
      throw new Error('Note must have an id')
    const id = noteId(note.id)
    return this.db.$.put(id, new Note(note)).catch()
  }
}

class NoteCounters {
  constructor(db) {
    this.db = db;
  }
  
  all() {
    return this.db.note.get.allIds().length
  }
}