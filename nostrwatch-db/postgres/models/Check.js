const { Model, DataTypes } = require('sequelize');
const sequelize = require('../path/to/your/database-connection'); // Adjust the path to your Sequelize connection setup

class Check extends Model {}

Check.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  relay_id: {
    type: DataTypes.STRING,
    references: {
      model: Relay,
      key: 'id'
    }
  },
  region_id: {
    type: DataTypes.STRING,
    references: {
      model: Region,
      key: 'id'
    }
  },
  software_id: {
    type: DataTypes.STRING,
    references: {
      model: Software,
      key: 'id'
    }
  },
  software_version: {
    type: DataTypes.INTEGER,
    references: {
      model: SoftwareVersion,
      key: 'id'
    }
  },
  online: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  read: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  write: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  latency_connect: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  latency_read: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  latency_write: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  nip11_hash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  checked_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
}, {
  // Other model options go here
  sequelize, // We need to pass the connection instance
  modelName: 'User', // We need to choose the model name
  timestamps: false
});

module.exports = User;
