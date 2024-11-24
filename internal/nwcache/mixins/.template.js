import { operators } from "lmdb-oql";
import { Relay } from "../schemas.js"

import { relayId, now } from "../utils.js"

const { $eq, $gte } = operators

export default class TemplateHelpers {
  constructor(db) {
    this.db = db;
    this.get = new TemplateGetters(db)
    this.set = new TemplateSetters(db)  
  }
}

class TemplateGetters {
  constructor(db) {
    this.db = db;
  }

  async one(relayUrl) {
    return this.db.$.get()
  }
}

class TemplateSetters {
  constructor(db) {
    this.db = db;
  }

  async put(relayObj) {
    await this.db.$.put()
  }
}