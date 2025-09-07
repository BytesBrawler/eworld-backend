const db = require("../db");

async function getOperators(typeId, userId) {
  console.log("Querying all operators");
  console.log(typeId);
  console.log(userId);
  
  const [operators] = await db.query(
    `SELECT o.id, o.description as name, o.code, o.min_digits, o.max_digits, 
            o.min_recharge, o.max_recharge 
     FROM keywords AS o 
     LEFT JOIN keyword_settings AS os ON os.keyword_id = o.id AND os.user_id = ? 
     LEFT JOIN operators AS k ON k.id = o.operator_id
     WHERE o.status = 1 AND k.type = ? AND COALESCE(os.enabled, 1) = 1 And k.status = 1
     ORDER BY o.description`,
    [userId, typeId]
  );
  return operators;
}


async function getKeywordsOfferCheck({ operatorId }) {
  const [keywords] = await db.query(
    `SELECT * FROM keywords as k 
        JOIN apis as a ON k.api = a.id
        WHERE k.operator_id = ? AND a.type = 'offercheck'`,
    [operatorId]
  );
  return keywords;
}

async function getKeywordLines({ keywordId}) {
  console.log("Querying all keywords");
  console.log(keywordId);
  const [keywords] = await db.query(
    `SELECT * FROM keywords as k 
        JOIN apis as a ON k.api = a.id
        JOIN operators as o ON o.id = k.operator_id
        WHERE k.operator_id = ?`,
    [operatorId]
  );
  return keywords;
}

async function updateRecharges({
  user_id,
  operatorId,
  customerNumber,
  amount,
  deducted_amount
}) {
  const [recharge] = await db.query(
    `INSERT INTO recharges (operator_id, mobile_number, amount, user_id, deducted_amount) VALUES (?, ?, ?, ?, ?)`,

    [operatorId, customerNumber, amount, user_id, deducted_amount]
  );
  return recharge;
}

module.exports = {
  getOperators,
 getKeywordLines,
  getKeywordsOfferCheck,
  updateRecharges
};
