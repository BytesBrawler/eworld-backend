const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const db = require("../db");
const crypto = require("crypto");
const { channel } = require("diagnostics_channel");
const { calculateUserMargins } = require("./retailer.controller");
const { dynamicRechargeCall} = require("./dynamicrecharge");
const messageUtils = require("../utils/sendMessage");

async function generateApiKey() {
  const apiKey = crypto.randomBytes(32).toString("hex");
  return apiKey;
}

const getApiData = asyncHandler(async (req, res) => {
  let { id } = req.query;
  console.log("id", id);
  if (!id) {
    id = req.user.id;
  }
  console.log("id", id);

  const [[user]] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  let apiKey = user.api_key;
  if (!apiKey) {
    apiKey = await generateApiKey();
    console.log("Generated API Key:", apiKey);
    await db.query("UPDATE users SET api_key = ? WHERE id = ?", [apiKey, id]);
  }

  const [ips] = await db.query("SELECT * FROM reseller_ips WHERE user_id = ?", [
    id
  ]);

  console.log("ips", ips);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { apiKey, ips, callback: user.callback_url },
        "API Key fetched successfully"
      )
    );
});

const generateNewApiKey = asyncHandler(async (req, res) => {
  let { id } = req.query;
  if (!id) {
    id = req.user.id;
  }
  const newApiKey = await generateApiKey();
  await db.query("UPDATE users SET api_key = ? WHERE id = ?", [newApiKey, id]);
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { apiKey: newApiKey },
        "New API Key generated successfully"
      )
    );
});

const addIp = asyncHandler(async (req, res) => {
  let { ip, id } = req.body;
  console.log(req.body);
  if (!id) {
    id = req.user.id;
    
  }

  if (!ip) {
    throw new ApiError(400, "IP address is required");
  }

  const [[existingIp]] = await db.query(
    "SELECT * FROM reseller_ips WHERE ip = ? AND user_id = ?",
    [ip, id]
  );
  if (existingIp) {
    throw new ApiError(400, "IP address already exists");
  }

  await db.query("INSERT INTO reseller_ips (user_id, ip) VALUES (?, ?)", [
    id,
    ip
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "IP address added successfully"));
});
const deleteIp = asyncHandler(async (req, res) => {
  let { ip, id } = req.body;
  if (!id) {
    id = req.user.id;
  }

  if (!ip) {
    throw new ApiError(400, "IP address is required");
  }

  const [[existingIp]] = await db.query(
    "SELECT * FROM reseller_ips WHERE ip = ? AND user_id = ?",
    [ip, id]
  );
  if (!existingIp) {
    throw new ApiError(400, "IP address does not exist");
  }

  //update ip address status to 0
  await db.query(
    "UPDATE reseller_ips SET status = 0 WHERE ip = ? AND user_id = ?",
    [ip, id]
  );

  return res
    .status(200)
    .json(new ApiResponse(200, null, "IP address deleted successfully"));
});

const EditIp = asyncHandler(async (req, res) => {
  let { ip, ipId, id } = req.body;
  console.log(req.body);
  if (!id) {
    id = req.user.id;
  }
  if (!ip) {
    throw new ApiError(400, "IP address is required");
  }
  if (!ipId) {
    throw new ApiError(400, "IP address id is required");
  }
  const [[existingIp]] = await db.query(
    "SELECT * FROM reseller_ips WHERE id = ? AND user_id = ?",
    [ipId, id]
  );
  if (!existingIp) {
    throw new ApiError(400, "IP address does not exist");
  }

  //update ip to ip for ipid
  await db.query(
    "UPDATE reseller_ips SET ip = ? WHERE id = ? AND user_id = ?",
    [ip, ipId, id]
  );
  return res
    .status(200)
    .json(new ApiResponse(200, null, "IP address updated successfully"));
});

const updateCallBackUrl = asyncHandler(async (req, res) => {
  let { callback_url, id } = req.body;
  if (!id) {
    id = req.user.id;
  }

  if (!callback_url) {
    throw new ApiError(400, "Callback URL is required");
  }

  await db.query("UPDATE users SET callback_url = ? WHERE id = ?", [
    callback_url,
    id
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Callback URL updated successfully"));
});

const recharge = asyncHandler(async (req, res) => {
  let { opcode, number, amount, account } = req.query;
  // if (!keywordId) throw new ApiError(400, "Keyword is required");

  console.log("req.query", req.query);
  

  //will get the keyword id from the opcode
  const [[keyword]] = await db.query(`SELECT * FROM keywords WHERE code = ?`, [
    opcode
  ]);

  console.log("keyword", keyword);
  if (!keyword) {
    return res
      .status(400)
      .json({ status: "failed", message: "Keyword not found" });
  }
  const keywordId = keyword.id;

  console.log(keywordId);

  let userId = req.user.id;
  const balance1 = req.user.balance;
  console.log(balance1);

  const balance = parseFloat(balance1); // or Number(user.balance)
  amount = parseFloat(amount); // or Number(req.body.amount)

  if (balance < amount) {
    return res
      .status(400)
      .json({ status: "failed", message: "Insufficient balance" });
  }

  const [[user]] = await db.query(`SELECT * FROM users WHERE id = ?`, [userId]);

  console.log("userId", userId);
  console.log("amount", amount);
  console.log("keywordId", keywordId);
  console.log("number", number);

  // 1. Get Keyword Details
  const [keywordRows] = await db.query("SELECT * FROM keywords WHERE id = ?", [
    keywordId
  ]);
  if (keywordRows.length === 0) throw new ApiError(404, "Keyword not found");
  console.log(keywordRows);
  //match keyword data

  const keywordDetails = keywordRows[0];
  console.log(keywordDetails);



  if (!account) {
    account = number;
  }

  if (keywordDetails.min_digits > account.length)
    return res
      .status(400)
      .json({ status: "failed", message: "Customer number is too short" });
  if (keywordDetails.max_digits < account.length)
    return res
      .status(400)
      .json({ status: "failed", message: "Customer number is too long" });

  if (parseFloat(keywordDetails.min_recharge) > amount)
    return res
      .status(400)
      .json({ status: "failed", message: "Amount is too low" });
  if (parseFloat(keywordDetails.max_recharge) < amount)
    return res
      .status(400)
      .json({ status: "failed", message: "Amount is too high" });



const [setting] = await db.query(
      `SELECT * FROM settings WHERE key_name = ?`,
      ["time_diff"]
    );

   const seconds = parseInt(setting[0].key_value);


    const [oldRecharged] = await db.query(
      `SELECT * FROM recharges WHERE user_id = ? AND keyword_id = ? AND account = ? and amount = ? and status != 'failed' and created_at > ?`,
      [
        userId,
        keywordId,
        account,
        amount,
        new Date(Date.now() - seconds * 1000)
      ]
    );

    console.log("old recharged", oldRecharged);

    if (oldRecharged.length > 0) {
      // Compare using timestamps to avoid string/date mismatch
      const createdAt = new Date(oldRecharged[0].created_at).getTime();
      const now = Date.now();
      const diff = now - createdAt;
      if (diff < seconds * 1000) {
        const remainingTime = seconds * 1000 - diff;
        const minutes = Math.floor(remainingTime / 60000);
        const secondsLeft = Math.floor((remainingTime % 60000) / 1000);

        throw new ApiError(
          400,
          `Please Try Again After ${minutes} Minutes and ${secondsLeft} Seconds`
        );
      }
    }


  let lines = [];
  let byvalue = true;
  [lines] = await db.query(
    `
      SELECT kl.*
      FROM kl_prevalues kp
      JOIN keyword_lines kl ON kl.id = kp.kl_id
      JOIN kl_financials kf ON kf.kl_id = kl.id
      WHERE kp.amount = ? 
        AND kl.keyword_id = ? 
        AND kl.status = 1 
        AND ABS(kf.balance) > ?
        AND kf.today_amount < COALESCE(kf.daily_max_amount, 9999999)
        AND kf.today_count < COALESCE(kf.daily_max_count, 9999999)
      ORDER BY kl.priority ASC
      `,
    [amount, keywordId, amount]
  );

  console.log("lines with prevalues", lines);

  if (lines.length === 0) {
    byvalue = false;
    // 3. Check KeywordLines by Range
    [lines] = await db.query(
      `
      SELECT kl.* , kf.balance as balance
      FROM keyword_lines as kl
      JOIN kl_financials kf on kf.kl_id = kl.id
      WHERE keyword_id = ?
        AND status = 1
        AND (min_amt IS NULL OR min_amt <= ?)
        AND (max_amt IS NULL OR max_amt >= ?)
        AND (min_digits IS NULL OR min_digits <= ?)
        AND (max_digits IS NULL OR max_digits >= ?)
        AND ABS(kf.balance) > ? and kf.today_amount < kf.daily_max_amount
      and kf.today_count < kf.daily_max_count
      ORDER BY priority ASC
    `,
      [keywordId, amount, amount, account.length, account.length, amount]
    );
  }

  console.log("lines without prevalues", lines);
  // let reqId = `${keywordId}${userId}${Date.now().toString().slice(-5)}`;

  if (lines.length === 0) {

    let [addRecharge] = await db.query(
      `INSERT INTO recharges (user_id, keyword_id, account, number, amount, deducted_amount, params,  user_prev_balance , user_new_balance, status) VALUES (?, ?,  ?, ?, ?, ?, ?, ?, ?,?)`,
      [
        userId,
        keywordId,
        account,
        customerNumber,
        amount,
        amount,
        JSON.stringify(params),
        balance ,
        balance - amount,
        "pending"
      ]
    );

    const reqId = addRecharge.insertId;
     params.reqid = reqId;

    await db.query(`update recharges set reqid = ? where id = ?`, [
      reqId,
      addRecharge.insertId
    ]);



    return res.status(200).json(
    {
      status: "pending",
      message: "Your request is logged",
      txnId: reqId,
      amount: amount,
      number: number,
      account: account
    }
    );

    // return res.status(400).json({
    //   status: "failed",
    //   message: "No lines available for this recharge"
    // });
  }
  console.log(lines);


    const [updateBalance] = await db.query(
      `UPDATE users SET balance = balance - ? WHERE id = ?`,
      [amount, userId]
    );
    if (updateBalance.affectedRows === 0) {
      return res
        .status(400)
        .json({ status: "failed", message: "Failed to update  balance" });
    }


  const currentline = lines[0];

  if (currentline.recharge_api == null) {
    return res
      .status(400)
      .json({ status: "failed", message: "Recharge API not available" });
  }

  // // Generate transaction ID using line, keywordId, userId, timestamp, and other details
  // const reqId = `TXN-${keywordId}-${userId}-${Date.now()}`;
  // console.log(`Generated Transaction ID: ${reqId}`);

  // //update the table and first line in gig

  // let params = {
  //   "mobile": number,
  //   "amount" : amount,
  //   "opcode" : currentline.merchant_code ?? keywordDetails.code,
  //   "txnid" : reqId,
  //   "remark": "mobile Recharge",
  // }
  // console.log("params", params);
 
 
  const params = {
    mobile: number,
    account: account,
    amount: amount,
    opcode: currentline?.merchant_code ?? keywordDetails.code,
    remark: "Mobile Recharge"
  };

  const baseParams = {
    mobile: number,
    account: account,
    amount: amount,
    remark: "mobile Recharge"
  };

  let byValue = true;
  let attempt = 0;
  const maxAttempts = 5;
  let finalStatus = "initiated";
  let finalMessage = "Recharge is pending";
  let finalLineId = 0;

  let rechargeId = null;
  let finalFilters = null;

  let addRecharge = null;
//genreate 6 digit reqid transaction id

  [addRecharge] = await db.query(
    `INSERT INTO recharges (user_id, keyword_id, account, number, amount, deducted_amount, params, user_prev_balance , user_new_balance , channel) VALUES (?, ?,  ?, ?, ?, ?, ?, ?, ? , ?)`,
    [
      userId,
      keywordId,
      account,
      number,
      amount,
      amount,
      JSON.stringify(params),

      req.user.balance,
      balance - amount,
      "api"
    ]
  );

  if (addRecharge.affectedRows === 0) {
    return { status: "error", message: "Failed to create recharge request." };
  }
  rechargeId = addRecharge.insertId;
  const reqId = addRecharge.insertId;
  params.reqid = reqId;
  baseParams.reqid = reqId;

   await db.query(`update recharges set reqid = ? where id = ?`, [
      reqId,
      addRecharge.insertId
    ]);

  while (attempt < maxAttempts) {
    finalStatus = "Pending";
    console.log(lines.length);
    console.log("byValue", byValue);

    if (lines.length === 0 && byValue) {
      const [liness] = await db.query(
        `
        SELECT kl.*, kf.balance as balance
        FROM keyword_lines as kl
        JOIN kl_financials kf ON kf.kl_id = kl.id
        WHERE keyword_id = ?
          AND status = 1
          AND (min_amt IS NULL OR min_amt <= ?)
          AND (max_amt IS NULL OR max_amt >= ?)
          AND (min_digits IS NULL OR min_digits <= ?)
          AND (max_digits IS NULL OR max_digits >= ?)
          AND ABS(kf.balance) > ?
          AND kf.today_amount < kf.daily_max_amount
          AND kf.today_count < kf.daily_max_count
          AND kl.id != ?
        ORDER BY priority ASC
        `,
        [keywordId, amount, amount, account.length, account.length, amount, finalLineId]
      );
      byValue = false;
      lines.push(...liness);

      console.log("lines without prevalues", lines);
      console.log("lines length", lines.length);

      if (lines.length === 0) break;
    }

    console.log("lines  ", lines);
    console.log("lines length", lines.length);
    if (lines.length === 0) break;

    const currentline = lines.shift();
    finalLineId = currentline.id;

    if (!currentline?.recharge_api) {
      attempt++;
      continue;
    }

    const attemptParams = {
      ...baseParams,
      reqid: reqId,
      opcode: currentline.merchant_code ?? keywordDetails.code
    };

    const [addgigs] = await db.query(
      "INSERT INTO recharge_gigs (rech_id, user_id, line_id, api_id, provider_id, amount, prev_balance) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        rechargeId,
        userId,
        currentline.id,
        currentline.recharge_api,
        currentline.api_provider,
        amount,
        currentline.balance
      ]
    );

    const gigId = addgigs.insertId;
    if (!gigId) {
      attempt++;
      continue;
    }

    const rechargeResponse = await dynamicRechargeCall(
      currentline.api_provider,
      currentline.recharge_api,
      attemptParams
    );

    // if (rechargeResponse.status == "error") {
    //   await db.query(
    //     `UPDATE recharge_gigs SET status = ?, new_balance = ?,  message = ? WHERE id = ?`,
    //     ["failed", currentline.balance, "API FAILED OR DISABLED", gigId]
    //   );
    //   finalStatus = "failed";
    //   finalMessage = "Recharge failed";
    //   attempt++;
    //   continue;
    // }


     if (rechargeResponse.status === "error" || rechargeResponse === undefined || rechargeResponse === null) {
      finalStatus = "pending";
      finalMessage = "Recharge pending";
      attempt++;
      rechargeResponse.status = "pending";
      await db.query(
        `UPDATE recharge_gigs SET status = ?, new_balance = ?, response_complete = ?, message = ? WHERE id = ?`,
        ["pending", currentline.balance,  JSON.stringify(rechargeResponse) ,finalMessage, gigId]
      );
      
        if (rechargeResponse.status === "pending" && currentline.status_check_api) {
      finalMessage =  "Recharge Pending";
    let  finalTxnid = rechargeResponse.filters.tid;
      // Check status once
      console.log(rechargeResponse);
      const statusResponse = await dynamicRechargeCall(
        currentline.api_provider,
        currentline.status_check_api,
        {
          ...attemptParams,
          txnid: rechargeResponse.filters.tid
        }
      );

      //now we weill add compelte detai fo thsi status check in gig

      await db.query(
        `insert into recharge_gigs (rech_id, user_id, line_id, api_id, provider_id, amount, prev_balance , config , status, request, response, response_complete,message) 
        VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)`,
        [
          rechargeId,
          userId,
          currentline.id,
          currentline.status_check_api,
          currentline.api_provider,
          amount,
          currentline.balance ?? 0,
          "status_check",
          statusResponse.status,
          JSON.stringify(statusResponse.raw.config),
          JSON.stringify(statusResponse.parsedData),
          JSON.stringify(statusResponse.raw.responseData),
          statusResponse.message
        ]
      );

      rechargeResponse = statusResponse;

      if (statusResponse?.status === "success") {
        finalStatus = "success";
        finalMessage =
          statusResponse.message || "Recharge successful after recheck";
        finalTxnid = statusResponse.filters.tid;
        // finalReqid = statusResponse.filters.reqid;
        finalFilters = statusResponse.filters;
        break;
      } else if (statusResponse?.status === "pending") {
        finalStatus = "pending";
        finalMessage = "Recharge is still pending";
        finalTxnid = statusResponse.filters.tid;
        // finalReqid = statusResponse.filters.reqid;
        finalFilters = statusResponse.filters;
        break;
      } else if (
        statusResponse?.status === "failed" &&
        statusResponse.returnToUser === true
      ) {
        finalStatus = "failed";
        finalMessage =
          statusResponse.message || "Recharge failed and amount refunded";
        finalFilters = rechargeResponse.filters;
        break;
      } // else try next line
    } 
     
    }

    console.log("rechargeResponse", rechargeResponse);


    await db.query(
      `UPDATE recharge_gigs SET status = ?, new_balance = ?, request = ?, response = ?, response_complete = ?, message = ? WHERE id = ?`,
      [
        rechargeResponse.status,
        rechargeResponse.filters.bal,
        JSON.stringify(rechargeResponse.raw.config),
        JSON.stringify(rechargeResponse.parsedData),
        JSON.stringify(rechargeResponse.raw.responseData),
        rechargeResponse.filters.msg,
        gigId
      ]
    );

    if (rechargeResponse.status === "success") {
      finalStatus = "success";
      finalMessage = rechargeResponse.message || "Recharge successful";
      finalTxnid = rechargeResponse.filters.tid;

      finalFilters = rechargeResponse.filters;
      break;
    }

    if (
      rechargeResponse.status === "failed" &&
      rechargeResponse.returnToUser === false
    ) {
      finalStatus = "failed";
      finalMessage =
        rechargeResponse.message || "Recharge failed and amount not refunded";
      finalFilters = rechargeResponse.filters;
      break;

    }

    if (
      rechargeResponse.status === "pending" &&
      !currentline.status_check_api
    ) {
      finalStatus = "pending";
      finalMessage = rechargeResponse.message || "Recharge Pending";
      finalTxnid = rechargeResponse.filters.tid;

      finalFilters = rechargeResponse.filters;
      break;
    }

    if (rechargeResponse.status === "pending" && currentline.status_check_api) {
      // Check status once
      finalMessage = rechargeResponse.message || "Recharge Pending";
      finalTxnid = rechargeResponse.filters.tid;
      const statusResponse = await dynamicRechargeCall(
        currentline.api_provider,
        currentline.status_check_api,
        {
          ...attemptParams,
          txnid:rechargeResponse.filters.tid,
        }
        
      );

        //now we weill add compelte detai fo thsi status check in gig

        await db.query(
          ` insert into recharge_gigs (rech_id, user_id, line_id, api_id, provider_id, amount, prev_balance , config , status, request, response, response_complete,message) 
          VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)`,
          [
            rechargeId,
            userId,
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

      console.log("Status Check API Response: ", statusResponse);

      if (statusResponse?.status === "success") {
        finalStatus = "success";
        finalMessage =
          statusResponse.message || "Recharge successful after recheck";
        finalTxnid = statusResponse.filters.tid;

        finalFilters = statusResponse.filters;
        break;
      } else if (statusResponse?.status === "pending") {
        finalStatus = "pending";
        finalMessage = "Recharge is still pending";
        finalTxnid = statusResponse.filters.tid;
        finalReqid = statusResponse.filters.reqid;
        finalFilters = statusResponse.filters;
        break;
      } else if (
        statusResponse?.status === "failed" &&
        statusResponse.returnToUser === true
      ) {
        finalStatus = "failed";
        finalMessage =
          statusResponse.message || "Recharge failed and amount refunded";
        finalFilters = rechargeResponse.filters;
        break;
      } // else try next line
    } else if (
      rechargeResponse.status === "failed" &&
      rechargeResponse.returnToUser === true
    ) {
      finalStatus = "failed";
      finalMessage =
        rechargeResponse.message || "Recharge failed and amount refunded";
      finalFilters = rechargeResponse.filters;
      break;
    }{
      finalStatus = "failed";
      finalMessage =
        rechargeResponse.message || "Recharge failed and amount not refunded";
      finalFilters = rechargeResponse.filters;

    }

    attempt++;
  }

  console.log("ended loop", attempt, lines.length);
  const message = finalMessage
    ? finalMessage
    : `Recharge is ${finalStatus} for ${number}`;

  if (finalStatus == "failed") {
    const [updateRecharge] = await db.query(
      `UPDATE recharges SET status = ?, txnid =? ,message = ? , completed_at = ? WHERE id = ?`,
      [
        finalStatus,
        finalFilters?.tid,
        message,
        new Date(),
        addRecharge.insertId
      ]
    );

    const [updateUser] = await db.query(
      `UPDATE users SET balance = balance + ? WHERE id = ?`,
      [amount, userId]
    );
  } else if (finalStatus == "success") {
    console.log("success");

    const result = await calculateUserMargins({
      userId: user.id,
      parentId: user.parent_id,
      keywordId: keywordId,
      amount: amount,
      linesMargin: currentline.margin_status === 1 ? currentline : null
    });

    console.log(result.retailerAddition);
    console.log(currentline.is_charges_by_user);
    console.log(currentline.is_additional_charges_fixed);
    console.log(currentline.additional_charges);
    console.log(amount);
    result.retailerAddition =
      result.retailerAddition +
      (currentline.is_charges_by_user === 1
        ? currentline.is_additional_charges_fixed === 1
          ? parseFloat(currentline.additional_charges)
          : amount * (parseFloat(currentline.additional_charges) / 100)
        : 0);

    console.log(currentline.is_charges_by_admin);
    console.log(currentline.is_additional_charges_fixed);
    console.log(currentline.additional_charges);
    console.log(amount);
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
      `UPDATE recharges SET status = ?,deducted_amount = deducted_amount -?,user_new_balance = user_new_balance +?, txnid =? ,opId = ?, message = ? , com_retailer = ?,com_parent = ?, com_superparent = ? , com_admin = ?,  parent_id =?, superparent_id = ?, completed_at = ? WHERE id = ?`,
      [
        finalStatus,
        result.retailerAddition,
        result.retailerAddition,
        finalFilters?.tid,
        finalFilters?.opId,
        message,
        result.retailerAddition,
        result.parentAddition,
        result.superAddition,
        admin_margin,
        req.user.parent,
        result.superParentId,
        new Date(),
        rechargeId
      ]
    );

    const [updateUser] = await db.query(
      `UPDATE users SET balance = balance + ? WHERE id = ?`,
      [result.retailerAddition, userId]
    );

    const [updateParent] = await db.query(
      `UPDATE users SET balance = balance + ? WHERE id = ?`,
      [result.parentAddition, req.user.parent]
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
    console.log(amount - (amount * parsedMargin) / 100);
    console.log(amount);
    //update currentlinebalance
    let updateLine;
    let usedDirectBalance = false;
    if (
      finalFilters?.bal &&
      finalFilters.bal !== 0 &&
      finalFilters.bal !== null &&
      finalFilters.bal !== undefined &&
      finalFilters.bal !== "0"
    ) {
      // Use direct balance value from finalFilters.bal
      usedDirectBalance = true;
      [updateLine] = await db.query(
      `UPDATE kl_financials
       SET balance = ?, 
         today_profit = today_profit + ?,
         today_amount = today_amount + ?, 
         today_count = today_count + 1 
       WHERE kl_id = ?`,
      [
        finalFilters.bal,
        admin_margin,
        amount,
        finalLineId
      ]
      );
    } else {
      // Subtract amount and admin_margin from current balance
      usedDirectBalance = false;
      [updateLine] = await db.query(
      `UPDATE kl_financials
       SET balance = balance - ? - ?, 
         today_profit = today_profit + ?,
         today_amount = today_amount + ?, 
         today_count = today_count + 1 
       WHERE kl_id = ?`,
      [
        amount,
        admin_margin,
        admin_margin,
        amount,
        finalLineId
      ]
      );
    }

     const [updateGigs] = await db.query(
      `UPDATE recharge_gigs SET status = ?, new_balance = ?,  message = ? WHERE rech_id = ? and line_id = ?`,
      [
        finalStatus,
         finalFilters?.bal &&
        finalFilters.bal !== 0 &&
        finalFilters.bal !== null &&
        finalFilters.bal !== undefined &&
        finalFilters.bal !== "0"
          ? finalFilters.bal
          : balance - amount - admin_margin,
        message,
        rechargeId,
        finalLineId
      ]);

  } else {
    const [updateRecharge] = await db.query(
      `UPDATE recharges SET status = ?, txnid =? ,message = ? , completed_at = ? WHERE id = ?`,
      [
        finalStatus,
        finalFilters?.tid,
        message,
        new Date(),
        addRecharge.insertId
      ]
    );

    const [getFinalLineBalance] = await db.query(
      `SELECT balance FROM kl_financials WHERE kl_id = ?`,
      [finalLineId]
    );

    //if final line have any balance it can ne any + or -ve or 0 hen we wil update the gig 
    if (getFinalLineBalance.length > 0) {
      const finalLineBalance = getFinalLineBalance[0].balance;
      const [updateGigs] = await db.query(
        `UPDATE recharge_gigs SET status = ?, new_balance = ?,  message = ? WHERE rech_id = ? and line_id = ?`,
        [finalStatus, finalLineBalance, message, rechargeId, finalLineId]
      );
    }

    // const [updateUser] = await db.query(
    //   `UPDATE users SET balance = balance + ? WHERE id = ?`,
    //   [amount, userId]
    // );
  }

  //cut and update the margin

  const data = {
    status: finalStatus,
    message: message,
    amount: amount,
    number: number,
    account: account,
    txnId: reqId,
    opId: finalFilters?.opId,

  };


  // messageUtils.sendMessageToUser(
  //   user.id,
  //   `Your Recharge is ${finalStatus} for ${number}`,
  //   "number"
  // );

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
      console.log("Callback failed, but continuing execution:", error.message);
    }
  }

  return res.status(200).json(data);
});

const statusCheck = asyncHandler(async (req, res) => {
  let { txnid } = req.query;
  console.log("txnid", txnid);
  if (!txnid) {
    return res
      .status(400)
      .json({ status: "failed", message: "Transaction ID is required" });
  }



  const [[recharge]] = await db.query(
    "SELECT * FROM recharges WHERE reqid = ?",
    [txnid]
  );
  console.log("recharge", recharge);

  if (recharge.length === 0 || recharge === null) {
    return res
      .status(400)
      .json({ status: "failed", message: "Recharge not found" });
  }

  if(recharge.user_id != req.user.id){
    return res
      .status(400)
      .json({ status: "failed", message: "Recharge not found" });
  }

  // inned data like

  const data = {
    status: recharge.status,
    message: recharge.message,
    amount: recharge.amount,
    number: recharge.number,
    account: recharge.account,
    txnId: recharge.reqId
  };

  return res.status(200).json(data);
});

const balanceCheck = asyncHandler(async (req, res) => {
  const [balance] = await db.query("SELECT balance FROM users WHERE id = ?", [
    req.user.id
  ]);
  if (balance.length === 0) {
    return res
      .status(400)
      .json({ status: "failed", message: "User not found" });
  }
  const userBalance = balance[0].balance;
  return res.status(200).json({ balance: userBalance });
});

const rechargeCallback = asyncHandler(async (req, res) => {
  try {
    // Handle both GET and POST callbacks
    const callbackData = req.method === 'GET' ? req.query : req.body;
    
    console.log("Received callback data:", callbackData);
    console.log("Request method:", req.method);
    console.log("Request headers:", req.headers);

    // Extract common callback parameters (adjust field names based on your API providers)
    const {
      txnid,
      reqid,
      status,
      message,
      opid,
      amount,
      number,
      account,
      operator,
      balance,
      // Add other fields your API providers might send
      operator_ref,
      api_response_code,
      error_code
    } = callbackData;

    // Validate required fields
    if (!txnid && !reqid) {
      return res.status(400).json({
        status: "error",
        message: "Transaction ID or Request ID is required"
      });
    }

    // Find the recharge record using txnid or reqid
    let recharge = null;
    let searchField = null;
    let searchValue = null;

    if (reqid) {
      searchField = "reqid";
      searchValue = reqid;
      const [[rechargeData]] = await db.query(
        "SELECT * FROM recharges WHERE reqid = ?",
        [reqid]
      );
      recharge = rechargeData;
    } else if (txnid) {
      searchField = "txnid";
      searchValue = txnid;
      const [[rechargeData]] = await db.query(
        "SELECT * FROM recharges WHERE txnid = ? OR reqid = ?",
        [txnid, txnid]
      );
      recharge = rechargeData;
    }

    if (!recharge) {
      console.log(`Recharge not found for ${searchField}: ${searchValue}`);
      return res.status(404).json({
        status: "error",
        message: "Recharge record not found"
      });
    }

    console.log("Found recharge:", recharge);

    // Check if recharge is already completed
    if (recharge.status === 'success' || recharge.status === 'failed') {
      console.log("Recharge already completed with status:", recharge.status);
      return res.status(200).json({
        status: "success",
        message: "Callback received - recharge already processed"
      });
    }

    // Normalize status from callback
    let normalizedStatus = 'pending';
    let shouldRefund = false;
    let callbackMessage = message || 'Status updated via callback';

    // Map different status values to our standard statuses
    const statusLower = status ? status.toLowerCase() : '';
    
    if (['success', 'successful', 'completed', 'done', 'ok', '1', 'true'].includes(statusLower)) {
      normalizedStatus = 'success';
    } else if (['failed', 'failure', 'error', 'rejected', 'declined', '0', 'false'].includes(statusLower)) {
      normalizedStatus = 'failed';
      shouldRefund = true;
    } else if (['pending', 'processing', 'initiated', 'in_progress'].includes(statusLower)) {
      normalizedStatus = 'pending';
    }

    console.log(`Status mapping: ${status} -> ${normalizedStatus}`);

    // Get user details for margin calculation
    const [[user]] = await db.query("SELECT * FROM users WHERE id = ?", [recharge.user_id]);
    
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Update recharge record
    const updateFields = {
      status: normalizedStatus,
      message: callbackMessage,
      completed_at: new Date()
    };

    // Add operator reference if provided
    if (opid || operator_ref) {
      updateFields.opId = opid || operator_ref;
    }

    // Add txnid if not already present
    if (txnid && !recharge.txnid) {
      updateFields.txnid = txnid;
    }

    if (normalizedStatus === 'success') {
      // Calculate margins for successful recharge
      const result = await calculateUserMargins({
        userId: user.id,
        parentId: user.parent_id,
        keywordId: recharge.keyword_id,
        amount: parseFloat(recharge.amount),
        linesMargin: null // We don't have line info in callback
      });

      // Update recharge with commission details
      await db.query(
        `UPDATE recharges SET 
         status = ?, 
         message = ?, 
         completed_at = ?, 
         txnid = COALESCE(?, txnid),
         opId = COALESCE(?, opId),
         deducted_amount = deducted_amount - ?,
         user_new_balance = user_new_balance + ?,
         com_retailer = ?,
         com_parent = ?, 
         com_superparent = ?, 
         com_admin = ?,
         parent_id = ?,
         superparent_id = ?
         WHERE id = ?`,
        [
          normalizedStatus,
          callbackMessage,
          new Date(),
          txnid,
          opid || operator_ref,
          result.retailerAddition,
          result.retailerAddition,
          result.retailerAddition,
          result.parentAddition,
          result.superAddition,
          0, // admin margin will be calculated separately
          user.parent_id,
          result.superParentId,
          recharge.id
        ]
      );

      // Update user balances
      await db.query(
        `UPDATE users SET balance = balance + ? WHERE id = ?`,
        [result.retailerAddition, user.id]
      );

      if (user.parent_id) {
        await db.query(
          `UPDATE users SET balance = balance + ? WHERE id = ?`,
          [result.parentAddition, user.parent_id]
        );
      }

      if (result.superParentId && !result.isDirect) {
        await db.query(
          `UPDATE users SET balance = balance + ? WHERE id = ?`,
          [result.superAddition, result.superParentId]
        );
      }

      console.log("Recharge marked as successful and commissions added");

    } else if (normalizedStatus === 'failed' && shouldRefund) {
      // Refund the amount for failed recharge
      await db.query(
        `UPDATE recharges SET 
         status = ?, 
         message = ?, 
         completed_at = ?, 
         txnid = COALESCE(?, txnid),
         opId = COALESCE(?, opId)
         WHERE id = ?`,
        [
          normalizedStatus,
          callbackMessage,
          new Date(),
          txnid,
          opid || operator_ref,
          recharge.id
        ]
      );

      // Refund the deducted amount
      await db.query(
        `UPDATE users SET balance = balance + ? WHERE id = ?`,
        [parseFloat(recharge.deducted_amount), user.id]
      );

      console.log("Recharge marked as failed and amount refunded");

    } else {
      // Just update status for pending
      await db.query(
        `UPDATE recharges SET 
         status = ?, 
         message = ?, 
         txnid = COALESCE(?, txnid),
         opId = COALESCE(?, opId)
         WHERE id = ?`,
        [
          normalizedStatus,
          callbackMessage,
          txnid,
          opid || operator_ref,
          recharge.id
        ]
      );

      console.log("Recharge status updated to pending");
    }

    // Send callback to user's callback URL if configured
    if (user.callback_url && (normalizedStatus === 'success' || normalizedStatus === 'failed')) {
      try {
        const userCallbackData = {
          status: normalizedStatus,
          message: callbackMessage,
          amount: recharge.amount,
          number: recharge.number,
          account: recharge.account,
          txnId: recharge.reqid,
          opId: opid || operator_ref || recharge.opId
        };

        const queryString = new URLSearchParams(userCallbackData).toString();
        const callbackUrl = `${user.callback_url}?${queryString}`;
        
        console.log("Sending callback to user:", callbackUrl);
        
        const response = await fetch(callbackUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json"
          }
        });

        console.log("User callback response status:", response.status);
      } catch (error) {
        console.log("Failed to send callback to user:", error.message);
      }
    }

    // Log the callback for debugging (optional - you can create this table)
    try {
      await db.query(
        `INSERT INTO callback_logs (recharge_id, callback_data, status, processed_at) VALUES (?, ?, ?, ?)`,
        [
          recharge.id,
          JSON.stringify(callbackData),
          normalizedStatus,
          new Date()
        ]
      );
    } catch (logError) {
      console.log("Callback logging skipped - table may not exist:", logError.message);
    }

    return res.status(200).json({
      status: "success",
      message: "Callback processed successfully",
      recharge_status: normalizedStatus
    });

  } catch (error) {
    console.error("Callback processing error:", error);
    
    // Log failed callback (optional)
    try {
      await db.query(
        `INSERT INTO callback_logs (callback_data, status, error_message, processed_at) VALUES (?, ?, ?, ?)`,
        [
          JSON.stringify(req.method === 'GET' ? req.query : req.body),
          'error',
          error.message,
          new Date()
        ]
      );
    } catch (logError) {
      console.log("Failed to log callback error - table may not exist:", logError.message);
    }

    return res.status(500).json({
      status: "error",
      message: "Failed to process callback"
    });
  }
});

module.exports = {
  getApiData,
  generateNewApiKey,
  addIp,
  deleteIp,
  EditIp,
  updateCallBackUrl,
  recharge,
  statusCheck,
  balanceCheck,
  rechargeCallback
};
