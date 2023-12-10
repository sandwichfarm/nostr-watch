import { Model, DataTypes } from 'sequelize'
import connection from '../connect/index.js'

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
      model: 'relays',
      key: 'id'
    }
  },
  data: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
}, {
  connection, 
  modelName: 'Dns', 
  indexes: [
    {
      fields: ['data'],
      using: 'GIN'
    }
  ]
});

export default Dns