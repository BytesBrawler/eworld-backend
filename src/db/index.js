const mysql2 = require('mysql2');
const {DB_NAME} = require('../constants');
 require('dotenv').config();
//require('dotenv').config({ path: __dirname + '/../.env' });
console.log("DB credentials:", {
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
  });
  


// Create the connection pool. The pool-specific settings are the defaults
const db = mysql2.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'local',
  dateStrings: true 
}).promise(); // Using promise mode

// Test the connection and print the result
db.getConnection()
  .then(connection => {
  console.log("Database connection successful!");
  connection.release(); // Release the connection back to the pool
  })
  .catch(err => {
  console.error("Database connection failed:", err);
  });



module.exports = db;
