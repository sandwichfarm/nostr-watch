const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // additional configuration as needed
});

module.exports = pool; 