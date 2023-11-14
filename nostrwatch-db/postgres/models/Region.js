const { Model, DataTypes } = require('sequelize');
const sequelize = require('../path/to/your/database-connection'); // Adjust the path to your Sequelize connection setup

class Region extends Model {}

Region.init({

  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  lat: {
    type: DataTypes.DATE,
    allowNull: false
  },
  lon: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  sequelize, 
  modelName: 'Region'
});

module.exports = Region;
