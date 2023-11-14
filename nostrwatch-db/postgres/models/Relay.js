const { Model, DataTypes } = require('sequelize');
const sequelize = require('../connect.js'); // Adjust the path to your Sequelize connection setup

class Relay extends Model {}

Relay.init({
  // Model attributes are defined here
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  first_seen: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_seen: {
    type: DataTypes.STRING,
    allowNull: true
  },
  last_checked: {
    type: DataTypes.DATE,
    allowNull: true
  },
  dead: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false 
  },
  parent: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Relay,
      key: 'id'
    }
  },
  is_relay: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_parent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false 
  },
  nip11_hash: {
    type: DataTypes.STRING,
    allowNull: true
  },
}, {
  // Other model options go here
  sequelize, // We need to pass the connection instance
  modelName: 'Relay' // We need to choose the model name
});

module.exports = User;
