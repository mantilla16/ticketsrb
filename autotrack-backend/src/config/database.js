const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.connect((err) => {
  if (err) console.error('Error connecting to PostgreSQL:', err.message);
  else console.log('Connected to PostgreSQL');
});

module.exports = pool;
