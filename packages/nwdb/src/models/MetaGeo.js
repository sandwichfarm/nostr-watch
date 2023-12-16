import { Model, DataTypes } from 'sequelize'
import sequelize from '../connect/index.js'

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
      model: 'Relays',
      key: 'id'
    }
  },
  data: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  sequelize, 
  modelName: 'Geo',
  indexes: [
    {
      unique: true,
      fields: ['id']
    }
  ]
});

export default Geo