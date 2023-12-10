import { Model, DataTypes } from 'sequelize';
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
      model: "relays",
      key: 'id'
    }
  },
  publisher_id: {
    type: DataTypes.STRING,
    allowNull: false,
    reference: {
      model: "publishers",
      key: 'id'
    }
  },
  connect: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  write: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  connectDuration: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  readDuration: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  writeDuration: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  duration: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  sequelize: connection, // Pass the connection instance
  modelName: 'Check', // Correct model name
  // Other model options
});

export default Check;
