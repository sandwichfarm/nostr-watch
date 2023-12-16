import { Model, DataTypes } from 'sequelize';
import sequelize from '../connect/index.js'

class Checkstatus extends Model {}

Checkstatus.init({
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
  sequelize: sequelize
});

export default Checkstatus;
