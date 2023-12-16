import { Model, DataTypes } from 'sequelize';
import sequelize from '../connect/index.js'

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
  type: {
    type: DataTypes.ENUM,
    values: ['general', 'proxy', 'aggregate', 'personal', 'archive', 'specialized'],
    defaultValue: 'general'
  },
  first_seen: {
    type: DataTypes.DATE,
    defaultValue: null
  },
  last_seen: {
    type: DataTypes.DATE,
    defaultValue: null
  },
  dead: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false 
  },
  parent_id: {
    type: DataTypes.STRING,
    allowNull: true,
    references: {
      model: 'Relays',
      key: 'id'
    }
  }
}, {
  sequelize: sequelize,
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
      fields: ['last_seen']
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
