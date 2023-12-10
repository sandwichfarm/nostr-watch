import { Model, DataTypes } from 'sequelize'
import connection from '../connect/index.js'

class RelayIp extends Model {}

RelayIp.init({
  // Model attributes are defined here
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  relay_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'relays',
      key: 'id'
    }
  },
  ip_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'ips',
      key: 'id'
    }
  },
}, {
  // Other model options go here
  connection, // We need to pass the connection instance
  modelName: 'RelayIp' // We need to choose the model name
});

export default RelayIp;
