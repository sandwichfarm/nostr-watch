const { Model, DataTypes } = require('sequelize');
const sequelize = require('../path/to/your/database-connection'); // Adjust the path to your Sequelize connection setup

class Nip extends Model {}

Nip.init({
  // Model attributes are defined here
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    unique: true
  }
}, {
  // Other model options go here
  sequelize, // We need to pass the connection instance
  modelName: 'Nip' // We need to choose the model name
});

module.exports = Nip;
