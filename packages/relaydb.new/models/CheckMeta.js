import { Model, DataTypes } from 'sequelize';
import { Relay, Publisher} from './index.js'
import connection from '../connect/index.js'

class Check extends Model {}

Check.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  relay_id: {
    type: DataTypes.STRING,
    allowNull: false,
    reference: {
      model: Relay,
      key: 'id'
    }
  },
  publisher_id: {
    type: DataTypes.STRING,
    allowNull: false,
    reference: {
      model: Publisher,
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
    allowNull: true,
    references: {
      model: 'relays',
      key: 'id'
    }
  }
}, {
  sequelize: connection, // Pass the connection instance
  modelName: 'check' // Correct model name
  // Other model options
});

export default Check;
