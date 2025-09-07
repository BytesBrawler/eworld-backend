
const db = require("../db");


async function getKeywordsList({ id, role }) {
    let keywords = [];
  
    if (![1,2, 3, 4, 5 ,6].includes(role)) {
      return keywords;
    }
  
    console.log("user id is " + id);
  
    const marginFields = {
      1: { standard: "mdist_std_margin" },
      2: { standard: "mdist_std_margin" },
      3: { standard: "mdist_std_margin" },
      4: { standard: "dist_std_margin"},
      5: { standard: "ret_std_margin"},
      6: { standard: "ret_std_margin"},
    };
  
    const { standard} = marginFields[role];
  
    
    const query = `
      SELECT 
        k.id as id,
        k.description AS name,
        k.code AS code,
        k.${standard} AS standard_margin,
        o.name as operator_name,
        ot.name AS type,
        u.margin_type as margin_type,
        COALESCE(ks.custom_margin, 
          CASE 
            WHEN u.margin_type = 'flat' THEN 0.0
            ELSE k.${standard}
          END
        ) AS effective_margin,
        COALESCE(ks.additional_charges, k.additional_charges) AS additional_charges,
        COALESCE(ks.is_charges_fixed, true) AS is_charges_fixed,
        COALESCE(ks.enabled, true) AS is_enabled,
        CASE 
            WHEN ks.custom_margin IS NOT NULL THEN 'custom'
            ELSE 'standard'
        END AS margin_status,
        ks.created_at,
        ks.updated_at
      FROM keywords as k
      LEFT JOIN users u ON u.id = ?
      LEFT JOIN operators o ON k.operator_id = o.id
      LEFT JOIN keyword_settings ks ON 
        ks.keyword_id = k.id AND 
        ks.user_id = ?
      LEFT JOIN operator_types ot ON ot.id = o.type 
    `;
  
    [keywords] = await db.query(query, [id, id]);
  
    console.log("operators:", keywords);
    return keywords;
  }

  async function getKeywordRecord({id , role}){

    console.log("is at get records");
    let operators = [];
    if (!["1","2","3", "4", "5" , "6"].includes(role)) {
        console.log("role is not 3,4,5");
      return operators;
    }

    console.log("user id is " + id);
    console.log("role is " + role);

    const marginFields = {
        1: { standard: "mdist_std_margin", custom: "mdist_cust_margin" },
        2: { standard: "mdist_std_margin", custom: "mdist_cust_margin" },
        3: { standard: "mdist_std_margin", custom: "mdist_cust_margin" },
        4: { standard: "dist_std_margin", custom: "dist_cust_margin" },
        5: { standard: "ret_std_margin", custom: "ret_cust_margin" },
        6: { standard: "ret_std_margin", custom: "ret_cust_margin" },
      };
    
      const { standard, custom } = marginFields[role];

      console.log(standard, custom);

      const query = `
      SELECT 
        k.id as id,
        k.description AS name,
        k.code AS code,
        k.${standard} AS standard_margin,
        COALESCE(kpr.custom_margin, k.${standard}) AS effective_margin,
        COALESCE(kpr.enabled, true) AS is_enabled,
        COALESCE(kpr.additional_charges, k.additional_charges) AS additional_charges,
        COALESCE(kpr.is_charges_fixed, true) AS is_charges_fixed,

        o.name as operator_name,
        ot.name AS type,
        CASE 
            WHEN kpr.custom_margin IS NOT NULL THEN 'custom'
            ELSE 'standard'
        END AS margin_status
      FROM keywords k
      LEFT JOIN operators o ON k.operator_id = o.id
      LEFT JOIN operator_types ot ON ot.id = o.type  
      LEFT JOIN keyword_record kpr ON kpr.keyword_id = k.id 
        AND kpr.user_id = ? 
        AND kpr.role = ?
    `;
    
    [operators] = await db.query(query ,[id, role]);
    console.log("operators:", operators);
    return operators;
  }


async function updateKeywordsSettingsQuery({
    id,
    keywordId,
    marginAmount,
    enabled,
    additional_charges,
    is_charges_fixed
  }) {

    console.log("updating settings for user", id);
    console.log("keyword id is " + keywordId);
    console.log("margin amount is " + marginAmount);
    console.log("enabled is " + enabled);
    console.log("additional_charges is " + additional_charges);
    console.log("is_charges_fixed is " + is_charges_fixed);
    const [result] = await db.query(
      `INSERT INTO keyword_settings 
         (user_id, keyword_id, custom_margin, enabled,additional_charges ,is_charges_fixed) 
         VALUES (?, ?, ?, ?,?,?)
         ON DUPLICATE KEY UPDATE 
         custom_margin = COALESCE(?, custom_margin),
         enabled = COALESCE(?, enabled),
         additional_charges = COALESCE(?, additional_charges),
         is_charges_fixed = COALESCE(?, is_charges_fixed)`,
      [id, keywordId, marginAmount, enabled ?? true, additional_charges ,is_charges_fixed ?? true, marginAmount, enabled , additional_charges ,is_charges_fixed ]
    );
  
    return result.affectedRows;
  }
  
  

async function updateKeywordRecordsQuery({
    id,
    keywordId,
    marginAmount,
    enabled,
    role,
    additional_charges,
    is_charges_fixed
  }) {
    const [result] = await db.query(
      `INSERT INTO keyword_record 
         (user_id, keyword_id, custom_margin, enabled , role, additional_charges ,is_charges_fixed) 
         VALUES (?, ?, ?, ?,?,?,?)
         ON DUPLICATE KEY UPDATE 
         custom_margin = COALESCE(?, custom_margin),
         enabled = COALESCE(?, enabled),
         additional_charges = COALESCE(?, additional_charges),
         is_charges_fixed = COALESCE(?, is_charges_fixed)`,
      [id, keywordId, marginAmount, enabled ?? true, role, additional_charges ,is_charges_fixed ?? true, marginAmount, enabled , additional_charges ,is_charges_fixed ]
    );
  
    return result.affectedRows;
  }
  
  


module.exports = {
getKeywordsList,
getKeywordRecord,
  updateKeywordsSettingsQuery,
    updateKeywordRecordsQuery,
  //  updateKeywordsSettingsBatch
};
