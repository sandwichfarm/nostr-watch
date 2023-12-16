import { Model, DataTypes } from 'sequelize';
import { Relay, Publisher} from './index.js'
import sequelize from '../connect/index.js'

class Checkmeta extends Model {}

Checkmeta.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  relay_id: {
    type: DataTypes.STRING,
    allowNull: false,
    reference: {
      model: "Relays",
      key: 'id'
    }
  },
  publisher_id: {
    type: DataTypes.STRING,
    allowNull: false,
    reference: {
      model: "Publishers",
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM,
    values: ['success', 'error', 'forward'],
  },
  message: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  meta_type: {
    type: DataTypes.ENUM,
    values: ['info', 'geo', 'dns', 'ssl'],
    allowNull: true
  },
  meta_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  sequelize: sequelize
});

export default Checkmeta;
