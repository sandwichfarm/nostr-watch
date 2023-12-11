export class BaseHelpers { 
  constructor(model){
    this.model = model 
    this.get = get(this)
    this.batch = batch(this)
  }
  
  insertIfNotExists(records, options){
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
      const ids = records.map(record => record.id);
      const existingRecords = await Relay.findAll({
          where: { id: ids }
      });
      const existingIds = new Set(existingRecords.map(record => record.id));
      const newRecords = records.filter(record => !existingIds.has(record.id));
      const insertedRecords = await model.bulkCreate(newRecords, {
          ...options,
          ignoreDuplicates: true,
          returning: true,
      });
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