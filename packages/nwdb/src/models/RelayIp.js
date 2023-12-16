import { Model, DataTypes } from 'sequelize'
import sequelize from '../connect/index.js'

class Relayip extends Model {}

Relayip.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
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
  ip_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Ips',
      key: 'id'
    }
  },
}, {
  sequelize
});

export default Relayip;
