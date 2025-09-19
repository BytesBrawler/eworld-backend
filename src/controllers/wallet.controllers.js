const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const query = require("../db/queries.js");
const { getRoleAccess } = require("./general.controller");
const { pause } = require("../db/index.js");
const db = require("../db");
const messageUtils = require("../utils/sendMessage");
const crypto = require("crypto");
const axios = require("axios");

// Utility function to determine balance type based on context
function getBalanceType(fromUser, toUser, transactionType, operationType = null) {
  // If it's an online payment, it's always a transfer
  if (transactionType === 'online') {
    return 'credit';
  }

  // Check for refund operations first (recharge failures, auto refunds)
  if (operationType === 'refund' || transactionType === 'refund' || 
      (operationType && operationType.includes('refund'))) {
    return 'refund';
  }

  // For offline transactions, determine based on roles and operation
  const fromUserRole = fromUser.role || fromUser.role_id;
  const toUserRole = toUser ? (toUser.role || toUser.role_id) : null;

  // If superadmin (role 1) or admin (role 2) is doing MANUAL operations
  if (fromUserRole <= 2) {
    // Manual admin deduct balance operation
    if (operationType === 'deduct' || operationType === 'manual_deduct' || 
        (operationType && operationType.includes('deduct'))) {
      return 'debit';
    }
    // Manual admin add balance operation  
    if (operationType === 'add' || operationType === 'manual_add' || operationType === 'credit' || 
        (operationType && operationType.includes('add'))) {
      return 'credit';
    }
  }

  // For parent-child relationships (role > 2)
  if (toUser && fromUserRole > 2) {
    // Parent deducting from child is a refund
    if (operationType === 'refund' || (operationType && operationType.includes('refund'))) {
      return 'refund';
    }
    // Parent transferring to child is a transfer
    return 'transfer';
  }

  // For fund requests and normal transfers between users
  if (operationType === 'transfer' || !operationType) {
    return 'transfer';
  }

  // Default to transfer for other cases
  return 'transfer';
}

// Getepay Utility Functions
class GetepayUtils {
  static getConfig() {
    return {
      iv: "LHPaBO5CtLWc8H2dtXaGgQ==",
      key: "gqd/0xqwKy2VX0BGMzwXnxL371ihOZU4trOWI9w13w0=",
      mid: "1232623",
      terminalId: "getepay.merchant130805@icici",
      baseUrl: "https://portal.getepay.in:8443/getepayPortal",
      generateInvoiceUrl: "https://portal.getepay.in:8443/getepayPortal/pg/generateInvoice",
      invoiceStatusUrl: "https://portal.getepay.in:8443/getepayPortal/pg/invoiceStatus",
      paymentResponseUrl: "https://portal.getepay.in:8443/getepayPortal/pg/pgPaymentResponse",
      // Legacy url property for backward compatibility
      url: "https://portal.getepay.in:8443/getepayPortal/pg/generateInvoice"
    };
  }

  static byteArrayToString(ba) {
    return Buffer.from(ba).toString('hex').toUpperCase();
  }

  static stringToByteArray(hex) {
    const result = [];
    for (let i = 0; i < hex.length; i += 2) {
      result.push(parseInt(hex.substr(i, 2), 16));
    }
    return Buffer.from(result);
  }

  static aesEncrypt(request, key, iv) {
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(request, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted;
  }

  static aesDecrypt(request, key, iv) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(request);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  }

  static encryptRequest(requestString, config) {
    const key = Buffer.from(config.key, 'base64');
    const iv = Buffer.from(config.iv, 'base64');
    const encrypted = this.aesEncrypt(requestString, key, iv);
    console.log("enc-1->", encrypted.length);
    return this.byteArrayToString(encrypted);
  }

  static decryptRequest(requestString, config) {
    const key = Buffer.from(config.key, 'base64');
    const iv = Buffer.from(config.iv, 'base64');
    const requestBytes = this.stringToByteArray(requestString);
    return this.aesDecrypt(requestBytes, key, iv);
  }

  static async generateRequest(config, request) {
    try {
      const requestWrapper = {
        mid: config.mid,
        terminalId: config.terminalId,
        req: this.encryptRequest(JSON.stringify(request), config)
      };

      const response = await axios.post(config.generateInvoiceUrl, requestWrapper, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (response.status === 200 && response.data) {
        const responseWrapper = response.data;
        if (responseWrapper.response) {
          const decryptedResponse = this.decryptRequest(responseWrapper.response, config);
          return JSON.parse(decryptedResponse);
        } else {
          return { error: "No response data received" };
        }
      } else {
        return { error: `HTTP Error: ${response.status} - ${response.statusText}` };
      }
    } catch (error) {
      console.error("Getepay generateRequest error:", error.message);
      return { error: error.message || "Request generation failed" };
    }
  }
static async requeryRequest(config, request) {
  try {
    // The request should already contain the proper format from the calling code
    // According to API documentation: mid, paymentId, referenceNo, status, terminalId
    const requeryRequestData = {
      mid: request.mid,
      paymentId: request.paymentId,
      referenceNo: request.referenceNo || "",
      status: request.status || "",
      terminalId: request.terminalId
    };

    const requestWrapper = {
      mid: config.mid,
      terminalId: config.terminalId,
      req: this.encryptRequest(JSON.stringify(requeryRequestData), config)
    };

    console.log("Getepay Requery Request Data:", requeryRequestData);
    console.log("Getepay Requery Request Wrapper:", requestWrapper);

    const response = await axios.post(config.invoiceStatusUrl, requestWrapper, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log("Getepay Requery HTTP Status:", response.status);
    console.log("Getepay Requery Raw Response:", response.data);

    if (response.status === 200 && response.data) {
      const responseWrapper = response.data;
      
      // Check if there's an error in the response wrapper
      if (responseWrapper.status && responseWrapper.status.toLowerCase() === 'error') {
        console.error("Getepay API returned error:", responseWrapper.message);
        return { error: responseWrapper.message || "API returned error status" };
      }
    //  return responseWrapper;
      
      if (responseWrapper.response) {
        try {
          const decryptedResponse = this.decryptRequest(responseWrapper.response, config);
          console.log("Getepay Requery Decrypted Response:", decryptedResponse);
          return JSON.parse(decryptedResponse);
        } catch (decryptError) {
          console.error("Decryption error:", decryptError.message);
          return { error: "Failed to decrypt response" };
        }
      } else {
        console.error("No response field in requery response:", responseWrapper);
        return { error: "No encrypted response received" };
      }
    } else {
      console.error("Requery HTTP Error:", response.status, response.statusText);
      return { error: `HTTP Error: ${response.status} - ${response.statusText}` };
    }
  } catch (error) {
    console.error("Getepay requeryRequest error:", error.message);
    if (error.response) {
      console.error("Error response status:", error.response.status);
      console.error("Error response data:", error.response.data);
    }
    return { error: error.message || "Network request failed" };
  }
}

  static async refundRequest(config, request) {
    try {
      const requestWrapper = {
        mid: config.mid,
        terminalId: config.terminalId,
        req: this.encryptRequest(JSON.stringify(request), config)
      };

      const response = await axios.post(config.refundUrl, requestWrapper, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (response.status === 200 && response.data) {
        const responseWrapper = response.data;
        if (responseWrapper.response) {
          const decryptedResponse = this.decryptRequest(responseWrapper.response, config);
          return JSON.parse(decryptedResponse);
        } else {
          return { error: "No response data received" };
        }
      } else {
        return { error: `HTTP Error: ${response.status} - ${response.statusText}` };
      }
    } catch (error) {
      console.error("Getepay refundRequest error:", error.message);
      return { error: error.message || "Refund request failed" };
    }
  }

  static getepayResponse(config, responseString) {
    try {
      const decryptedResponse = this.decryptRequest(responseString, config);
      console.log("Decrypted response:", decryptedResponse);
      return JSON.parse(decryptedResponse);
    } catch (error) {
      console.error("Getepay response decryption error:", error.message);
      return null;
    }
  }
}


const getBalanceByParent = asyncHandler(async (req, res) => {
  const {number} = req.query;
  const user = await query.users({mobile:number});
  console.log(user);
  // const user = await query.findUserByMobile(number);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  var isParent = await getRoleAccess(req.user.role, user.role_id, req.user.id, user.parent_id);
  console.log(isParent);
  if(isParent) {
    const balance = await query.getBalance(user.id);
    res
      .status(200)
      .json(new ApiResponse(200, balance, "Balance fetched successfully"));
  } else {
    throw new ApiError(403, "Not authorized to access user balance");
  }
});

//fetch balance
const getBalance = asyncHandler(async (req, res) => {
  const balance = await query.users({factor:"select", columns:["balance"],id: req.user.id });
  console.log(balance);
  // const balance = await query.getBalance(req.user.id);
  if (!balance) throw new ApiError(404, "Balance not found");
  res
    .status(200)
    .json(new ApiResponse(200, balance, "Balance fetched successfully"));
});

//create fund request
const fundRequest = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) throw new ApiError(400, "Invalid amount");
  await query.createFundRequest(req.user.id, amount);
  res.status(200).json(new ApiResponse(200, null, "Fund request sent"));
})

///get all fund request of user
const getAllFundRequest = asyncHandler(async (req, res) => {
  const requests = await query.fundRequests({user_id:req.user.id});
  console.log(requests);
  // const requests = await query.getFundRequests(req.user.id);
  res.status(200).json(new ApiResponse(200, requests, "Fund requests fetched"));
});

//fund request to parent
const getAllFundRequestforParent = asyncHandler(async (req, res) => {
  const requests = await query.getFundRequestsParent(req.user.id);
  res.status(200).json(new ApiResponse(200, requests, "Fund requests fetched"));
});

//paretns approve fund request
const approveFund = asyncHandler(async (req, res) => {
  const  id  = req.query.id;
  console.log(id);  
  //   const { status } = req.body;
  //   const currentBalance = await query.getBalance(req.user.id);
  const [fundRequest] = await query.fundRequests({id});
  //const fundRequest = fundRequests[0];
  // const fundRequest = await query.getFundRequestbyId(id);
  console.log(fundRequest);

  if (fundRequest.status === "approved") {
    throw new ApiError(400, "Fund request already approved");
  }
  if (Number(fundRequest.amount) > Number(req.user.balance)) {
    throw new ApiError(400, "Insufficient balance");
  }
 const balanceAdd =  await balanceAddition(req.user, fundRequest.amount, fundRequest.user_id, fundRequest.amount, {operationType: 'transfer'});
 await query.updateFundRequestStatus(fundRequest.id, "approved", req.user.id);
 console.log(balanceAdd);

  res.status(200).json(new ApiResponse(200, balanceAdd, "Fund request updated"));
});


async function balanceAddition(parent_user, amount, userId,originalAmount, options = {},remark) {
  const { orderId = null, type = 'offline', operationType = 'add' } = options;
  const balanceBeforeDeduction = parent_user.balance;

  const balanceBeforeAddition = await query.getBalance(userId);
  await query.deductBalance(parent_user.id, amount);
  const balanceAfterDeduction = await query.getBalance(parent_user.id);
  await query.addBalance(userId, amount);
  const balanceAfterAddition = await query.getBalance(userId);

  let status = "failed";
  if (
    Number(balanceBeforeAddition) <= Number(balanceAfterAddition) ||
    Number(balanceBeforeDeduction) >= Number(balanceAfterDeduction)
  ) {
    status = "success";
  }

  console.log(status);

  // Get the user details for balance type determination
  const toUser = await query.findUserById(userId);
  const balanceType = getBalanceType(parent_user, toUser, type, operationType);

  await query.addBalanceTransaction(
    parent_user.id,
    userId,
    amount,
    originalAmount,
    status,
    balanceBeforeAddition,
    balanceAfterAddition,
    balanceBeforeDeduction,
    balanceAfterDeduction,
    orderId,
    type,
    remark,
    balanceType
  );



  return { status, balanceBeforeAddition, balanceAfterAddition, balanceBeforeDeduction, balanceAfterDeduction };
}

async function balanceWithdraw(parent_user, amount, userId, originalAmount, remark, generateItsEntry = true, operationType = 'transfer') {
  //generate order idon basisi of  as userid and timestamp
  const orderId = `${userId}-${Date.now()}`;
  const type = 'offline';

  const balanceBeforeDeduction = parent_user.balance;
  const balanceBeforeAddition = await query.getBalance(userId);
  
  if (generateItsEntry) {
    // Normal withdrawal: deduct from parent and add to user
    await query.deductBalance(parent_user.id, amount);
    const balanceAfterDeduction = await query.getBalance(parent_user.id);
    await query.addBalance(userId, amount);
    const balanceAfterAddition = await query.getBalance(userId);

    let status = "failed";
    if (
      Number(balanceBeforeAddition) >= Number(balanceAfterAddition) ||
      Number(balanceBeforeDeduction) <= Number(balanceAfterDeduction)
    ) {
      status = "success";
    }

    console.log("Withdrawal with ITS entry:", status);

    // Get the user details for balance type determination
    const toUser = await query.findUserById(userId);
    // Use the provided operation type for balance type determination
    const balanceType = getBalanceType(parent_user, toUser, type, operationType);

    await query.addBalanceTransaction(
      parent_user.id,
      userId,
      amount,
      originalAmount,
      status,
      balanceBeforeAddition,
      balanceAfterAddition,
      balanceBeforeDeduction,
      balanceAfterDeduction,
      orderId,
      type,
      remark,
      balanceType
    );
    return { status, balanceBeforeAddition, balanceAfterAddition, balanceBeforeDeduction, balanceAfterDeduction };
  } else {
    // Admin/Super Admin withdrawal without ITS entry: only deduct from parent, don't add to user
    const absoluteAmount = Math.abs(amount); // Ensure positive value for deduction
    await query.deductBalance(parent_user.id, absoluteAmount);
    const balanceAfterDeduction = await query.getBalance(parent_user.id);
    
    // Don't change user's balance
    const balanceAfterAddition = balanceBeforeAddition;
    
    const status = "success";
    
    console.log("Admin withdrawal without ITS entry:", status);
    
    // Don't create transaction record for admin withdrawals without ITS entry
    return { 
      status, 
      balanceBeforeAddition, 
      balanceAfterAddition, 
      balanceBeforeDeduction, 
      balanceAfterDeduction 
    };
  }
}

// async function balanceDeduction(parent_user , amount , user){
//     const balanceBeforeDeduction = user.balance;
//     const balanceBeforeAddition = await query.getBalance(parent_user.id);
//     await query.deductBalance(user.id, amount);
//     const balanceAfterDeduction = await query.getBalance(user.id);
//     await query.addBalance(parent_user, amount);
//     const balanceAfterAddition = await query.getBalance(parent_user.id);
   
//     let status = "failed";
//   if (
//       Number(balanceBeforeAddition) <= Number(balanceAfterAddition) ||
//       Number(balanceBeforeDeduction) >= Number(balanceAfterDeduction)
//   ) {
//       status = "success";
      
//   }

//   console.log(status);  
  
//     await query.addBalanceTransaction(
//       parent_user.id,
//       userId,
//       amount,
//       status,
//       balanceBeforeAddition,
//       balanceAfterAddition,
//       balanceBeforeDeduction,
//       balanceAfterDeduction,
//       "alpha testing",
//       "approval fund request"
//     );
//     return { status , balanceBeforeAddition , balanceAfterAddition , balanceBeforeDeduction , balanceAfterDeduction};
// }

//router.post('/wallet/transfer', authMiddleware,
const addBalance = asyncHandler(async (req, res) => {
  let{ mobile, amount ,remark} = req.body;
  console.log(mobile, amount);

  if (!mobile || !amount || amount <= 0) {
    throw new ApiError(400, "Invalid data");
  }
  const user = await query.users({mobile});

  

  // const user = await query.findUserByMobile(mobile);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if(req.user.role > user.role_id){
    throw new ApiError(403, "Not authorized to add balance");
  }

  console.log("user", user);
  if(req.user.role > 2){
  if(user.parent_id !== req.user.id) {
      throw new ApiError(403, "Not authorized to transfer funds");
  }}
let originalAmount = amount;

  if(user.is_flat_margin === 1){

    amount = amount + user.margin_rates * amount / 100;
  }


  console.log("amount", amount);

  if (req.user.balance < amount) {
    throw new ApiError(400, "Insufficient balance");
  }

 // Determine operation type based on user role - admin manual addition is 'credit', parent transfer is 'transfer'  
 const operationType = req.user.role <= 2 ? 'credit' : 'transfer';
 const balanceUpdate =  await balanceAddition(req.user, amount, user.id , originalAmount , {operationType} , remark);
//  messageUtils.sendMessageToUser(
//   user.id,
//   `Your Eworld wallet balance has been credited with ${amount}`,
// );

messageUtils.sendMessageToUser(
  user.id,
  `Dear eworld User (${user.person} ji), Balance of ${amount} is transfererd to your account , your new balance is ${balanceUpdate.balanceAfterAddition}`,
  "number"
);
messageUtils.sendMessageToUser(
  req.user.id,
  `Dear eworld User, Balance of ${amount} is transfererd to ${user.person}(${user.mobile} -- new balance of user is ${balanceUpdate.balanceAfterAddition}). Your balance: ${balanceUpdate.balanceAfterDeduction}`,
  "number"
);
//   await query.deductBalance(req.user.id, amount);
//   await query.addBalance(user.id, amount);
  // await query.updateFundRequestStatus(id, status);

  res.status(200).json(new ApiResponse(200, balanceUpdate, "Balance Added Succesfully"));
});

//router.post('/wallet/transfer', authMiddleware,
const withDrawBalance = asyncHandler(async (req, res) => {
  let{ mobile, amount, remark, generateItsEntry = true } = req.body;
  console.log(mobile, amount, "generateItsEntry:", generateItsEntry);

  if (!mobile || !amount || amount <= 0) {
    throw new ApiError(400, "Invalid data");
  }
  const user = await query.users({mobile});
  // const user = await query.findUserByMobile(mobile);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if(req.user.role > user.role_id){
    throw new ApiError(403, "Not authorized to change balance");
  }


   if(req.user.role > 2){
  if(user.parent_id !== req.user.id) {
      throw new ApiError(403, "Not authorized to transfer funds");
  }}

amount = -amount;
  console.log("amount", amount);

let originalAmount = amount;

console.log("user" ,user);

  // Determine operation type based on user role - admin manual deduction is 'debit', parent deduction is 'refund'
  const operationType = req.user.role <= 2 ? 'deduct' : 'refund';
  const balanceUpdate =  await balanceWithdraw(req.user, amount, user.id, originalAmount, remark, generateItsEntry, operationType);

  

  // if (req.user.balance < amount) {
  //   throw new ApiError(400, "Insufficient balance");
  // }

//  const balanceUpdate =  await balanceDeduction(req.user, amount, user);
//   await query.deductBalance(req.user.id, amount);
//   await query.addBalance(user.id, amount);
  // await query.updateFundRequestStatus(id, status);

  res.status(200).json(new ApiResponse(200, balanceUpdate, "Balance Withdrawn Successfully"));
});

//router.post('/wallet/transfer', authMiddleware,
const generateBalance = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  console.log(amount);

  if ( !amount || amount <= 0) {
    throw new ApiError(400, "Invalid data");
  }

  if(req.user.role !== 1){
    throw new ApiError(403, "Not authorized to generate balance");
  }

  // const user = await query.findUserByMobile(mobile);

  const geBalance =    await query.addBalance(1, amount);
  // messageUtils.sendMessageToUser(
  //   req.user.id,
  //   `Your balance has been credited with ${amount}}`,
  //   "number"
  // );
  messageUtils.sendMessageToUser(
    req.user.id,
    `Your Eworld wallet balance has been credited with ${amount}`,
  );
  res.status(200).json(new ApiResponse(200, geBalance, "Balance Added Succesfully"));
//   await query.deductBalance(req.user.id, amount);
//   await query.addBalance(user.id, amount);
  // await query.updateFundRequestStatus(id, status);

//  res.status(200).json(new ApiResponse(200, balanceUpdate, "Balance Added Succesfully"));
});
// const axios = require("axios");
const qs = require("qs"); // for application/x-www-form-urlencoded

// const generateOrder = asyncHandler(async (req, res) => {
//   const { amount } = req.body;
//   console.log("Amount:", amount);

//   if (!amount || amount <= 0) {
//     throw new ApiError(400, "Invalid data");
//   }

//   const orderIds = `${req.user.id}-${Date.now()}`;
//   const orderId = `${Date.now()}`;
//   console.log("Generated Order ID:", orderId);

//   // Optional: Save order locally before calling payment gateway
//   const localOrder = await query.createOrder(req.user.id, amount, orderId);
//   console.log("Local Order Saved:", localOrder);

//   // Prepare payload for TezGateway API
//   const payload = {
//     customer_mobile: req.user.mobile || "9667027786", // fallback if user.mobile is missing
//     user_token: 'afc5bad164707b4ce92e20fc9bf72a6d',           // Store this securely in .env
//     amount: amount.toString(),
//     order_id: orderId,
//     redirect_url: "https://www.mohammedimran.in", // Change to your site
//     remark1: "user_id_" + req.user.id,
//     remark2: "tez_payment",
//   };

//   console.log("TezGateway Payload:", payload);

//   try {
//     const response = await axios.post(
//       "https://tezgateway.com/api/create-order",
//       qs.stringify(payload), // convert to x-www-form-urlencoded
//       {
//         headers: {
//           "Content-Type": "application/x-www-form-urlencoded",
//         },
//       }
//     );

//     console.log(response);

//     const data = response.data;
//     console.log("TezGateway Response:", data);

//     if (data.status === true || data.status === "true") {
//       res.status(200).json(
//         new ApiResponse(200, {
//           localOrder,
//           gatewayOrderId: data.result.orderId,
//           paymentUrl: data.result.payment_url,
//         }, "Order created successfully")
//       );
//     } else {
//       throw new ApiError(400, data.message || "Payment Gateway Error");
//     }
//   } catch (err) {
//     console.error("TezGateway Error:", err.message);
//     throw new ApiError(500, "Failed to create order via payment gateway");
//   }
// });

const generateOrder = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  console.log("Amount:", amount);

  if (!amount || amount <= 0) {
    throw new ApiError(400, "Invalid amount");
  }

  const orderId = `${Date.now()}`;
  const userId = req.user.id;
  const userMobile = req.user.mobile || "9667027786";

  // Step 1: Insert transaction with status 'initiated'
  await db.query(
    `INSERT INTO transactions (user_id, amount, order_id, status) VALUES (?, ?, ?, ?)`,
    [userId, amount, orderId, 'initiated']
  );
  console.log("Transaction initiated with orderId:", orderId);

  // Step 2: Prepare payload for TezGateway
  const payload = {
    customer_mobile: userMobile,
    user_token: process.env.TEZ_USER_TOKEN || "afc5bad164707b4ce92e20fc9bf72a6d",
    amount: amount.toString(),
    order_id: orderId,
    redirect_url: `https://e8e2-2401-4900-a9c6-f6af-1cd-5511-1623-2b9f.ngrok-free.app/api/v1/wallet/redirectGateway?order_id=${orderId}`,
    remark1: "user_id_" + userId,
    remark2: "tez_payment",
  };
  console.log("TezGateway Payload:", payload);

  try {
    const response = await axios.post(
      "https://tezgateway.com/api/create-order",
      qs.stringify(payload),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const data = response.data;
    console.log("TezGateway Response:", data);

    if (data.status === true || data.status === "true") {
      // Step 3: Update transaction with gateway response and mark as pending
      await db.query(
        `UPDATE transactions SET status = ?, reference_id = ?, gateway_response = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
        ['pending', data.result.orderId || null, JSON.stringify(data), orderId]
      );

      return res.status(200).json(
        new ApiResponse(200, {
          orderId,
          gatewayOrderId: data.result.orderId,
          paymentUrl: data.result.payment_url,
        }, "Order created successfully")
      );
    } else {
      // Step 4: Update transaction as failed with gateway response
      await db.query(
        `UPDATE transactions SET status = ?, gateway_response = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
        ['failed', JSON.stringify(data), orderId]
      );

      throw new ApiError(400, data.message || "Payment Gateway Error");
    }

  } catch (err) {
    console.error("TezGateway Error:", err.message);

    // Step 5: On API error, mark transaction failed
    await db.query(
      `UPDATE transactions SET status = ?, gateway_response = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
      ['failed', JSON.stringify({ error: err.message }), orderId]
    );

    throw new ApiError(500, "Failed to create order via payment gateway");
  }
});


const verifyAndProcessTransaction = async (orderId) => {
  const [rows] = await db.query("SELECT * FROM transactions WHERE order_id = ? LIMIT 1", [orderId]);
  const transaction = rows[0];

  if (!transaction) {
    return { status: "error", message: "Transaction not found" };
  }

  if (transaction.status === "success") {
    return { status: "success", message: "Transaction already processed" };
  }

 // try {
    // 1. Verify payment with gateway
    const { data } = await axios.post(
      "https://tezgateway.com/api/check-order-status",
      new URLSearchParams({
        user_token: process.env.TEZ_USER_TOKEN || "afc5bad164707b4ce92e20fc9bf72a6d",
        order_id: orderId,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    console.log("data", data);

    if (!data.status || !["SUCCESS", "PENDING"].includes(data.result.txnStatus)) {
      // 2. If not successful or pending, update transaction
      await db.query(
      "UPDATE transactions SET status = ?, gateway_response = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?",
      ["failed", JSON.stringify(data), orderId]
      );
      return { status: "error", message: "Transaction failed or not completed" };
    }

    if (data.result.txnStatus === "PENDING") {
      // 3. If transaction is pending, update status accordingly
      await db.query(
      "UPDATE transactions SET status = ?, gateway_response = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?",
      ["pending", JSON.stringify(data), orderId]
      );
      return { status: "pending", message: "Transaction is still pending" };
    }

    // 3. Check if already updated to avoid duplicate balance
    if (transaction.status === "success") {
      return { status: "success", message: "Transaction already processed" };
    }

    const amount = transaction.amount;
    const userId = transaction.user_id;
    const user = await query.users({id:userId});
  // const user = await query.findUserByMobile(mobile);

  
  // if(user.parentId !== req.user.id) {
  //     throw new ApiError(403, "Not authorized to transfer funds");
  // }
let originalAmount = amount;

  if(user.is_flat_margin === 1){

    amount = Number(amount) + Number(user.margin_rates) * Number(amount) / 100;
  }

    const adminRes = await db.query("SELECT * FROM users WHERE id = 1");
    const admin = adminRes[0][0];

    // if (admin.balance < amount) {
    //   return { status: "error", message: "Admin balance is insufficient" };
    // }

    // 4. Add balance to user
    const result = await balanceAddition(admin, amount, userId ,originalAmount, {orderId , type: 'online', operationType: 'transfer'});

    if (result.status !== "success") {
      return { status: "error", message: "Balance addition failed" };
    }

    // 5. Mark transaction as success
    await db.query(
      "UPDATE transactions SET status = ?, gateway_response = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?",
      ["success", JSON.stringify(data), orderId]
    );


messageUtils.sendMessageToUser(
userId,
  `Dear eworld User, Balance of ${amount} is transfererd to your account`,
  "number"
);


messageUtils.sendMessageToUser(
  userId,
  `Your Eworld wallet  balance has been credited with ${amount}}`,

);

    return { status: "success", message: "Balance added successfully" };

  // } catch (err) {
  //   console.error("Verification Error:", err.message);
  //   return { status: "error", message: "Verification failed" };
  // }
};


const webhookCallback = asyncHandler(async (req, res) => {
  console.log("yes");
  console.log("Webhook Callback:", req.query);
  const { order_id } = req.query;
  console.log("Webhook Order ID:", order_id);
  console.log("callback reciever");

  if (!order_id) {
    return res.status(400).json({ status: false, message: "Missing order_id" });
  }
  

  const result = await verifyAndProcessTransaction(order_id);

  return res.status(result.status === "success" ? 200 : 400).json(result);
});

const statusCheck = asyncHandler(async (req, res) => {
  const { order_id } = req.body || req.query;
  console.log("status check :", order_id);
  console.log("callback reciever");

  if (!order_id) {
    return res.status(400).json({ status: false, message: "Missing order_id" });
  }

  const result = await verifyAndProcessTransaction(order_id);
  console.log(result);

  res.status(200).json(new ApiResponse(200, result, "Status Check Success"));

  // return res.status(result.status === "success" ? 200 : 400).json(result);
}
);

const redirect = asyncHandler(async (req, res) => {
  const { order_id } = req.query;
  console.log("Redirect Order ID:", order_id);
  console.log("callback reciever");

  // if (!order_id) {
  //   return res.status(400).json({ status: false, message: "Missing order_id" });
  // }

  const result = await verifyAndProcessTransaction(order_id);
  console.log(result);
  // Determine the payment status
  const status = result?.status || 'pending';
  
  // Configure display elements based on status
  let iconSymbol = '✓';
  let iconColor = '#27ae60'; // Green for success
  let title = 'Payment Request Received';
  let message = 'Thank you for your payment. Your order has been processed successfully.';
  let balanceMessage = 'Your balance will be updated shortly.';
  
  // Adjust display elements based on status
  if (status === 'pending') {
    iconSymbol = '⌛';
    iconColor = '#f39c12'; // Orange for pending
    title = 'Payment Processing';
    message = 'Your payment is being processed. This may take a few moments.';
    balanceMessage = 'Your balance will be updated once the payment is confirmed.';
  } else if (status === 'failed') {
    iconSymbol = '✗';
    iconColor = '#e74c3c'; // Red for failed
    title = 'Payment Failed';
    message = 'We encountered an issue processing your payment.';
    balanceMessage = 'Please try again or contact support if the issue persists.';
  }
  
  // Send HTML response with appropriate status information
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 40px 20px;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 500px;
          margin: 0 auto;
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
          color: #2c3e50;
        }
        .status-icon {
          color: ${iconColor};
          font-size: 64px;
          margin-bottom: 20px;
        }
        .message {
          margin: 20px 0;
          font-size: 18px;
          color: #34495e;
        }
        .note {
          margin-top: 40px;
          color: #7f8c8d;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="status-icon">${iconSymbol}</div>
        <h1>${title}</h1>
        <div class="message">
          ${message}
        </div>
        <div class="message">
          ${balanceMessage}
        </div>
        <div class="note">
          You can close this window now.
        </div>
      </div>
      
      <script>
        // For mobile apps that open this in a webview, we can send a message
        // to the app to close the webview and include status information
        try {
          if (window.flutter_inappwebview) {
            window.flutter_inappwebview.callHandler('closeWebView', '${status}');
          }
        } catch (e) {
          console.log('Not in Flutter WebView or handler not available');
        }
      </script>
    </body>
    </html>
  `);
  

  // return res.status(result.status === "success" ? 200 : 400).json(result);
}
);


const addMoney = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
console.log(orderId);
console.log("checking status");
  if (!orderId) {
    throw new ApiError(400, "Order ID is required");
  }

  // ✅ Call reusable verification + balance function
  const result = await verifyAndProcessTransaction(orderId);

  if (result.status !== "success") {
    throw new ApiError(400, result.message || "Failed to verify transaction");
  }


  res.status(200).json(new ApiResponse(200, result, "Balance Added Successfully"));
});





// const addMoney = asyncHandler(async (req, res) => {
//   const { amount , orderId } = req.body;
//   console.log( amount);

//   if ( !amount || amount <= 0) {
//     throw new ApiError(400, "Invalid data");
//   }
//   const admin = await query.users({id:1});

//   if (admin.balance < amount) {
//     throw new ApiError(400, "Currently unavailable");
//   }

//  const balanceUpdate =  await balanceAddition(admin, amount, req.user.id);
//  if(balanceUpdate.status !== "success"){
//    throw new ApiError(400, "Failed to add balance");
//  }

//  data = {
//  status:  balanceUpdate.status,
//  }
// //   await query.deductBalance(req.user.id, amount);
// //   await query.addBalance(user.id, amount);
//   // await query.updateFundRequestStatus(id, status);

//   res.status(200).json(new ApiResponse(200, data, "Balance Added Succesfully"));
// });



//router.get('/wallet/transactions', authMiddleware,
const getTransactions = asyncHandler(async (req, res) => {
  const transactions = await query.transactions({id:req.user.id});
  // const transactions = await query.getTransactions(req.user.id);
  res
    .status(200)
    .json(new ApiResponse(200, transactions, "Transactions fetched"));
});

const getBalReport = asyncHandler(async (req, res) => {
  const transactions = await query.balTransactions({id:req.user.id});
  // const transactions = await query.getBalanceReport(req.user.id);
  if (!transactions) throw new ApiError(404, "Balance Report not found");
  if (transactions.length === 0) throw new ApiError(404, "No Balance Report found");


  res
    .status(200)
    .json(new ApiResponse(200, transactions, "Balance Report fetched"));
});

// Getepay Controller Methods
const getepayGenerateOrder = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  console.log("Getepay Amount:", amount);

  if (!amount || amount <= 0) {
    throw new ApiError(400, "Invalid amount");
  }

  const userId = req.user.id;
  // const userMobile = req.user.mobile || "9667027786";
  // const userEmail = req.user.email || "imranchopdar13@gmail.com";
  // const companyName = "Eworld";

  //get user details
  const user = await query.users({id:userId});
  // const user = await query.findUserByMobile(mobile);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const userMobile = user.mobile || req.userId;
  const companyName = user.company || "";
  const personName = user.person || "Eworld User";

  // Step 1: Insert transaction with status 'initiated' to get the table ID
  const [insertResult] = await db.query(
    `INSERT INTO transactions (user_id, amount, status, gateway) VALUES (?, ?, ?, ?)`,
    [userId, amount, 'initiated', 'getepay']
  );
  
  const orderId = insertResult.insertId.toString(); // Use table ID as order ID
  
  // Step 2: Update the transaction with the order_id (same as table ID)
  await db.query(
    `UPDATE transactions SET order_id = ? WHERE id = ?`,
    [orderId, insertResult.insertId]
  );
  
  console.log("Getepay transaction initiated with orderId:", orderId);

  // Step 3: Prepare Getepay request
  const config = GetepayUtils.getConfig();
  const getepayRequest = {
    mid: config.mid,
    amount: amount.toFixed(2),
    merchantTransactionId: orderId,
    transactionDate: new Date().toISOString(),
    terminalId: config.terminalId,
    udf1: userMobile,
    udf2: companyName,
    udf3: personName,
    udf4: "",
    udf5: "",
    udf6: "",
    udf7: "",
    udf8: "",
    udf9: "",
    udf10: "",
    ru: "",
    callbackUrl: `${process.env.BASE_URL || 'https://eworldrc.in'}/api/v1/wallet/getepay/callback`,
    currency: "INR",
    paymentMode: "UPI",
    bankId: "",
    txnType: "",
    productType: "",
    txnNote: `${userMobile}_EWO${orderId}`,
    vpa: ""
  };

  console.log("Getepay Request:", getepayRequest);

  try {
    const orderResponse = await GetepayUtils.generateRequest(config, getepayRequest);
    console.log("Getepay Response:", orderResponse);

    if (orderResponse.error) {
      // Step 4: Update transaction as failed
      await db.query(
        `UPDATE transactions SET status = ?, gateway_response = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
        ['failed', JSON.stringify(orderResponse), orderId]
      );
      throw new ApiError(400, orderResponse.error);
    }

    // Step 5: Update transaction with gateway response and paymentId as reference_id
    await db.query(
      `UPDATE transactions SET status = ?, reference_id = ?, gateway_response = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
      ['pending', orderResponse.paymentId || null, JSON.stringify(orderResponse), orderId]
    );

    return res.status(200).json(
      new ApiResponse(200, {
        orderId,
        paymentId: orderResponse.paymentId,
        paymentUrl: orderResponse.paymentUrl,
        qrIntent: orderResponse.qrIntent,
        qrCode: orderResponse.qr,
        // qrPath: orderResponse.qrPath,
        // token: orderResponse.token
      }, "Getepay order created successfully")
    );

  } catch (err) {
    console.error("Getepay Error:", err.message);

    // Step 6: On API error, mark transaction failed
    await db.query(
      `UPDATE transactions SET status = ?, gateway_response = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
      ['failed', JSON.stringify({ error: err.message }), orderId]
    );

    throw new ApiError(500, "Failed to create Getepay order");
  }
});

const getepayCallback = asyncHandler(async (req, res) => {
  console.log("Getepay Callback received:", req.body);
  console.log("Getepay Callback received:", req.query);
  console.log("Getepay Callback received:", req);
  const { response } = req.body;

  if (!response) {
    return res.status(400).json({ status: false, message: "Missing response data" });
  }

  try {
    const config = GetepayUtils.getConfig();
    const callbackData = GetepayUtils.getepayResponse(config, response);
    console.log("Getepay Callback Data:", callbackData);

    if (!callbackData || !callbackData.merchantTransactionId) {
      return res.status(400).json({ status: false, message: "Invalid callback data" });
    }

    const orderId = callbackData.merchantTransactionId;
    const result = await verifyAndProcessGetepayTransaction(orderId, callbackData);

    return res.status(result.status === "success" ? 200 : 400).json(result);

  } catch (error) {
    console.error("Getepay Callback Error:", error.message);
    return res.status(500).json({ status: false, message: "Callback processing failed" });
  }
});

const getepayStatusCheck = asyncHandler(async (req, res) => {
  const { order_id } = req.body || req.query;
  console.log("Getepay status check:", order_id);

  if (!order_id) {
    throw new ApiError(400, "Missing order_id");
  }

  // Store the original transaction status before processing
  const [originalTxn] = await db.query("SELECT * FROM transactions WHERE order_id = ? LIMIT 1", [order_id]);
  const originalStatus = originalTxn[0]?.status;

  const result = await verifyAndProcessGetepayTransaction(order_id);
  console.log("Getepay status result:", result);

  // Get the updated transaction to check if status changed
  const [updatedTxn] = await db.query("SELECT * FROM transactions WHERE order_id = ? LIMIT 1", [order_id]);
  const newStatus = updatedTxn[0]?.status;
  const statusChanged = originalStatus !== newStatus;

  // Return comprehensive response
  res.status(200).json(new ApiResponse(200, {
    status: result.status, 
    message: result.message,
    original_status: originalStatus,
    new_status: newStatus,
    status_changed: statusChanged,
    transaction_data: updatedTxn[0] || null,
    gateway_data: result.data || null
  }, "Getepay status check completed"));
});


const getepayRequery = asyncHandler(async (req, res) => {
  const { merchantTransactionId } = req.body;

  if (!merchantTransactionId) {
    throw new ApiError(400, "merchantTransactionId is required");
  }

  try {
    // First check if transaction exists in our database
    const [transactionRows] = await db.query(
      "SELECT * FROM transactions WHERE order_id = ? LIMIT 1",
      [merchantTransactionId]
    );

    if (transactionRows.length === 0) {
      throw new ApiError(404, "Transaction not found in local database");
    }

    const transaction = transactionRows[0];
    
    // Check if reference_id exists in the transaction
    if (!transaction.reference_id) {
      throw new ApiError(400, "Payment reference ID not found for this transaction");
    }
    console.log("Found transaction:", {
      id: transaction.id,
      order_id: transaction.order_id,
      amount: transaction.amount,
      status: transaction.status,
      gateway: transaction.gateway
    });

    const config = GetepayUtils.getConfig();
    
    // According to the API documentation, the request should include these fields
    const requeryRequest = {
      mid: config.mid,
      paymentId: transaction.reference_id, // Use gateway transaction ID if available
      referenceNo: "", // Leave empty as per documentation
      status: "", // Leave empty as per documentation
      terminalId: config.terminalId
    };

    console.log("Getepay Requery Request:", requeryRequest);

    const requeryResponse = await GetepayUtils.requeryRequest(config, requeryRequest);
    console.log("Getepay Requery Response:", requeryResponse);

    if (requeryResponse) {
      // Update transaction status based on requery response
      let updatedStatus = transaction.status; // Keep existing status as default
      
      if (requeryResponse.txnStatus) {
        // Map Getepay status to your internal status
        switch (requeryResponse.txnStatus.toLowerCase()) {
          case 'success':
          case 'completed':
            updatedStatus = 'completed';
            break;
          case 'failed':
          case 'failure':
            updatedStatus = 'failed';
            break;
          case 'pending':
            updatedStatus = 'pending';
            break;
          default:
            updatedStatus = requeryResponse.txnStatus.toLowerCase();
        }
      }

      // Update transaction with requery response and potentially updated status
      await db.query(
        `UPDATE transactions SET 
         gateway_response = ?, 
         status = ?,
         updated_at = CURRENT_TIMESTAMP 
         WHERE order_id = ?`,
        [
          JSON.stringify(requeryResponse), 
          updatedStatus,
          String(merchantTransactionId)
        ]
      );

      res.status(200).json(new ApiResponse(200, {
        transaction: {
          ...transaction,
          status: updatedStatus,
          gateway_response: requeryResponse
        },
        requeryResponse: requeryResponse
      }, "Getepay requery completed successfully"));
    } else {
      throw new ApiError(400, "Requery failed - no response received from Getepay");
    }

  } catch (error) {
    console.error("Getepay Requery Error:", error);
    
    // If it's already an ApiError, re-throw it
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Otherwise, wrap it in an ApiError
    throw new ApiError(500, error.message || "Requery request failed");
  }
});

// const getepayRequery = asyncHandler(async (req, res) => {
//   const { merchantTransactionId } = req.body;

//   if (!merchantTransactionId) {
//     throw new ApiError(400, "merchantTransactionId is required");
//   }

//   try {
//     // First check if transaction exists in our database
//     const [transactionRows] = await db.query(
//       "SELECT * FROM transactions WHERE order_id = ? LIMIT 1",
//       [merchantTransactionId]
//     );

//     if (transactionRows.length === 0) {
//       throw new ApiError(404, "Transaction not found in local database");
//     }

//     const transaction = transactionRows[0];
//     console.log("Found transaction:", {
//       id: transaction.id,
//       order_id: transaction.order_id,
//       amount: transaction.amount,
//       status: transaction.status,
//       gateway: transaction.gateway
//     });

//     const config = GetepayUtils.getConfig();
//     const requeryRequest = {
//       merchantTransactionId: merchantTransactionId
//     };

//     console.log("Getepay Requery Request:", requeryRequest);

//     const requeryResponse = await GetepayUtils.requeryRequest(config, requeryRequest);
//     console.log("Getepay Requery Response:", requeryResponse);

//     if (requeryResponse) {
//       // Update transaction with requery response
//       await db.query(
//         `UPDATE transactions SET gateway_response = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
//         [JSON.stringify(requeryResponse), merchantTransactionId]
//       );

//       res.status(200).json(new ApiResponse(200, {
//         transaction: transaction,
//         requeryResponse: requeryResponse
//       }, "Getepay requery completed"));
//     } else {
//       throw new ApiError(400, "Requery failed - no response received");
//     }

//   } catch (error) {
//     console.error("Getepay Requery Error:", error.message);
//     throw new ApiError(500, error.message || "Requery request failed");
//   }
// });

const getepayRefund = asyncHandler(async (req, res) => {
  const { merchantTransactionId, refundAmount, refundNote } = req.body;

  if (!merchantTransactionId || !refundAmount) {
    throw new ApiError(400, "merchantTransactionId and refundAmount are required");
  }

  try {
    // Check if transaction exists and is successful
    const [transactionRows] = await db.query(
      "SELECT * FROM transactions WHERE order_id = ? AND status = 'success' LIMIT 1",
      [merchantTransactionId]
    );

    if (transactionRows.length === 0) {
      throw new ApiError(404, "Transaction not found or not successful");
    }

    const transaction = transactionRows[0];
    if (parseFloat(refundAmount) > parseFloat(transaction.amount)) {
      throw new ApiError(400, "Refund amount cannot exceed transaction amount");
    }

    const config = GetepayUtils.getConfig();
    const refundRequest = {
      merchantTransactionId: merchantTransactionId,
      refundAmount: parseFloat(refundAmount).toFixed(2),
      refundNote: refundNote || "Refund request"
    };

    const refundResponse = await GetepayUtils.refundRequest(config, refundRequest);
    console.log("Getepay Refund Response:", refundResponse);

    if (refundResponse) {
      // Log refund request
      await db.query(
        `INSERT INTO refund_requests (transaction_id, user_id, refund_amount, refund_note, gateway_response, status) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [transaction.id, transaction.user_id, refundAmount, refundNote, JSON.stringify(refundResponse), 'pending']
      );

      res.status(200).json(new ApiResponse(200, refundResponse, "Getepay refund request submitted"));
    } else {
      throw new ApiError(400, "Refund request failed");
    }

  } catch (error) {
    console.error("Getepay Refund Error:", error.message);
    throw new ApiError(500, "Refund request failed");
  }
});

// Helper endpoint to list recent transactions for testing
const getRecentTransactions = asyncHandler(async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, order_id, amount, status, gateway, created_at, user_id 
       FROM transactions 
       ORDER BY created_at DESC 
       LIMIT 10`
    );

    res.status(200).json(new ApiResponse(200, rows, "Recent transactions fetched"));
  } catch (error) {
    console.error("Get Recent Transactions Error:", error.message);
    throw new ApiError(500, "Failed to fetch transactions");
  }
});

// Helper function for Getepay transaction verification
// Helper function to log status check attempts
const logStatusCheck = async (orderId, transactionId, checkType, statusData, previousStatus, updatedStatus, balanceProcessed = false, balanceAmount = 0, requestData = null, errorMessage = null) => {
  try {
    const logData = {
      order_id: orderId,
      transaction_id: transactionId,
      gateway: 'GETEPAY',
      check_type: checkType,
      
      // Extract key fields from Getepay response
      gateway_txn_id: statusData?.getepayTxnId || null,
      gateway_status: statusData?.txnStatus || statusData?.paymentStatus || null,
      payment_mode: statusData?.paymentMode || null,
      txn_amount: statusData?.txnAmount ? parseFloat(statusData.txnAmount) : null,
      settlement_amount: statusData?.settlementAmount ? parseFloat(statusData.settlementAmount) : null,
      bank_ref_no: statusData?.custRefNo || statusData?.settlementRefNo || null,
      payment_id: statusData?.getepayTxnId || null,
      txn_date: statusData?.txnDate ? new Date(statusData.txnDate) : null,
      settlement_date: statusData?.settlementDate ? new Date(statusData.settlementDate) : null,
      error_code: statusData?.errorCode || null,
      error_message: statusData?.bankError || errorMessage || null,
      
      // Complete response as JSON
      gateway_response: JSON.stringify(statusData),
      request_data: requestData ? JSON.stringify(requestData) : null,
      
      // Status tracking
      previous_status: previousStatus,
      updated_status: updatedStatus,
      status_changed: previousStatus !== updatedStatus,
      
      // Balance processing info
      balance_added: balanceAmount,
      balance_processed: balanceProcessed,
      admin_balance_sufficient: true
    };

    await db.query(`
      INSERT INTO transaction_status_logs (
        order_id, transaction_id, gateway, check_type,
        gateway_txn_id, gateway_status, payment_mode, txn_amount, settlement_amount,
        bank_ref_no, payment_id, txn_date, settlement_date, error_code, error_message,
        gateway_response, request_data, previous_status, updated_status, status_changed,
        balance_added, balance_processed, admin_balance_sufficient
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      logData.order_id, logData.transaction_id, logData.gateway, logData.check_type,
      logData.gateway_txn_id, logData.gateway_status, logData.payment_mode, 
      logData.txn_amount, logData.settlement_amount, logData.bank_ref_no, 
      logData.payment_id, logData.txn_date, logData.settlement_date, 
      logData.error_code, logData.error_message, logData.gateway_response, 
      logData.request_data, logData.previous_status, logData.updated_status, 
      logData.status_changed, logData.balance_added, logData.balance_processed, 
      logData.admin_balance_sufficient
    ]);

    console.log(`Status check logged for order ${orderId}: ${previousStatus} -> ${updatedStatus}`);
  } catch (error) {
    console.error("Failed to log status check:", error.message);
  }
};

const verifyAndProcessGetepayTransaction = async (orderId, callbackData = null) => {
  const [rows] = await db.query("SELECT * FROM transactions WHERE order_id = ? LIMIT 1", [orderId]);
  const transaction = rows[0];

  if (!transaction) {
    return { status: "error", message: "Transaction not found" };
  }

  const previousStatus = transaction.status;
  const checkType = callbackData ? 'callback' : 'status_check';

  if (transaction.status === "success") {
    // Log the status check even if already processed
   // await logStatusCheck(orderId, transaction.id, checkType, callbackData || {}, previousStatus, 'success', true, transaction.amount);
    return { status: "success", message: "Transaction already processed" };
  }

  try {
    let statusData = callbackData;
    let requestData = null;

    // If no callback data provided, query Getepay for status
    if (!statusData) {
      if (!transaction.reference_id) {
        const errorMsg = "Payment reference ID not found for this transaction";
        await logStatusCheck(orderId, transaction.id, 'status_check', null, previousStatus, 'failed', false, 0, null, errorMsg);
        throw new ApiError(400, errorMsg);
      }

      console.log("Found transaction:", {
        id: transaction.id,
        order_id: transaction.order_id,
        amount: transaction.amount,
        status: transaction.status,
        gateway: transaction.gateway
      });

      const config = GetepayUtils.getConfig();
      
      // Prepare request for Getepay status check
      requestData = {
        mid: config.mid,
        paymentId: transaction.reference_id,
        referenceNo: "",
        status: "",
        terminalId: config.terminalId
      };

      const requeryResponse = await GetepayUtils.requeryRequest(config, requestData);
      console.log("Requery response for verification:", requeryResponse);
      
      if (requeryResponse && !requeryResponse.error) {
        statusData = requeryResponse;
      } else {
        const errorMsg = requeryResponse?.error || "Unable to verify transaction status";
        console.error("Requery failed:", errorMsg);
        
        // Log the failed status check
        await logStatusCheck(orderId, transaction.id, 'status_check', requeryResponse, previousStatus, 'failed', false, 0, requestData, errorMsg);
        
        // Only update status, not gateway_response
        await db.query(
          "UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?",
          ["failed", String(orderId)]
        );
        return { status: "error", message: errorMsg };
      }
    }

    if (!statusData) {
      const errorMsg = "Unable to verify transaction status";
      await logStatusCheck(orderId, transaction.id, checkType, null, previousStatus, 'failed', false, 0, requestData, errorMsg);
      
      await db.query(
        "UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?",
        ["failed", orderId]
      );
      return { status: "error", message: errorMsg };
    }

    // Check transaction status
    const txnStatus = statusData.txnStatus || statusData.status || statusData.transactionStatus;
    console.log("Transaction status from Getepay:", txnStatus);
    
    if (txnStatus === "SUCCESS" || txnStatus === "COMPLETED" || txnStatus === "PAID") {
      // Process successful transaction
      const amount = transaction.amount;
      const userId = transaction.user_id;
      const user = await query.users({id: userId});

       const [rows2] = await db.query("SELECT * FROM transactions WHERE order_id = ? LIMIT 1", [orderId]);
  const transaction2 = rows2[0];

   if (transaction2.status === "success") {
    // Log the status check even if already processed
   // await logStatusCheck(orderId, transaction.id, checkType, callbackData || {}, previousStatus, 'success', true, transaction.amount);
    return { status: "success", message: "Transaction already processed" };
  }

      
      let processedAmount = amount;
      let originalAmount = amount;

      if (user.is_flat_margin === 1) {
        processedAmount = Number(amount) + (Number(user.margin_rates) * Number(amount) / 100);
      }

      const adminRes = await db.query("SELECT * FROM users WHERE id = 1");
      const admin = adminRes[0][0];

      // if (admin.balance < processedAmount) {
      //   const errorMsg = "Admin balance is insufficient";
      //   await logStatusCheck(orderId, transaction.id, checkType, statusData, previousStatus, 'failed', false, 0, requestData, errorMsg);
      //   return { status: "error", message: errorMsg };
      // }

      // Add balance to user
      const result = await balanceAddition(admin, processedAmount, userId, originalAmount, {
        orderId, 
        type: 'online',
        operationType: 'credit'
      });

      if (result.status !== "success") {
        const errorMsg = "Balance addition failed";
        await logStatusCheck(orderId, transaction.id, checkType, statusData, previousStatus, 'failed', false, 0, requestData, errorMsg);
        return { status: "error", message: errorMsg };
      }

      // Log successful status check with balance processing
      await logStatusCheck(orderId, transaction.id, checkType, statusData, previousStatus, 'success', true, processedAmount, requestData);

      // Only update status in transactions table
      await db.query(
        "UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?",
        ["success", orderId]
      );

      const userName = user.person || "Eworld User";
      const userShop = user.company || "";
      const userMobile = user.mobile || "";

      // Send notification
      messageUtils.sendMessageToUser(
        userId,
        `Dear ${userName}(${userShop}), Balance of ${processedAmount} has been added to your account ${userMobile} with refrenceid: ${transaction.reference_id}. Thank you for using Eworld!`,
        "number"
      );
      messageUtils.sendMessageToUser(
        1,
        `Dear Admin, Balance of ${processedAmount} has been added to your  ${userName}(${userShop})-${userMobile} with refrenceid: ${transaction.reference_id}. Thank you for using Eworld!`,
        "number"
      );

      messageUtils.sendMessageToUser(
        userId,
        `Your Eworld wallet balance has been credited with ${processedAmount} `
      );

      return { status: "success", message: "Balance added successfully via Getepay", data: statusData };

    } else if (txnStatus === "PENDING" || txnStatus === "INITIATED" || txnStatus === "PROCESSING") {
      // Log pending status check
      await logStatusCheck(orderId, transaction.id, checkType, statusData, previousStatus, 'pending', false, 0, requestData);
      
      await db.query(
        "UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?",
        ["pending", String(orderId)]
      );
      return { status: "pending", message: "Transaction is still pending", data: statusData };

    } else {
      // Log failed status check
      await logStatusCheck(orderId, transaction.id, checkType, statusData, previousStatus, 'failed', false, 0, requestData, `Transaction failed with status: ${txnStatus}`);
      
      await db.query(
        "UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?",
        ["failed", String(orderId)]
      );
      return { status: "failed", message: `Transaction failed with status: ${txnStatus}`, data: statusData };
    }

  } catch (err) {
    console.error("Getepay Verification Error:", err.message);
    
    // Log the error
    await logStatusCheck(orderId, transaction?.id, checkType, null, previousStatus, 'failed', false, 0, null, err.message);
    
    return { status: "error", message: "Verification failed: " + err.message };
  }
};

// Helper endpoint to get status logs for a transaction
const getTransactionStatusLogs = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  console.log("Fetching status logs for orderId:", orderId);

  if (!orderId) {
    throw new ApiError(400, "Order ID is required");
  }

  try {
    // Get all fields from the transaction_status_logs table
    const [logs] = await db.query(`
      SELECT 
        id, order_id, transaction_id, gateway, check_type, 
        gateway_txn_id, gateway_status, payment_mode, txn_amount, settlement_amount,
        bank_ref_no, payment_id, txn_date, settlement_date, error_code, error_message,
        gateway_response, request_data, previous_status, updated_status, status_changed,
        balance_added, balance_processed, admin_balance_sufficient, created_at
      FROM transaction_status_logs 
      WHERE order_id = ? 
      ORDER BY created_at DESC
    `, [orderId]);

    console.log(`Found ${logs.length} status logs for order ${orderId}`);

    // Return empty array if no logs found (don't throw error)
    res.status(200).json(new ApiResponse(200, {
      orderId: orderId,
      totalLogs: logs.length,
      logs: logs,
      hasLogs: logs.length > 0
    }, logs.length > 0 ? "Transaction status logs fetched successfully" : "No status logs found for this transaction"));

  } catch (error) {
    console.error("Get Status Logs Error:", error.message);
    throw new ApiError(500, "Failed to fetch status logs: " + error.message);
  }
});

// Search parent users for admin transfer functionality
const searchParentUsers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  
  // Check if user is admin or superadmin
  if (req.user.role > 2) {
    throw new ApiError(403, "Access denied. Admin privileges required.");
  }
  
  if (!search || search.length < 3) {
    throw new ApiError(400, "Search term must be at least 3 characters long");
  }
  
  try {
    const parents = await query.searchParentUsers(search);
    
    res.status(200).json(new ApiResponse(200, {
      parents,
      count: parents.length
    }, "Parent users fetched successfully"));
    
  } catch (error) {
    console.error("Error searching parent users:", error);
    throw new ApiError(500, "Failed to search parent users");
  }
});

// Get children of a selected parent for admin transfer
const getParentChildren = asyncHandler(async (req, res) => {
  const { parentId } = req.params;
  
  // Check if user is admin or superadmin
  if (req.user.role > 2) {
    throw new ApiError(403, "Access denied. Admin privileges required.");
  }
  
  if (!parentId) {
    throw new ApiError(400, "Parent ID is required");
  }
  
  try {
    // Get parent info first
    const parent = await query.findUserById(parentId);
    if (!parent) {
      throw new ApiError(404, "Parent user not found");
    }
    
    if (parent.role_id < 3) {
      throw new ApiError(400, "Selected user is not a valid parent (distributor/master)");
    }
    
    // Get all children (both direct and indirect)
    const children = await query.getAllChildrenForParent(parentId);
    
    res.status(200).json(new ApiResponse(200, {
      parent: {
        id: parent.id,
        person: parent.person,
        mobile: parent.mobile,
        company: parent.company,
        balance: parent.balance,
        role_id: parent.role_id
      },
      children,
      count: children.length
    }, "Parent children fetched successfully"));
    
  } catch (error) {
    console.error("Error fetching parent children:", error);
    throw new ApiError(500, "Failed to fetch parent children");
  }
});

// Admin transfer balance on behalf of parent to child
const adminTransferBalance = asyncHandler(async (req, res) => {
  const { parentId, childId, amount, remarks = 'Admin transfer' } = req.body;
  
  // Check if user is admin or superadmin
  if (req.user.role > 2) {
    throw new ApiError(403, "Access denied. Admin privileges required.");
  }
  
  if (!parentId || !childId || !amount) {
    throw new ApiError(400, "Parent ID, Child ID, and amount are required");
  }
  
  if (amount <= 0) {
    throw new ApiError(400, "Amount must be greater than 0");
  }
  
  try {
    // Get parent and child info
    const parent = await query.findUserById(parentId);
    const child = await query.findUserById(childId);
    
    if (!parent || !child) {
      throw new ApiError(404, "Parent or child user not found");
    }
    
    // Verify parent-child relationship
    if (child.parent_id !== parent.id) {
      throw new ApiError(400, "Invalid parent-child relationship");
    }

    // Apply margin calculation logic
    let originalAmount = amount;

    if(child.is_flat_margin === 1){
      amount = amount + child.margin_rates * amount / 100;
    }

    console.log("amount", amount);

    if (parent.balance < amount) {
      throw new ApiError(400, "Insufficient balance in parent account");
    }
    
    // Start transaction
    // await db.beginTransaction();
    
    try {
      // Determine operation type based on user role - admin manual addition is 'credit', parent transfer is 'transfer'  
      const operationType = req.user.role <= 2 ? 'credit' : 'transfer';
      const balanceUpdate = await balanceAddition(parent, amount, child.id, originalAmount, {operationType}, remarks);
      
      // Send messages to both parent and child
      messageUtils.sendMessageToUser(
        child.id,
        `Dear eworld User (${child.person} ji), Balance of ${originalAmount} is transferred to your account by admin, your new balance is ${balanceUpdate.balanceAfterAddition}`,
        "number"
      );
      messageUtils.sendMessageToUser(
        parent.id,
        `Dear eworld User, Balance of ${originalAmount} is transferred from your account to ${child.person}(${child.mobile}) by admin. Your new balance: ${balanceUpdate.balanceAfterDeduction}`,
        "number"
      );
      
      // await db.commit();
      
      res.status(200).json(new ApiResponse(200, {
        transfer: {
          amount: originalAmount,
          actualAmount: amount,
          from: {
            id: parent.id,
            person: parent.person,
            mobile: parent.mobile,
            oldBalance: balanceUpdate.balanceBeforeDeduction,
            newBalance: balanceUpdate.balanceAfterDeduction
          },
          to: {
            id: child.id,
            person: child.person,
            mobile: child.mobile,
            oldBalance: balanceUpdate.balanceBeforeAddition,
            newBalance: balanceUpdate.balanceAfterAddition
          },
          adminUser: {
            id: req.user.id,
            person: req.user.person,
            mobile: req.user.mobile
          },
          remarks,
          timestamp: new Date()
        }
      }, "Balance transferred successfully"));
      
    } catch (error) {
     // await db.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error("Error in admin transfer:", error);
    throw new ApiError(500, "Failed to transfer balance");
  }
});

// Admin refund balance from child back to parent
const adminRefundBalance = asyncHandler(async (req, res) => {
  const { childId, parentId, amount, remarks = 'Admin refund' } = req.body;
  
  // Check if user is admin or superadmin
  if (req.user.role > 2) {
    throw new ApiError(403, "Access denied. Admin privileges required.");
  }
  
  if (!childId || !parentId || !amount) {
    throw new ApiError(400, "Child ID, Parent ID, and amount are required");
  }
  
  if (amount <= 0) {
    throw new ApiError(400, "Amount must be greater than 0");
  }
  
  try {
    // Get parent and child info
    const child = await query.findUserById(childId);
    const parent = await query.findUserById(parentId);
    
    if (!child || !parent) {
      throw new ApiError(404, "Child or parent user not found");
    }
    
    // Verify parent-child relationship (direct or indirect)
    const allChildren = await query.getAllChildrenForParent(parentId);
    const isValidChild = allChildren.some(c => c.id === parseInt(childId));
    
    if (!isValidChild) {
      throw new ApiError(400, "Invalid parent-child relationship");
    }

    // Apply margin calculation logic
    let originalAmount = amount;

    if(child.is_flat_margin === 1){
      amount = amount + child.margin_rates * amount / 100;
    }

    console.log("amount", amount);

    if (child.balance < amount) {
      throw new ApiError(400, "Insufficient balance in child account");
    }
    
    // Start transaction
  
    
    try {
      // For refund: child is the source (like req.user), parent is the target (like user)
      // Determine operation type - admin refund is 'refund'
      const operationType = 'refund';
      const balanceUpdate = await balanceAddition(child, amount, parent.id, originalAmount, {operationType}, remarks);
      
      // Send messages to both parent and child
      messageUtils.sendMessageToUser(
        child.id,
        `Dear eworld User (${child.person} ji), Balance of ${originalAmount} is refunded from your account by admin, your new balance is ${balanceUpdate.balanceAfterAddition}`,
        "number"
      );
      messageUtils.sendMessageToUser(
        parent.id,
        `Dear eworld User, Balance of ${originalAmount} is refunded to your account from ${child.person}(${child.mobile}) by admin. Your new balance: ${balanceUpdate.balanceAfterDeduction}`,
        "number"
      );
      

      
      res.status(200).json(new ApiResponse(200, {
        refund: {
          amount: originalAmount,
          actualAmount: amount,
          from: {
            id: child.id,
            person: child.person,
            mobile: child.mobile,
            oldBalance: balanceUpdate.balanceBeforeAddition,
            newBalance: balanceUpdate.balanceAfterAddition
          },
          to: {
            id: parent.id,
            person: parent.person,
            mobile: parent.mobile,
            oldBalance: balanceUpdate.balanceBeforeDeduction,
            newBalance: balanceUpdate.balanceAfterDeduction
          },
          adminUser: {
            id: req.user.id,
            person: req.user.person,
            mobile: req.user.mobile
          },
          remarks,
          timestamp: new Date()
        }
      }, "Balance refunded successfully"));
      
    } catch (error) {
     
      throw error;
    }
    
  } catch (error) {
    console.error("Error in admin refund:", error);
    throw new ApiError(500, "Failed to refund balance");
  }
});

module.exports = {
  getBalance,
  fundRequest,
  getAllFundRequest,
  approveFund,
  addBalance,
  withDrawBalance,
  addMoney,
  getTransactions,
  getAllFundRequestforParent,
  getBalReport,
  getBalanceByParent,
  generateBalance,
  generateOrder,
  webhookCallback,
  statusCheck,
  redirect,
  // Getepay methods
  getepayGenerateOrder,
  getepayCallback,
  getepayStatusCheck,
  getepayRequery,
  getepayRefund,
  getTransactionStatusLogs,
  getRecentTransactions,
  // Admin transfer methods
  searchParentUsers,
  getParentChildren,
  adminTransferBalance,
  adminRefundBalance,
};
