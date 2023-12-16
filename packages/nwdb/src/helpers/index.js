export const batchInsertIfNotExists = async (model, records, options={}) => {
  const ids = records.map(record => record.id);
  const existingRecords = await model.findAll({
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

export const insertIfNotExists = async (model, record, options={}) => {
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

export default {
  batchInsertIfNotExists,
  insertIfNotExists
}