const mysql = require('mysql2/promise');

// Database configuration (adjust as needed)
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'eworld'
};

async function testBalanceTypeQueries() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database');

    // Test 1: Simple SELECT from bal_transactions with balance_type
    console.log('\n=== Test 1: Select from bal_transactions ===');
    const [rows1] = await connection.query(`
      SELECT id, amount, balance_type, transaction_type, status
      FROM bal_transactions 
      LIMIT 5
    `);
    console.log('Results:', rows1);

    // Test 2: UNION query similar to the one we fixed
    console.log('\n=== Test 2: UNION query ===');
    const [rows2] = await connection.query(`
      SELECT
        bt.amount,
        bt.status,
        bt.transaction_type,
        bt.created_at,
        bt.reference_id,
        bt.prev_balance,
        bt.new_balance,
        bt.remark,
        bt.balance_type
      FROM bal_transactions AS bt
      LIMIT 2
      
      UNION ALL
      
      SELECT
        t.amount,
        t.status,
        'online' AS transaction_type,
        t.created_at,
        t.reference_id,
        NULL AS prev_balance,
        NULL AS new_balance,
        t.payment_mode AS remark,
        NULL AS balance_type
      FROM transactions AS t
      LIMIT 2
    `);
    console.log('UNION Results:', rows2);

    console.log('\n✅ All tests passed! UNION queries are working correctly.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ER_WRONG_NUMBER_OF_COLUMNS_IN_SELECT') {
      console.error('This is the column mismatch error we were trying to fix');
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testBalanceTypeQueries();