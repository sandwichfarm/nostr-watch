import { Sequelize, Model, DataTypes } from 'sequelize'
import sequelize from '../connect/index.js'

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
      name: 'index_software_on_data',
      fields: [Sequelize.literal("((data ->> 'software')::text)")]
    },
    {
      name: 'index_version_on_data',
      fields: [Sequelize.literal("((data ->> 'version')::text)")]
    },
    {
      name: 'index_payment_required_on_data',
      fields: [Sequelize.literal("((data -> 'limitation' ->> 'payment_required')::boolean)")]
    },
    {
      fields: ['data'],
      using: 'GIN'
    }
  ]
});

export default Info