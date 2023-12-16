import sequelize from './connect/index.js'
import models from './models/index.js'
import helpers from './helpers/index.js'

import initdb from './init.js'
const initRes = await initdb(10)

console.log('created new:', initRes.dbNew)
console.log('message:', initRes.message)

try {
  await sequelize.sync();
  console.log('Database synchronized.');
} catch (e) {
  console.error('Error during Sequelize synchronization:', e);
  throw e;
}

export default {
  sequelize,
  connect: sequelize,
  models,
  helpers,
}