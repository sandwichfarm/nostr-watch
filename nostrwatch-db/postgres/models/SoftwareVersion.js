const { Model, DataTypes } = require('sequelize');
const sequelize = require('../path/to/your/database-connection'); // Adjust the path to your Sequelize connection setup

class Software extends Model {}

Software.init({
  // Model attributes are defined here
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  version: {
    type: DataTypes.STRING,
    allowNull: false
  },
}, {
  // Other model options go here
  sequelize, // We need to pass the connection instance
  modelName: 'Software' // We need to choose the model name
});

module.exports = Software;
