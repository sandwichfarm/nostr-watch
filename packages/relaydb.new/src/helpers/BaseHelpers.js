export class BaseHelpers { 
  constructor(model){
    this.model = model 
    this.count = count(this)
    this.batch = batch(this)
  }
  
  async createIfNotExists(records, options){
    const existingRecord = await model.findOne({
      where: { id: record.id }
    });
    if(existingRecord) return false
    const insertedRecord = await model.create(record, {
        ...options,
        ignoreDuplicates: true,
        returning: true,
    });
    return insertedRecord
  }
}

const batch = function(self){
  const { model } = self
  return {
    createIfNotExists: async function(records, options) {
      let insertedRecords = []
      try {
        const ids = records.map(record => record.id);
        const existingRecords = await model.findAll({
            where: { id: ids }
        });
        const existingIds = new Set(existingRecords.map(record => record.id));
        const newRecords = records.filter(record => !existingIds.has(record.id));
        insertedRecords = await model.bulkCreate(newRecords, {
            ...options,
            ignoreDuplicates: true,
            returning: true,
        });
      }
      catch(e){ console.warn(e) }
      return insertedRecords
    }
  }
}

const count = function(self){
  const { model } = self 
  return {
    all: async function() {
      return model.count()
    }
  }
}