const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const query = require("../db/retailer.queries");
const { parseApiResponse } = require("../utils/response_parser");
const db = require("../db");
const { dynamicRechargeCall } = require("./dynamicrecharge");

const messageUtils = require("../utils/sendMessage");
const e = require("express");

const getOperators = asyncHandler(async (req, res) => {
  const typeId = req.query.type;

  const operators = await query.getOperators(typeId, req.user.id);
  if (!operators) throw new ApiError(404, "Operators not found");
  if (operators.length === 0) throw new ApiError(404, "No Operators found");

  res.status(200).json(new ApiResponse(200, operators, "Operators fetched"));
});

const getCircles = asyncHandler(async (req, res) => {
  const circles = await db.query(`SELECT * FROM circles order by name`);
  res.status(200).json(new ApiResponse(200, circles, "Circles fetched"));
});

//lculation function
function calculateRecharge(amount) {
  const masterMargin = 7;
  const distributorMargin = 5;
  const retailerMargin = 3;

  // Retailer pays after discount
  const retailerPays = amount - amount * (retailerMargin / 100);

  // Earnings
  const distributorEarnings =
    amount * ((distributorMargin - retailerMargin) / 100);
  const masterEarnings = amount * ((masterMargin - distributorMargin) / 100);

  return {
    rechargeAmount: amount,
    retailerPays: retailerPays.toFixed(2),
    distributorEarnings: distributorEarnings.toFixed(2),
    masterEarnings: masterEarnings.toFixed(2)
  };
}

const getOperatorsOffer = asyncHandler(async (req, res) => {
  const { keywordId, customerNumber, account, circleId } = req.body;

  if (!keywordId) throw new ApiError(400, "Operator ID is required");
  if (!customerNumber) throw new ApiError(400, "Customer Number is required");

  let data;

  const [planFetchLine] = await db.query(
    `SELECT * FROM extraLines WHERE keyword_id = ? and type = ? and status = 1`,
    [keywordId, "offercheck"]
  );

  if (planFetchLine.length === 0) throw new ApiError(404, "No plan found");

  let circles;
  let circle;
  if (planFetchLine[0].circles_id && circleId) {
    [circles] = await db.query(`SELECT * FROM customCircles WHERE id = ?`, [
      planFetchLine[0].circles_id
    ]);
    if (circles.length === 0) throw new ApiError(404, "Circles not found");
    if (planFetchLine.length === 0) throw new ApiError(404, "No plan found");
    const [tempCircle] = await db.query(`SELECT * FROM circles WHERE id = ?`, [
      circleId
    ]);

    console.log("temp circle", tempCircle);
    // Get the name from tempCircle and fetch the corresponding value from circles[0].codes
    const tempCircleName = tempCircle[0].name;
    circle = circles[0].codes[tempCircleName];
    console.log("circle", circle);
  }

  console.log("plan fetch line", planFetchLine);
  console.log("circle", circles);

  const response = await dynamicRechargeCall(
    planFetchLine[0].api_provider,
    planFetchLine[0].api,
    {
      mobile: customerNumber,
      account: account,
      circle: circle,
      opcode: planFetchLine[0].merchant_code ?? keywordDetails.code,
      reqid: `TXN-${keywordId}-${req.user.id}-${Date.now()}`,
      remark: "plan fetch"
    }
  );

  function toLowerCaseKeys(obj) {
    if (!obj || typeof obj !== "object") return obj;
    return Object.keys(obj).reduce((acc, key) => {
      acc[key.toLowerCase()] = obj[key];
      return acc;
    }, {});
  }

  const rawResponseLower = toLowerCaseKeys(response.raw.responseData);

  // Try to find a key that matches 'message' in any case
  function findMessage(obj) {
    if (!obj) return undefined;
    for (const key in obj) {
      if (key.toLowerCase() === "message") {
        return obj[key];
      }
    }
    return undefined;
  }

  let message =
    findMessage(rawResponseLower) ||
    response.filters.msg ||
    response.raw.responseData;

  console.log(response);

  if (response.status == "error") {
    throw new ApiError(404, "API not available");
  }

  if (response.status == "failed") {
    throw new ApiError(404, message);
  }
  if (response.status == "pending") {
    throw new ApiError(404, message);
  }

  data = response.parsedData;

  //now we weill fetch filtered data from this
  // if(planFetchLine[0].is_main_response == 0){
  const transformedPlans = transformPlanData(
    response.parsedData,
    planFetchLine[0]
  );
  data = transformedPlans;

  console.log("transformed data", data);

  return res
    .status(200)
    .json(new ApiResponse(200, data, "Plans fetched successfully"));

  // const [keywordRows] = await db.query("SELECT * FROM keywords WHERE id = ?", [
  //   keywordId
  // ]);
  // if (keywordRows.length === 0) throw new ApiError(404, "Keyword not found");
  // console.log(keywordRows);
  // //match keyword data

  // const keywordDetails = keywordRows[0];
  // console.log(keywordDetails);

  // if (keywordDetails.min_digits > customerNumber.length)
  //   throw new ApiError(400, "Customer number is too short");
  // if (keywordDetails.max_digits < customerNumber.length)
  //   throw new ApiError(400, "Customer number is too long");

  // // 2. Check Prevalues

  // // 3. Check KeywordLines by Range
  // const [lines] = await db.query(
  //   `
  //   SELECT *
  //   FROM offercheckLines
  //   WHERE keyword_id = ?
  //     AND status = 1
  //   ORDER BY created_at desc limit 1
  // `,
  //   [keywordId]
  // );

  // console.log(lines);

  // if (lines.length === 0) {
  //   throw new ApiError(404, "NoT availbe");
  // }
  // console.log(lines);

  // const response = await dynamicRechargeCall(
  //   lines[0].api_provider,
  //   lines[0].offercheck_api,
  //   {
  //     mobile: customerNumber,
  //     account: account,
  //     amount: 0,
  //     opcode: lines[0].merchant_code ?? keywordDetails.code,
  //     reqid: `TXN-${keywordId}-${req.user.id}-${Date.now()}`,
  //     remark:  "offercheck"
  //   }
  // );

  // console.log(response);
  // if (response.status == "error") {
  //   throw new ApiError(404, "API not available");
  // }
  // if (response.status == "failed") {
  //   throw new ApiError(404, "NOT AVAILABLE");
  // }
  // if (response.status == "pending") {
  //   throw new ApiError(404, "API not available");
  // }
  // const data = response.parsedData;
  // console.log("parsed data", data);

  // return res
  //   .status(200)
  //   .json(new ApiResponse(200, data, "Recharge Proceeds succesfully"));

  // const api = await query.getKeywordsOfferCheck({ operatorId });
  // console.log(api);

  // res.status(200).json(new ApiResponse(200, api, "Operators fetched"));
});

const recharge = asyncHandler(async (req, res) => {
  let { keywordId, customerNumber, amount, id, account, providerID } = req.body;
  // if (!keywordId) throw new ApiError(400, "Keyword is required");

  console.log("req.body", req.body);



  let oldRecharge = null;

  if (id) {
    [[oldRecharge]] = await db.query(`SELECT * FROM recharges WHERE id = ?`, [
      id
    ]);
  }

  console.log("old recharge", oldRecharge);

  let userId = req.user.id;
  const balance1 = req.user.balance;


  let balance = parseFloat(balance1); // or Number(user.balance)
  amount = parseFloat(req.body.amount); // or Number(req.body.amount)

  if (!id) {
    if (balance < amount) {
      throw new ApiError(400, "Insufficient balance");
    }
  } else {
    userId = oldRecharge.user_id;
    amount = oldRecharge.amount;
    customerNumber = oldRecharge.number;
    keywordId = oldRecharge.keyword_id;
    account = oldRecharge.account;
  }

  const [[user]] = await db.query(`SELECT * FROM users WHERE id = ?`, [userId]);
  balance = parseFloat(user.balance); // Ensure user balance is a number

  //if (balance < amount) throw new ApiError(400, "Insufficient balance");

  // 1. Get Keyword Details
  const [keywordRows] = await db.query("SELECT * FROM keywords WHERE id = ?", [
    keywordId
  ]);
  if (keywordRows.length === 0) throw new ApiError(404, "Keyword not found");

  //match keyword data

  const keywordDetails = keywordRows[0];
  console.log(keywordDetails);

  if (!account) {
    account = customerNumber;
  }

  if (keywordDetails.min_digits > account.length)
    throw new ApiError(400, "Customer number is too short");
  if (keywordDetails.max_digits < account.length)
    throw new ApiError(400, "Customer number is too long");

  if (parseFloat(keywordDetails.min_recharge) > amount)
    throw new ApiError(400, "Amount is too low");
  if (parseFloat(keywordDetails.max_recharge) < amount)
    throw new ApiError(400, "Amount is too high");

  if (!id) {
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
  }

  // 2. Check Prevalues

  let lines = [];
  let byvalue = true;

  if (providerID) {

    [lines] = await db.query(
      `
      SELECT kl.* ,  kf.balance as balance
      FROM keyword_lines kl
  JOIN kl_financials kf on kf.kl_id = kl.id
      WHERE kl.keyword_id = ? 
        AND kl.api_provider = ?
        AND (min_amt IS NULL OR min_amt <= ?)
        AND (max_amt IS NULL OR max_amt >= ?)
        AND (min_digits IS NULL OR min_digits <= ?)
        AND (max_digits IS NULL OR max_digits >= ?)
      ORDER BY priority ASC
    `,
      [keywordId, providerID, amount, amount, account.length, account.length]
    );
    console.log("lines with provider", lines);
  } else {
    [lines] = await db.query(
      `
      SELECT kl.*, kf.balance as balance
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
  }



  if (lines.length === 0) {
    byvalue = false;
    // 3. Check KeywordLines by Range
    if (!providerID) {
      [lines] = await db.query(
        `
    SELECT kl.* , kf.balance as balance
    FROM keyword_lines as kl
    JOIN kl_financials kf on kf.kl_id = kl.id
    WHERE keyword_id = ?
      AND kl.status = 1
      AND (kl.min_amt IS NULL OR kl.min_amt <= ?)
      AND (kl.max_amt IS NULL OR kl.max_amt >= ?)
      AND (kl.min_digits IS NULL OR kl.min_digits <= ?)
      AND (kl.max_digits IS NULL OR kl.max_digits >= ?)
      AND ABS(kf.balance) > ? and kf.today_amount < kf.daily_max_amount
    and kf.today_count < kf.daily_max_count
    ORDER BY priority ASC
  `,
        [keywordId, amount, amount, account.length, account.length, amount]
      );
    }
  }

  console.log("lines without prevalues", lines);

  const params = {
    mobile: customerNumber,
    account: account,
    amount: amount,
   

    remark: "Mobile Recharge"
  };


  console.log("lines are", lines);

  if (!id) {
    const [updateBalance] = await db.query(
      `UPDATE users SET balance = balance - ? WHERE id = ?`,
      [amount, userId]
    );
    if (updateBalance.affectedRows === 0) {
      throw new ApiError(404, "TRY AGAIN");
    }
  }

  const randomPart = Math.floor(Math.random() * 90) + 10; // 2 digit random number (10-99)
  let reqId = `${keywordId}${userId}${Date.now().toString().slice(-5)}${randomPart}`;

    if (lines.length === 0 && !id) {
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

     reqId = addRecharge.insertId;
     params.reqid = reqId;

    await db.query(`update recharges set reqid = ? where id = ?`, [
      reqId,
      addRecharge.insertId
    ]);



    return res.status(200).json(
      new ApiResponse(
        200,
        {
          keywordId,
          customerNumber,
          account,
          amount,
          status: "pending",
          message:"Recharge proceeds successfully, Current Recharge Status is pending will be updated soon",
        },
        "Recharge Proceeds succesfully"
      )
    );

    // throw new ApiError(404, "No match found");
  }

  //update balance

  //get Api and keyword detail according to top match keyword_line

  const currentline = lines[0];
  console.log("current line", currentline);
  let statusCheckApi = null;
  let RechargeApi;
  let balanceApi = null;

  if (currentline.recharge_api == null) {
    throw new ApiError(404, "Recharge API not found");
  }

  // let reqId = `${keywordId}${userId}${+new Date()}`;
  // Generate a more randomized reqId to reduce collision chances
 

  if (id) {
    reqId = oldRecharge.reqid;
  }

  const baseParams = {
    mobile: customerNumber,
    account: account,
    amount: Number.isInteger(amount) || (typeof amount === "number" && amount % 1 === 0)
      ? parseInt(amount)
      : parseFloat(amount),
    // reqid: reqId,
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

  if (!id) {
    [addRecharge] = await db.query(
      `INSERT INTO recharges (user_id, keyword_id, account, number, amount, deducted_amount, params,  user_prev_balance , user_new_balance) VALUES (?, ?,  ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        keywordId,
        account,
        customerNumber,
        amount,
        amount,
        JSON.stringify(params),
        balance,
        balance - amount
      ]
    );

    if (addRecharge.affectedRows === 0) {
      return { status: "error", message: "Failed to create recharge request." };
    }
    rechargeId = addRecharge.insertId;
    reqId = addRecharge.insertId;

    await db.query(`update recharges set reqid = ? where id = ?`, [
      reqId,
      rechargeId
    ]);
  } else {
    rechargeId = oldRecharge.id;
    reqId = oldRecharge.reqid;
  }

  while (attempt < maxAttempts) {
    finalStatus = "pending";
    console.log(lines.length);
    console.log("byValue", byValue);

    if (lines.length === 0 && byValue && !id) {
      const [liness] = await db.query(
        `
      SELECT kl.*, kf.balance as balance
      FROM keyword_lines as kl
      JOIN kl_financials kf ON kf.kl_id = kl.id
      WHERE keyword_id = ?
        AND kl.status = 1
        AND (kl.min_amt IS NULL OR kl.min_amt <= ?)
        AND (kl.max_amt IS NULL OR kl.max_amt >= ?)
        AND (kl.min_digits IS NULL OR kl.min_digits <= ?)
        AND (kl.max_digits IS NULL OR kl.max_digits >= ?)
        AND ABS(kf.balance) > ?
        AND kf.today_amount < kf.daily_max_amount
        AND kf.today_count < kf.daily_max_count
        and kl_id != ?
      ORDER BY priority ASC
      `,
        [
          keywordId,
          amount,
          amount,
          account.length,
          account.length,
          amount,
          finalLineId
        ]
      );
      byValue = false;
      lines.push(...liness);

      console.log("lines without prevalues", lines);


      if (lines.length === 0) break;
    }

    console.log("lines  ", lines);

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


    console.log("current. lines balance", currentline.balance);

    const [addgigs] = await db.query(
      "INSERT INTO recharge_gigs (rech_id, user_id, line_id, api_id, provider_id, amount, prev_balance,config, request) VALUES (?, ?, ?, ?, ?, ?, ?,?,?)",
      [
        rechargeId,
        userId,
        currentline.id,
        currentline.recharge_api,
        currentline.api_provider,
        amount,
        currentline.balance,
        "recharge",
        JSON.stringify(attemptParams)
        
      ]
    );

    const gigId = addgigs.insertId;
    if (!gigId) {
      attempt++;
      continue;
    }

    let rechargeResponse = await dynamicRechargeCall(
      currentline.api_provider,
      currentline.recharge_api,
      attemptParams
    );

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
      finalTxnid = rechargeResponse.filters.tid;
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
        isNaN(Number(rechargeResponse.filters.bal)) ||
        rechargeResponse.filters.bal === null ||
        rechargeResponse.filters.bal === undefined ||
        rechargeResponse.filters.bal === ""
          ? 0
          : Number(rechargeResponse.filters.bal),
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
      finalMessage = rechargeResponse.message || "Recharge Pending";
      finalTxnid = rechargeResponse.filters.tid;
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
        ` insert into recharge_gigs (rech_id, user_id, line_id, api_id, provider_id, amount, prev_balance , config , status, request, response, response_complete,message) 
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
    } else if (
      rechargeResponse.status === "failed" &&
      rechargeResponse.returnToUser === true
    ) {
      finalStatus = "failed";
      finalMessage =
        rechargeResponse.message || "Recharge failed and amount refunded";
      finalFilters = rechargeResponse.filters;
      break;
    } else if (
      rechargeResponse.status === "failed" &&
      rechargeResponse.returnToUser === false
    ) {
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
    : `Recharge is ${finalStatus} for ${customerNumber}`;

  let retailerAddition = 0;
  let parentAddtion = 0;
  let supperAddition = 0;

  if (finalStatus == "failed") {
    const [updateRecharge] = await db.query(
      `UPDATE recharges SET status = ?, txnid =? ,message = ? ,user_new_balance = user_new_balance + ?, completed_at = ? WHERE id = ?`,
      [finalStatus, finalFilters?.tid, message, amount, new Date(), rechargeId]
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

    console.log("Calculated Margins:", result);
    // return {
    //   retailerAddition,
    //   parentAddition,
    //   superAddition,
    //   isDirect: parentMargin.role == 4,
    //   rawMargins: {
    //     retailerMargin: retailerAdd,
    //     parentMargin: parentAdd,
    //     superMargin: superAdd
    //   }

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

    const [updateRecharge] = await db.query(
      `UPDATE recharges SET status = ?,deducted_amount = deducted_amount -?,user_new_balance = user_new_balance +?, txnid =? , opId = ? ,message = ? , com_retailer = ?,com_parent = ?, com_superparent = ? , com_admin = ?,  parent_id =?, superparent_id = ?, completed_at = ? WHERE id = ?`,
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
    // const parsedMargin = parseFloat(currentline.admin_margin);
    // console.log(amount - (amount * parsedMargin)/100);
    console.log(amount);
    //update currentlinebalance
    // Use currentline.balance (line balance) if finalFilters?.bal is not available
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
        [finalFilters.bal, admin_margin, amount, finalLineId]
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
        [amount, admin_margin, admin_margin, amount, finalLineId]
      );
    }

    //   const [updateLine] = await db.query(
    //   `UPDATE kl_financials
    //  SET balance =  ?,
    //      today_profit = today_profit + ?,
    //      today_amount = today_amount + ?,
    //      today_count = today_count + 1
    //  WHERE kl_id = ?`,
    //   [
    //     finalFilters?.bal &&
    //     finalFilters.bal !== 0 &&
    //     finalFilters.bal !== null &&
    //     finalFilters.bal !== undefined &&
    //     finalFilters.bal !== "0"
    //       ? finalFilters.bal
    //       : balance - amount - admin_margin,
    //     admin_margin,
    //     amount,
    //     finalLineId
    //   ]
    // );

    if (updateLine.affectedRows === 0) {
      throw new ApiError(404, "Failed to update line balance");
    }

    const [updateGigs] = await db.query(
      `UPDATE recharge_gigs SET status = ?, new_balance = ?,  message = ? WHERE rech_id = ? and line_id = ?`,
      [
        finalStatus,
        finalFilters?.bal &&
        !isNaN(Number(finalFilters.bal)) &&
        finalFilters.bal !== 0 &&
        finalFilters.bal !== null &&
        finalFilters.bal !== undefined &&
        finalFilters.bal !== "0"
          ? finalFilters.bal
          : balance - amount - admin_margin,
        message,
        rechargeId,
        finalLineId
      ]
    );
  } else {
    const [updateRecharge] = await db.query(
      `UPDATE recharges SET status = ?, txnid =? ,message = ? , completed_at = ? WHERE id = ?`,
      [finalStatus, finalFilters?.tid, message, new Date(), rechargeId]
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
        [finalStatus, finalLineBalance ?? 0, message, rechargeId, finalLineId]
      );
    }

    // const [updateUser] = await db.query(
    //   `UPDATE users SET balance = balance + ? WHERE id = ?`,
    //   [amount, userId]
    // );
  }

  //cut and update the margin

  const data = {
    keywordId,
    customerNumber,
    account,
    amount,
    status: finalStatus,
    message
  };

  // messageUtils.sendMessageToUser(
  //   req.user.id,
  //   `Your Recharge is ${finalStatus} for ${customerNumber}`
  // );

  return res
    .status(200)
    .json(new ApiResponse(200, data, "Recharge Proceeds succesfully"));
});
async function calculateUserMargins({ userId, parentId, keywordId, amount }) {
  const parsedAmount = parseFloat(amount);
  console.log("parsed amount", parsedAmount);
  console.log("userId", userId);
  console.log("parentId", parentId);
  console.log("keywordId", keywordId);
  let retailerMargin = null;
  let parentMargin = null;
  let superMargin = null;

  // 1. Get Retailer Margin
  [[retailerMargin]] = await db.query(
    `
    SELECT
      u.margin_type,
      COALESCE(
        ks.custom_margin, 
        CASE 
          WHEN u.margin_type = 'flat' THEN 0.0
          ELSE k.ret_std_margin
        END
      ) AS margin,
      COALESCE(ks.additional_charges, k.additional_charges) AS additional_charges,
      COALESCE(ks.is_charges_fixed, true) AS is_charges_fixed
    FROM keywords AS k
    LEFT JOIN users u ON u.id = ?
    LEFT JOIN keyword_settings ks 
      ON ks.keyword_id = k.id 
      AND ks.user_id = ? 
    WHERE k.id = ?
    `,
    [userId, userId, keywordId]
  );

  console.log("retailer margin", retailerMargin);

  // 2. Get Parent (Distributor / Master Distributor) Margin
  console.log(parentId);
  [[parentMargin]] = await db.query(
    `
    SELECT
      u.margin_type,
      u.role_id AS role,
      r.parent_id AS parent,
      COALESCE(
        ks.custom_margin,
        CASE 
          WHEN u.margin_type = 'flat' THEN 0.0
          ELSE 
            CASE 
              WHEN u.role_id = 4 THEN k.dist_std_margin 
              WHEN u.role_id = 3 THEN k.mdist_std_margin 
              When u.role_id = 2 THEN k.ret_std_margin
              WHEN u.role_id = 1 THEN k.ret_std_margin

              ELSE 0.0 
            END
        END
      ) AS margin,
        COALESCE(ks.additional_charges, k.additional_charges) AS additional_charges,
      COALESCE(ks.is_charges_fixed, true) AS is_charges_fixed
    FROM keywords AS k
    LEFT JOIN users u ON u.id = ?
    LEFT JOIN keyword_settings ks 
      ON ks.keyword_id = k.id 
      AND ks.user_id = ?
    LEFT JOIN users r ON r.id = u.id
    WHERE k.id = ?
    `,
    [parentId, parentId, keywordId]
  );

  console.log("parent margin", parentMargin);

  // 3. Get Super Margin if needed

  if (parentMargin.role == 4) {
    [[superMargin]] = await db.query(
      `
      SELECT
        u.margin_type,
        u.role_id AS role,
        COALESCE(
          ks.custom_margin,
          CASE 
            WHEN u.margin_type = 'flat' THEN 0.0
            ELSE k.mdist_std_margin
          END
        ) AS margin,
          COALESCE(ks.additional_charges, k.additional_charges) AS additional_charges,
      COALESCE(ks.is_charges_fixed, true) AS is_charges_fixed
      FROM keywords AS k
      LEFT JOIN users u ON u.id = ?
      LEFT JOIN keyword_settings ks 
        ON ks.keyword_id = k.id 
        AND ks.user_id = ?
      WHERE k.id = ?
      `,
      [parentMargin.parent, parentMargin.parent, keywordId]
    );
  }

  console.log("supermargin", superMargin);

  // Margin amount values
  let retailerAdd = parseFloat(retailerMargin.margin);
  let parentAdd = 0;
  let superAdd = 0;

  // Parent margin calculation
  if (retailerMargin.margin_type === "flat") {
    parentAdd = parseFloat(parentMargin.margin);
  } else {
    parentAdd = parseFloat(parentMargin.margin) - retailerAdd;
  }

  // Super margin calculation
  if (parentMargin.role == 4) {
    if (parentMargin.margin_type === "flat") {
      superAdd = parseFloat(superMargin.margin);
    } else {
      superAdd =
        parseFloat(superMargin.margin) - parseFloat(parentMargin.margin);
    }
  }

  const retailerAddition =
    retailerAdd * (parsedAmount / 100) +
    (retailerMargin.is_charges_fixed
      ? parseFloat(retailerMargin.additional_charges)
      : amount * (parseFloat(retailerMargin.additional_charges) / 100));

  const parentAddition =
    parentAdd * (parsedAmount / 100) +
    (parentMargin.is_charges_fixed
      ? parseFloat(parentMargin.additional_charges)
      : amount * (parseFloat(parentMargin.additional_charges) / 100));

  const superAddition =
    parentMargin.role == 4
      ? superAdd * (parsedAmount / 100) +
        (superMargin.is_charges_fixed
          ? parseFloat(superMargin.additional_charges)
          : amount * (parseFloat(superMargin.additional_charges) / 100))
      : 0;

  return {
    retailerAddition,
    parentAddition,
    superAddition,
    superParentId: parentMargin.parent,
    isDirect: parentMargin.role != 4,
    rawMargins: {
      retailerMargin: retailerAdd,
      parentMargin: parentAdd,
      superMargin: superAdd
    }
  };
}

const planFetch = asyncHandler(async (req, res) => {
  const { keywordId, circleId } = req.body;
  if (!keywordId) throw new ApiError(400, "Keyword is required");

  const [plans] = await db.query(
    `SELECT * FROM plans WHERE keyword_id = ? and circle_id = ? and  created_at > ?`,
    [keywordId, circleId, new Date(Date.now() - 24 * 60 * 60 * 1000)]
  );

  console.log("plans", plans);
  let data;

  if (!plans || plans.length === 0) {
    const [planFetchLine] = await db.query(
      `SELECT * FROM extraLines WHERE keyword_id = ? and type = ? and status = 1`,
      [keywordId, "plan fetch"]
    );
    if (planFetchLine.length === 0) throw new ApiError(404, "No plan found");

    const [circles] = await db.query(
      `SELECT * FROM customCircles WHERE id = ?`,
      [planFetchLine[0].circles_id]
    );
    console.log("plan fetch line", planFetchLine);
    console.log("circle", circles);

    if (circles.length === 0) throw new ApiError(404, "Circles not found");

    const [tempCircle] = await db.query(`SELECT * FROM circles WHERE id = ?`, [
      circleId
    ]);

    console.log("temp circle", tempCircle);
    // Get the name from tempCircle and fetch the corresponding value from circles[0].codes
    const tempCircleName = tempCircle[0].name;
    const circle = circles[0].codes[tempCircleName];
    console.log("circle", circle);

    const response = await dynamicRechargeCall(
      planFetchLine[0].api_provider,
      planFetchLine[0].api,
      {
        mobile: req.body.mobile,
        account: req.body.account,
        circle: circle,
        opcode: planFetchLine[0].merchant_code ?? keywordDetails.code,
        reqid: `TXN-${keywordId}-${req.user.id}-${Date.now()}`,
        remark: "plan fetch"
      }
    );
    // Convert all keys in response.filters and response.raw.responseData to lowercase
    function toLowerCaseKeys(obj) {
      if (!obj || typeof obj !== "object") return obj;
      return Object.keys(obj).reduce((acc, key) => {
        acc[key.toLowerCase()] = obj[key];
        return acc;
      }, {});
    }

    const rawResponseLower = toLowerCaseKeys(response.raw.responseData);

    // Try to find a key that matches 'message' in any case
    function findMessage(obj) {
      if (!obj) return undefined;
      for (const key in obj) {
        if (key.toLowerCase() === "message") {
          return obj[key];
        }
      }
      return undefined;
    }

    let message =
      findMessage(rawResponseLower) ||
      response.filters.msg ||
      response.raw.responseData;

    console.log(response);

    if (response.status == "error") {
      throw new ApiError(404, "API not available");
    }

    if (response.status == "failed") {
      throw new ApiError(404, message);
    }
    if (response.status == "pending") {
      throw new ApiError(404, message);
    }

    data = response.parsedData;

    //now we weill fetch filtered data from this
    // if(planFetchLine[0].is_main_response == 0){
    const transformedPlans = transformPlanData(
      response.parsedData,
      planFetchLine[0]
    );
    data = transformedPlans;
    console.log("transformed plans", transformedPlans);

    //save this data in plans table
    const [insertPlans] = await db.query(
      `INSERT INTO plans (keyword_id, circle_id, plans) VALUES (?, ?, ?)`,
      [keywordId, circleId, JSON.stringify(transformedPlans)]
    );
    console.log(insertPlans);
  } else {
    data = plans[0].plans;
  }

  console.log("data", data);

  return res
    .status(200)
    .json(new ApiResponse(200, data, "Plans fetched successfully"));
});
function transformPlanData(responseData, planFetchLine) {
  // Extract filters from planFetchLine
  const amountFilter = planFetchLine?.rs_filter || "price"; // Changed default to 'price' based on your data
  const validityFilter = planFetchLine?.extra_filter || "validity";
  const descFilter = planFetchLine?.desc_filter || "logdesc"; // Changed default to 'logdesc' based on your data

  // Check if responseData is an array
  if (Array.isArray(responseData)) {
    // If it's an array, transform it differently
    const transformedData = {
      plans: [] // Create a default category called "plans"
    };

    // Transform each plan in the array
    responseData.forEach((plan) => {
      const transformedPlan = {
        amount: plan[amountFilter] || plan.price || plan.rs || plan.amount,
        validity: extractValidity(
          plan[validityFilter] || plan.logdesc || plan.desc || ""
        ),
        desc:
          plan[descFilter] ||
          plan.logdesc ||
          plan.ofrtext ||
          plan.desc ||
          plan.description,
        extra: plan[validityFilter] || plan.logdesc || plan.desc
      };

      transformedData.plans.push(transformedPlan);
    });

    return transformedData;
  } else {
    // Original logic for object with categories
    const transformedData = {};

    // Iterate through each category in the original data
    for (const category in responseData) {
      // Initialize array for this category if it doesn't exist
      transformedData[category] = [];

      // Transform each plan in the category
      responseData[category].forEach((plan) => {
        const transformedPlan = {
          amount: plan[amountFilter] || plan.rs || plan.price || plan.amount,
          validity: plan[validityFilter] || plan.validity || plan.valid_for,
          desc: plan[descFilter] || plan.desc || plan.description,
          extraInfo: plan[validityFilter] || plan.logdesc || plan.desc
        };

        transformedData[category].push(transformedPlan);
      });
    }

    return transformedData;
  }
}

// Helper function to extract validity from description
function extractValidity(text) {
  // Try to extract days validity from the text
  const dayMatch = text.match(/(\d+)\s*din|(\d+)\s*day|(\d+)\s*D/i);
  if (dayMatch) {
    const days = dayMatch[1] || dayMatch[2] || dayMatch[3];
    return `${days} days`;
  }

  // If no validity found, return empty string
  return "";
}

const getDTHInfo = asyncHandler(async (req, res) => {
  const { keywordId, account } = req.body;
  if (!keywordId) throw new ApiError(400, "Keyword is required");
  if (!account) throw new ApiError(400, "Account is required");

  const [extraLines] = await db.query(
    `SELECT * FROM extraLines WHERE keyword_id = ? and type = ? and status = 1`,
    [keywordId, "info fetch"]
  );

  if (extraLines.length === 0) throw new ApiError(404, "Not found");

  const response = await dynamicRechargeCall(
    extraLines[0].api_provider,
    extraLines[0].api,
    {
      mobile: account,
      account: account,
      opcode: extraLines[0].merchant_code ?? keywordDetails.code,
      reqid: `TXN-${keywordId}-${req.user.id}-${Date.now()}`,
      remark: "info fetch"
    }
  );

  console.log(response);
  // Convert all keys in response.filters and response.raw.responseData to lowercase
  function toLowerCaseKeys(obj) {
    if (!obj || typeof obj !== "object") return obj;
    return Object.keys(obj).reduce((acc, key) => {
      acc[key.toLowerCase()] = obj[key];
      return acc;
    }, {});
  }

  const rawResponseLower = toLowerCaseKeys(response.raw.responseData);

  // Try to find a key that matches 'message' in any case
  function findMessage(obj) {
    if (!obj) return undefined;
    for (const key in obj) {
      if (key.toLowerCase() === "message") {
        return obj[key];
      }
    }
    return undefined;
  }

  let message =
    findMessage(rawResponseLower) ||
    response.filters.msg ||
    response.raw.responseData;

  console.log(response);

  if (response.status == "error") {
    throw new ApiError(404, "API not available");
  }

  if (response.status == "failed") {
    throw new ApiError(404, message);
  }
  if (response.status == "pending") {
    throw new ApiError(404, message);
  }

  const data = response.parsedData;
  const parsedData = response.parsedData;
  const format = response.format || "json{}";

  // 8. Extract filtered fields
  const extractFromData = (key) => {
    if (!key) return null;
    console.log("key is", key);
    if (format === "string") {
      // const regex = new RegExp(`${key}\\s*[:=]\\s*([^\\s,]+)`, 'i');
      // const match = parsedData.match(regex);
      // return match ? match[1] : null;
      return parsedData[key.toLowerCase()] || null;
    }
    const data = Array.isArray(parsedData) ? parsedData[0] : parsedData;

    if (format === "xml") {
      const root = Object.values(data)[0]; // first XML node
      console.log("root", root);
      console.log("key", key);
      console.log("root[key]", root?.[key]);
      return root?.[key] ? root[key][0] : null;
    }

    console.log("data is", data);
    return data?.[key] ?? null;
  };

  //       data is {
  //   VC: '3048391977',
  //   Name: 'MR Sumit Ji',
  //   Rmn: '7851897498',
  //   Balance: '95.81',
  //   Monthly: '',
  //   'Next Recharge Date': '2025-05-24',
  //   Plan: '',
  //   Address: 'Plot No 25 Gali No 4 Panchyawala Sirsi Road Jaipur',
  //   City: '',
  //   District: '',
  //   State: '44',
  //   'PIN Code': '302021'
  // }

  const responseData = {
    name: extractFromData(extraLines[0].name_filter),
    description: extractFromData(extraLines[0].description_filter),
    extraInfo: extractFromData(extraLines[0].extra_info_filter),
    balance: extractFromData(extraLines[0].rs_filter),
    account: extractFromData(extraLines[0].account_filter),
    bill_date: extractFromData(extraLines[0].bill_date_filter),
    due_date: `Next recharge data ${extractFromData(extraLines[0].due_date_filter)}`
    //     msg : extractFromData(api.msg_filter),
  };

  return res
    .status(200)
    .json(new ApiResponse(200, data, "Info fetched successfully"));
});

const billFetch = asyncHandler(async (req, res) => {
  const { keywordId, account, circleId } = req.body;
  if (!keywordId) throw new ApiError(400, "Keyword is required");
  if (!account) throw new ApiError(400, "Account is required");

  const [extraLines] = await db.query(
    `SELECT * FROM extraLines WHERE keyword_id = ? and type = ? and status = 1`,
    [keywordId, "bill fetch"]
  );

  if (extraLines.length === 0) throw new ApiError(404, "Not found");
  let circle;

  if (circleId) {
    const [circles] = await db.query(
      `SELECT * FROM customCircles WHERE id = ?`,
      [extraLines[0].circles_id]
    );
    if (circles.length === 0) throw new ApiError(404, "Circles not found");
    const [tempCircle] = await db.query(`SELECT * FROM circles WHERE id = ?`, [
      circleId
    ]);
    if (tempCircle.length === 0) throw new ApiError(404, "Circles not found");
    // Get the name from tempCircle and fetch the corresponding value from circles[0].codes
    const tempCircleName = tempCircle[0].name;
    circle = circles[0].codes[tempCircleName];
    console.log("circle", circle);
  }

  const response = await dynamicRechargeCall(
    extraLines[0].api_provider,
    extraLines[0].api,
    {
      mobile: account,
      account: account,
      circle: circle,
      opcode: extraLines[0].merchant_code ?? keywordDetails.code,
      reqid: `TXN-${keywordId}-${req.user.id}-${Date.now()}`,
      remark: "bill fetch"
    }
  );
  console.log(response);
  // Convert all keys in response.filters and response.raw.responseData to lowercase
  function toLowerCaseKeys(obj) {
    if (!obj || typeof obj !== "object") return obj;
    return Object.keys(obj).reduce((acc, key) => {
      acc[key.toLowerCase()] = obj[key];
      return acc;
    }, {});
  }

  const rawResponseLower = toLowerCaseKeys(response.raw.responseData);

  // Try to find a key that matches 'message' in any case
  function findMessage(obj) {
    if (!obj) return undefined;
    for (const key in obj) {
      if (key.toLowerCase() === "message") {
        return obj[key];
      }
    }
    return undefined;
  }

  let message =
    findMessage(rawResponseLower) ||
    response.filters.msg ||
    response.raw.responseData;

  console.log(response);

  if (response.status == "error") {
    throw new ApiError(404, "API not available");
  }

  if (response.status == "failed") {
    throw new ApiError(404, message);
  }
  if (response.status == "pending") {
    throw new ApiError(404, message);
  }

  const data = response.parsedData;
  const parsedData = response.parsedData;
  return res
    .status(200)
    .json(new ApiResponse(200, data, "Info fetched successfully"));
});

const demoApi = asyncHandler(async (req, res) => {
  return res.status(200).json({ status: 1 });
});

module.exports = {
  getOperators,
  getCircles,
  getOperatorsOffer,
  recharge,
  calculateUserMargins,
  planFetch,
  getDTHInfo,
  billFetch,
  demoApi
};
