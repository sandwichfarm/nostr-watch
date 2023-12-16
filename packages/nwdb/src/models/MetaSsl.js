import { Model, DataTypes } from 'sequelize'
import sequelize from '../connect/index.js'

class Ssl extends Model {}

Ssl.init(
  {
    // Model attributes are defined here
    id: {
      type: DataTypes.STRING, //hash
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
    data: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
  }, {
    sequelize,
    indexes: [
      {
        fields: ['data'],
        using: 'GIN'
      }
    ]
  }
);

export default Ssl