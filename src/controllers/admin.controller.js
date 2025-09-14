const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const query = require("../db/queries");
const { getRoleAccess } = require("./general.controller");
const db = require("../db");
const rechargeController = require("./retailer.controller");
const {dynamicRechargeCall} = require("./dynamicrecharge");
const messageUtils = require("../utils/sendMessage");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const getUsers = asyncHandler(async (req, res) => {
  const { role_id } = req.query;

  if (!role_id) {
    throw new ApiError(500, "Please provide correct data");
  }
  if (req.user.role > role_id) {
    throw new ApiError(403, "You are not authorized to view this user");
  }

  const users = await query.users({ role_id });
  if (!users) {
    throw new ApiError(404, "No users found");
  }
  return res.status(201).json(new ApiResponse(200, users, "Users Fetched"));
});

const getPendingRecharges = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const offset = (page - 1) * limit;

  const [recharges] = await db.query(
    `SELECT * FROM recharge WHERE status = 'pending' LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        recharges,
        "Pending Recharges Retrieved Successfully"
      )
    );
});

// Get user transaction history with detailed filters
const getUserTransactions = asyncHandler(async (req, res) => {
  const {
    startDate,
    endDate,
    userId,
    transactionType,
    status,
    page = 1,
    limit = 10
  } = req.query;

  const offset = (page - 1) * limit;

  const transactions = await query.getUserTransactions({
    startDate,
    endDate,
    userId,
    transactionType,
    status,
    offset,
    limit
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        transactions,
        "User Transactions Retrieved Successfully"
      )
    );
});

const updateTxn = asyncHandler(async (req, res) => {
  console.log(req.body);
const {reqId, txnId} = req.body;

if(!reqId || !txnId){
  throw ApiError(400, "Please provide correct data");
}

const updateRecharge = await query.db.query(
  "update recharges set txnid = ? where reqid = ?",
  [txnId,reqId]
);

 return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {},
        "Recharge updated succesfully"
      )
    );
});

// Get operator performance metrics
const getOperatorPerformance = asyncHandler(async (req, res) => {
  const { startDate, endDate, keywordId, page = 1, limit = 50 , id } = req.query;

  const offset = (page - 1) * limit;
 
  const userId = id ??  req.user.id;
 let role = req.user.role;
  if(id){
    const [user] = await db.query(
      `SELECT role_id FROM users WHERE id = ?`,
      [id]
    );
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    console.log("user", user);

    role = user[0].role_id;

  }


  const { keywords, totals } = await query.getOperatorPerformance(
    role,
    userId,
    {
      startDate,
      endDate, 
      keywordId,
      offset,
      limit
    }
  );


  return res.status(200).json(
    new ApiResponse(
      200,
      {
        keywords,
        totals
      },
      "Operator Performance Retrieved Successfully"
    )
  );
});

const resetPassword = asyncHandler(async (req, res) => {
  const { id, password } = req.body;
  if (!id || !password) {
    throw new ApiError(400, "Please provide correct data");
  }
  const [user] = await db.query(`SELECT * FROM users WHERE id = ?`, [id]);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const [updateUser] = await db.query(
    `UPDATE users SET password = ? WHERE id = ?`,
    [hashedPassword, id]
  );

  messageUtils.sendMessageToUser(
    user.id,
    `Dear User, Your new password for eworld is  ${password}`,
    "number"
  );
  if (!updateUser) {
    throw new ApiError(500, "Failed to update user");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "User password updated successfully"));
});

// Get commission reports
const getCommissionReports = asyncHandler(async (req, res) => {
  const {
    startDate,
    endDate,
    userId,
    operatorId,
    page = 1,
    limit = 10
  } = req.query;

  const offset = (page - 1) * limit;

  const commissions = await query.getCommissionReports({
    startDate,
    endDate,
    userId,
    operatorId,
    offset,
    limit
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        commissions,
        "Commission Reports Retrieved Successfully"
      )
    );
});

// Get dashboard summary
const getDashboardSummary = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const summary = await query.getDashboardSummary({
    startDate,
    endDate
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, summary, "Dashboard Summary Retrieved Successfully")
    );
});

// Get comprehensive recharge reports
const getRechargeReports = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    startDate,
    endDate,
    operatorType,
    keyword,
    retailerNumber,
    number,
    apiProvider,
    status,
    minAmount,
    maxAmount
  } = req.query;
  console.log("Recharge Reports Query Parameters: ", req.query);

  const reports = await query.getRechargeReports({
    page,
    limit,
    startDate,
    endDate,
    operatorType,
    keyword,
    retailerNumber,
    number,
    apiProvider,
    status,
    minAmount,
    maxAmount
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, reports, "Recharge Reports Retrieved Successfully")
    );
});

const updateRecharge = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type } = req.body;

  if (!id) {
    throw new ApiError(400, {}, "Please provide correct data");
  }

  const [[recharge]] = await db.query(`SELECT * FROM recharges WHERE id = ?`, [
    id
  ]);

  const [[user]] = await db.query(`SELECT * FROM users WHERE id = ?`, [
    recharge.user_id
  ]);

  console.log(user);

  const [[lastgig]] = await db.query(
    `SELECT * from recharge_gigs where rech_id = ? order by id desc limit 1`,
    [recharge.id]
  );
  console.log("lastgig", lastgig);

  let currentline;


if(lastgig !== null && lastgig !== undefined){
   [[currentline]] = await db.query(
    `select * from keyword_lines where id = ?`,
    [lastgig.line_id]
  );
}
  let finalFilters;

  console.log(recharge);
  console.log("currentline", currentline);
  let finalStatus = recharge.status;
  let amount = recharge.amount;

  console.log("final status", finalStatus);
  if (type === "fail") {
    console.log("fail");
    if (finalStatus === "failed") {
      return res
        .status(200)
        .json(new ApiResponse(200, {}, "Recharge Already Failed"));
    }
    finalStatus = "failed";
  } else if (type === "success") {
    console.log("success");
    if (finalStatus === "success") {
      console.log("Resending");
      return res
        .status(200)
        .json(new ApiResponse(200, {}, "Recharge Already Success"));
    }
    console.log("returned from ehre");
    finalStatus = "success";
  } else if (type === "status") {
    // Handle the "status" type logic

    const baseParams = {
      mobile: recharge.number,
      amount: recharge.amount,
      reqid: recharge.reqid,
      remark: "mobile Recharge Status check"
    };
    const [keywordDetails] = await db.query(
      `SELECT * FROM keywords WHERE id = ?`,
      [recharge.keyword_id]
    );

    const attemptParams = {
      ...baseParams,
      opcode: currentline.merchant_code ?? keywordDetails.code
    };

    console.log("Attempt Params: ", attemptParams);
    console.log(currentline);

    const statusResponse = await dynamicRechargeCall(
      currentline.api_provider,
      currentline.status_check_api,
      {
        ...attemptParams,
        txnid: recharge.txnid
      }
    );

    console.log("Status Response: ", statusResponse);

    if (statusResponse?.status === "error") {
      throw new ApiError(
        500,
        `Recharge Status Check Failed due to ${statusResponse?.error}`
      );
    }

    //update line gig with new conif gof statteus check
    await db.query(
      ` insert into recharge_gigs (rech_id, user_id, line_id, api_id, provider_id, amount, prev_balance , config , status, request, response, response_complete,message) 
      VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)`,
      [
        recharge.id,
        recharge.user_id,
        currentline.id,
        currentline.status_check_api,
        currentline.api_provider,
        amount,
        currentline.balance,
        "status_check",
        statusResponse.status,
        JSON.stringify(statusResponse.raw.config),
        JSON.stringify(statusResponse.parsedData),
        JSON.stringify(statusResponse.raw.responseData),
        statusResponse.message
      ]
    );

    finalFilters = statusResponse.filters;

    if (statusResponse?.status === "success") {
      console.log("statusResponse2", statusResponse);
      finalStatus = "success";
      recharge.message = "Recharge successful after recheck";
      recharge.txnId = statusResponse.filters.tid;
      recharge.opId = statusResponse.filters.opId;

      console.log("statusResponse.filters.tid", statusResponse.filters.tid);
      console.log("message", recharge.message);

      // recharge.reqId = statusResponse.filters.reqid;

      if (recharge.status === "success") {
        ("Recharge is already success");
        return res.status(200).json(new ApiResponse(200, {}, recharge.message));
      }

      console.log("moving out");
    } else if (statusResponse?.status === "pending") {
      finalStatus = "pending";
      recharge.message = "Recharge is still pending";
      recharge.txnId = statusResponse.filters.tid;
      // recharge.reqId = statusResponse.filters.reqid;
      if (recharge.status === "pending") {
        return res.status(200).json(new ApiResponse(200, {}, recharge.message));
      }
    } else {
      finalStatus = "failed";
      recharge.message =
        statusResponse.message || "Recharge failed and amount refunded";

      if (recharge.status === "failed") {
        return res.status(200).json(new ApiResponse(200, {}, recharge.message));
      }
    }

    // Ensure the subsequent code executes after handling "status"
    console.log("Continuing to process after status check...");
    console.log("Final Status:", finalStatus);
    console.log("Recharge Details:", recharge);

    // Ensure no early return or throw prevents reaching this point
  }

  console.log("final status", finalStatus);
  if (finalStatus === "success") {
    const result = await rechargeController.calculateUserMargins({
      userId: user.id,
      parentId: user.parent_id,
      keywordId: recharge.keyword_id,
      amount: recharge.amount
    });
    console.log("margin calculated");

    let extraadd = 0;
    if (recharge.status === "failed") {
      extraadd = recharge.amount;
    }

    result.retailerAddition =
      result.retailerAddition +
      (currentline.is_charges_by_user === 1
        ? currentline.is_additional_charges_fixed === 1
          ? parseFloat(currentline.additional_charges)
          : amount * (parseFloat(currentline.additional_charges) / 100)
        : 0);

    const admin_margin =
      (currentline.admin_margin * amount) / 100 -
      result.retailerAddition -
      result.parentAddition -
      result.superAddition +
      (currentline.is_charges_by_admin === 1
        ? currentline.is_additional_charges_fixed === 1
          ? parseFloat(currentline.additional_charges)
          : amount * (parseFloat(currentline.additional_charges) / 100)
        : 0);

    console.log("admin margin", admin_margin);

    console.log("resukt of uodates is ", result);

    const [updateRecharge] = await db.query(
      `UPDATE recharges SET status = ?,deducted_amount = deducted_amount - ?, txnid =?  ,opId = ?, message = ? , com_retailer = ?,com_parent = ?, com_superparent = ? , com_admin = ?,  parent_id =?, superparent_id = ?, completed_at = ? WHERE id = ?`,
      [
        "success",
        result.retailerAddition - extraadd,
        recharge?.txnId,
        recharge?.opId,
        recharge.message,
        result.retailerAddition,
        result.parentAddition,
        result.superAddition,
        admin_margin,
        user.parent_id,
        result.superParentId,
        new Date(),
        recharge.id
      ]
    );

    const [updateUser] = await db.query(
      `UPDATE users SET balance = balance + ? WHERE id = ?`,
      [result.retailerAddition - extraadd, user.id]
    );

    const [updateParent] = await db.query(
      `UPDATE users SET balance = balance + ? WHERE id = ?`,
      [result.parentAddition, user.parent_id]
    );
    if (!result.isDirect) {
      console.log("updaitn master");
      console.log(result.superParentId);
      const [updateSuper] = await db.query(
        `UPDATE users SET balance = balance + ? WHERE id = ?`,
        [result.superAddition, result.superParentId]
      );

      console.log(updateSuper);
    }

    console.log(currentline);
    const parsedMargin = parseFloat(currentline.admin_margin);

    //update currentlinebalance
    const [updateLine] = await db.query(
      `UPDATE kl_financials
       SET balance = CASE 
                       WHEN ? IS NOT NULL AND ? != 0 AND ? != '0' THEN ? 
                       ELSE balance - ? - ?
                     END,
           today_profit = today_profit + ?,
           today_amount = today_amount + ?, 
           today_count = today_count + 1 
       WHERE kl_id = ?`,
      [
        finalFilters?.bal, // First condition for CASE
        finalFilters?.bal, // Second condition for CASE
        finalFilters?.bal, // Third condition for CASE
        finalFilters?.bal, // Value to set if CASE is true
        recharge.amount, // Value to subtract from balance
        admin_margin, // Value to subtract from balance
        admin_margin, // Value to add to today_profit
        recharge.amount, // Value to add to today_amount
        currentline.id // kl_id for the WHERE clause
      ]
    );

    if (updateLine.affectedRows === 0) {
      throw new ApiError(404, "Failed to update line balance");
    }

    console.log("updating userr status", updateRecharge);
    const [getnewRecharge] = await db.query(
      `SELECT * FROM recharges WHERE id = ?`,
      [recharge.id]
    );
    console.log("updating userr status", getnewRecharge);

    recharge.message = "Recharge Successed";

    const data = {
      status: finalStatus,
      message: recharge.message,
      amount: amount,
      number: recharge.number,
      account: recharge.account,
      txnId: recharge.reqid,
      opId: recharge.opId
    };

    messageUtils.sendMessageToUser(
      user.id,
      `Your Recharge is ${finalStatus} for ${recharge.number}`,
      "number"
    );

    ///call to callback url
    if (user.callback_url) {
      try {
        const callbackUrl = user.callback_url;
        const callbackParams = {
          ...data
        };
        console.log("callbackParams", callbackParams);
        // Call GET API with query as callback params
        const queryString = new URLSearchParams(callbackParams).toString();
        const url = `${callbackUrl}?${queryString}`;
        console.log("callbackUrl", url);
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json"
          }
        });
        console.log("callback response", response);
      } catch (error) {
        console.log(
          "Callback failed, but continuing execution:",
          error.message
        );
      }
    }

    //line ka kya hoga baabu mosaaye
  } else if (finalStatus === "failed") {
    console.log("updating userr status", recharge);
    recharge.message = "Recharge failed";

    const [updateRecharge] = await db.query(
      `UPDATE recharges SET status = ?, message = ? , deducted_amount = ?, completed_at = ?  , com_parent = ? , com_superparent = ? ,parent_id = ? , superparent_id = ? WHERE id = ?`,
      [
      (finalStatus == 'failed' && (recharge.status === 'success' || recharge.status === 'pending')) ? 'refunded' : "failed",
      (finalStatus == 'failed' && (recharge.status === 'success' || recharge.status === 'pending')) ? 'Recharge Amount refunded' : "Recharge failed",
      0,
      new Date(),
      null,
      null,
      null,
      null,
      recharge.id
      ]
    );
    // console.log("updating userr status" , updateRecharge);

    //get the keywords name and type
    const [[keywordDetails]] = await db.query(
      `SELECT * FROM keywords WHERE id = ?`,
      [recharge.keyword_id]
    );

    //update balacne transaction record 
    if(finalStatus == 'failed' && (recharge.status === 'success' || recharge.status === 'pending')){
      await db.query(
        `INSERT INTO bal_transactions (to_id, amount, original_amount, prev_balance, new_balance, reference_id,  remark, status, maalik_prev_balance, maalik_new_balance, balance_type)
         VALUES (?, ?, ?, ?, ?, ?,  ?, ?,?,?, ?)`,
        [
          recharge.user_id,
          recharge.deducted_amount,
          recharge.amount,
          user.balance,
          (parseFloat(user.balance) + parseFloat(recharge.deducted_amount)),
          recharge.id,
          `Recharge Amount refunded for ${recharge.number}(${keywordDetails.description} ) at ${recharge.created_at}`,
          "success", // Provide a value for 'status' if needed, otherwise leave as empty string
          0,
          0,
          'refund' // Recharge refund is 'refund' not 'credit'
        ]
      );
    }


    const [updateUser] = await db.query(
      `UPDATE users SET balance = balance + ? WHERE id = ?`,
      [recharge.deducted_amount, recharge.user_id]
    );

    //remove provided margin from parent and superparent with parent_ud and superparent_id
    //with com_parent and com_superparent

    if(lastgig !== null ){
    if (recharge.com_parent && recharge.parent_id) {
      const [updateParent] = await db.query(
        `UPDATE users SET balance = balance - ? WHERE id = ?`,
        [recharge.com_parent, recharge.parent_id]
      );

      console.log("updated userr status parent", updateParent);
    }

    if (recharge.superparent_id && recharge.com_superparent) {
      const [updateSuper] = await db.query(
        `UPDATE users SET balance = balance - ? WHERE id = ?`,
        [recharge.com_superparent, recharge.superparent_id]
      );
      console.log("updated userr status superparent", updateSuper);
    }
  }

    //line ka kya hoga baabu mosaaye
  }

  console.log(finalStatus);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        finalStatus,
        recharge.message || "Recharge Updated Successfully"
      )
    );
});

const getMessages = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 2;
    const offset = (page - 1) * limit;
    const mobileNumber = req.query.mobile || "";
    const messageType = req.query.type || "";
    const startDate = req.query.startDate || "";
    const endDate = req.query.endDate || "";

    let params = [];
    let countParams = [];
    let userIdQuery = "";

    // Base query
    let query = `
      SELECT m.*, u.person, u.mobile 
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE 1=1
    `;

    let countQuery = `
      SELECT COUNT(*) as total
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE 1=1
    `;

    // Filter by mobile number if provided
    if (mobileNumber) {
      userIdQuery = ` AND u.mobile LIKE ?`;
      query += userIdQuery;
      countQuery += userIdQuery;
      params.push(`%${mobileNumber}%`);
      countParams.push(`%${mobileNumber}%`);
    }

    // Filter by message type if provided
    if (messageType) {
      query += ` AND m.type = ?`;
      countQuery += ` AND m.type = ?`;
      params.push(messageType);
      countParams.push(messageType);
    }

    // Filter by date range if provided
    if (startDate && endDate) {
      query += ` AND m.created_at BETWEEN ? AND ?`;
      countQuery += ` AND m.created_at BETWEEN ? AND ?`;
      params.push(startDate, endDate);
      countParams.push(startDate, endDate);
    }

    // Order and apply pagination
    query += ` ORDER BY m.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    // Execute queries
    const [messages] = await db.query(query, params);
    const [countResult] = await db.query(countQuery, countParams);

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    // Format response for pagination
    res.json({
      success: true,
      data: messages,
      pagination: {
        total,
        totalPages,
        currentPage: page,
        limit
      }
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
});

const resendMessage = asyncHandler(async (req, res) => {
  try {
    const messageId = req.params.id;

    // Get the message details
    const [message] = await db.query("SELECT * FROM messages WHERE id = ?", [
      messageId
    ]);

    if (!message || message.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    }

    // Resend the message
    const result = await messageUtils.sendMessageToUser(
      message[0].user_id,
      message[0].message,
      message[0].type
    );
    console.log("result of resend message", result);

    if (result.success) {
      res.json({
        success: true,
        message: "Message resent successfully",
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to resend message",
        error: result.error
      });
    }
  } catch (error) {
    print(error);
    console.error("Error resending message:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
});

const resendBulkMessage = asyncHandler(async (req, res) => {
  try {
    console.log("Request body:", req.body);
    const { messageIds } = req.body;
    
    // Validate messageIds
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
     throw new ApiError(400, "Please provide valid message IDs");
    }
    
    console.log("Processing messageIds:", messageIds);
    
    // Process the messages
    await messageUtils.sendBulkMessagesAsync(messageIds);
   
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          {},
          "Bulk Messages Sent Successfully"
        )
      );
  } catch (error) {
    console.error("Error in resendBulkMessage:", error);
    return res
      .status(500)
      .json(
        new ApiResponse(
          500,
          {},
          "Error processing bulk message request"
        )
      );
  }
});


const getSettings = asyncHandler(async (req, res) => {
  const [settings] = await db.query(`SELECT * FROM settings`);

  return res
    .status(200)
    .json(new ApiResponse(200, settings, "Settings Retrieved Successfully"));
});

const updateSettings = asyncHandler(async (req, res) => {
  const { id, key_name, key_value } = req.body;

  if (!id || !key_name || !key_value) {
    throw new ApiError(400, "Please provide correct data");
  }

  const [updateSettings] = await db.query(
    `UPDATE settings SET key_name = ?, key_value = ? WHERE id = ?`,
    [key_name, key_value, id]
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, updateSettings, "Settings Updated Successfully")
    );
});
const insertSettings = asyncHandler(async (req, res) => {
  const { key_name, key_value } = req.body;

  if (!key_name || !key_value) {
    throw new ApiError(400, "Please provide correct data");
  }

  const [insertSettings] = await db.query(
    `INSERT INTO settings (key_name, key_value) VALUES (?, ?)`,
    [key_name, key_value]
  );

  return res
    .status(201)
    .json(
      new ApiResponse(201, insertSettings, "Settings Inserted Successfully")
    );
});


const transferUser = asyncHandler(async (req, res) => {
  const { user, newParent } = req.body;

  if (!user || !newParent) {
    throw new ApiError(400, "Please provide correct data");
  }
  if(req.user.role >2){
    throw new ApiError(403, "You are not authorized to transfer this user");
  }

  const [[userDetails]] = await db.query(
    `SELECT * FROM users WHERE mobile = ?`,
    [user]
  );
  if (!userDetails) {
    throw new ApiError(404, "User not found");
  }

  console.log("userDetails", userDetails);  

  const [[newParentDetails]] = await db.query(
    `SELECT * FROM users WHERE mobile = ?`,
    [newParent]
  );
  if (!newParentDetails) {
    throw new ApiError(404, "New Parent not found");
  }

  console.log("newParentDetails", newParentDetails);

  console.log("userDetails.parent_id", userDetails.parent_id);
  console.log("newParentDetails.id", newParentDetails.id);
  if (userDetails.parent_id === newParentDetails.id) {
    throw new ApiError(400, "User is already under this parent");
  }
 
  const [updateUser] = await db.query(
    `UPDATE users SET parent_id = ? WHERE id = ?`,
    [newParentDetails.id, userDetails.id]
  );
  

  return res
    .status(200)
    .json(new ApiResponse(200, updateUser, "User Transferred Successfully"));
});

const getLinesDetails = asyncHandler(async (req, res) => {
  if(req.user.role > 2){
    throw new ApiError(403, "You are not authorized to view this data");
  }

  const { startDate, endDate, keywordId } = req.body;

  // Set default date range if not provided (last 30 days)
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  // Set start to beginning of day and end to end of day
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  try {
    // Base query for keywords with basic info only
    let keywordQuery = `
      SELECT 
        k.id as keyword_id,
        k.description as keyword_description,
        k.code as keyword_code,
        o.name as operator_name,
        o.code as operator_code,
        ot.name as operator_type
      FROM keywords k
      JOIN operators o ON k.operator_id = o.id
      JOIN operator_types ot ON o.type = ot.id
    `;

    const queryParams = [];
    
    if (keywordId) {
      keywordQuery += ` WHERE k.id = ?`;
      queryParams.push(keywordId);
    }

    const [keywords] = await db.query(keywordQuery, queryParams);
    console.log("Keywords fetched:", keywords);
    console.log("Query Params:", queryParams);
    console.log("query", keywordQuery);

    const responseData = [];

    for (const keyword of keywords) {
      // Get keyword lines with basic info and financial data
      const keywordLinesQuery = `
        SELECT 
          kl.id as line_id,
          kl.description as line_description,
          kl.status as line_status,
          kl.priority,
          ap.name as api_provider_name,
          ap.status as provider_status,
          klf.balance as line_balance,
          klf.today_amount,
          klf.today_count,
          klf.today_profit,
          klf.daily_max_count,
          klf.daily_max_amount,
          klf.last_at as line_last_transaction
        FROM keyword_lines kl
        JOIN api_providers ap ON kl.api_provider = ap.id
        LEFT JOIN kl_financials klf ON kl.id = klf.kl_id
        WHERE kl.keyword_id = ?
        ORDER BY kl.priority ASC, kl.id ASC
      `;

      const [lines] = await db.query(keywordLinesQuery, [keyword.keyword_id]);
      console.log("Lines fetched for keyword:", keyword.keyword_id, lines);

      // Calculate financial metrics for each line based on gigs data
      const linesWithFinancials = [];

      for (const line of lines) {
        // Get recharge gigs data for this line within date range
        const gigsQuery = `
          SELECT 
            rg.status,
            rg.amount,
            rg.prev_balance,
            rg.new_balance,
            rg.config,
            rg.created_at,
            r.status as recharge_status,
            r.com_retailer,
            r.com_parent,
            r.com_superparent,
            r.com_admin,
            r.deducted_amount,
            r.amount as original_amount
          FROM recharge_gigs rg
          JOIN recharges r ON rg.rech_id = r.id
          WHERE rg.line_id = ? 
            AND rg.created_at BETWEEN ? AND ?
        `;

        const [gigs] = await db.query(gigsQuery, [line.line_id, start, end]);

        // Categorize gigs into recharges and status checks
        const rechargeGigs = gigs.filter(gig => 
          !gig.config || gig.config.toLowerCase() !== 'status_check'
        );
        
        const statusCheckGigs = gigs.filter(gig => 
          gig.config && gig.config.toLowerCase() === 'status_check'
        );

        // Calculate financial metrics
        const totalRecharges = rechargeGigs.length;
        const successfulRecharges = rechargeGigs.filter(g => g.status === 'success').length;
        const failedRecharges = rechargeGigs.filter(g => g.status === 'failed').length;
        const pendingRecharges = rechargeGigs.filter(g => g.status === 'pending').length;
        
        const totalAmount = rechargeGigs.reduce((sum, gig) => sum + parseFloat(gig.amount || 0), 0);
        const successAmount = rechargeGigs
          .filter(g => g.status === 'success')
          .reduce((sum, gig) => sum + parseFloat(gig.amount || 0), 0);
        
        const totalCommissions = rechargeGigs.reduce((sum, gig) => {
          return sum + parseFloat(gig.com_retailer || 0) + 
                     parseFloat(gig.com_parent || 0) + 
                     parseFloat(gig.com_superparent || 0) + 
                     parseFloat(gig.com_admin || 0);
        }, 0);

        const successRate = totalRecharges > 0 ? (successfulRecharges / totalRecharges * 100).toFixed(2) : 0;
        
     

        linesWithFinancials.push({
          line_id: line.line_id,
          description: line.line_description,
          priority: line.priority,
          status: line.line_status,
          api_provider: line.api_provider_name,
          provider_status: line.provider_status,
          financial_metrics: {
            // From kl_financials table
            current_balance: parseFloat(line.line_balance || 0),
            today_amount: parseFloat(line.today_amount || 0),
            today_count: parseInt(line.today_count || 0),
            today_profit: parseFloat(line.today_profit || 0),
            daily_max_count: parseInt(line.daily_max_count || 0),
            daily_max_amount: parseFloat(line.daily_max_amount || 0),
            last_transaction_at: line.line_last_transaction,
            
            // Calculated from gigs data
            total_recharges: totalRecharges,
            successful_recharges: successfulRecharges,
            failed_recharges: failedRecharges,
            pending_recharges: pendingRecharges,
            status_checks: statusCheckGigs.length,
            total_amount: parseFloat(totalAmount.toFixed(2)),
            successful_amount: parseFloat(successAmount.toFixed(2)),
            total_commissions: parseFloat(totalCommissions.toFixed(2)),
            success_rate: parseFloat(successRate)
          }
        });
        console.log("Line financials calculated:", linesWithFinancials[linesWithFinancials.length - 1]);
      }

      // Calculate keyword-level aggregated financials
      const keywordTotalRecharges = linesWithFinancials.reduce((sum, line) => 
        sum + line.financial_metrics.total_recharges, 0);
      
      const keywordSuccessfulRecharges = linesWithFinancials.reduce((sum, line) => 
        sum + line.financial_metrics.successful_recharges, 0);
      
      const keywordTotalAmount = linesWithFinancials.reduce((sum, line) => 
        sum + line.financial_metrics.total_amount, 0);
      
      const keywordSuccessfulAmount = linesWithFinancials.reduce((sum, line) => 
        sum + line.financial_metrics.successful_amount, 0);
      
      const keywordTotalCommissions = linesWithFinancials.reduce((sum, line) => 
        sum + line.financial_metrics.total_commissions, 0);
        
      const keywordCurrentBalance = linesWithFinancials.reduce((sum, line) => 
        sum + line.financial_metrics.current_balance, 0);

      responseData.push({
        keyword_info: {
          id: keyword.keyword_id,
          description: keyword.keyword_description,
          code: keyword.keyword_code
        },
        operator_info: {
          name: keyword.operator_name,
          code: keyword.operator_code,
          type: keyword.operator_type
        },
        keyword_financial_summary: {
          total_recharges: keywordTotalRecharges,
          successful_recharges: keywordSuccessfulRecharges,
          failed_recharges: keywordTotalRecharges - keywordSuccessfulRecharges,
          total_amount: parseFloat(keywordTotalAmount.toFixed(2)),
          successful_amount: parseFloat(keywordSuccessfulAmount.toFixed(2)),
          total_commissions: parseFloat(keywordTotalCommissions.toFixed(2)),
          current_total_balance: parseFloat(keywordCurrentBalance.toFixed(2)),
          success_rate: keywordTotalRecharges > 0 ? 
            parseFloat((keywordSuccessfulRecharges / keywordTotalRecharges * 100).toFixed(2)) : 0,
          active_lines: linesWithFinancials.filter(line => line.status).length,
          total_lines: linesWithFinancials.length
        },
        lines: linesWithFinancials,
        date_range: {
          start_date: start.toISOString().split('T')[0],
          end_date: end.toISOString().split('T')[0]
        }
      });
    }

    console.log("Response Data:", responseData);
    console.log(JSON.stringify(responseData[0].lines))

    return res
      .status(200)
      .json(new ApiResponse(200, responseData, "Keyword Financial Details Retrieved Successfully"));

  } catch (error) {
    console.error('Error fetching keyword financial details:', error);
    throw new ApiError(500, "Failed to retrieve keyword financial details");
  }
});

const getKeywordDetails = asyncHandler(async (req, res) => {
 const userRole = req.user.role;

 if( userRole > 2) {
   throw new ApiError(403, "You are not authorized to view this data");
 }
// Fetch keywords with operator info
const [getKeywordData] = await db.query(
  `SELECT k.id, k.description, ot.name as operator_type,  k.code as keyword_code, k.status
   FROM keywords k 
   JOIN operators o ON k.operator_id = o.id
   JOIN operator_types ot ON o.type = ot.id
  `
  //  WHERE k.status = 1`
);
// For each keyword, fetch sum of balance, total lines, and active lines
for (const keyword of getKeywordData) {
  // Total balance of active lines
  const [[balanceResult]] = await db.query(
    `SELECT 
      SUM(CASE WHEN kl.status = 1 THEN f.balance ELSE 0 END) as total_balance,
       SUM(f.today_amount) as today_amount,
      COUNT(*) as total_lines,
      COUNT(CASE WHEN kl.status = 1 THEN 1 END) as active_lines
     FROM keyword_lines kl
     JOIN kl_financials f ON kl.id = f.kl_id
     WHERE kl.keyword_id = ?`,
    [keyword.id]
  );
  keyword.total_balance = parseFloat(balanceResult.total_balance || 0);
  keyword.total_lines = balanceResult.total_lines || 0;
  keyword.active_lines = balanceResult.active_lines || 0;
  keyword.today_amount = parseFloat(balanceResult.today_amount || 0);

  
}
 if (!getKeywordData || getKeywordData.length === 0) {
   throw new ApiError(404, "No keywords found");
 }

 console.log("getKeywordData", getKeywordData);
  return res
    .status(200)
    .json(new ApiResponse(200,{ keywords : getKeywordData}, "Keywords Retrieved Successfully"));
});

module.exports = {
  getUsers,
  updateTxn,
  getRechargeReports,
  updateRecharge,
  getMessages,
  resendMessage,
  resendBulkMessage,
  resetPassword,
  getKeywordDetails,

  getUserTransactions,

  getOperatorPerformance,

  getCommissionReports,
  getDashboardSummary,
  getSettings,
  updateSettings,
  insertSettings,
  transferUser,
  getLinesDetails
};
