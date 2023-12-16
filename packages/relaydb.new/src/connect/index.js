import dotenv from 'dotenv';
import postgres from './postgres.js';

dotenv.config();

const dialect = process.env.DB_DIALECT || 'postgres';
const dialects = {
  postgres: postgres
};

const sequelize = dialects[dialect]()

try {
  await sequelize.authenticate();
  console.log('Connection has been established successfully.');
} catch (error) {
  throw new Error('Unable to connect to the database:', error);
}

export default sequelize;