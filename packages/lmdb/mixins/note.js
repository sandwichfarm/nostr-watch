import { noteId } from '../../utils/index.js'
import { operators, IDS } from "lmdb-oql";
import { Note } from '../schemas.js'

const { $eq, $gte, $isDefined } = operators 

export default class NoteMixin { 
  constructor(db) {
    this.db = db;
    this.set = new NoteSetters(db)
    this.get = new NoteGetters(db)
    this.count = new NoteCounters(db)
  }

  async exists(input) {
    if(input?.id)
      return this.db.$.get(noteId(input.id))
    else 
      return this.db.$.get(noteId(input))
  }
}

class NoteGetters {
  constructor(db) {
    this.db = db;
  }

  async allIds(){
    return [...this.db.$.select(IDS).from(Note).where({ Note: { id: $isDefined } })]
  }
}

class NoteSetters {
  constructor(db) {
    this.db = db;
  }

  async one(note) {
    const id = noteId(note.id)
    if(new String(note.id).length <= 64)
      this.db.$.put(noteId(note.id), new Note(note))
  }
}

class NoteCounters {
  constructor(db) {
    this.db = db;
  }
  
  async all() {
    const ids = await this.db.note.get.allIds()
    return ids.flat().length
  }
}