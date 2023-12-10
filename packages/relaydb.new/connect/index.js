import dotenv from 'dotenv';
import postgres from './postgres';

dotenv.config();

const dialect = process.env.DB_DIALECT || 'postgres';
const dialects = {
  postgres: postgres
};

export default dialects[dialect];