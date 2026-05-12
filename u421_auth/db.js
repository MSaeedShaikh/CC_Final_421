const { Pool } = require('pg');

const pool = new Pool({
  host: 'u421_postgres',
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  port: 5432,
});

module.exports = pool;
