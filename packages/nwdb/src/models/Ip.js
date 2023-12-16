import { Model, DataTypes } from 'sequelize'
import sequelize from '../connect/index.js'

class Ip extends Model {}

Ip.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    unique: true
  },
  ip: {
    type: DataTypes.STRING,
    unique: true
  },
  type: {
    type: DataTypes.ENUM,
    values: ['ipv4', 'ipv6']
  }
}, {
  sequelize, 
  modelName: 'Ip',
  indexes: [
    {
      unique: true,
      fields: ['ip']
    },
    {
      unique: false,
      fields: ['type']
    }
  ]
});

export default Ip 