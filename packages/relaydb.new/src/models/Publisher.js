import { Model, DataTypes } from 'sequelize'
import sequelize from '../connect/index.js'

class Publisher extends Model {}

Publisher.init({
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  geo_id: {
    type: DataTypes.STRING,
    reference: {
      model: 'Geos',
      key: 'id'
    }
  },
}, {
  sequelize
});

export default Publisher