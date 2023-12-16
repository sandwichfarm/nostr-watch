import { Model, DataTypes } from 'sequelize'
import sequelize from '../connect/index.js'

class Dns extends Model {}

Dns.init({
  id: {
    type: DataTypes.STRING, //hash
    primaryKey: true
  },
  relay_id: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'Relays',
      key: 'id'
    }
  },
  data: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
}, {
  sequelize, 
  modelName: 'Dns', 
  indexes: [
    {
      fields: ['data'],
      using: 'GIN'
    }
  ]
});

export default Dns