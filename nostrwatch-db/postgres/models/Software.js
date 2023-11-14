const { Model, DataTypes } = require('sequelize');
const sequelize = require('../path/to/your/database-connection'); // Adjust the path to your Sequelize connection setup

class SoftwareVersion extends Model {}

SoftwareVersion.init({
  // Model attributes are defined here
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
}, {
  // Other model options go here
  sequelize, // We need to pass the connection instance
  modelName: 'SoftwareVersion' // We need to choose the model name
});

module.exports = SoftwareVersion;
