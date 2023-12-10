import { Sequelize, Model, DataTypes } from 'sequelize'
import connection from '../connect/index.js'

class Info extends Model {}

Info.init({
  id: {
    type: DataTypes.STRING, //hash
    primaryKey: true
  },
  relay_id: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'relays',
      key: 'id'
    }
  },
  data: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
}, {
  connection, 
  modelName: 'Info', 
  indexes: [
    {
      fields: [Sequelize.literal("((data ->> 'software')::text)")]
    },
    {
      fields: [Sequelize.literal("((data ->> 'version')::text)")]
    },
    {
      fields: [Sequelize.literal("((data -> 'limitation' ->> 'payment_required')::boolean)")]
    },
    {
      fields: ['data'],
      using: 'GIN'
    }
  ]
});

export default Info