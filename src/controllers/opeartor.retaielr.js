const db = require("../db");
const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const query = require("../db/queries");
const marginQuery = require("../db/margin.query");
const confQuery = require("../db/configuration.query");

const { getRoleAccess } = require("./general.controller");
const {dynamicRechargeCall} = require("./dynamicrecharge");
const updateBalanceQueue = require("../queues/updateBalanceQueue");
const { get } = require("../routes/operator.routes");

const updateKeywordSettings = asyncHandler(async (req, res) => {
  const {
    id,
    keyword,
    margin,
    enabled,
    all,
    role,
    additional_charges,
    is_charges_fixed
  } = req.body;
  console.log(req.body);

  // Validate keyword exists
  const keywordDetails = await confQuery.getKeywordById(keyword);
  if (!keywordDetails) {
    throw new ApiError(404, "Keyword not found");
  }

  // Validate user exists
  const user = await query.users({ id: id });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  let updateParams;
  let result;

  if (all == false) {
    // Prepare update object
    updateParams = {
      id: id,
      keywordId: keyword,
      marginAmount: margin,
      enabled: enabled,
      additional_charges: additional_charges,
      is_charges_fixed: is_charges_fixed
    };

    // Perform the update
    result = await marginQuery.updateKeywordsSettingsQuery(updateParams);
    console.log(result);

    if (result === 0) {
      throw new ApiError(500, "Failed to update settings");
    }

    const [update] = await db.query(
      'update users set margin_type = "customised" where id = ?',
      [id]
    );
  } else {
    console.log("updating all");
    // const updateRecords = await marginQuery.updateKeywordRecordsQuery({
    //   id: id,
    //   keywordId: keyword,
    //   marginAmount: margin,
    //   enabled: enabled,
    //   role: role
    // });
    // console.log(updateRecords);

    // // Fetch all users in a single query
    // const [users] = await db.query(
    //   `SELECT id FROM users WHERE parent_id = ? AND role_id = ? AND margin_type != 'flat'`,
    //   [id, role]
    // );

    // if (users.length > 0) {
    //   // Call batch update function instead of looping
    //   const updateParams = users.map(user => ({
    //     id: user.id,
    //     keywordId: keyword,
    //     marginAmount: margin,
    //     enabled: enabled
    //   }));

    //   const result = await marginQuery.updateKeywordsSettingsBatch(updateParams);
    //   console.log(result);

    //   if (result === 0) {
    //     throw new ApiError(500, "Failed to update settings");
    //   }

    //   // // Batch update users' margin_type in a single query
    //   // const userIds = users.map(user => user.id);
    //   await db.query(
    //     `UPDATE users SET margin_type = 'customised' WHERE parent_id = ? AND role_id = ? AND margin_type != 'flat'`
    //     [id, role]
    //   );
    // }

    // const updateRecordParams = {
    //   id: id,
    //   operatorId: operator,
    //   marginAmount: margin,
    //   enabled: enabled,
    //   role: role
    //   };

    const updateRecords = await marginQuery.updateKeywordRecordsQuery({
      id: id,
      keywordId: keyword,
      marginAmount: margin,
      enabled: enabled,
      role: role,
      additional_charges: additional_charges,
      is_charges_fixed: is_charges_fixed
    });
    console.log(updateRecords);
    let users;

    if (margin === null) {
      [users] = await db.query(
        `SELECT id FROM users WHERE parent_id = ? and role_id = ? `,
        [id, role]
      );
      console.log("this is null");
    } else {
      [users] = await db.query(
        `SELECT id FROM users WHERE parent_id = ? and role_id = ? and margin_type != 'flat'`,
        [id, role]
      );
    }

    console.log(users);

    //add wait for 5 secondsl
    //await new Promise(resolve => setTimeout(resolve, 5000));

    for (const user of users) {
      console.log("updating for user", user.id);
      const updateParams = {
        id: user.id,
        keywordId: keyword,
        marginAmount: margin,
        enabled: enabled,
        additional_charges: additional_charges,
        is_charges_fixed: is_charges_fixed
      };

      const result =
        await marginQuery.updateKeywordsSettingsQuery(updateParams);
      console.log(result);

      if (result === 0) {
        throw new ApiError(500, "Failed to update settings");
      }
    }
    await db.query(
      `update users set margin_type = "customised" WHERE parent_id = ? and role_id = ? and margin_type != 'flat'`,
      [id, role]
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, result, "Operator settings updated successfully")
    );
});

const getUserMargin = asyncHandler(async (req, res) => {
  const { id, role, all } = req.query;
  console.log(" req.query", req.query);

  if (!id) throw new ApiError(404, "User not found");

  console.log(req.query);
  if (all == "true") {
    console.log("this is at all");
    let margin = await marginQuery.getKeywordRecord({
      id,
      role: role
    });
    console.log("margins is", margin);
    return res
      .status(200)
      .json(new ApiResponse(200, margin, "Margin fetched successfully"));
  }

  const user = await query.findUserById(id);
  console.log(user);
  // const [user] = await db.query(`SELECT * from users where id = ?`, [id]);

  if (user.length === 0) throw new ApiError(404, "User not found");

  // const isAccess = await getRoleAccess(req.user.role, 5, id, req.user.id);
  // if (!isAccess) throw new ApiError(403, "Unauthorized to get margin");

  let margin = await marginQuery.getKeywordsList({
    id,
    role: user.role_id
  });
  console.log(margin);
  return res
    .status(200)
    .json(new ApiResponse(200, margin, "Margin fetched successfully"));
});

const deleteCustomMargin = asyncHandler(async (req, res) => {
  const { retailer, operator } = req.body;

  // Validate user permissions if needed
  if (req.user.role !== 1 && req.user.role !== 2) {
    throw new ApiError(403, "Unauthorized to remove custom margin");
  }

  const user = await query.users({ id: retailer });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const operatorDetails = await query.getOperatorById(operator);
  if (!operatorDetails) {
    throw new ApiError(404, "Operator not found");
  }

  const result = await removeCustomMargin({
    retailerId: retailer,
    operatorId: operator
  });

  if (result === 0) {
    throw new ApiError(500, "Failed to remove custom margin");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Custom margin removed successfully"));
});

async function removeCustomMargin({ retailerId, operatorId }) {
  const [result] = await db.query(
    `DELETE FROM operator_settings WHERE user_id = ? AND operator_id = ?`,
    [retailerId, operatorId]
  );
  return result.affectedRows;
}

// const updateLineBalance = asyncHandler(async (req, res) => {
//   const { lineId, keywordId, type } = req.body;

//   // Push the job to a queue system
//   await queue.add('eworld-updateLineBalanceJob', { lineId, keywordId, type });

//   return res.status(202).json(new ApiResponse(202, null, "Update request received. Balance update will be processed shortly."));
// });

const updateLineBalance = asyncHandler(async (req, res) => {
  const { lineId, keywordId, type } = req.body;

  let line = [];
  console.log("lineId", lineId);


  if (type === "single") {
    console.log("1");
    // [line] = await db.query(`SELECT kl.* FROM keyword_lines WHERE id = ? AND keyword_id = ?`, [lineId, keywordId]);

    try {
      [line] = await db.query(
        `SELECT * FROM keyword_lines WHERE id = ? AND keyword_id = ?`,
        [lineId, keywordId]
      );
      console.log("line", line);
    } catch (error) {
      console.error("❌ DB Query Error:", error);
    }
    let finalBalance = 0;
    console.log("line", line);
    for (const lineItem of line) {
      const response = await dynamicRechargeCall(
        lineItem.api_provider,
        lineItem.balance_check_api,
        { opcode: lineItem.merchant_code }
      );
      
      console.log(response);
      if (
        response.status === "error" ||
        response.status === "failed" ||
        !response.filters.bal
      ){
        throw new ApiError(401, `Failed to get balance - ${JSON.stringify(response)}`);
      }

      let balanceValue = response.filters.bal;
      // Handle case where balance is an object with multiple values
      if (typeof balanceValue === 'object' && balanceValue !== null) {
        balanceValue = Object.values(balanceValue).reduce((sum, val) => {
          const numVal = parseFloat(val);
          return sum + (isNaN(numVal) ? 0 : numVal);
        }, 0);
      }

      finalBalance = parseFloat(balanceValue) || 0;

      await db.query(`UPDATE kl_financials SET balance = ? WHERE kl_id = ?`, [
        finalBalance,
        lineItem.id
      ]);
    }
    return res
    .status(201)
    .json(new ApiResponse(201, {balance : finalBalance}, "Balance fetched succesfully"));
  
  } else {
    await updateBalanceQueue.add("eworld-updateLineBalanceJob", {
      lineId,
      keywordId,
      type
    });

    return res
    .status(202)
    .json(new ApiResponse(202, {
      message:
        "Balance update job added to the queue. It will be processed in background."
    }));

    // return res.status(202).json({
    //   message:
    //     "Balance update job added to the queue. It will be processed in background."
    // });
  }
});

// const updateLineBalance = asyncHandler(async (req, res) => {
//   const {lineId,keywordId,type} = req.body;
//   let line = null;

//   if (type == "single"){
//     [line] = await db.query(
//       `SELECT kl.* FROM keyword_lines as kl  WHERE id = ? AND keyword_id = ?`,
//       [lineId,keywordId  ]
//     );
//   }else if(type == "keyword"){
//     [line] = await db.query(
//       `SELECT kl.* FROM keyword_lines as kl  WHERE keyword_id = ?`,
//       [keywordId  ]
//     );
//   }else if(type == "all"){
//     [line] = await db.query(
//       `SELECT kl.* FROM keyword_lines as kl  `
//     );
//   }
//   console.log("line", line);

//   if (line.length === 0) throw new ApiError(404, "Line not found");

//   //for eac line we will call the dynaimc recharge function and if get balance then update the balace for the line in kl_finaicials table of that line

//   for (const lineItem of line) {

//     console.log("line item", lineItem);

//     const balanceCheckResponse = await dynamicRechargeCall(
//       lineItem.api_provider,
//       lineItem.balance_check_api ,
//       {opCode : lineItem.merchant_code},
//     );
//    // console.log(balanceCheckResponse);

//     if (balanceCheckResponse.status === "error" || balanceCheckResponse.filters.bal === null ||balanceCheckResponse.status === "failed" ) {
//       continue;
//     }

//     if(balanceCheckResponse.filters.bal !== null){
//       const [update] = await db.query(
//         `UPDATE kl_financials SET balance = ? WHERE kl_id = ?`,
//         [balanceCheckResponse.filters.bal, lineItem.id]
//       );
//       console.log("updated", update);

//     }

//   }

//   return res
//     .status(200)
//     .json(new ApiResponse(200, line, "Line balance updated successfully"));

// });


const getCircles = asyncHandler(async (req, res) => {
  const {providerId} = req.query;
  console.log("providerId", providerId);
  if (!providerId) throw new ApiError(404, "Provider not found");
  const [circles] = await db.query(
    `SELECT id,name FROM circles`
  );
  console.log("circles", circles);
  return res
    .status(200)
    .json(new ApiResponse(200, circles, "Circles fetched successfully")
  )

});

module.exports = {
  getUserMargin,
  deleteCustomMargin,
  updateKeywordSettings,
  updateLineBalance,
  removeCustomMargin,
  getCircles
};
