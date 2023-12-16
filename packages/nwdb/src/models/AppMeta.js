import { Model, DataTypes } from 'sequelize'
import sequelize from '../connect/index.js'

class AppMeta extends Model {}

AppMeta.init({
  key: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  value: {
    type: DataTypes.STRING
  }
}, {
  sequelize, 
  modelName: 'AppMeta'
});

export default AppMeta