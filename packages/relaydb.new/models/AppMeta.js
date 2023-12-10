import { Model, DataTypes } from 'sequelize'
import connection from '../connect/index.js'

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
  connection, 
  modelName: 'AppMeta'
});

export default AppMeta