import { Model, DataTypes } from 'sequelize'
import connection from '../connect/index.js'

class Geo extends Model {}

Geo.init({
  id: {
    type: DataTypes.STRING, //geohash
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
  }
}, {
  connection, 
  modelName: 'Geo',
  indexes: [
    {
      unique: true,
      fields: ['id']
    }
  ]
});

export default Geo