const { Model, DataTypes } = require('sequelize');
const sequelize = require('../path/to/your/database-connection'); // Adjust the path to your Sequelize connection setup

class Region extends Model {}

Region.init({
  // Model attributes are defined here
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  relay_id: {
    type: DataTypes.STRING,
    allowNull: false
  },
  nip_id: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  // Other model options go here
  sequelize, // We need to pass the connection instance
  modelName: 'Region' // We need to choose the model name
});

module.exports = Region;
