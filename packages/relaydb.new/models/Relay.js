import { Model, DataTypes } from 'sequelize';
import connection from '../connect/index.js'

class Relay extends Model {}

Relay.init({
  id: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  network: {
    type: DataTypes.ENUM,
    values: ['clearnet', 'tor', 'i2p', 'cjdns'],
    allowNull: false
  },
  first_seen: {
    type: DataTypes.DATE,
    allowNull: true
  },
  dead: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false 
  },
  parent_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'relays',
      key: 'id'
    }
  }
}, {
  sequelize: connection,
  modelName: 'Relay',
  indexes: [
    {
      unique: true,
      fields: ['url']
    },
    {
      unique: false,
      fields: ['network']
    },
    {
      unique: false,
      fields: ['first_seen']
    },
    {
      unique: false,
      fields: ['dead']
    },
    {
      unique: false,
      fields: ['parent_id']
    }
  ]
}); 

export default Relay;
