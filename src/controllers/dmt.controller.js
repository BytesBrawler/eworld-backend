const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const db = require("../db/index");
const axios = require("axios");
const crypto = require("crypto");
const { calculateUserMargins, recharge } = require("./retailer.controller");

// InstantPay DMT Configuration
const IPAY_BASE_URL = "https://api.instantpay.in/fi/remit/out/domestic/v2/";
const IPAY_AUTH_CODE = process.env.IPAY_AUTH_CODE || "1";
const IPAY_CLIENT_ID = process.env.IPAY_CLIENT_ID || "YWY3OTAzYzNlM2ExZTJlOW2jMbRfL3ybGJmQCMyBHwo=";
const IPAY_CLIENT_SECRET = process.env.IPAY_CLIENT_SECRET || "49cd37dc9c7166b1178a956c2806d16ea59314bd7ba8d130901fbdcd314fda65";
const IPAY_OUTLET_ID = process.env.IPAY_OUTLET_ID;
const IPAY_ENCRYPTION_KEY = process.env.IPAY_ENCRYPTION_KEY || "d85c0949d324a6a6d85c0949d324a6a6";

const headers = {
    'X-Ipay-Auth-Code': 1,
    'X-Ipay-Client-Id': 'YWY3OTAzYzNlM2ExZTJlOW2jMbRfL3ybGJmQCMyBHwo=',
    'X-Ipay-Client-Secret': '1e72c1e4ba6f327001f2215178d54e80954d304e0cd9a8bf1d8fef1c96b9d466',
    'X-Ipay-Outlet-Id': IPAY_OUTLET_ID,
    'X-Ipay-Endpoint-Ip': "47.15.68.250",
    // 'X-Ipay-Endpoint-Ip': endpointIp,
    // 'Content-Type': 'application/json'
  };

// Helper function to create InstantPay headers
const createInstantPayHeaders = (endpointIp = "127.0.0.1") => {
  return {
    'X-Ipay-Auth-Code': 1,
    'X-Ipay-Client-Id': IPAY_CLIENT_ID,
    'X-Ipay-Client-Secret': IPAY_CLIENT_SECRET,
    'X-Ipay-Outlet-Id': IPAY_OUTLET_ID,
    'X-Ipay-Endpoint-Ip': "47.15.68.250",
    // 'X-Ipay-Endpoint-Ip': endpointIp,
    // 'Content-Type': 'application/json'
  };
};





function encryptAadhaar(aadhaarData) {
    try {
        const encryptionKey = process.env.IPAY_ENCRYPTION_KEY;
        
        if (!encryptionKey) {
            throw new Error('IPAY_ENCRYPTION_KEY environment variable is not set');
        }
        
        // Use the encryption key as-is (32 characters = 32 bytes for AES-256)
        const key = Buffer.from(encryptionKey, 'utf8');
        
        // Generate random IV (16 bytes for AES-256-CBC)
        const iv = crypto.randomBytes(16);
        
        // Create cipher
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        
        // Encrypt the data (raw binary output)
        let encrypted = cipher.update(aadhaarData, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        
        // Prepend IV to encrypted data (iv . ciphertext)
        const encryptedWithIV = Buffer.concat([iv, encrypted]);
        
        // Base64 encode the result
        return encryptedWithIV.toString('base64');
        
    } catch (error) {
        console.error('Encryption error:', error.message);
        throw error;
    }
}
// Corresponding decryption function
const decryptAadhaar = (encryptedData) => {
  console.log("🔓 === Starting Aadhaar Decryption ===");
  
  if (!encryptedData || typeof encryptedData !== 'string') {
    throw new Error('Invalid encrypted data provided');
  }
  
  try {
    const algorithm = 'aes-256-cbc';
    const secret = process.env.IPAY_ENCRYPTION_KEY;
    
    if (!secret) {
      throw new Error('Encryption key not found in environment variables');
    }
    
    // Parse the encrypted data
    const parts = encryptedData.split(':');
    
    let key, iv, encrypted;
    
    if (parts.length === 3) {
      // Format: salt:iv:encrypted (PBKDF2 was used)
      const salt = Buffer.from(parts[0], 'hex');
      iv = Buffer.from(parts[1], 'hex');
      encrypted = parts[2];
      
      // Derive key using same parameters as encryption
      key = crypto.pbkdf2Sync(secret, salt, 10000, 32, 'sha256');
    } else if (parts.length === 2) {
      // Format: iv:encrypted (direct key was used)
      iv = Buffer.from(parts[0], 'hex');
      encrypted = parts[1];
      
      // Derive key same way as encryption
      if (secret.length === 64) {
        key = Buffer.from(secret, 'hex');
      } else if (secret.length === 32) {
        key = Buffer.from(secret, 'utf8');
      } else {
        throw new Error('Cannot decrypt: key derivation method unclear');
      }
    } else {
      throw new Error('Invalid encrypted data format');
    }
    
    console.log("🔓 Creating decipher...");
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    
    console.log("🔓 Decrypting data...");
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    console.log("✅ Decryption successful");
    console.log("🔓 === Aadhaar Decryption Completed ===");
    
    return decrypted;
    
  } catch (error) {
    console.error("❌ Decryption error occurred:");
    console.error("❌ Error message:", error.message);
    throw new Error(`Decryption failed: ${error.message}`);
  }
};


// 0. Merchant Onboarding (eKYC)
const merchantOnboarding = asyncHandler(async (req, res) => {
  const { 
    mobileNumber,
    firstName,
    lastName,
    email,
    shopName,
    address,
    pincode, 
    city,
    state,
    aadhaarNumber,
    panNumber,
    accountNumber,
    ifsc,
    latitude,
    longitude,
    gstNumber, // Optional
    businessType = "INDIVIDUAL" // INDIVIDUAL, PARTNERSHIP, PRIVATE_LIMITED, etc.
  } = req.body;

  console.log("=== DMT Merchant Onboarding Started ===");
  console.log("Request Body:", { mobileNumber, firstName, lastName, email, shopName });
  console.log("User ID:", req.user.id);

  // Validate required fields
  if (!mobileNumber || !firstName || !lastName || !email || !shopName || 
      !address || !pincode || !city || !state || !aadhaarNumber || 
      !panNumber || !accountNumber || !ifsc || !latitude || !longitude) {
    console.log("Validation failed: Missing required fields");
    throw new ApiError(400, "All required merchant details must be provided");
  }

  try {
    // Check if merchant is already onboarded
    const existingMerchant = await db.query(
      "SELECT * FROM dmt_merchants WHERE mobile_number = ? AND user_id = ?",
      [mobileNumber, req.user.id]
    );

    console.log("Existing merchant check:", existingMerchant.length > 0 ? "Found" : "Not found");

    if (existingMerchant.length > 0 && existingMerchant[0].is_verified) {
      console.log("Merchant already verified, returning existing data");
      return res.status(200).json(
        new ApiResponse(200, existingMerchant[0], "Merchant already onboarded successfully")
      );
    }

    // Encrypt sensitive data
    const encryptedAadhaar = encryptAadhaar(aadhaarNumber);
    console.log("Aadhaar encrypted successfully");

    // Prepare merchant onboarding request
    const merchantData = {
      mobileNumber,
      firstName,
      lastName,
      email,
      shopName,
      address,
      pincode,
      city,
      state,
      encryptedAadhaar,
      panNumber,
      accountNumber,
      ifsc,
      latitude,
      longitude,
      businessType,
      ...(gstNumber && { gstNumber }) // Add GST number if provided
    };

    console.log("Calling InstantPay API with data:", { 
      mobileNumber, 
      firstName, 
      lastName, 
      email, 
      shopName 
    });

    // Call InstantPay Merchant Onboarding API
    const response = await axios.post(
      `${IPAY_BASE_URL}/merchantOnboarding`,
      merchantData,
      { headers: createInstantPayHeaders(req.ip) }
    );

    const apiData = response.data;
    console.log("=== InstantPay API Response ===");
    console.log("Status Code:", apiData.statuscode);
    console.log("Status:", apiData.status);
    console.log("Full Response:", JSON.stringify(apiData, null, 2));

    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'merchantOnboarding',
        JSON.stringify({ mobileNumber, shopName, email }),
        JSON.stringify(apiData),
        apiData.statuscode || 'UNKNOWN'
      ]
    );

    // Save merchant data to local database
    if (apiData.statuscode === "TXN" || apiData.statuscode === "OTP") {
      const merchantId = apiData.data?.merchantId || null;
      const referenceKey = apiData.data?.referenceKey || null;
      const validity = apiData.data?.validity || null;

      console.log("Saving merchant to database:", { merchantId, referenceKey, validity });

      if (existingMerchant.length === 0) {
        console.log("Inserting new merchant record");
        // Insert new merchant
        await db.query(
          `INSERT INTO dmt_merchants (user_id, mobile_number, first_name, last_name, email, 
           shop_name, address, pincode, city, state, aadhaar_number, pan_number, 
           account_number, ifsc, latitude, longitude, business_type, gst_number, 
           merchant_id, reference_key, validity, is_verified, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            req.user.id, mobileNumber, firstName, lastName, email, shopName,
            address, pincode, city, state, aadhaarNumber, panNumber,
            accountNumber, ifsc, latitude, longitude, businessType, gstNumber || null,
            merchantId, referenceKey, validity, apiData.statuscode === "TXN" ? 1 : 0
          ]
        );
      } else {
        console.log("Updating existing merchant record");
        // Update existing merchant
        await db.query(
          `UPDATE dmt_merchants SET first_name = ?, last_name = ?, email = ?, shop_name = ?, 
           address = ?, pincode = ?, city = ?, state = ?, pan_number = ?, account_number = ?, 
           ifsc = ?, latitude = ?, longitude = ?, business_type = ?, gst_number = ?, 
           merchant_id = ?, reference_key = ?, validity = ?, is_verified = ?, updated_at = NOW() 
           WHERE mobile_number = ? AND user_id = ?`,
          [
            firstName, lastName, email, shopName, address, pincode, city, state,
            panNumber, accountNumber, ifsc, latitude, longitude, businessType, gstNumber || null,
            merchantId, referenceKey, validity, apiData.statuscode === "TXN" ? 1 : 0,
            mobileNumber, req.user.id
          ]
        );
      }
    } else {
      console.log("API call failed or unexpected status code:", apiData.statuscode);
    }

    console.log("=== Merchant Onboarding Completed Successfully ===");
    return res.status(200).json(
      new ApiResponse(200, apiData, "Merchant onboarding initiated successfully")
    );

  } catch (error) {
    console.error("=== Merchant Onboarding Error ===");
    console.error("Error:", error.response?.data || error.message);
    console.error("Stack:", error.stack);

    // Log error in database
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'merchantOnboarding',
        JSON.stringify({ mobileNumber, shopName, email }),
        JSON.stringify({ error: error.message }),
        'ERROR'
      ]
    );

    throw new ApiError(500, error.response?.data?.status || "Failed to onboard merchant");
  }
});

// 0.1. Verify Merchant Onboarding OTP
const merchantOnboardingVerify = asyncHandler(async (req, res) => {
  const { mobileNumber, otp, referenceKey } = req.body;

  console.log("=== DMT Merchant Onboarding Verification Started ===");
  console.log("Request:", { mobileNumber, otp: otp ? "***" : "empty", referenceKey });

  if (!mobileNumber || !otp || !referenceKey) {
    console.log("Validation failed: Missing required fields");
    throw new ApiError(400, "Mobile number, OTP, and reference key are required");
  }

  try {
    console.log("Calling InstantPay Merchant Verification API");
    // Call InstantPay Merchant Verification API
    const response = await axios.post(
      `${IPAY_BASE_URL}/merchantOnboardingVerify`,
      {
        mobileNumber,
        otp,
        referenceKey
      },
      { headers: createInstantPayHeaders(req.ip) }
    );

    const apiData = response.data;
    console.log("=== InstantPay Verification Response ===");
    console.log("Status Code:", apiData.statuscode);
    console.log("Status:", apiData.status);
    console.log("Full Response:", JSON.stringify(apiData, null, 2));

    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'merchantOnboardingVerify',
        JSON.stringify({ mobileNumber, otp }),
        JSON.stringify(apiData),
        apiData.statuscode || 'UNKNOWN'
      ]
    );

    // If verification is successful, update merchant status
    if (apiData.statuscode === "TXN") {
      console.log("Verification successful, updating merchant status");
      await db.query(
        `UPDATE dmt_merchants SET is_verified = 1, updated_at = NOW() 
         WHERE mobile_number = ? AND user_id = ?`,
        [mobileNumber, req.user.id]
      );
    } else {
      console.log("Verification failed with status:", apiData.statuscode);
    }

    console.log("=== Merchant Verification Completed ===");
    return res.status(200).json(
      new ApiResponse(200, apiData, "Merchant verification completed successfully")
    );

  } catch (error) {
    console.error("=== Merchant Verification Error ===");
    console.error("Error:", error.response?.data || error.message);
    console.error("Stack:", error.stack);

    // Log error in database
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'merchantOnboardingVerify',
        JSON.stringify({ mobileNumber, otp }),
        JSON.stringify({ error: error.message }),
        'ERROR'
      ]
    );

    throw new ApiError(500, error.response?.data?.status || "Failed to verify merchant");
  }
});

// 0.2. Get Merchant Status
const getMerchantStatus = asyncHandler(async (req, res) => {
  console.log("=== Getting Merchant Status ===");
  console.log("User ID:", req.user.id);

  const merchant = await db.query(
    `SELECT id, mobile_number, first_name, last_name, email, shop_name, 
     merchant_id, is_verified, created_at FROM dmt_merchants WHERE user_id = ?`,
    [req.user.id]
  );

  console.log("Merchant found:", merchant.length > 0 ? "Yes" : "No");

  return res.status(200).json(
    new ApiResponse(200, merchant, "Merchant status fetched successfully")
  );
});

// Testing endpoint - Mock responses for frontend testing
const getTestingMockResponse = asyncHandler(async (req, res) => {
  const { endpoint, mockType = 'success' } = req.params;
  
  console.log(`=== Mock Testing Response for ${endpoint} ===`);
  console.log("Mock Type:", mockType);

  let mockData = {};

  switch (endpoint) {
    case 'remitter-profile':
      mockData = mockType === 'success' ? {
        statuscode: "TXN",
        status: "Remitter profile found",
        data: {
          firstName: "Test",
          lastName: "User",
          mobile: "9876543210",
          limitPerTransaction: 25000,
          limitTotal: 100000,
          limitConsumed: 0,
          limitAvailable: 100000,
          beneficiaries: []
        }
      } : {
        statuscode: "ERR",
        status: "Remitter not found",
        data: { referenceKey: "TEST123" }
      };
      break;

    case 'remitter-register':
      mockData = {
        statuscode: "OTP",
        status: "OTP sent for remitter registration",
        data: { referenceKey: "TEST123" }
      };
      break;

    case 'remitter-verify':
      mockData = {
        statuscode: "TXN",
        status: "Remitter verification successful",
        data: { verified: true }
      };
      break;

    default:
      mockData = {
        statuscode: "TXN",
        status: "Success",
        data: { message: "Mock response" }
      };
  }

  return res.status(200).json(
    new ApiResponse(200, mockData, `Mock response for ${endpoint}`)
  );
});

async function checkMoneyTransferOperator() {
    const [OperatorRows] = await db.query("SELECT * FROM operators WHERE name = ? and status = 1", [
      "Money Transfer"
    ]);
    if (OperatorRows.length === 0) throw new ApiError(404, "This service is not available");
    return OperatorRows[0];
  }


// 1. Check Remitter Profile
const checkRemitterProfile = asyncHandler(async (req, res) => {
  const { mobileNumber } = req.body;

  // Helper function to check if Money Transfer operator is active
  
  await checkMoneyTransferOperator();
  
  console.log("=== DMT Check Remitter Profile Started ===");
  console.log("Mobile Number:", mobileNumber);
  console.log("User ID:", req.user.id);
  console.log("Request IP:", req.ip);
  console.log("Timestamp:", new Date().toISOString());

  if (!mobileNumber) {
    console.log("❌ Validation failed: Mobile number missing");
    throw new ApiError(400, "Mobile number is required");
  }

  console.log("✅ Mobile number validation passed");

  try {
    // Check if remitter exists in local database first
    console.log("🔍 Checking local database for existing remitter...");
    const localRemitter = await db.query(
      "SELECT * FROM dmt_remitters WHERE mobile_number = ? AND user_id = ?",
      [mobileNumber, req.user.id]
    );

    console.log("📊 Local remitter check result:", localRemitter.length > 0 ? "Found" : "Not found");
    if (localRemitter.length > 0) {
      console.log("📋 Local remitter data:", {
        id: localRemitter[0].id,
        isVerified: localRemitter[0].is_verified,
        firstName: localRemitter[0].first_name,
        lastName: localRemitter[0].last_name
      });
    }


    var header = { headers: createInstantPayHeaders() };
    console.log("📤 Using headers:", header);

    // Call InstantPay API
    console.log("🌐 Calling InstantPay Remitter Profile API...");
    console.log("📤 API Request URL:", `${IPAY_BASE_URL}/remitterProfile`);
    console.log("📤 API Request Data:", { mobileNumber });
    console.log("📤 API Headers:", createInstantPayHeaders());
    const response = await axios.post(
      `${IPAY_BASE_URL}/remitterProfile`,
      { mobileNumber },
      header 
      
    );

    const apiData = response.data;
    console.log("apid ata", apiData);
    console.log("=== InstantPay Remitter Profile Response ===");
    console.log("📥 Response Status Code:", response.status);
    console.log("📥 API Status Code:", apiData.statuscode);
    console.log("📥 API Status Message:", apiData.status);
    console.log("📥 API Response Data:", JSON.stringify(apiData.data, null, 2));
    console.log("📥 Full API Response:", JSON.stringify(apiData, null, 2));

    console.log("💾 Logging API call to database...");
    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'remitterProfile',
        JSON.stringify({ mobileNumber }),
        JSON.stringify(apiData),
        apiData.statuscode
      ]
    );
    console.log("✅ API call logged successfully");

    // If remitter exists on InstantPay, update local database
    if (apiData.statuscode === "TXN" && apiData.data) {
      console.log("💾 Updating local database with remitter data...");
      const remitterData = apiData.data;
      console.log("📋 Remitter data to save:", remitterData);
      
      if (localRemitter.length === 0) {
        console.log("➕ Inserting new remitter record...");
        // Insert new remitter
        await db.query(
          `INSERT INTO dmt_remitters (user_id, mobile_number, first_name, last_name, city, pincode, 
           limit_per_transaction, limit_total, limit_consumed, limit_available, is_verified, 
           reference_key, validity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            req.user.id,
            mobileNumber,
            remitterData.firstName || '',
            remitterData.lastName || '',
            remitterData.city || '',
            remitterData.pincode || '',
            remitterData.limitPerTransaction || 0,
            remitterData.limitTotal || 0,
            remitterData.limitConsumed || 0,
            remitterData.limitAvailable || 0,
            1,
            remitterData.referenceKey || '',
            remitterData.validity || null
          ]
        );
        console.log("✅ New remitter record inserted");
      } else {
        console.log("🔄 Updating existing remitter record...");
        // Update existing remitter
        await db.query(
          `UPDATE dmt_remitters SET first_name = ?, last_name = ?, city = ?, pincode = ?, 
           limit_per_transaction = ?, limit_total = ?, limit_consumed = ?, limit_available = ?, 
           reference_key = ?, validity = ?, updated_at = NOW() WHERE mobile_number = ? AND user_id = ?`,
          [
            remitterData.firstName || '',
            remitterData.lastName || '',
            remitterData.city || '',
            remitterData.pincode || '',
            remitterData.limitPerTransaction || 0,
            remitterData.limitTotal || 0,
            remitterData.limitConsumed || 0,
            remitterData.limitAvailable || 0,
            remitterData.referenceKey || '',
            remitterData.validity || null,
            mobileNumber,
            req.user.id
          ]
        );
        console.log("✅ Existing remitter record updated");
      }

      // Update beneficiaries if they exist using the sync helper
      if (remitterData.beneficiaries && remitterData.beneficiaries.length > 0) {
        console.log("👥 Synchronizing beneficiaries data...");
        const syncResult = await syncBeneficiariesWithDatabase(
          req.user.id,
          mobileNumber,
          remitterData.beneficiaries
        );
        console.log("✅ Beneficiaries synchronized:", syncResult.syncResults);
      } else {
        console.log("ℹ️ No beneficiaries found in API response");
      }
    } else {
      console.log("⚠️ API response indicates remitter not found or error occurred");
      console.log("📊 Status code:", apiData.statuscode);
    }

    console.log("📤 Sending response to client...");
    res.status(200).json(
      new ApiResponse(200, apiData, "Remitter profile fetched successfully")
    );
    console.log("✅ DMT Check Remitter Profile completed successfully");

  } catch (error) {
    console.error("❌ DMT Remitter Profile Error occurred:");
    console.error("❌ Error message:", error.message);
    console.error("❌ Error stack:", error.stack);
    console.error("❌ API Response data:", error.response?.data);
    console.error("❌ API Response status:", error.response?.status);
    
    console.log("💾 Logging error to database...");
    // Log error in database
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'remitterProfile',
        JSON.stringify({ mobileNumber }),
        JSON.stringify({ error: error.message }),
        'ERROR'
      ]
    );
    console.log("✅ Error logged to database");

    throw new ApiError(500, error.response?.data?.status || "Failed to fetch remitter profile");
  }
});

// 2. Register Remitter
const registerRemitter = asyncHandler(async (req, res) => {
  const { mobileNumber, aadhaarNumber, referenceKey } = req.body;

  await checkMoneyTransferOperator();
  console.log("=== DMT Remitter Registration Started ===");
  console.log("📱 Mobile Number:", mobileNumber);
  console.log("🆔 Aadhaar Number:", aadhaarNumber ? "***Provided***" : "Not provided");
  console.log("🔑 Reference Key:", referenceKey);
  console.log("👤 User ID:", req.user.id);
  console.log("🌐 Request IP:", req.ip);
  console.log("⏰ Timestamp:", new Date().toISOString());

  if (!mobileNumber || !aadhaarNumber || !referenceKey) {
    console.log("❌ Validation failed: Missing required fields");
    console.log("❌ Missing:", {
      mobileNumber: !mobileNumber,
      aadhaarNumber: !aadhaarNumber,
      referenceKey: !referenceKey
    });
    throw new ApiError(400, "Mobile number, Aadhaar number, and reference key are required");
  }

  console.log("✅ All required fields validation passed");

  try {
    // Encrypt Aadhaar number
    console.log("🔐 Starting Aadhaar encryption process...");
    console.log("🔐 Aadhaar length:", aadhaarNumber.length);
    
    const encryptedAadhaar = encryptAadhaar(aadhaarNumber);
    console.log("✅ Aadhaar encrypted successfully");
    console.log("🔐 Encrypted Aadhaar length:", encryptedAadhaar);

    console.log("🌐 Preparing InstantPay API call...");
    console.log("📤 API URL:", `${IPAY_BASE_URL}/remitterRegistration`);
    console.log("📤 Request data:", {
      mobileNumber,
      encryptedAadhaar,
      referenceKey
    });

    // Call InstantPay API
    console.log("📡 Making API call to InstantPay...");
    const response = await axios.post(
      `${IPAY_BASE_URL}/remitterRegistration`,
      {
        mobileNumber,
        encryptedAadhaar ,
        referenceKey
      },
      { headers: createInstantPayHeaders() }
    );

    console.log("api data", response.data);
    
    console.log("=== InstantPay Remitter Registration Response ===");
    console.log("📥 HTTP Status:", response.status);
    console.log("📥 Response data:", JSON.stringify(response.data, null, 2));

    const apiData = response.data;
    console.log("📊 API Status Code:", apiData.statuscode);
    console.log("📊 API Status Message:", apiData.status);
    console.log("📊 API Data:", apiData.data);

    console.log("💾 Logging API call to database...");
    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'remitterRegistration',
        JSON.stringify({ mobileNumber, encryptedAadhaar }),
        JSON.stringify(apiData),
        apiData.statuscode
      ]
    );
    console.log("✅ API call logged successfully");

    // If registration is successful, save to local database
    if (apiData.statuscode === "OTP") {
      console.log("📨 OTP sent successfully, saving remitter data to local database...");
      console.log("💾 Data to save:", {
        userId: req.user.id,
        mobileNumber,
        referenceKey: apiData.data?.referenceKey || referenceKey,
        validity: apiData.data?.validity
      });
      
      await db.query(
        `INSERT INTO dmt_remitters (user_id, mobile_number, aadhaar_number, reference_key, 
         validity, is_verified, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW()) 
         ON DUPLICATE KEY UPDATE reference_key = VALUES(reference_key), validity = VALUES(validity), updated_at = NOW()`,
        [
          req.user.id,
          mobileNumber,
          aadhaarNumber,
          apiData.data?.referenceKey || referenceKey,
          apiData.data?.validity || null,
          0
        ]
      );
      console.log("✅ Remitter data saved to local database");
    } else {
      console.log("⚠️ Registration did not return OTP status");
      console.log("⚠️ Received status:", apiData.statuscode);
    }

    console.log("📤 Sending response to client...");
    res.status(200).json(
      new ApiResponse(200, apiData, "Remitter registration initiated successfully")
    );
    console.log("✅ DMT Remitter Registration completed successfully");

  } catch (error) {
    console.error("❌ DMT Remitter Registration Error occurred:");
    console.error("❌ Error message:", error.message);
    console.error("❌ Error stack:", error.stack);
    console.error("❌ API Response data:", error.response?.data);
    console.error("❌ API Response status:", error.response?.status);
    console.error("❌ Full error object:", error);
    
    console.log("💾 Logging error to database...");
    // Log error in database
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'remitterRegistration',
        JSON.stringify({ mobileNumber }),
        JSON.stringify({ error: error.message }),
        'ERROR'
      ]
    );
    console.log("✅ Error logged to database");

    throw new ApiError(500, error.response?.data?.status || "Failed to register remitter");
  }
});

// 3. Verify Remitter OTP
const verifyRemitterOtp = asyncHandler(async (req, res) => {
  const { mobileNumber, otp, referenceKey } = req.body;

  await checkMoneyTransferOperator();
  console.log("=== DMT Remitter OTP Verification Started ===");
  console.log("📱 Mobile Number:", mobileNumber);
  console.log("🔢 OTP:", otp ? "***PROVIDED***" : "Not provided");
  console.log("🔑 Reference Key:", referenceKey);
  console.log("👤 User ID:", req.user.id);
  console.log("🌐 Request IP:", req.ip);
  console.log("⏰ Timestamp:", new Date().toISOString());

  if (!mobileNumber || !otp || !referenceKey) {
    console.log("❌ Validation failed: Missing required fields");
    console.log("❌ Missing:", {
      mobileNumber: !mobileNumber,
      otp: !otp,
      referenceKey: !referenceKey
    });
    throw new ApiError(400, "Mobile number, OTP, and reference key are required");
  }

  console.log("✅ All required fields validation passed");

  try {
    console.log("🌐 Preparing InstantPay API call for OTP verification...");
    console.log("📤 API URL:", `${IPAY_BASE_URL}/remitterRegistrationVerify`);
    console.log("📤 Request data:", {
      mobileNumber,
      otp: "***HIDDEN***",
      referenceKey
    });

    // Call InstantPay API for OTP verification
    console.log("📡 Making API call to InstantPay...");
    const response = await axios.post(
      `${IPAY_BASE_URL}/remitterRegistrationVerify`,
      {
        mobileNumber,
        otp,
        referenceKey
      },
      { headers: createInstantPayHeaders() }
    );

    const apiData = response.data;
    console.log("=== InstantPay OTP Verification Response ===");
    console.log("📥 HTTP Status:", response.status);
    console.log("📥 API Status Code:", apiData.statuscode);
    console.log("📥 API Status Message:", apiData.status);
    console.log("📥 API Data:", apiData.data);
    console.log("📥 Full Response:", JSON.stringify(apiData, null, 2));

    console.log("💾 Logging API call to database...");
    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'remitterRegistrationVerify',
        JSON.stringify({ mobileNumber, otp }),
        JSON.stringify(apiData),
        apiData.statuscode
      ]
    );
    console.log("✅ API call logged successfully");

    // If verification is successful, update local database
    if (apiData.statuscode === "TXN") {
      console.log("✅ OTP verification successful, updating remitter status...");
      await db.query(
        `UPDATE dmt_remitters SET is_verified = 1, updated_at = NOW() 
         WHERE mobile_number = ? AND user_id = ?`,
        [mobileNumber, req.user.id]
      );
      console.log("✅ Remitter verification status updated in database");
    } 
    
    else {
      console.log("⚠️ OTP verification failed");
      console.log("⚠️ Status code received:", apiData.statuscode);
    }

    console.log("📤 Sending response to client...");
    res.status(200).json(
      new ApiResponse(200, apiData, "Remitter OTP verified successfully")
    );
    console.log("✅ DMT Remitter OTP Verification completed");

  } catch (error) {
    console.error("❌ DMT Remitter OTP Verification Error occurred:");
    console.error("❌ Error message:", error.message);
    console.error("❌ Error stack:", error.stack);
    console.error("❌ API Response data:", error.response?.data);
    console.error("❌ API Response status:", error.response?.status);
    
    console.log("💾 Logging error to database...");
    // Log error in database
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'remitterRegistrationVerify',
        JSON.stringify({ mobileNumber, otp }),
        JSON.stringify({ error: error.message }),
        'ERROR'
      ]
    );
    console.log("✅ Error logged to database");

    throw new ApiError(500, error.response?.data?.status || "Failed to verify remitter OTP");
  }
});

// 4. Get Local Remitters
const getRemitters = asyncHandler(async (req, res) => {
  const remitters = await db.query(
    `SELECT id, mobile_number, first_name, last_name, city, pincode, 
     limit_per_transaction, limit_total, limit_consumed, limit_available, 
     is_verified, validity, created_at FROM dmt_remitters WHERE user_id = ? ORDER BY created_at DESC`,
    [req.user.id]
  );

  res.status(200).json(
    new ApiResponse(200, remitters, "Remitters fetched successfully")
  );
});

// Helper function to sync beneficiaries between external API and local database
const syncBeneficiariesWithDatabase = async (userId, mobileNumber, externalBeneficiaries = []) => {
  console.log("🔄 Starting beneficiary synchronization...");
  console.log("📊 External beneficiaries count:", externalBeneficiaries.length);
  
  const syncResults = {
    newBeneficiaries: 0,
    updatedBeneficiaries: 0,
    deletedBeneficiaries: 0,
    totalBeneficiaries: 0
  };

  try {
    // Get all external beneficiary IDs for comparison
    const externalBeneficiaryIds = externalBeneficiaries.map(b => b.id);
    console.log("📋 External beneficiary IDs:", externalBeneficiaryIds);

    // Get current active beneficiaries from database
    const [currentBeneficiaries] = await db.query(
      "SELECT beneficiary_id FROM dmt_beneficiaries WHERE mobile_number = ? AND user_id = ? AND is_active = 1",
      [mobileNumber, userId]
    );
    
    const currentBeneficiaryIds = currentBeneficiaries.map(b => b.beneficiary_id);
    console.log("📋 Current database beneficiary IDs:", currentBeneficiaryIds);

    // Find beneficiaries that exist in database but not in external API (should be soft deleted)
    const beneficiariesToDelete = currentBeneficiaryIds.filter(id => !externalBeneficiaryIds.includes(id));
    console.log("🗑️ Beneficiaries to soft delete:", beneficiariesToDelete);

    // Soft delete beneficiaries that no longer exist in external API
    for (const beneficiaryIdToDelete of beneficiariesToDelete) {
      console.log("🗑️ Soft deleting beneficiary:", beneficiaryIdToDelete);
      await db.query(
        "UPDATE dmt_beneficiaries SET is_active = 0, updated_at = NOW() WHERE beneficiary_id = ? AND mobile_number = ? AND user_id = ?",
        [beneficiaryIdToDelete, mobileNumber, userId]
      );
      syncResults.deletedBeneficiaries++;
    }

    // Process each external beneficiary
    for (const beneficiary of externalBeneficiaries) {
      console.log("🔍 Processing beneficiary:", beneficiary.id, beneficiary.name);
      
      const [existingBeneficiary] = await db.query(
        "SELECT * FROM dmt_beneficiaries WHERE beneficiary_id = ? AND mobile_number = ? AND user_id = ?",
        [beneficiary.id, mobileNumber, userId]
      );

      if (existingBeneficiary.length === 0) {
        console.log("➕ Adding new beneficiary:", beneficiary.name);
        await db.query(
          `INSERT INTO dmt_beneficiaries (user_id, mobile_number, beneficiary_id, name, 
           account_number, ifsc, bank_name, beneficiary_mobile, verification_date, 
           bank_verification_status, is_active, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
          [
            userId,
            mobileNumber,
            beneficiary.id,
            beneficiary.name,
            beneficiary.account,
            beneficiary.ifsc,
            beneficiary.bank,
            beneficiary.beneficiaryMobileNumber || '',
            beneficiary.verificationDt,
            'NOT_VERIFIED' // Default status for new beneficiaries
          ]
        );
        syncResults.newBeneficiaries++;
        console.log("✅ New beneficiary added successfully");
      } else {
        console.log("🔄 Updating existing beneficiary:", beneficiary.name);
        // Update basic details but preserve verification status and related fields
        // Also ensure beneficiary is marked as active if it exists in external API
        await db.query(
          `UPDATE dmt_beneficiaries SET name = ?, account_number = ?, ifsc = ?, 
           bank_name = ?, beneficiary_mobile = ?, verification_date = ?, is_active = 1, updated_at = NOW() 
           WHERE beneficiary_id = ? AND mobile_number = ? AND user_id = ?`,
          [
            beneficiary.name,
            beneficiary.account,
            beneficiary.ifsc,
            beneficiary.bank,
            beneficiary.beneficiaryMobileNumber || '',
            beneficiary.verificationDt,
            beneficiary.id,
            mobileNumber,
            userId
          ]
        );
        syncResults.updatedBeneficiaries++;
        console.log("✅ Existing beneficiary updated successfully");
      }
    }

    // Get final merged list with verification status from database (only active beneficiaries)
    const [mergedBeneficiaries] = await db.query(
      `SELECT id, beneficiary_id, name, account_number, ifsc, bank_name, 
       beneficiary_mobile, verification_date, bank_verification_status, 
       name_match_percent, bank_registered_name, created_at FROM dmt_beneficiaries 
       WHERE mobile_number = ? AND user_id = ? AND is_active = 1 ORDER BY created_at DESC`,
      [mobileNumber, userId]
    );

    syncResults.totalBeneficiaries = mergedBeneficiaries.length;
    console.log("✅ Beneficiary synchronization completed:", syncResults);
    
    return {
      beneficiaries: mergedBeneficiaries,
      syncResults
    };

  } catch (error) {
    console.error("❌ Error during beneficiary synchronization:", error);
    throw error;
  }
};

// Helper function to delete beneficiary from database
const deleteBeneficiaryFromDatabase = async (userId, mobileNumber, beneficiaryId, deleteType = 'soft') => {
  console.log(`🗑️ ${deleteType === 'hard' ? 'Hard' : 'Soft'} deleting beneficiary from database:`, beneficiaryId);
  
  try {
    if (deleteType === 'hard') {
      // Hard delete - permanently remove from database
      const result = await db.query(
        "DELETE FROM dmt_beneficiaries WHERE beneficiary_id = ? AND mobile_number = ? AND user_id = ?",
        [beneficiaryId, mobileNumber, userId]
      );
      console.log(`✅ Beneficiary hard deleted from database. Rows affected: ${result.affectedRows}`);
      return result.affectedRows > 0;
    } else {
      // Soft delete - mark as inactive
      const result = await db.query(
        "UPDATE dmt_beneficiaries SET is_active = 0, updated_at = NOW() WHERE beneficiary_id = ? AND mobile_number = ? AND user_id = ?",
        [beneficiaryId, mobileNumber, userId]
      );
      console.log(`✅ Beneficiary soft deleted from database. Rows affected: ${result.affectedRows}`);
      return result.affectedRows > 0;
    }
  } catch (error) {
    console.error("❌ Error deleting beneficiary from database:", error);
    throw error;
  }
};

// 5. Get Local Beneficiaries with API synchronization
const getBeneficiaries = asyncHandler(async (req, res) => {
  const { mobileNumber } = req.params;

  if (!mobileNumber) {
    throw new ApiError(400, "Mobile number is required");
  }

  console.log("=== Get Beneficiaries with Sync Started ===");
  console.log("Mobile Number:", mobileNumber);
  console.log("User ID:", req.user.id);

  try {
    // First try to fetch from external API to get latest data
    console.log("🌐 Fetching beneficiaries from external API...");
    let externalBeneficiaries = [];
    
    try {
      const response = await axios.post(
        `${IPAY_BASE_URL}/remitterProfile`,
        { mobileNumber },
        { headers: createInstantPayHeaders() }
      );

      if (response.data.statuscode === "TXN" && response.data.data?.beneficiaries) {
        externalBeneficiaries = response.data.data.beneficiaries;
        console.log("✅ External beneficiaries fetched:", externalBeneficiaries.length);
      } else {
        console.log("⚠️ No beneficiaries found in external API or remitter not found");
      }
    } catch (apiError) {
      console.log("⚠️ External API call failed, proceeding with database only:", apiError.message);
    }

    // Synchronize with database
    const syncResult = await syncBeneficiariesWithDatabase(
      req.user.id, 
      mobileNumber, 
      externalBeneficiaries
    );

    console.log("📤 Sending synchronized beneficiaries to client");
    res.status(200).json(
      new ApiResponse(200, {
        beneficiaries: syncResult.beneficiaries,
        syncInfo: syncResult.syncResults
      }, "Beneficiaries fetched and synchronized successfully")
    );

  } catch (error) {
    console.error("❌ Error in getBeneficiaries:", error);
    
    // Fallback to database only
    console.log("🔄 Falling back to database-only fetch...");
    const beneficiaries = await db.query(
      `SELECT id, beneficiary_id, name, account_number, ifsc, bank_name, 
       beneficiary_mobile, verification_date, bank_verification_status, 
       name_match_percent, bank_registered_name, created_at FROM dmt_beneficiaries 
       WHERE mobile_number = ? AND user_id = ? ORDER BY created_at DESC`,
      [mobileNumber, req.user.id]
    );

    res.status(200).json(
      new ApiResponse(200, {
        beneficiaries,
        syncInfo: { message: "Fetched from database only due to API error" }
      }, "Beneficiaries fetched from database")
    );
  }
});

// Get DMT Transaction History
const getTransactionHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const transactions = await db.query(
    `SELECT id, api_endpoint, request_data, response_data, status, created_at 
     FROM dmt_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [req.user.id, parseInt(limit), parseInt(offset)]
  );

  const totalCount = await db.query(
    "SELECT COUNT(*) as count FROM dmt_transactions WHERE user_id = ?",
    [req.user.id]
  );

  res.status(200).json(
    new ApiResponse(200, {
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount[0].count,
        totalPages: Math.ceil(totalCount[0].count / limit)
      }
    }, "Transaction history fetched successfully")
  );
});

// Get Detailed DMT Transaction History 
const getDetailedTransactionHistory = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    status, 
    fromDate, 
    toDate,
    remitterMobile,
    beneficiaryAccount
  } = req.query;
  
  const offset = (page - 1) * limit;
  
  console.log("=== Get Detailed DMT Transaction History ===");
  console.log("👤 User ID:", req.user.id);
  console.log("📄 Page:", page, "Limit:", limit);
  console.log("🔍 Filters:", { status, fromDate, toDate, remitterMobile, beneficiaryAccount });

  try {
    // Build dynamic WHERE clause
    let whereConditions = ['user_id = ?'];
    let queryParams = [req.user.id];
    
    if (status) {
      whereConditions.push('status = ?');
      queryParams.push(status.toUpperCase());
    }
    
    if (fromDate) {
      whereConditions.push('created_at >= ?');
      queryParams.push(new Date(fromDate));
    }
    
    if (toDate) {
      whereConditions.push('created_at <= ?');
      queryParams.push(new Date(toDate));
    }
    
    if (remitterMobile) {
      whereConditions.push('remitter_mobile = ?');
      queryParams.push(remitterMobile);
    }
    
    if (beneficiaryAccount) {
      whereConditions.push('beneficiary_account = ?');
      queryParams.push(beneficiaryAccount);
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    // Get detailed transactions
    const [transactions] = await db.query(
      `SELECT 
        id,
        recharge_id,
        remitter_mobile,
        beneficiary_name,
        beneficiary_account,
        beneficiary_ifsc,
        beneficiary_bank_name,
        beneficiary_mobile,
        transaction_amount,
        transfer_mode,
        transaction_charges,
        gst_amount,
        total_deducted,
        external_ref,
        pool_reference_id,
        txn_reference_id,
        ipay_uuid,
        order_id,
        pool_account,
        pool_opening_balance,
        pool_closing_balance,
        status,
        api_status_code,
        api_status_message,
        failure_reason,
        user_balance_before,
        user_balance_after,
        commission_earned,
        transaction_timestamp,
        environment,
        created_at,
        updated_at
       FROM dmt_transaction_details 
       WHERE ${whereClause}
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(limit), parseInt(offset)]
    );

    // Get total count for pagination
    const [totalCount] = await db.query(
      `SELECT COUNT(*) as count FROM dmt_transaction_details WHERE ${whereClause}`,
      queryParams
    );

    // Get summary statistics
    const [summaryStats] = await db.query(
      `SELECT 
        COUNT(*) as total_transactions,
        SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as successful_transactions,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_transactions,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_transactions,
        COALESCE(SUM(CASE WHEN status = 'SUCCESS' THEN transaction_amount ELSE 0 END), 0) as total_success_amount,
        COALESCE(SUM(CASE WHEN status = 'SUCCESS' THEN commission_earned ELSE 0 END), 0) as total_commission_earned,
        COALESCE(SUM(CASE WHEN status = 'SUCCESS' THEN transaction_charges ELSE 0 END), 0) as total_charges
       FROM dmt_transaction_details 
       WHERE ${whereClause}`,
      queryParams
    );

    console.log("📊 Found transactions:", transactions.length);
    console.log("📈 Total count:", totalCount[0].count);

    res.status(200).json(
      new ApiResponse(200, {
        transactions,
        summary: summaryStats[0],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount[0].count,
          totalPages: Math.ceil(totalCount[0].count / limit)
        }
      }, "Detailed transaction history fetched successfully")
    );

  } catch (error) {
    console.error("❌ Get Detailed Transaction History Error:", error);
    throw new ApiError(500, "Failed to fetch detailed transaction history");
  }
});

// Get Single Detailed DMT Transaction
const getDetailedTransaction = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;

  console.log("=== Get Single Detailed DMT Transaction Started ===");
  
  console.log("=== Get Single Detailed DMT Transaction ===");
  console.log("👤 User ID:", req.user.id);
  console.log("🆔 Transaction ID:", transactionId);

  if (!transactionId) {
    throw new ApiError(400, "Transaction ID is required");
  }

  try {
    // Get detailed transaction
    const [transaction] = await db.query(
      `SELECT 
        dtd.*,
        r.status as recharge_status,
        r.txnid as recharge_txnid,
        r.message as recharge_message,
        r.completed_at as recharge_completed_at
       FROM dmt_transaction_details dtd
       LEFT JOIN recharges r ON r.id = dtd.recharge_id
       WHERE dtd.recharge_id = ? `,
      [transactionId]
    );

    if (!transaction.length) {
      throw new ApiError(404, "Transaction not found");
    }

    console.log("✅ Transaction found");

    res.status(200).json(
      new ApiResponse(200, transaction[0], "Transaction details fetched successfully")
    );

  } catch (error) {
    console.error("❌ Get Detailed Transaction Error:", error);
    throw new ApiError(500, "Failed to fetch transaction details");
  }
});

// 7. Remitter KYC
const remitterKyc = asyncHandler(async (req, res) => {
  const { 
    mobileNumber, 
    referenceKey, 
    captureType = "FACE", 
    externalRef,
    consentTaken = "Y",
    biometricData 
  } = req.body;

  console.log(req.body);
  if (!mobileNumber || !referenceKey || !externalRef || !biometricData) {
    throw new ApiError(400, "All required fields must be provided for KYC");
  }

  let userId = req.user.id;
  const balance1 = req.user.balance;


  let balance = parseFloat(balance1); // or Number(user.balance)

  await checkMoneyTransferOperator();

  const [keywordRows] = await db.query("SELECT * FROM keywords WHERE description = ? and status = 1", [
    'Verification'
  ]);
  if (keywordRows.length === 0) throw new ApiError(404, "Keyword not found");

  //match keyword data

  const keywordDetails = keywordRows[0];
  let keywordId = keywordDetails.id;

 let  [[currentline]] = await db.query(
      `SELECT kl.* from keyword_lines as kl
      JOIN kl_financials kf ON kf.kl_id = kl.id
      WHERE kl.keyword_id = ? 
        AND kl.status = 1 
        AND kf.today_amount < COALESCE(kf.daily_max_amount, 9999999)
        AND kf.today_count < COALESCE(kf.daily_max_count, 9999999)
      ORDER BY kl.priority ASC
      `,
      [keywordId]
    );

    if( !currentline || currentline.length === 0) {
      throw new ApiError(404, "We are not active, Please try again later");
    }


      const result = await calculateUserMargins({
          userId: userId,
          parentId: req.user.parent_id,
          keywordId: keywordId,
          amount: 0,
          linesMargin: currentline.margin_status === 1 ? currentline : null
        });
    
        console.log("Calculated Margins:", result);


        //deduct the retailer margin now
      let amount =   result.retailerAddition;

      if (balance < amount) {
        throw new ApiError(400, "Insufficient balance to proceed with KYC");
      }

      //update user balance
      await db.query(
        `UPDATE users SET balance = balance - ? WHERE id = ?`,
        [amount, userId]
      );

       const [addRecharge] = await db.query(
      `INSERT INTO recharges (user_id, keyword_id, account, number, amount, deducted_amount,user_prev_balance , user_new_balance, status) VALUES (?, ?,  ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        keywordId,
        mobileNumber,
        mobileNumber,
        amount,
        amount,
        balance ,
        balance - amount,
        "pending"
      ]
    );

      console.log("Recharge added to database:", addRecharge);

      const rechargeId = addRecharge.insertId;
    console.log("Recharge ID:", rechargeId);




  let latitude = 26.94642;
  let longitude = 75.72912;

  try {
    // Call InstantPay API
    // If biometricData is a string, parse it to JSON
    let biometricDataObj = biometricData;
    if (typeof biometricData === "string") {
      try {
      biometricDataObj = JSON.parse(biometricData);
      } catch (e) {
      throw new ApiError(400, "Invalid biometricData JSON string");
      }
    }

    const rechargeId = addRecharge.insertId;
    console.log("Recharge ID:", rechargeId);

    // Ensure externalRef is exactly 8 characters (pad or trim as needed)
    let externalRefStr = (typeof rechargeId !== "undefined" && rechargeId !== null) ? rechargeId.toString() : (() => { throw new ApiError(500, "Recharge ID is undefined"); })();
    if (externalRefStr.length < 8) {
      // Pad at the start with "svrechar" (or any string) to make it 8 characters
      externalRefStr = ("svrechar" + externalRefStr).slice(-8);
    }

    console.log("External Reference String:", externalRefStr);
    // // If more than 8, keep last 8 characters
    // else if (externalRefStr.length > 8) {
    //   externalRefStr = externalRefStr.slice(-8);
    // }

  

     const params = {
        mobileNumber,
      latitude,
      longitude,
      referenceKey,
      externalRef : externalRefStr,
      consentTaken,
      biometricData: biometricDataObj
    }

    const requestParams = {
      mobileNumber,
      latitude,
      longitude,
      referenceKey,
      captureType,
      externalRef: externalRefStr,
      consentTaken,
      biometricData: biometricDataObj
    };

    console.log("📤 Request Parameters:", requestParams);


    console.log("📤 Complete Request:", JSON.stringify(requestParams, null, 2))
    //print headers
    console.log("headers", createInstantPayHeaders());

    console.log("🌐 Calling InstantPay Remitter KYC API..."
      + `\n📤 URL: ${IPAY_BASE_URL}/remitterKyc`
    );

    const response = await axios.post(
      `${IPAY_BASE_URL}/remitterKyc`,
      requestParams,
      { headers: createInstantPayHeaders() }
    );

  //print headers
    console.log("🌐 InstantPay API Response received");


    //print complete request for postman
    console.log("📥 Response Data:", JSON.stringify(response.data, null, 2));

    

    const apiData = response.data;
    console.log("api data", apiData);

    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'remitterKyc',
        JSON.stringify(params),
        JSON.stringify(apiData),
        apiData.statuscode
      ]
    );

        const [addgigs] = await db.query(
      "INSERT INTO recharge_gigs (rech_id, user_id, line_id, api_id, provider_id, amount, prev_balance, config, request, response, response_complete ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        rechargeId,
        userId,
        currentline.id,
        currentline.recharge_api,
        currentline.api_provider,
        amount,
        currentline.balance,
        "Recharge",
        JSON.stringify(params),
        JSON.stringify(apiData),
        JSON.stringify(apiData)
      ]
    );


    const gigId = addgigs.insertId;

    // If KYC is successful, update local database
    if (apiData.statuscode === "TXN") {
      await db.query(
        `UPDATE dmt_remitters SET is_verified = 1, updated_at = NOW() 
         WHERE mobile_number = ? AND user_id = ?`,
        [mobileNumber, req.user.id]
      );

       await db.query(
        `UPDATE recharges SET status = 'success',reqid = ?, updated_at = NOW() 
         WHERE id = ?`,
        [rechargeId,rechargeId]
      );

      //update recharge gigs
      await db.query(
        `UPDATE recharge_gigs SET status = 'success', updated_at = NOW(), message = ?
          WHERE id = ?`,
        ["Bank account verification Success " + apiData.status, gigId]
      );
       res.status(200).json(
      new ApiResponse(200, apiData, "Remitter KYC processed successfully")
    );
    }else{

      //retunr the user amount
      await db.query(
        `UPDATE users SET balance = balance + ? WHERE id = ?`,
        [amount, userId]
      );

        //updaet recharge status
      await db.query(
        `UPDATE recharges SET status = 'failed', deducted_amount = ?, updated_at = NOW() 
         WHERE id = ?`,
        [0, rechargeId]
      );

      //update recharge gigs
      await db.query(
        `UPDATE recharge_gigs SET status = 'failed', updated_at = NOW(), message = ?
          WHERE id = ?`,
        ["Bank account verification failed: " + apiData.status, gigId]
      );
            
      
      console.log("⚠️ KYC processing did not return TXN status");
      console.log("⚠️ Received status:", apiData.statuscode);
     throw new ApiError(400, "KYC processing failed with status: " + apiData.statuscode);
    }

   

  } catch (error) {
    console.error("DMT Remitter KYC Error:", error);
    
    // Log error in database
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'remitterKyc',
        JSON.stringify({ mobileNumber }),
        JSON.stringify({ error: error.message }),
        'ERROR'
      ]
    );

    throw new ApiError(500, error.response?.data?.status || "Failed to process remitter KYC");
  }
});

// 8. Register Beneficiary
const registerBeneficiary = asyncHandler(async (req, res) => {
  const { 
    beneficiaryMobileNumber, 
    remitterMobileNumber, 
    ifsc, 
    accountNumber, 
    bankId, 
    name 
  } = req.body;

  console.log("=== DMT Register Beneficiary Started ===");
  console.log("📱 Beneficiary Mobile:", beneficiaryMobileNumber);
  console.log("📱 Remitter Mobile:", remitterMobileNumber);
  console.log("🏦 Bank ID:", bankId);
  console.log("🏦 IFSC:", ifsc);
  console.log("💼 Account Number:", accountNumber);
  console.log("👤 Name:", name);
  console.log("👤 User ID:", req.user.id);

  if (!beneficiaryMobileNumber || !remitterMobileNumber || !ifsc || !accountNumber || !bankId || !name) {
    throw new ApiError(400, "All beneficiary details are required");
  }

  try {
    // Get bank name from local database
    console.log("🔍 Fetching bank details from database...");
    const bankDetails = await db.query(
      "SELECT bank_name FROM banks WHERE bank_id = ? AND is_active = 1",
      [bankId]
    );
    
    const bankName = bankDetails.length > 0 ? bankDetails[0].bank_name : "Unknown Bank";
    console.log("🏦 Bank Name:", bankName);

    // Call InstantPay API
    console.log("🌐 Calling InstantPay Beneficiary Registration API...");
    const response = await axios.post(
      `${IPAY_BASE_URL}/beneficiaryRegistration`,
      {
        beneficiaryMobileNumber,
        remitterMobileNumber,
        ifsc,
        accountNumber,
        bankId,
        name
      },
      { headers: createInstantPayHeaders() }
    );

    const apiData = response.data;
    console.log("=== InstantPay Beneficiary Registration Response ===");
    console.log("📥 API Status Code:", apiData.statuscode);
    console.log("📥 API Status Message:", apiData.status);
    console.log("📥 API Data:", apiData.data);

    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'beneficiaryRegistration',
        JSON.stringify({ beneficiaryMobileNumber, remitterMobileNumber, accountNumber, ifsc, name, bankId }),
        JSON.stringify(apiData),
        apiData.statuscode
      ]
    );

    // If registration is successful (TXN) or OTP sent, save to local database
    if (apiData.statuscode === "TXN" || apiData.statuscode === "OTP") {
      const beneficiaryId = apiData.data?.beneficiaryId;
      if (beneficiaryId) {
        console.log("💾 Saving beneficiary to local database...");
        console.log("💾 Beneficiary ID:", beneficiaryId);
        console.log("💾 Bank Name:", bankName);

        //get bank name form db
      const [[banks]] = await db.query(
      `SELECT bank_id, bank_name 
       FROM banks WHERE bank_id = ?`
       ,[bankId] 
    );
    console.log(banks.bank_name);
        
        await db.query(
          `INSERT INTO dmt_beneficiaries (user_id, mobile_number, beneficiary_id, name, 
           account_number, ifsc, bank_name, beneficiary_mobile, bank_verification_status, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NOT_VERIFIED', NOW()) 
           ON DUPLICATE KEY UPDATE name = VALUES(name), bank_name = VALUES(bank_name), updated_at = NOW()`,
          [
            req.user.id,
            remitterMobileNumber,
            beneficiaryId,
            name,
            accountNumber,
            ifsc,
            banks.bank_name,
            beneficiaryMobileNumber
          ]
        );
        console.log("✅ Beneficiary saved to local database");
      }
    }

    console.log("📤 Sending response to client...");
    res.status(200).json(
      new ApiResponse(200, apiData, "Beneficiary registration initiated successfully")
    );

  } catch (error) {
    console.error("DMT Beneficiary Registration Error:", error);
    
    // Log error in database
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'beneficiaryRegistration',
        JSON.stringify({ beneficiaryMobileNumber, remitterMobileNumber }),
        JSON.stringify({ error: error.message }),
        'ERROR'
      ]
    );

    throw new ApiError(500, error.response?.data?.status || "Failed to register beneficiary");
  }
});

// 9. Verify Beneficiary Registration OTP
const verifyBeneficiaryOtp = asyncHandler(async (req, res) => {
  const { remitterMobileNumber, otp, beneficiaryId, referenceKey } = req.body;

  if (!remitterMobileNumber || !otp || !beneficiaryId || !referenceKey) {
    throw new ApiError(400, "All fields are required for beneficiary OTP verification");
  }

  await checkMoneyTransferOperator();

  try {
    // Call InstantPay API
    const response = await axios.post(
      `${IPAY_BASE_URL}/beneficiaryRegistrationVerify`,
      {
        remitterMobileNumber,
        otp,
        beneficiaryId,
        referenceKey
      },
      { headers: createInstantPayHeaders(req.ip) }
    );

    const apiData = response.data;

    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'beneficiaryRegistrationVerify',
        JSON.stringify({ remitterMobileNumber, otp, beneficiaryId }),
        JSON.stringify(apiData),
        apiData.statuscode
      ]
    );

    // If verification is successful, update local database
    if (apiData.statuscode === "TXN") {
      await db.query(
        `UPDATE dmt_beneficiaries SET verification_date = NOW(), bank_verification_status = 'NOT_VERIFIED', updated_at = NOW() 
         WHERE beneficiary_id = ? AND mobile_number = ? AND user_id = ?`,
        [beneficiaryId, remitterMobileNumber, req.user.id]
      );
    }

    res.status(200).json(
      new ApiResponse(200, apiData, "Beneficiary OTP verified successfully")
    );

  } catch (error) {
    console.error("DMT Beneficiary OTP Verification Error:", error);
    
    // Log error in database
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'beneficiaryRegistrationVerify',
        JSON.stringify({ remitterMobileNumber, otp, beneficiaryId }),
        JSON.stringify({ error: error.message }),
        'ERROR'
      ]
    );

    throw new ApiError(500, error.response?.data?.status || "Failed to verify beneficiary OTP");
  }
});

// 9.1. Verify Bank Account
const verifyBankAccount = asyncHandler(async (req, res) => {
  const { 
    payeeName, 
    accountNumber, 
    bankIfsc, 
    externalRef, 
    pennyDrop = "AUTO", 
    latitude, 
    longitude 
  } = req.body;

  if (!accountNumber || !bankIfsc || !externalRef || !latitude || !longitude) {
    throw new ApiError(400, "Account number, bank IFSC, external reference, latitude, and longitude are required");
  }

  try {
    const requestData = {
      payee: {
        name: payeeName,
        accountNumber: accountNumber,
        bankIfsc: bankIfsc
      },
      externalRef: externalRef,
      consent: "Y",
      pennyDrop: pennyDrop,
      latitude: latitude,
      longitude: longitude
    };

    // Call InstantPay Bank Account Verification API
    const response = await axios.post(
      "https://api.instantpay.in/identity/verifyBankAccount",
      requestData,
      { 
        headers: {
          'X-Ipay-Auth-Code': IPAY_AUTH_CODE,
          'X-Ipay-Client-Id': IPAY_CLIENT_ID,
          'X-Ipay-Client-Secret': IPAY_CLIENT_SECRET,
          'X-Ipay-Endpoint-Ip': req.ip || "127.0.0.1",
          'Content-Type': 'application/json'
        }
      }
    );

    const apiData = response.data;

    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'verifyBankAccount',
        JSON.stringify(requestData),
        JSON.stringify(apiData),
        apiData.statuscode
      ]
    );

    // Check if the transaction was successful
    if (apiData.statuscode === "TXN") {
      // Check name matching if payeeName was provided
      if (payeeName && apiData.data?.payee?.nameMatchPercent) {
        const nameMatchPercent = parseFloat(apiData.data.payee.nameMatchPercent);
        
        // If name match percentage is below 80%, return error
        if (nameMatchPercent < 80) {
          res.status(400).json(
            new ApiResponse(400, {
              ...apiData,
              nameMatchError: true,
              providedName: payeeName,
              bankRegisteredName: apiData.data.payee.name,
              matchPercentage: nameMatchPercent
            }, "Bank account verification failed: Name mismatch detected")
          );
          return;
        }
      }

      res.status(200).json(
        new ApiResponse(200, apiData, "Bank account verification successful")
      );
    } else {
      // If verification failed, return error with details
      res.status(400).json(
        new ApiResponse(400, apiData, apiData.status || "Bank account verification failed")
      );
    }

  } catch (error) {
    console.error("Bank Account Verification Error:", error);
    
    // Log error in database
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'verifyBankAccount',
        JSON.stringify({ accountNumber, bankIfsc, externalRef }),
        JSON.stringify({ error: error.message }),
        'ERROR'
      ]
    );

    throw new ApiError(500, error.response?.data?.status || "Failed to verify bank account");
  }
});

// 9.2. Manual Bank Verification for Beneficiaries
const manualBankVerification = asyncHandler(async (req, res) => {
  const { 
    beneficiaryId, 
    remitterMobileNumber,
    accountNumber, 
    ifsc, 
    payeeName,
    latitude = "26.94642", 
    longitude = "75.72912" 
  } = req.body;

  console.log("=== Manual Bank Verification Started ===");
  console.log("Beneficiary ID:", beneficiaryId);
  console.log("Remitter Mobile:", remitterMobileNumber);
  console.log("Account Number:", accountNumber);
  console.log("IFSC:", ifsc);
  console.log("Payee Name:", payeeName);

  if (!beneficiaryId || !remitterMobileNumber || !accountNumber || !ifsc || !payeeName) {
    throw new ApiError(400, "All fields are required for manual bank verification");
  }

  try {
    // Check if beneficiary exists and belongs to the user
    const [beneficiaryDetails] = await db.query(
      `SELECT * FROM dmt_beneficiaries WHERE beneficiary_id = ? AND mobile_number = ? AND user_id = ? AND is_active = 1`,
      [beneficiaryId, remitterMobileNumber, req.user.id]
    );

    let beneficiary;
    let isBeneficiaryNewlyCreated = false;

    if (beneficiaryDetails.length === 0) {
      console.log("⚠️ Beneficiary not found in database, creating new beneficiary record...");
      
      // Try to get bank name from IFSC code
      let bankName = "Unknown Bank";
      let bankId = null;
      
      // Extract bank prefix from IFSC (first 4 characters)
      const ifscPrefix = ifsc.substring(0, 4);
      console.log("🔍 Extracted IFSC prefix:", ifscPrefix);
      
      // Try to find bank by IFSC alias or prefix
      const [bankDetails] = await db.query(
        `SELECT bank_id, bank_name FROM banks WHERE 
         (ifsc_alias = ? OR ifsc_global LIKE ? OR bank_name LIKE ?) 
         AND is_active = 1 LIMIT 1`,
        [ifscPrefix, `${ifscPrefix}%`, `%${ifscPrefix}%`]
      );
      
      if (bankDetails.length > 0) {
        bankName = bankDetails[0].bank_name;
        bankId = bankDetails[0].bank_id;
        console.log("✅ Found bank details:", { bankId, bankName });
      } else {
        console.log("⚠️ Could not find bank details for IFSC prefix:", ifscPrefix);
      }

      // Create new beneficiary record in database
      const [insertResult] = await db.query(
        `INSERT INTO dmt_beneficiaries (user_id, mobile_number, beneficiary_id, name, 
         account_number, ifsc, bank_name, beneficiary_mobile, bank_verification_status, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NOT_VERIFIED', NOW())`,
        [
          req.user.id,
          remitterMobileNumber,
          beneficiaryId,
          payeeName,
          accountNumber,
          ifsc,
          bankName,
          req.user.mobile_number || remitterMobileNumber // Use user's mobile or remitter mobile as beneficiary mobile
        ]
      );

      console.log("✅ New beneficiary record created with ID:", insertResult.insertId);
      isBeneficiaryNewlyCreated = true;

      // Create beneficiary object for further processing
      beneficiary = {
        id: insertResult.insertId,
        user_id: req.user.id,
        mobile_number: remitterMobileNumber,
        beneficiary_id: beneficiaryId,
        name: payeeName,
        account_number: accountNumber,
        ifsc: ifsc,
        bank_name: bankName,
        beneficiary_mobile: remitterMobileNumber || req.user.mobile_number,
        bank_verification_status: 'NOT_VERIFIED',
        created_at: new Date()
      };
    } else {
      beneficiary = beneficiaryDetails[0];
      console.log("✅ Existing beneficiary found:", beneficiary.name);
    }

    // Get user balance and setup for deduction
    let userId = req.user.id;
    const balance1 = req.user.balance;
    let balance = parseFloat(balance1);

    await checkMoneyTransferOperator();

    // Get Bank Verification keyword details for deduction
    const [keywordRows] = await db.query("SELECT * FROM keywords WHERE description = ? and status = 1", [
      'Bank Verification'
    ]);
    
    if (keywordRows.length === 0) {
      throw new ApiError(404, "Bank Verification service not available");
    }

    const keywordDetails = keywordRows[0];
    let keywordId = keywordDetails.id;

    // Get active line for Bank Verification
    let [[currentline]] = await db.query(
      `SELECT kl.* from keyword_lines as kl
      JOIN kl_financials kf ON kf.kl_id = kl.id
      WHERE kl.keyword_id = ? 
        AND kl.status = 1 
        AND kf.today_amount < COALESCE(kf.daily_max_amount, 9999999)
        AND kf.today_count < COALESCE(kf.daily_max_count, 9999999)
      ORDER BY kl.priority ASC`,
      [keywordId]
    );

    console.log("Current Line for Bank Verification:", currentline);
    if (!currentline || currentline.length === 0) {
      throw new ApiError(404, "Bank verification service not available, please try again later");
    }

    // Calculate margins for deduction
    const result = await calculateUserMargins({
      userId: userId,
      parentId: req.user.parent_id,
      keywordId: keywordId,
      amount: 0,
      linesMargin: currentline.margin_status === 1 ? currentline : null
    });

    console.log("Calculated Margins:", result);

    // Deduct the retailer margin for bank verification
    let amount = result.retailerAddition;

    if (balance < amount) {
      throw new ApiError(400, "Insufficient balance to proceed with bank verification");
    }

    // Update beneficiary status to PENDING before starting verification
    await db.query(
      `UPDATE dmt_beneficiaries SET bank_verification_status = 'PENDING', updated_at = NOW() 
       WHERE beneficiary_id = ? AND mobile_number = ? AND user_id = ?`,
      [beneficiaryId, remitterMobileNumber, req.user.id]
    );

    // Deduct balance before bank verification
    await db.query(
      `UPDATE users SET balance = balance - ? WHERE id = ?`,
      [amount, userId]
    );

    // Create recharge record for bank verification
    const [addRecharge] = await db.query(
      `INSERT INTO recharges (user_id, keyword_id, account, number, amount, deducted_amount, user_prev_balance, user_new_balance, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        keywordId,
      //  accountNumber,
      beneficiary.beneficiary_mobile,
        remitterMobileNumber,
        amount,
        amount,
        balance,
        balance - amount,
        "pending"
      ]
    );

    const rechargeId = addRecharge.insertId;
    console.log("Recharge ID created for bank verification:", rechargeId);

    // Prepare bank verification request
    const bankVerificationData = {
      payee: {
        name: payeeName,
        accountNumber: accountNumber,
        bankIfsc: ifsc
      },
      externalRef: rechargeId.toString(),
      consent: "Y",
      pennyDrop: "AUTO",
      latitude: latitude,
      longitude: longitude
    };

    console.log("🏦 Calling bank verification API...");
    // Call InstantPay Bank Account Verification API
    const bankVerificationResponse = await axios.post(
      "https://api.instantpay.in/identity/verifyBankAccount",
      bankVerificationData,
      { headers: createInstantPayHeaders(req.ip) }
    );

    const bankApiData = bankVerificationResponse.data;
    console.log("🏦 Bank verification response:", bankApiData);

    // Create recharge gig entry
    const [addgigs] = await db.query(
      "INSERT INTO recharge_gigs (rech_id, user_id, line_id, api_id, provider_id, amount, prev_balance, config, request, response, response_complete ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        rechargeId,
        userId,
        currentline.id,
        currentline.recharge_api,
        currentline.api_provider,
        amount,
        currentline.balance,
        "Bank Verification",
        JSON.stringify(bankVerificationData),
        JSON.stringify(bankApiData),
        JSON.stringify(bankApiData)
      ]
    );
    const gigId = addgigs.insertId;

    // Log the bank verification API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'manualBankVerification',
        JSON.stringify(bankVerificationData),
        JSON.stringify(bankApiData),
        bankApiData.statuscode
      ]
    );

    // Check bank verification result
    if (bankApiData.statuscode === "TXN") {
      // Check name matching - handle both numeric and empty values
      let nameMatchPercent = 0;
      if (bankApiData.data?.payee?.nameMatchPercent !== undefined && 
          bankApiData.data?.payee?.nameMatchPercent !== null && 
          bankApiData.data?.payee?.nameMatchPercent !== '') {
        nameMatchPercent = parseFloat(bankApiData.data.payee.nameMatchPercent);
        // Handle NaN case
        if (isNaN(nameMatchPercent)) {
          nameMatchPercent = 0;
        }
      }
      
      const bankRegisteredName = bankApiData.data?.payee?.name || '';
      const originalName = bankApiData.data?.payee?.origName || '';
      
      console.log("🏦 Name match percentage:", nameMatchPercent);
      console.log("🏦 Bank registered name:", bankRegisteredName);
      console.log("🏦 Original name:", originalName);

      // Check if bank account has valid name information
      if (!bankRegisteredName || bankRegisteredName.trim() === '') {
        console.log("⚠️ Bank account verification failed - No name found in bank records");
        
        // Update beneficiary with failed verification
        await db.query(
          `UPDATE dmt_beneficiaries SET 
           bank_verification_status = 'FAILED', 
           bank_verification_date = NOW(), 
           name_match_percent = ?, 
           bank_registered_name = ?, 
           updated_at = NOW() 
           WHERE beneficiary_id = ? AND mobile_number = ? AND user_id = ?`,
          [
            nameMatchPercent,
            originalName || 'No name found',
            beneficiaryId,
            remitterMobileNumber,
            req.user.id
          ]
        );

        // Refund the amount since verification failed
        await db.query(
          `UPDATE users SET balance = balance + ? WHERE id = ?`,
          [amount, userId]
        );

        // Update recharge status to failed
        await db.query(
          `UPDATE recharges SET status = 'failed', deducted_amount = ?, updated_at = NOW() 
           WHERE id = ?`,
          [0, rechargeId]
        );

        // Update recharge gigs
        await db.query(
          `UPDATE recharge_gigs SET status = 'failed', updated_at = NOW(), message = ?
           WHERE id = ?`,
          ["Bank account verification failed: No name found in bank records " + bankApiData.status, gigId]
        );

        return res.status(400).json(
          new ApiResponse(400, {
            success: false,
            verificationStatus: "FAILED",
            nameMatch: false,
            nameMatchPercent: nameMatchPercent,
            providedName: payeeName,
            bankRegisteredName: bankRegisteredName,
            originalName: originalName,
            beneficiaryCreated: isBeneficiaryNewlyCreated,
            beneficiaryId: beneficiaryId,
            failureReason: "NO_NAME_FOUND",
            message: isBeneficiaryNewlyCreated ? 
              "Bank account verification failed: No name found in bank records. Beneficiary was added to database but verification failed" : 
              "Bank account verification failed: No name found in bank records"
          }, "Bank account verification failed - No name found")
        );
      }

      // if (nameMatchPercent) {
        console.log("✅ Bank account verification successful with good name match");
        
        // Update beneficiary with successful bank verification status
        await db.query(
          `UPDATE dmt_beneficiaries SET 
           bank_verification_status = 'VERIFIED', 
           bank_verification_date = NOW(), 
           name_match_percent = ?, 
           bank_registered_name = ?, 
           updated_at = NOW() 
           WHERE beneficiary_id = ? AND mobile_number = ? AND user_id = ?`,
          [
            nameMatchPercent,
            bankRegisteredName,
            beneficiaryId,
            remitterMobileNumber,
            req.user.id
          ]
        );

        // Update recharge status to success
        await db.query(
          `UPDATE recharges SET status = 'success', reqid = ?, updated_at = NOW() 
           WHERE id = ?`,
          [rechargeId, rechargeId]
        );

        // Update recharge gigs
        await db.query(
          `UPDATE recharge_gigs SET status = 'success', updated_at = NOW(), message = ?
           WHERE id = ?`,
          ["Bank account verification successful " + bankApiData.status, gigId]
        );

        return res.status(200).json(
          new ApiResponse(200, {
            success: true,
            verificationStatus: "VERIFIED",
            nameMatch: true,
            nameMatchPercent: nameMatchPercent,
            bankRegisteredName: bankRegisteredName,
            originalName: originalName,
            providedName: payeeName,
            beneficiaryCreated: isBeneficiaryNewlyCreated,
            beneficiaryId: beneficiaryId,
            poolReferenceId: bankApiData.data?.poolReferenceId,
            txnReferenceId: bankApiData.data?.txnReferenceId,
            message: isBeneficiaryNewlyCreated ? 
              "Bank account verified successfully and beneficiary added to database" : 
              "Bank account verified successfully"
          }, "Bank account verification completed successfully")
        );

      // } else {
      //   console.log("⚠️ Bank account verification failed due to low name match");
        
      //   // Update beneficiary with failed verification
      //   await db.query(
      //     `UPDATE dmt_beneficiaries SET 
      //      bank_verification_status = 'FAILED', 
      //      bank_verification_date = NOW(), 
      //      name_match_percent = ?, 
      //      bank_registered_name = ?, 
      //      updated_at = NOW() 
      //      WHERE beneficiary_id = ? AND mobile_number = ? AND user_id = ?`,
      //     [
      //       nameMatchPercent,
      //       bankRegisteredName,
      //       beneficiaryId,
      //       remitterMobileNumber,
      //       req.user.id
      //     ]
      //   );

      //   // Refund the amount since verification failed
      //   await db.query(
      //     `UPDATE users SET balance = balance + ? WHERE id = ?`,
      //     [amount, userId]
      //   );

      //   // Update recharge status to failed
      //   await db.query(
      //     `UPDATE recharges SET status = 'failed', deducted_amount = ?, updated_at = NOW() 
      //      WHERE id = ?`,
      //     [0, rechargeId]
      //   );

      //   // Update recharge gigs
      //   await db.query(
      //     `UPDATE recharge_gigs SET status = 'failed', updated_at = NOW(), message = ?
      //      WHERE id = ?`,
      //     ["Bank account verification failed: Name mismatch " + bankApiData.status, gigId]
      //   );

      //   return res.status(400).json(
      //     new ApiResponse(400, {
      //       success: false,
      //       verificationStatus: "FAILED",
      //       nameMatch: false,
      //       nameMatchPercent: nameMatchPercent,
      //       providedName: payeeName,
      //       bankRegisteredName: bankRegisteredName,
      //       originalName: originalName,
      //       beneficiaryCreated: isBeneficiaryNewlyCreated,
      //       beneficiaryId: beneficiaryId,
      //       failureReason: "NAME_MISMATCH",
      //       poolReferenceId: bankApiData.data?.poolReferenceId,
      //       txnReferenceId: bankApiData.data?.txnReferenceId,
      //       message: isBeneficiaryNewlyCreated ? 
      //         "Bank account verification failed: Name mismatch detected. Beneficiary was added to database but verification failed" : 
      //         "Bank account verification failed: Name mismatch detected"
      //     }, "Bank account verification failed due to name mismatch")
      //   );
      // }
    } 
    else if (bankApiData.statuscode === "ERR") {
      console.log("❌ Bank account verification failed - Invalid account");

      // Update beneficiary with failed verification
      await db.query(
        `UPDATE dmt_beneficiaries SET 
         bank_verification_status = 'FAILED', 
         updated_at = NOW() 
         WHERE beneficiary_id = ? AND mobile_number = ? AND user_id = ?`,
        [beneficiaryId, remitterMobileNumber, req.user.id]
      );

      // Refund the amount since verification failed
      await db.query(
        `UPDATE users SET balance = balance + ? WHERE id = ?`,
        [amount, userId]
      );

      // Update recharge status to failed
      await db.query(
        `UPDATE recharges SET status = 'failed', deducted_amount = ?, updated_at = NOW() 
         WHERE id = ?`,
        [0, rechargeId]
      );

      // Update recharge gigs
      await db.query(
        `UPDATE recharge_gigs SET status = 'failed', updated_at = NOW(), message = ?
         WHERE id = ?`,
        ["Bank account verification failed: " + bankApiData.status, gigId]
      );

      return res.status(400).json(
        new ApiResponse(400, {
          success: false,
          verificationStatus: "FAILED",
          nameMatch: false,
          nameMatchPercent: 0,
          providedName: payeeName,
          bankRegisteredName: '',
          originalName: bankApiData.data?.payee?.origName || '',
          beneficiaryCreated: isBeneficiaryNewlyCreated,
          beneficiaryId: beneficiaryId,
          failureReason: "INVALID_ACCOUNT",
          poolReferenceId: bankApiData.data?.poolReferenceId,
          errorCode: bankApiData.statuscode,
          errorMessage: bankApiData.status,
          message: isBeneficiaryNewlyCreated ? 
            `Bank account verification failed: ${bankApiData.status}. Beneficiary was added to database but verification failed` : 
            `Bank account verification failed: ${bankApiData.status}`
        }, "Bank account verification failed - Invalid account")
      );
    } 
    else {
      console.log("❌ Bank account verification API failed with unknown status");

      // Update beneficiary with failed verification
      await db.query(
        `UPDATE dmt_beneficiaries SET 
         bank_verification_status = 'FAILED', 
         updated_at = NOW() 
         WHERE beneficiary_id = ? AND mobile_number = ? AND user_id = ?`,
        [beneficiaryId, remitterMobileNumber, req.user.id]
      );

      // Refund the amount since verification failed
      await db.query(
        `UPDATE users SET balance = balance + ? WHERE id = ?`,
        [amount, userId]
      );

      // Update recharge status to failed
      await db.query(
        `UPDATE recharges SET status = 'failed', deducted_amount = ?, updated_at = NOW() 
         WHERE id = ?`,
        [0, rechargeId]
      );

      // Update recharge gigs
      await db.query(
        `UPDATE recharge_gigs SET status = 'failed', updated_at = NOW(), message = ?
         WHERE id = ?`,
        ["Bank verification API failed: " + bankApiData.status, gigId]
      );

      return res.status(400).json(
        new ApiResponse(400, {
          success: false,
          verificationStatus: "FAILED",
          nameMatch: false,
          nameMatchPercent: 0,
          providedName: payeeName,
          bankRegisteredName: '',
          originalName: '',
          beneficiaryCreated: isBeneficiaryNewlyCreated,
          beneficiaryId: beneficiaryId,
          failureReason: "API_ERROR",
          errorCode: bankApiData.statuscode,
          errorMessage: bankApiData.status,
          message: isBeneficiaryNewlyCreated ? 
            `Bank account verification failed: ${bankApiData.status || "Unknown error"}. Beneficiary was added to database but verification failed` : 
            (bankApiData.status || "Bank account verification failed")
        }, "Bank account verification failed")
      );
    }

  } catch (error) {
    console.error("Manual Bank Verification Error:", error);
    
    // Update beneficiary verification status to failed only if beneficiary exists
    try {
      await db.query(
        `UPDATE dmt_beneficiaries SET bank_verification_status = 'FAILED', updated_at = NOW() 
         WHERE beneficiary_id = ? AND mobile_number = ? AND user_id = ?`,
        [beneficiaryId, remitterMobileNumber, req.user.id]
      );
      console.log("✅ Updated beneficiary status to FAILED due to error");
    } catch (dbError) {
      console.error("❌ Failed to update beneficiary status:", dbError);
    }
    
    // Log error in database
    try {
      await db.query(
        `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          req.user.id,
          'manualBankVerification',
          JSON.stringify({ beneficiaryId, accountNumber, ifsc }),
          JSON.stringify({ error: error.message }),
          'ERROR'
        ]
      );
      console.log("✅ Error logged to database");
    } catch (dbError) {
      console.error("❌ Failed to log error to database:", dbError);
    }

    throw new ApiError(500, error.response?.data?.status || "Failed to verify bank account");
  }
});

// 10. Delete Beneficiary
const deleteBeneficiary = asyncHandler(async (req, res) => {
  const { remitterMobileNumber, beneficiaryId, deleteType = 'soft' } = req.body;

  if (!remitterMobileNumber || !beneficiaryId) {
    throw new ApiError(400, "Remitter mobile number and beneficiary ID are required");
  }

  try {
    // Call InstantPay API
    const response = await axios.post(
      `${IPAY_BASE_URL}/beneficiaryDelete`,
      {
        remitterMobileNumber,
        beneficiaryId
      },
      { headers: createInstantPayHeaders() }
    );

    const apiData = response.data;
    console.log("=== InstantPay Beneficiary Delete Response ===");
    console.log("📥 API Status Code:", apiData);

    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'beneficiaryDelete',
        JSON.stringify({ remitterMobileNumber, beneficiaryId }),
        JSON.stringify(apiData),
        apiData.statuscode
      ]
    );

    // If deletion is successful (TXN), update local database
    if (apiData.statuscode === "TXN") {
      console.log(`🗑️ ${deleteType === 'hard' ? 'Hard' : 'Soft'} deleting beneficiary from database`);
      await deleteBeneficiaryFromDatabase(req.user.id, remitterMobileNumber, beneficiaryId, deleteType);
    }

    res.status(200).json(
      new ApiResponse(200, apiData, "Beneficiary deletion initiated successfully")
    );

  } catch (error) {
    console.error("DMT Beneficiary Delete Error:", error);
    
    // Log error in database
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'beneficiaryDelete',
        JSON.stringify({ remitterMobileNumber, beneficiaryId }),
        JSON.stringify({ error: error.message }),
        'ERROR'
      ]
    );

    throw new ApiError(500, error.response?.data?.status || "Failed to delete beneficiary");
  }
});

// 11. Verify Beneficiary Delete OTP
const verifyBeneficiaryDeleteOtp = asyncHandler(async (req, res) => {
  const { remitterMobileNumber, beneficiaryId, otp, referenceKey, deleteType = 'soft' } = req.body;

  if (!remitterMobileNumber || !beneficiaryId || !otp || !referenceKey) {
    throw new ApiError(400, "All fields are required for beneficiary delete verification");
  }

  try {
    // Call InstantPay API
    const response = await axios.post(
      `${IPAY_BASE_URL}/beneficiaryDeleteVerify`,
      {
        remitterMobileNumber,
        beneficiaryId,
        otp,
        referenceKey
      },
      { headers: createInstantPayHeaders() }
    );

    const apiData = response.data;

    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'beneficiaryDeleteVerify',
        JSON.stringify({ remitterMobileNumber, beneficiaryId, otp }),
        JSON.stringify(apiData),
        apiData.statuscode
      ]
    );

    // If deletion verification is successful, update local database
    if (apiData.statuscode === "TXN") {
      console.log(`🗑️ ${deleteType === 'hard' ? 'Hard' : 'Soft'} deleting beneficiary from database after OTP verification`);
      await deleteBeneficiaryFromDatabase(req.user.id, remitterMobileNumber, beneficiaryId, deleteType);
    }

    res.status(200).json(
      new ApiResponse(200, apiData, "Beneficiary deleted successfully")
    );

  } catch (error) {
    console.error("DMT Beneficiary Delete Verify Error:", error);
    
    // Log error in database
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'beneficiaryDeleteVerify',
        JSON.stringify({ remitterMobileNumber, beneficiaryId, otp }),
        JSON.stringify({ error: error.message }),
        'ERROR'
      ]
    );

    throw new ApiError(500, error.response?.data?.status || "Failed to verify beneficiary deletion");
  }
});

// 7. Generate Transaction OTP
const generateTransactionOtp = asyncHandler(async (req, res) => {
  const { remitterMobileNumber, beneficiaryId, amount, channel = "IMPS" ,referenceKey} = req.body;
  console.log("=== DMT Generate Transaction OTP Started ===");
  console.log("📱 Remitter Mobile:", remitterMobileNumber)
  console.log("📱 Beneficiary ID:", beneficiaryId

  );

  if (!remitterMobileNumber || !beneficiaryId || !amount) {
    throw new ApiError(400, "Remitter mobile number, beneficiary ID, and amount are required");
  }

  // Validate amount
  if (amount < 1 || amount > 200000) {
    throw new ApiError(400, "Amount should be between ₹1 and ₹2,00,000");
  }

  try {
    // Check if remitter exists and is verified
    const remitter = await db.query(
      "SELECT * FROM dmt_remitters WHERE mobile_number = ? AND user_id = ? AND is_verified = 1",
      [remitterMobileNumber, req.user.id]
    );

    if (!remitter.length) {
      throw new ApiError(404, "Verified remitter not found");
    }

    // Check if beneficiary exists and is verified
    const beneficiary = await db.query(
      "SELECT * FROM dmt_beneficiaries WHERE beneficiary_id = ? AND mobile_number = ? AND user_id = ? AND is_active = 1",
      [beneficiaryId, remitterMobileNumber, req.user.id]
    );

    if (!beneficiary.length) {
      throw new ApiError(404, "Verified beneficiary not found");
    }

    // Prepare InstantPay API request
    const requestData = {
      remitterMobileNumber,
      amount: parseFloat(amount).toFixed(2),
      referenceKey: referenceKey || ""
    };

    console.log("request data", requestData);

    // Call InstantPay Generate OTP API
    const response = await axios.post(
      `${IPAY_BASE_URL}/generateTransactionOtp`,
      requestData,
      { headers: createInstantPayHeaders() }
    );
    const apiData = response.data;

    // Log transaction in database
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'generateTransactionOtp',
        JSON.stringify(requestData),
        JSON.stringify(response.data),
        'SUCCESS'
      ]
    );

    return res.status(200).json(new ApiResponse(200, apiData, "Transaction OTP generated successfully"));

  } catch (error) {
    console.error("Generate Transaction OTP Error:", error.response?.data || error.message);

    // Log error in database
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'generateTransactionOtp',
        JSON.stringify({ remitterMobileNumber, beneficiaryId, amount, channel }),
        JSON.stringify({ error: error.message }),
        'ERROR'
      ]
    );

    throw new ApiError(500, error.response?.data?.status || "Failed to generate transaction OTP");
  }
});



// 9. Transaction (OTP-based Fund Transfer)
const transaction = asyncHandler(async (req, res) => {
 let{ 
    remitterMobileNumber, 
    beneficiaryId, 
    amount, 
    channel = "IMPS",
    otp,
    otpRefId 
  } = req.body;

  console.log("=== DMT Transaction Started ===");


let account = remitterMobileNumber;

  if (!remitterMobileNumber || !beneficiaryId || !amount || !otp) {
    console.log("❌ Validation failed: Missing required fields");
    console.log("❌ Missing:", {
      remitterMobileNumber: !remitterMobileNumber,
      beneficiaryId: !beneficiaryId,
      amount: !amount,
      otp: !otp
    });
    throw new ApiError(400, "Remitter mobile number, beneficiary ID, amount, and OTP are required");
  }

  // Validate amount
  if (amount < 1 || amount > 200000) {
    console.log("❌ Amount validation failed:", amount);
    throw new ApiError(400, "Amount should be between ₹1 and ₹2,00,000");
  }

  //try {
    console.log("🔍 Checking if remitter exists and is verified...");
    // Check if remitter exists and is verified
    const remitter = await db.query(
      "SELECT * FROM dmt_remitters WHERE mobile_number = ? AND user_id = ? AND is_verified = 1",
      [remitterMobileNumber, req.user.id]
    );

    if (!remitter.length) {
      console.log("❌ Verified remitter not found");
      throw new ApiError(404, "Verified remitter not found");
    }
    console.log("✅ Verified remitter found:", remitter[0].first_name, remitter[0].last_name);

    console.log("🔍 Checking if beneficiary exists and is verified...");
    // Check if beneficiary exists and is verified
    let [beneficiary] = await db.query(
      "SELECT * FROM dmt_beneficiaries WHERE beneficiary_id = ? AND mobile_number = ? AND user_id = ? AND is_active = 1",
      [beneficiaryId, remitterMobileNumber, req.user.id]
    );
    console.log("Beneficiary query result:", beneficiary);

    if (!beneficiary.length) {
      console.log("❌ Beneficiary not found");
       [beneficiary] = await db.query(
      "SELECT * FROM dmt_beneficiaries WHERE id = ? AND mobile_number = ? AND user_id = ? AND is_active = 1",
      [beneficiaryId, remitterMobileNumber, req.user.id]
    );
    }
    if (!beneficiary.length) {
      console.log("❌ Beneficiary not found");
      throw new ApiError(404, "Beneficiary not found");
    }
    console.log("✅ Beneficiary found:", beneficiary[0].name, beneficiary[0].account_number);



  let userId = req.user.id;
  const balance1 = req.user.balance;


  let balance = parseFloat(balance1); // or Number(user.balance)
  amount = parseFloat(req.body.amount); // or Number(req.body.amount)
   const [[user]] = await db.query(`SELECT * FROM users WHERE id = ?`, [userId]);
  balance = parseFloat(user.balance); // Ensure user balance is a number


  if (balance < amount) {
      throw new ApiError(400, "Insufficient balance");
    }



  const [keywordRows] = await db.query("SELECT * FROM keywords WHERE description = ? and status = ?", [
    'Money Transfer 2' , 1
  ]);


  if (keywordRows.length === 0) throw new ApiError(404, "Keyword not Active found");

  //match keyword data

  const keywordDetails = keywordRows[0];
  console.log(keywordDetails);
  let keywordId = keywordDetails.id;
  console.log("Keyword ID:", keywordId);



 if (keywordDetails.min_digits > account.length)
    throw new ApiError(400, "Customer number is too short");
  if (keywordDetails.max_digits < account.length)
    throw new ApiError(400, "Customer number is too long");

  if (parseFloat(keywordDetails.min_recharge) > amount)
    throw new ApiError(400, "Amount is too low");
  if (parseFloat(keywordDetails.max_recharge) < amount)
    throw new ApiError(400, "Amount is too high");


   const [setting] = await db.query(
      `SELECT * FROM settings WHERE key_name = ?`,
      ["time_diff"]
    );

    let seconds = parseInt(setting[0].key_value);
    seconds = seconds - 180


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

    console.log("keywordId", keywordId);

    let [lines] = await db.query(
      `SELECT kl.*, kf.balance as balance
    from keyword_lines kl 
      JOIN kl_financials kf ON kf.kl_id = kl.id
      WHERE  kl.keyword_id = ? 
        AND kl.status = 1 
        AND kf.today_amount < COALESCE(kf.daily_max_amount, 9999999)
        AND kf.today_count < COALESCE(kf.daily_max_count, 9999999)
      ORDER BY kl.priority ASC
      `,
      [ keywordId]
    );

    console.log("Active lines found:", lines);

    if( !lines || lines.length === 0) {
      console.log("❌ No active lines found for the given amount");
      throw new ApiError(404, "No active lines found for the given amount");
    }
const [dmtChargeKeyword] = await db.query(
    `SELECT keywords.* FROM keywords 
    join operators on operators.id = keywords.operator_id
    WHERE operators.code = ? AND keywords.status = 1 and keywords.min_recharge <= ? and keywords.max_recharge >= ?`,
    ['DMT2' , amount, amount]
  );


  //now get the charges for thsi keywod via the cumission sytem
  if (dmtChargeKeyword.length === 0) {
    console.log("❌ DMT charges keyword not found for the given amount");
    throw new ApiError(404, "DMT charges keyword not found for the given amount");
  }

  const dmtChargeKeywordDetails = dmtChargeKeyword[0];
  console.log("DMT Charge Keyword Details:", dmtChargeKeywordDetails);
  const dmtChargeKeywordId = dmtChargeKeywordDetails.id;
   
const [[retailerMargin]] = await db.query(
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
    [userId, userId, dmtChargeKeywordId]
  );

  console.log("dmt charge keyword" , dmtChargeKeywordId);

  console.log("Retailer Margin Details:", retailerMargin);

  // just fetch teh value of amount that should be extra in users account accordngin to retailer margin
   let retailerAdd = parseFloat(retailerMargin.margin);
   let parsedAmount = parseFloat(amount.toFixed(2));

   let retailerAddition1 =
    retailerAdd * (parsedAmount / 100) +
    (retailerMargin.is_charges_fixed
      ? parseFloat(retailerMargin.additional_charges)
      : amount * (parseFloat(retailerMargin.additional_charges) / 100));


  // Calculate the total amount to be deducted from user balance

   retailerAddition1 = parseFloat(retailerAddition1.toFixed(2));


  // Calculate initial deduction if user has flat margin
  let initialDeductedAmount = 0;
  if (user.is_flat_margin) {
    initialDeductedAmount = user.margin_rates ? (amount * user.margin_rates) / 100 : 0;
  }

  if (balance - initialDeductedAmount + retailerAddition1 < amount) {
    throw new ApiError(400, "Insufficient balance");
  }

    

    let totalDeduction = parseFloat(amount) + initialDeductedAmount;
    
   

    const [updateBalance] = await db.query(
      `UPDATE users SET balance = balance - ?  WHERE id = ?`,
      [totalDeduction, userId]
    );
    if (updateBalance.affectedRows === 0) {
      throw new ApiError(404, "TRY AGAIN");
    }

  console.log("✅ User balance updated successfully");
  let customerNumber = beneficiary[0].account_number;


   const randomPart = Math.floor(Math.random() * 90) + 10; // 2 digit random number (10-99)
  let reqId = `${keywordId}${userId}${Date.now().toString().slice(-5)}${randomPart}`;
  let params = {
    reqid: reqId,
    userId: userId,
    keywordId: keywordId,
    customerNumber: customerNumber,
    account: account,
    amount: amount,
    otp: otp,
    channel: channel,
    referenceKey: req.body.referenceKey || ""
  };

    
  const currentline = lines[0];
  console.log("current line", currentline);



  let finalStatus = "initiated";
  let finalMessage = "Recharge is pending";
  let finalLineId = currentline.id;

  let rechargeId = null;
  let finalFilters = null;

  let addRecharge = null;


    [addRecharge] = await db.query(
      `INSERT INTO recharges (user_id, keyword_id, account, number, amount, deducted_amount, params,  user_prev_balance , user_new_balance) VALUES (?, ?,  ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        keywordId,
        account,
        customerNumber,
        amount,
        totalDeduction,
        JSON.stringify(params),
        balance,
        balance - totalDeduction
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
        JSON.stringify(params)
      ]
    );

    const gigId = addgigs.insertId;

    console.log("Recharge gig created with ID:", gigId);

  console.log("✅ All validations passed");
 let latitude = 26.94642;
  let longitude = 75.72912;

  

    

    console.log("📤 Preparing InstantPay transaction request...");
    // Prepare InstantPay API request
    const requestData = {
      remitterMobileNumber,
      accountNumber: beneficiary[0].account_number,
      ifsc: beneficiary[0].ifsc,
      transferMode: channel,
      transferAmount: parseFloat(amount).toFixed(2),
      latitude:latitude || "0.0",
      longitude: longitude || "0.0",
      referenceKey: req.body.referenceKey || "",
      otp: otp,
      externalRef: 'DMT-' + reqId.toString(), 
    };

    console.log("📤 Request data:", {
      ...requestData,
      otp: "***HIDDEN***"
    });

    console.log("🌐 Making API call to InstantPay...");
    // Call InstantPay Transaction API
    const response = await axios.post(
      `${IPAY_BASE_URL}/transaction`,
      requestData,
      { headers: createInstantPayHeaders() }
    );

    const apiData = response.data;

    console.log("=== InstantPay Transaction Response ===");
    console.log("📥 HTTP Status:", response.status);
    console.log("📥 Response data:", JSON.stringify(response.data, null, 2));

    console.log("💾 Logging transaction to database...");
    // Log transaction in database
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'transaction',
        JSON.stringify(requestData),
        JSON.stringify(response.data),
        response.data.statuscode 
      ]
    );
    console.log("✅ Transaction logged to database");

    // Store detailed transaction record regardless of success/failure
    console.log("💾 Storing detailed transaction record...");
    
    // Parse the API response data
    const apiResponseData = response.data;
    const transactionData = apiResponseData.data || {};
    const poolData = transactionData.pool || {};
    
    // Get bank name from beneficiary record
    const bankName = beneficiary[0].bank_name || 'Unknown Bank';
    
    // Insert detailed transaction record
    const [detailedTransaction] = await db.query(
      `INSERT INTO dmt_transaction_details (
        recharge_id, user_id, remitter_mobile, beneficiary_id, beneficiary_name, 
        beneficiary_account, beneficiary_ifsc, beneficiary_bank_name, beneficiary_mobile,
        transaction_amount, transfer_mode, transaction_charges, gst_amount, total_deducted,
        external_ref, pool_reference_id, txn_reference_id, ipay_uuid, order_id,
        pool_account, pool_opening_balance, pool_closing_balance,
        status, api_status_code, api_status_message, user_balance_before, user_balance_after,
        latitude, longitude, transaction_timestamp, environment, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        rechargeId,
        req.user.id,
        remitterMobileNumber,
        beneficiaryId,
        transactionData.beneficiaryName || beneficiary[0].name,
        transactionData.beneficiaryAccount || beneficiary[0].account_number,
        transactionData.beneficiaryIfsc || beneficiary[0].ifsc,
        bankName,
        beneficiary[0].beneficiary_mobile || null,
        parseFloat(amount),
        channel,
        0, // Will be calculated based on pool data
        0, // Will be calculated based on pool data  
        totalDeduction,
        transactionData.externalRef || `DMT-${rechargeId}`,
        transactionData.poolReferenceId || null,
        transactionData.txnReferenceId || null,
        apiResponseData.ipay_uuid || null,
        apiResponseData.orderid || null,
        poolData.account || null,
        poolData.openingBal ? parseFloat(poolData.openingBal) : null,
        poolData.closingBal ? parseFloat(poolData.closingBal) : null,
        apiResponseData.statuscode === "TXN" ? 'SUCCESS' : 'FAILED',
        apiResponseData.statuscode || null,
        apiResponseData.status || null,
        balance,
        balance - totalDeduction,
        latitude || null,
        longitude || null,
        apiResponseData.timestamp ? new Date(apiResponseData.timestamp) : new Date(),
        apiResponseData.environment || 'LIVE'
      ]
    );
    
    console.log("✅ Detailed transaction record created with ID:", detailedTransaction.insertId);

    // If transaction is successful, store it in the database and update balance
    if (response.data.statuscode === "TXN") {
      console.log("✅ Transaction successful! Storing fund transfer record...");
      
      // Calculate actual charges from pool data
      let actualCharges = 0;
      if (poolData.amount && poolData.mode === "DR") {
        actualCharges = parseFloat(poolData.amount) - parseFloat(amount);
      }
      
      // Update the detailed transaction record with calculated charges
      await db.query(
        `UPDATE dmt_transaction_details SET 
         transaction_charges = ?, 
         gst_amount = ? 
         WHERE id = ?`,
        [
          actualCharges > 0 ? actualCharges : 0,
          0, // GST calculation if needed
          detailedTransaction.insertId
        ]
      );
      
      await db.query(
        `INSERT INTO dmt_fund_transfers (user_id, remitter_mobile, beneficiary_id, amount, channel, 
         transaction_id, ref_id, status, charge, gst, total_amount, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          req.user.id,
          remitterMobileNumber,
          beneficiaryId,
          parseFloat(amount),
          channel,
          transactionData.txnReferenceId || null,
          transactionData.poolReferenceId || null,
          'SUCCESS',
          actualCharges,
          0,
          parseFloat(poolData.amount || amount)
        ]
      );
      console.log("✅ Fund transfer record created");

      finalStatus = "success";
      finalMessage = "Transaction completed successfully";
      finalLineId = currentline.id;

    } else {
      console.log("❌ Transaction failed with status code:", response.data.statuscode);
      if(response.data.statuscode === "EOP") {
        finalMessage = apiData.status;
      }
      
      // Update detailed transaction record with failure reason
      await db.query(
        `UPDATE dmt_transaction_details SET 
         failure_reason = ?,
         status = 'FAILED'
         WHERE id = ?`,
        [
          apiResponseData.status || "Transaction failed",
          detailedTransaction.insertId
        ]
      );
      
      finalStatus = "failed";
     // finalMessage = response.data.status || "Transaction failed";
      
      console.log("✅ User balance reverted due to transaction failure");
      console.log("❌ Transaction failed with status:", response.data.statuscode);
    }
console.log("Final Status:", finalStatus);
console.log("Final Message:", finalMessage);




   let retailerAddition = 0;
  let parentAddtion = 0;
  let supperAddition = 0;

  
  if (finalStatus == "failed") {
    finalMessage = apiData.status;
    console.log("Transaction failed, reverting changes...");
    const [updateRecharge] = await db.query(
      `UPDATE recharges SET status = ?, txnid =? ,message = ? ,user_new_balance = user_new_balance + ?, completed_at = ? WHERE id = ?`,
      [finalStatus, apiData.orderid, finalMessage, totalDeduction, new Date(), rechargeId]
    );

    console.log("updateRecharge", updateRecharge);

    const [updateUser] = await db.query(
      `UPDATE users SET balance = balance + ? WHERE id = ?`,
      [totalDeduction, userId]
    );

    //update recharge gigs
      await db.query(
      `UPDATE recharge_gigs SET status = ?, response = ?, response_complete = ?, message = ? WHERE id = ?`,
      [
        finalStatus,
        JSON.stringify(apiData),
        1, // Set response_complete to 1 (true) or appropriate value
        finalMessage ?? "Transaction Failed",
        gigId
      ]
    );
    
    // Update detailed transaction record for failed transaction
    await db.query(
      `UPDATE dmt_transaction_details SET 
       status = 'FAILED',
       failure_reason = ?,
       user_balance_after = user_balance_before
       WHERE recharge_id = ?`,
      [finalMessage, rechargeId]
    );

     throw new ApiError(400, finalMessage || "Transaction failed");
    
  } else if (finalStatus == "success") {
    console.log("success");
   const result1 = await calculateUserMargins({
        userId: user.id,
        parentId: user.parent_id,
        keywordId: keywordId,
        amount: amount,
        linesMargin: currentline.margin_status === 1 ? currentline : null
      });

     // console.log("Calculated Margins:", result);

      result1.retailerAddition =
        result1.retailerAddition +
        (currentline.is_charges_by_user === 1
          ? currentline.is_additional_charges_fixed === 1
            ? parseFloat(currentline.additional_charges)
            : amount * (parseFloat(currentline.additional_charges) / 100)
          : 0);

      const admin_margin =
        (currentline.admin_margin * amount) / 100 -
        result1.retailerAddition -
        result1.parentAddition -
        result1.superAddition +
        (currentline.is_charges_by_admin === 1
          ? currentline.is_additional_charges_fixed === 1
            ? parseFloat(currentline.additional_charges)
            : amount * (parseFloat(currentline.additional_charges) / 100)
          : 0);


      const result2 = await calculateUserMargins({
        userId: user.id,
        parentId: user.parent_id,
        keywordId: dmtChargeKeywordId,
        amount: amount,
        linesMargin: currentline.margin_status === 1 ? currentline : null
      });

      const result = {
        retailerAddition: result1.retailerAddition + result2.retailerAddition,
        parentAddition: result1.parentAddition + result2.parentAddition,
        superAddition: result1.superAddition + result2.superAddition,
        superParentId: user.super_parent_id,
        isDirect: user.is_direct_margin === 1
      };

      console.log("Calculated Margins:", result);
    const [updateRecharge] = await db.query(
      `UPDATE recharges SET status = ?, deducted_amount = deducted_amount -?,user_new_balance = user_new_balance +?, txnid =? , opId = ? ,message = ? , com_retailer = ?,com_parent = ?, com_superparent = ? , com_admin = ?,  parent_id =?, superparent_id = ?, completed_at = ? WHERE id = ?`,
      [
        finalStatus,
        result.retailerAddition,
        result.retailerAddition,
      apiData.orderid,
       apiData.ipay_uuid,
        finalMessage ?? "Transaction Processed",
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
    
      [updateLine] = await db.query(
        `UPDATE kl_financials
       SET balance = balance - ? - ?, 
         today_profit = today_profit + ?,
         today_amount = today_amount + ?, 
         today_count = today_count + 1 
       WHERE kl_id = ?`,
        [amount, admin_margin, admin_margin, amount, finalLineId]
      );
   

    

    if (updateLine.affectedRows === 0) {
      throw new ApiError(404, "Failed to update line balance");
    }

      await db.query(
      `UPDATE recharge_gigs SET status = ?,response = ?, response_complete = ?, message = ? WHERE id = ?`,
      [
        finalStatus,
        JSON.stringify(apiData),
        JSON.stringify(apiData), // Only stringify the API response data to avoid circular structure error
        finalMessage ?? "Transaction Success",
        gigId
      ]
    );

    const [updateGigs] = await db.query(
      `UPDATE recharge_gigs SET status = ?, new_balance = ?,  message = ? WHERE rech_id = ? and line_id = ?`,
      [
        finalStatus,
        balance - amount - admin_margin,
        finalMessage ?? "Transaction Processed",
        rechargeId,
        finalLineId
      ]
    );
    
    // Update detailed transaction record with commission details
    await db.query(
      `UPDATE dmt_transaction_details SET 
       status = 'SUCCESS',
       commission_earned = ?,
       user_balance_after = user_balance_before - ? + ?
       WHERE recharge_id = ?`,
      [
        result.retailerAddition,
        totalDeduction,
        result.retailerAddition,
        rechargeId
      ]
    );
    
  } else {
    const [updateRecharge] = await db.query(
      `UPDATE recharges SET status = ?, txnid =? ,message = ? , completed_at = ? WHERE id = ?`,
      [finalStatus, finalFilters?.tid, finalMessage, new Date(), rechargeId]
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
        [finalStatus, finalLineBalance ?? 0, finalMessage, rechargeId, finalLineId]
      );
    }

    // Update detailed transaction record for pending status
    await db.query(
      `UPDATE dmt_transaction_details SET 
       status = 'PENDING'
       WHERE recharge_id = ?`,
      [rechargeId]
    );
  }

   



    console.log("📤 Sending response to client...");
    return res.status(200).json(new ApiResponse(200, apiData, "Transaction completed successfully"));


  // } catch (error) {
  //   console.error("❌ DMT Transaction Error occurred:");
  //   console.error("❌ Error message:", error.message);
  //   console.error("❌ Error stack:", error.stack);
  //   console.error("❌ API Response data:", error.response?.data);
  //   console.error("❌ API Response status:", error.response?.status);

  //   console.log("💾 Logging error to database...");
  //   // Log error in database
  //   await db.query(
  //     `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
  //      VALUES (?, ?, ?, ?, ?, NOW())`,
  //     [
  //       req.user.id,
  //       'transaction',
  //       JSON.stringify({ remitterMobileNumber, beneficiaryId, amount, otp }),
  //       JSON.stringify({ error: error.message }),
  //       'ERROR'
  //     ]
  //   );
  //   console.log("✅ Error logged to database");

  //   throw new ApiError(500, error.response?.data?.status || "Transaction failed");
  // }
});



// Sync bank list from InstantPay API
const syncBankList = asyncHandler(async (req, res) => {
  console.log("=== DMT Bank List Sync Started ===");
  console.log("⏰ Timestamp:", new Date().toISOString());

  try {
    console.log("🌐 Calling InstantPay Bank Details API...");
    // Call InstantPay Bank Details API

    const response = await axios.post(
      `${IPAY_BASE_URL}/banks`,
      {},
      { headers: createInstantPayHeaders("106.205.157.47") }
    );

  //  console.log("response", response);

    const apiData = response.data;
    console.log("=== InstantPay Bank Details Response ===");
    console.log("📥 HTTP Status:", response.status);
    console.log("📥 API Status Code:", apiData.statuscode);
    console.log("📥 API Status Message:", apiData.status);
    console.log("📥 Number of banks:", apiData.data?.length || 0);

    if (apiData.statuscode === "TXN" && apiData.data && Array.isArray(apiData.data)) {
      console.log("💾 Processing bank data for database storage...");
      
      // Clear existing banks (optional - or you can update existing ones)
      console.log("🗑️ Clearing existing bank records...");
      await db.query("DELETE FROM banks");
      
      console.log("➕ Inserting new bank records...");
      let insertedCount = 0;
      
      for (const bank of apiData.data) {
        try {
          // Check if bank already exists
          const [existingBank] = await db.query(
            "SELECT bank_id FROM banks WHERE bank_id = ?",
            [bank.bankId || bank.id]
          );

          if (existingBank.length > 0) {
            // Update existing bank
            await db.query(
              `UPDATE banks SET 
                bank_name = ?, 
                ifsc_alias = ?, 
                ifsc_global = ?, 
                neft_enabled = ?, 
                neft_failure_rate = ?, 
                imps_enabled = ?, 
                imps_failure_rate = ?, 
                upi_enabled = ?, 
                upi_failure_rate = ?, 
                is_active = 1, 
                updated_at = NOW()
               WHERE bank_id = ?`,
              [
                bank.name || bank.bankName,
                bank.ifscAlias || null,
                bank.ifscGlobal || null,
                bank.neftEnabled || 0,
                bank.neftFailureRate || '0',
                bank.impsEnabled || 0,
                bank.impsFailureRate || '0',
                bank.upiEnabled || 0,
                bank.upiFailureRate || '0',
                bank.bankId || bank.id
              ]
            );
          } else {
            // Insert new bank
            await db.query(
              `INSERT INTO banks (bank_id, bank_name, ifsc_alias, ifsc_global, neft_enabled, neft_failure_rate, 
               imps_enabled, imps_failure_rate, upi_enabled, upi_failure_rate, is_active, created_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
              [
                bank.bankId || bank.id,
                bank.name || bank.bankName,
                bank.ifscAlias || null,
                bank.ifscGlobal || null,
                bank.neftEnabled || 0,
                bank.neftFailureRate || '0',
                bank.impsEnabled || 0,
                bank.impsFailureRate || '0',
                bank.upiEnabled || 0,
                bank.upiFailureRate || '0',
                1
              ]
            );
          }
          insertedCount++;
        } catch (insertError) {
         console.error("❌ Error inserting bank:", bank, insertError.message);
        }
      }
      
      console.log(`✅ Successfully inserted ${insertedCount} banks`);
      
      // Log sync success
      await db.query(
        `INSERT INTO bank_sync_log (sync_date, total_banks, status, created_at) 
         VALUES (NOW(), ?, 'SUCCESS', NOW())`,
        [insertedCount]
      );
      
      console.log("✅ Bank sync completed successfully");
      
      if (res) {
        return res.status(200).json(
          new ApiResponse(200, {
            totalBanks: insertedCount,
            syncTime: new Date().toISOString(),
            status: "success"
          }, "Bank list synced successfully")
        );
      }
      
      return { success: true, totalBanks: insertedCount };
      
    } else {
      console.log("❌ API response indicates failure or no data");
      console.log("📊 Status code:", apiData.statuscode);
      
      // Log sync failure
      await db.query(
        `INSERT INTO bank_sync_log (sync_date, total_banks, status, error_message, created_at) 
         VALUES (NOW(), 0, 'FAILED', ?, NOW())`,
        [apiData.status || "Unknown error"]
      );
      
      if (res) {
        throw new ApiError(500, apiData.status || "Failed to fetch bank list from InstantPay");
      }
      
      return { success: false, error: apiData.status || "Failed to fetch bank list" };
    }

  } catch (error) {
    // console.error("❌ DMT Bank Sync Error occurred:");
    // console.error("❌ Error message:", error.message);
    // console.error("❌ Error stack:", error.stack);
    // console.error("❌ API Response data:", error.response?.data);
    
    // Log sync failure
    await db.query(
      `INSERT INTO bank_sync_log (sync_date, total_banks, status, error_message, created_at) 
       VALUES (NOW(), 0, 'FAILED', ?, NOW())`,
      [error.message]
    );
    
    console.log("✅ Error logged to database");
    
    if (res) {
      throw new ApiError(500, error.response?.data?.status || "Failed to sync bank list");
    }
    
    return { success: false, error: error.message };
  }
});

// Get bank list from local database
const getBankList = asyncHandler(async (req, res) => {
  console.log("=== DMT Get Bank List Started ===");
  console.log("👤 User ID:", req.user?.id);
  console.log("⏰ Timestamp:", new Date().toISOString());

  try {
    console.log("🔍 Fetching banks from database...");
    
    // Get banks from local database
    const [banks] = await db.query(
      `SELECT bank_id, bank_name, ifsc_alias, ifsc_global, neft_enabled, neft_failure_rate, 
       imps_enabled, imps_failure_rate, upi_enabled, upi_failure_rate, is_active, updated_at 
       FROM banks WHERE is_active = 1 ORDER BY bank_name ASC`
    );
    
    console.log("📊 Found banks:", banks.length);
    
    // Check when was the last sync
    const lastSync = await db.query(
      `SELECT sync_date, total_banks, status FROM bank_sync_log 
       ORDER BY sync_date DESC LIMIT 1`
    );
    
    console.log("📅 Last sync:", lastSync[0]?.sync_date || "Never");
    
    // If no banks found or last sync was more than 24 hours ago, trigger sync
    const shouldSync = banks.length === 0 || 
                      !lastSync[0] || 
                      (new Date() - new Date(lastSync[0].sync_date)) > (24 * 60 * 60 * 1000);
    
    if (shouldSync) {
      console.log("🔄 Bank list is outdated or empty, triggering sync...");
      
      // Trigger background sync (don't wait for it)
      syncBankList().then(() => {
        console.log("✅ Background bank sync completed");
      }).catch(error => {
       // console.error("❌ Background bank sync failed:", error.message);
      });
    }
    
    console.log("📤 Sending bank list to client...");
    return res.status(200).json(
      new ApiResponse(200, {
        banks,
        lastSync: lastSync[0] || null,
        shouldRefresh: shouldSync
      }, "Bank list fetched successfully")
    );

  } catch (error) {
    // console.error("❌ DMT Get Bank List Error occurred:");
    // console.error("❌ Error message:", error.message);
    // console.error("❌ Error stack:", error.stack);
    
    throw new ApiError(500, "Failed to fetch bank list");
  }
});

// Force sync bank list (manual trigger)
const forceSyncBankList = asyncHandler(async (req, res) => {
  console.log("=== DMT Force Bank Sync Started ===");
  console.log("👤 User ID:", req.user.id);
  console.log("⏰ Timestamp:", new Date().toISOString());
  
  return await syncBankList(req, res);
});

// Get bank sync status
const getBankSyncStatus = asyncHandler(async (req, res) => {
  console.log("=== DMT Get Bank Sync Status ===");
  
  try {
    const syncLogs = await db.query(
      `SELECT sync_date, total_banks, status, error_message 
       FROM bank_sync_log ORDER BY sync_date DESC LIMIT 10`
    );
    
    const bankCount = await db.query(
      "SELECT COUNT(*) as count FROM banks WHERE is_active = 1"
    );
    
    return res.status(200).json(
      new ApiResponse(200, {
        currentBankCount: bankCount[0].count,
        syncHistory: syncLogs,
        lastSync: syncLogs[0] || null
      }, "Bank sync status fetched successfully")
    );

  } catch (error) {
 //   console.error("DMT Get Bank Sync Status Error:", error);
    throw new ApiError(500, "Failed to fetch bank sync status");
  }
});

// Schedule automatic bank sync (call this from a cron job or scheduler)
const scheduleAutoBankSync = async () => {
  console.log("🕒 Scheduled bank sync started");
  
  try {
    const result = await syncBankList();
   // console.log("✅ Scheduled bank sync completed:", result);
    return result;
  } catch (error) {
   // console.error("❌ Scheduled bank sync failed:", error.message);
    return { success: false, error: error.message };
  }
};

// =================== MT1 (Money Transfer 1) APIs ===================
// These APIs use the new InstantPay domesticPpi endpoints with enhanced security

const MT1_BASE_URL = "https://api.instantpay.in/fi/remit/out/domesticPpi/";

// Helper function to create MT1 InstantPay headers
const createMT1InstantPayHeaders = (endpointIp = "127.0.0.1") => {
  return {
    'X-Ipay-Auth-Code': 1,
    'X-Ipay-Client-Id': IPAY_CLIENT_ID,
    'X-Ipay-Client-Secret': IPAY_CLIENT_SECRET,
    'X-Ipay-Outlet-Id': IPAY_OUTLET_ID,
    'X-Ipay-Endpoint-Ip': "47.15.68.250",
    'Content-Type': 'application/json'
  };
};

// 1. MT1 Bank List
const mt1GetBankList = asyncHandler(async (req, res) => {
  console.log("=== MT1 Bank List Started ===");
  
  try {
    const response = await axios.post(
      `${MT1_BASE_URL}banks`,
      {},
      { headers: createMT1InstantPayHeaders() }
    );

    const apiData = response.data;
    console.log("MT1 Bank List Response:", apiData);

    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'mt1BankList',
        JSON.stringify({}),
        JSON.stringify(apiData),
        apiData.statuscode || 'UNKNOWN'
      ]
    );

    return res.status(200).json(
      new ApiResponse(200, apiData, "MT1 Bank list fetched successfully")
    );

  } catch (error) {
    console.error("MT1 Bank List Error:", error);
    
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [req.user.id, 'mt1BankList', JSON.stringify({}), JSON.stringify({ error: error.message }), 'ERROR']
    );

    throw new ApiError(500, error.response?.data?.status || "Failed to fetch MT1 bank list");
  }
});

// 2. MT1 Remitter Profile
const mt1CheckRemitterProfile = asyncHandler(async (req, res) => {
  const { mobileNumber, referenceKey, otp } = req.body;

  console.log("=== MT1 Remitter Profile Started ===");
  console.log("Mobile Number:", mobileNumber);

  if (!mobileNumber) {
    throw new ApiError(400, "Mobile number is required");
  }

  try {
    const requestData = {
      mobileNumber,
      ...(referenceKey && { referenceKey }),
      ...(otp && { otp })
    };

    const response = await axios.post(
      `${MT1_BASE_URL}remitterProfile`,
      requestData,
      { headers: createMT1InstantPayHeaders() }
    );

    const apiData = response.data;
    console.log("MT1 Remitter Profile Response:", apiData);

    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'mt1RemitterProfile',
        JSON.stringify(requestData),
        JSON.stringify(apiData),
        apiData.statuscode || 'UNKNOWN'
      ]
    );

    

    // If successful and has beneficiaries, sync them with database
    if (apiData.statuscode === "TXN" && apiData.data?.beneficiaries) {
      console.log("👥 Synchronizing MT1 beneficiaries...");
      const syncResult = await syncBeneficiariesWithDatabase(
        req.user.id,
        mobileNumber,
        apiData.data.beneficiaries
      );
      console.log("✅ MT1 Beneficiaries synchronized:", syncResult.syncResults);
      
      // Add sync info to response
      apiData.syncInfo = syncResult.syncResults;
    }

    return res.status(200).json(
      new ApiResponse(200, apiData, "MT1 Remitter profile checked successfully")
    );

  } catch (error) {
    console.error("MT1 Remitter Profile Error:", error);
    
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [req.user.id, 'mt1RemitterProfile', JSON.stringify({ mobileNumber }), JSON.stringify({ error: error.message }), 'ERROR']
    );

    throw new ApiError(500, error.response?.data?.status || "Failed to check MT1 remitter profile");
  }
});

// 3. MT1 Remitter Registration
const mt1RegisterRemitter = asyncHandler(async (req, res) => {
  let { mobileNumber, aadhaarNumber, referenceKey, pan, authType } = req.body;

  console.log("=== MT1 Remitter Registration Started ===");
  console.log("Mobile Number:", mobileNumber);
  console.log("PAN:", pan || 'Not provided');
  console.log("Auth Type:", authType);

  if (!mobileNumber || !aadhaarNumber || !referenceKey || !authType || !pan) {
    throw new ApiError(400, "Mobile number, Aadhaar number, reference key, auth type, and PAN are required for MT1 remitter registration");
  }

  // PAN is now required for MT1
  if (typeof pan !== 'string' || pan.trim().length === 0) {
    throw new ApiError(400, "PAN is required and must be a valid string");
  }

  authType = "OTP";
  try {
    // Encrypt Aadhaar number using the available encryption function
    const encryptedAadhaar = encryptAadhaar(aadhaarNumber);
    console.log("Aadhaar encrypted successfully");

    const requestData = {
      mobileNumber,
      encryptedAadhaar,
      referenceKey,
      pan: pan.toUpperCase(), // PAN is now required for MT1
      authType // Use the authType from frontend ("BIOAUTH" or "OTP")
    };

    const response = await axios.post(
      `${MT1_BASE_URL}remitterRegistration`,
      requestData,
      { headers: createMT1InstantPayHeaders() }
    );

    const apiData = response.data;
    console.log("MT1 Remitter Registration Response:", apiData);

    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'mt1RemitterRegistration',
        JSON.stringify({ 
          mobileNumber, 
          aadhaar: "***ENCRYPTED***", 
          pan: pan ? pan.toUpperCase() : 'Not provided', 
          authType, 
          referenceKey 
        }),
        JSON.stringify(apiData),
        apiData.statuscode || 'UNKNOWN'
      ]
    );

    return res.status(200).json(
      new ApiResponse(200, apiData, "MT1 Remitter registration initiated successfully")
    );

  } catch (error) {
    console.error("MT1 Remitter Registration Error:", error);
    
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [req.user.id, 'mt1RemitterRegistration', JSON.stringify({ mobileNumber, pan: pan || 'Not provided', authType }), JSON.stringify({ error: error.message }), 'ERROR']
    );

    throw new ApiError(500, error.response?.data?.status || "Failed to register MT1 remitter");
  }
});

// 4. MT1 Remitter Registration Verify
const mt1VerifyRemitterRegistration = asyncHandler(async (req, res) => {
  const { mobileNumber, referenceKey, latitude, longitude, externalRef, otp } = req.body;

  console.log("=== MT1 Remitter Registration Verify Started ===");
  console.log("Mobile Number:", mobileNumber);

  if (!mobileNumber || !referenceKey || !latitude || !longitude || !externalRef || !otp) {
    throw new ApiError(400, "All fields are required for MT1 remitter registration verification");
  }

  await checkMoneyTransferOperator();

  let userId = req.user.id;
  const balance1 = req.user.balance;
  let balance = parseFloat(balance1);

  // Get keyword details for verification
  const [keywordRows] = await db.query("SELECT * FROM keywords WHERE description = ? and status = 1", [
    'Verification'
  ]);
  if (keywordRows.length === 0) throw new ApiError(404, "Verification keyword not found");

  const keywordDetails = keywordRows[0];
  let keywordId = keywordDetails.id;

  let [[currentline]] = await db.query(
    `SELECT kl.* from keyword_lines as kl
    JOIN kl_financials kf ON kf.kl_id = kl.id
    WHERE kl.keyword_id = ? 
      AND kl.status = 1 
      AND kf.today_amount < COALESCE(kf.daily_max_amount, 9999999)
      AND kf.today_count < COALESCE(kf.daily_max_count, 9999999)
    ORDER BY kl.priority ASC
    `,
    [keywordId]
  );

  if (!currentline || currentline.length === 0) {
    throw new ApiError(404, "Verification service not available, please try again later");
  }

  const result = await calculateUserMargins({
    userId: userId,
    parentId: req.user.parent_id,
    keywordId: keywordId,
    amount: 0,
    linesMargin: currentline.margin_status === 1 ? currentline : null
  });

  console.log("Calculated Margins:", result);

  // Deduct the retailer margin now
  let amount = result.retailerAddition;

  if (balance < amount) {
    throw new ApiError(400, "Insufficient balance to proceed with MT1 remitter verification");
  }

  // Update user balance
  await db.query(
    `UPDATE users SET balance = balance - ? WHERE id = ?`,
    [amount, userId]
  );

  const [addRecharge] = await db.query(
    `INSERT INTO recharges (user_id, keyword_id, account, number, amount, deducted_amount, user_prev_balance, user_new_balance, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      keywordId,
      mobileNumber,
      mobileNumber,
      amount,
      amount,
      balance,
      balance - amount,
      "pending"
    ]
  );

  console.log("Recharge added to database:", addRecharge);

  const rechargeId = addRecharge.insertId;
  console.log("Recharge ID:", rechargeId);

  try {
    const requestData = {
      mobileNumber,
      referenceKey,
      latitude,
      longitude,
      externalRef,
      otp
    };

    const response = await axios.post(
      `${MT1_BASE_URL}remitterRegistrationVerify`,
      requestData,
      { headers: createMT1InstantPayHeaders() }
    );

    const apiData = response.data;
    console.log("MT1 Remitter Registration Verify Response:", apiData);

    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'mt1RemitterRegistrationVerify',
        JSON.stringify({ ...requestData, otp: "***HIDDEN***" }),
        JSON.stringify(apiData),
        apiData.statuscode || 'UNKNOWN'
      ]
    );

    // Add recharge gigs entry
    const [addgigs] = await db.query(
      "INSERT INTO recharge_gigs (rech_id, user_id, line_id, api_id, provider_id, amount, prev_balance, config, request, response, response_complete ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        rechargeId,
        userId,
        currentline.id,
        currentline.recharge_api,
        currentline.api_provider,
        amount,
        currentline.balance,
        "MT1 Verification",
        JSON.stringify(requestData),
        JSON.stringify(apiData),
        JSON.stringify(apiData)
      ]
    );

    const gigId = addgigs.insertId;

    // If registration verification is successful (TXN), automatically fetch remitter profile
    if (apiData.statuscode === 'TXN') {
      console.log("✅ Registration verification successful! Fetching remitter profile...");
      
      // Update recharge status to success
      await db.query(
        `UPDATE recharges SET status = 'success', reqid = ?, updated_at = NOW() 
         WHERE id = ?`,
        [rechargeId, rechargeId]
      );

      // Update recharge gigs
      await db.query(
        `UPDATE recharge_gigs SET status = 'success', updated_at = NOW(), message = ?
          WHERE id = ?`,
        ["MT1 Remitter verification success " + apiData.status, gigId]
      );



      
      // try {
      //   // Call remitter profile to get the complete profile data
      //   const profileResponse = await axios.post(
      //     `${MT1_BASE_URL}remitterProfile`,
      //     { mobileNumber },
      //     { headers: createMT1InstantPayHeaders() }
      //   );

      //   const profileData = profileResponse.data;
      //   console.log("MT1 Remitter Profile After Registration:", profileData);

      //   // Log profile fetch call
      //   await db.query(
      //     `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
      //      VALUES (?, ?, ?, ?, ?, NOW())`,
      //     [
      //       req.user.id,
      //       'mt1RemitterProfile_AfterRegistration',
      //       JSON.stringify({ mobileNumber }),
      //       JSON.stringify(profileData),
      //       profileData.statuscode || 'UNKNOWN'
      //     ]
      //   );

      //   // Return combined response with registration verification and profile data
        return res.status(200).json(
          new ApiResponse(200, apiData, "MT1 Remitter registration verified and profile fetched successfully")
        );

      // } catch (profileError) {
      //   console.error("❌ Error fetching profile after registration:", profileError);
        
      //   // Return just the registration verification result if profile fetch fails
      //   return res.status(200).json(
      //     new ApiResponse(200, apiData, "MT1 Remitter registration verified successfully, but failed to fetch profile")
      //   );
      // }
    } else {
      console.log("⚠️ MT1 verification failed");
      console.log("⚠️ Status code received:", apiData.statuscode);

      // Return the user amount
      await db.query(
        `UPDATE users SET balance = balance + ? WHERE id = ?`,
        [amount, userId]
      );

      // Update recharge status
      await db.query(
        `UPDATE recharges SET status = 'failed', deducted_amount = ?, updated_at = NOW() 
         WHERE id = ?`,
        [0, rechargeId]
      );

      // Update recharge gigs
      await db.query(
        `UPDATE recharge_gigs SET status = 'failed', updated_at = NOW(), message = ?
          WHERE id = ?`,
        ["MT1 Remitter verification failed: " + apiData.status, gigId]
      );

      // Return registration verification result for other status codes
      return res.status(200).json(
        new ApiResponse(200, apiData, "MT1 Remitter registration verification response")
      );
    }

  } catch (error) {
    console.error("MT1 Remitter Registration Verify Error:", error);
    
    // Return the user amount on error
    await db.query(
      `UPDATE users SET balance = balance + ? WHERE id = ?`,
      [amount, userId]
    );

    // Update recharge status to failed
    await db.query(
      `UPDATE recharges SET status = 'failed', deducted_amount = ?, updated_at = NOW() 
       WHERE id = ?`,
      [0, rechargeId]
    );
    
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [req.user.id, 'mt1RemitterRegistrationVerify', JSON.stringify({ mobileNumber, externalRef }), JSON.stringify({ error: error.message }), 'ERROR']
    );

    throw new ApiError(500, error.response?.data?.status || "Failed to verify MT1 remitter registration");
  }
});

// 5. MT1 Remitter KYC
const mt1RemitterKyc = asyncHandler(async (req, res) => {
  const { 
    mobileNumber, 
    referenceKey, 
    latitude, 
    longitude, 
    externalRef, 
    consentTaken, 
    captureType, 
    biometricData 
  } = req.body;

  console.log("=== MT1 Remitter KYC Started ===");
  console.log("Mobile Number:", mobileNumber);
  console.log("Capture Type:", captureType);

  if (!mobileNumber || !referenceKey || !latitude || !longitude || !externalRef || !biometricData) {
    throw new ApiError(400, "All fields are required for MT1 remitter KYC");
  }

  try {
    const requestData = {
      mobileNumber,
      referenceKey,
      latitude,
      longitude,
      externalRef,
      consentTaken: consentTaken || "Y",
      captureType: captureType || "FINGER",
      biometricData
    };

    const response = await axios.post(
      `${MT1_BASE_URL}remitterKyc`,
      requestData,
      { headers: createMT1InstantPayHeaders() }
    );

    const apiData = response.data;
    console.log("MT1 Remitter KYC Response:", apiData);

    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'mt1RemitterKyc',
        JSON.stringify({ ...requestData, biometricData: "***BIOMETRIC_DATA***" }),
        JSON.stringify(apiData),
        apiData.statuscode || 'UNKNOWN'
      ]
    );

    return res.status(200).json(
      new ApiResponse(200, apiData, "MT1 Remitter KYC completed successfully")
    );

  } catch (error) {
    console.error("MT1 Remitter KYC Error:", error);
    
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [req.user.id, 'mt1RemitterKyc', JSON.stringify({ mobileNumber, externalRef }), JSON.stringify({ error: error.message }), 'ERROR']
    );

    throw new ApiError(500, error.response?.data?.status || "Failed to complete MT1 remitter KYC");
  }
});

// 6. MT1 Beneficiary List
const mt1GetBeneficiaryList = asyncHandler(async (req, res) => {
  const { remitterMobileNumber, referenceKey, isSyncMode } = req.body;

  console.log("=== MT1 Beneficiary List Started ===");
  console.log("Remitter Mobile:", remitterMobileNumber);

  if (!remitterMobileNumber || !referenceKey) {
    throw new ApiError(400, "Remitter mobile number and reference key are required");
  }

  try {
    const requestData = {
      remitterMobileNumber,
      referenceKey,
      isSyncMode: isSyncMode !== undefined ? isSyncMode : true
    };

    const response = await axios.post(
      `${MT1_BASE_URL}beneficiaryList`,
      requestData,
      { headers: createMT1InstantPayHeaders() }
    );

    const apiData = response.data;
    console.log("MT1 Beneficiary List Response:", apiData);

    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'mt1BeneficiaryList',
        JSON.stringify(requestData),
        JSON.stringify(apiData),
        apiData.statuscode || 'UNKNOWN'
      ]
    );

    // If successful and has beneficiaries, sync them with database
    if (apiData.statuscode === "TXN" && apiData.data?.beneficiaries) {
      console.log("👥 Synchronizing MT1 beneficiary list...");
      const syncResult = await syncBeneficiariesWithDatabase(
        req.user.id,
        remitterMobileNumber,
        apiData.data.beneficiaries
      );
      console.log("✅ MT1 Beneficiary list synchronized:", syncResult.syncResults);
      
      // Replace API beneficiaries with merged database beneficiaries (includes verification status)
      apiData.data.beneficiaries = syncResult.beneficiaries;
      apiData.syncInfo = syncResult.syncResults;
    }

    return res.status(200).json(
      new ApiResponse(200, apiData, "MT1 Beneficiary list fetched successfully")
    );

  } catch (error) {
    console.error("MT1 Beneficiary List Error:", error);
    
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [req.user.id, 'mt1BeneficiaryList', JSON.stringify({ remitterMobileNumber }), JSON.stringify({ error: error.message }), 'ERROR']
    );

    throw new ApiError(500, error.response?.data?.status || "Failed to fetch MT1 beneficiary list");
  }
});

// 7. MT1 Beneficiary Registration
const mt1RegisterBeneficiary = asyncHandler(async (req, res) => {
  const { remitterMobileNumber, referenceKey, accountNumber, ifsc, bankId, name } = req.body;

  await checkMoneyTransferOperator();

  console.log("=== MT1 Beneficiary Registration Started ===");
  console.log("Remitter Mobile:", remitterMobileNumber);
  console.log("Beneficiary Name:", name);

  if (!remitterMobileNumber || !referenceKey || !accountNumber || !ifsc || !bankId || !name) {
    throw new ApiError(400, "All fields are required for MT1 beneficiary registration");
  }

  await checkMoneyTransferOperator();

  try {
    // Call MT1 beneficiary registration API directly without bank verification
    console.log("🏦 Calling MT1 beneficiary registration...");
    
    const requestData = {
      remitterMobileNumber,
      referenceKey,
      accountNumber,
      ifsc,
      bankId,
      name
    };

    const response = await axios.post(
      `${MT1_BASE_URL}beneficiaryRegistration`,
      requestData,
      { headers: createMT1InstantPayHeaders() }
    );

    const apiData = response.data;
    console.log("MT1 Beneficiary Registration Response:", apiData);

    // Log the MT1 beneficiary registration API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'mt1BeneficiaryRegistration',
        JSON.stringify(requestData),
        JSON.stringify(apiData),
        apiData.statuscode || 'UNKNOWN'
      ]
    );

    // If registration is successful, save to local database
    if (apiData.statuscode === "TXN" || apiData.statuscode === "OTP") {
      const beneficiaryId = apiData.data?.beneficiaryId;
      if (beneficiaryId) {
        console.log("💾 Saving beneficiary to local database...");
        console.log("💾 Beneficiary ID:", beneficiaryId);

        // Get bank name from database
        const [[banks]] = await db.query(
          `SELECT bank_id, bank_name FROM banks WHERE bank_id = ?`,
          [bankId] 
        );
        console.log("Bank Name:", banks?.bank_name);
        
        await db.query(
          `INSERT INTO dmt_beneficiaries (user_id, mobile_number, beneficiary_id, name, 
           account_number, ifsc, bank_name, beneficiary_mobile, bank_verification_status, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NOT_VERIFIED', NOW()) 
           ON DUPLICATE KEY UPDATE name = VALUES(name), bank_name = VALUES(bank_name), updated_at = NOW()`,
          [
            req.user.id,
            remitterMobileNumber,
            beneficiaryId,
            name,
            accountNumber,
            ifsc,
            banks?.bank_name || 'Unknown Bank',
            ''  // beneficiaryMobileNumber - not available in MT1
          ]
        );
        console.log("✅ Beneficiary saved to local database with NOT_VERIFIED status");
      }
    }

    return res.status(200).json(
      new ApiResponse(200, apiData, "MT1 Beneficiary registration initiated successfully")
    );

  } catch (error) {
    console.error("MT1 Beneficiary Registration Error:", error);
    
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [req.user.id, 'mt1BeneficiaryRegistration', JSON.stringify({ remitterMobileNumber, name, accountNumber }), JSON.stringify({ error: error.message }), 'ERROR']
    );

    throw new ApiError(500, error.response?.data?.status || "Failed to register MT1 beneficiary");
  }
});

// 8. MT1 Beneficiary Delete
const mt1DeleteBeneficiary = asyncHandler(async (req, res) => {
  const { remitterMobileNumber, referenceKey, beneficiaryId, deleteType = 'soft' } = req.body;

  console.log("=== MT1 Beneficiary Delete Started ===");
  console.log("Remitter Mobile:", remitterMobileNumber);
  console.log("Beneficiary ID:", beneficiaryId);

  if (!remitterMobileNumber || !referenceKey || !beneficiaryId) {
    throw new ApiError(400, "All fields are required for MT1 beneficiary deletion");
  }

  try {
    const requestData = {
      remitterMobileNumber,
      referenceKey,
      beneficiaryId
    };

    const response = await axios.post(
      `${MT1_BASE_URL}beneficiaryDelete`,
      requestData,
      { headers: createMT1InstantPayHeaders() }
    );

    const apiData = response.data;
    console.log("MT1 Beneficiary Delete Response:", apiData);

    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'mt1BeneficiaryDelete',
        JSON.stringify(requestData),
        JSON.stringify(apiData),
        apiData.statuscode || 'UNKNOWN'
      ]
    );

    // If deletion is successful or requires OTP, prepare for database deletion
    if (apiData.statuscode === "TXN") {
      // Direct success - delete immediately
      console.log(`🗑️ MT1 Direct success - ${deleteType === 'hard' ? 'Hard' : 'Soft'} deleting beneficiary from database`);
      await deleteBeneficiaryFromDatabase(req.user.id, remitterMobileNumber, beneficiaryId, deleteType);
    } else if (apiData.statuscode === "OTP") {
      // OTP required - store beneficiaryId in session/temporary storage for later deletion
      console.log("🔄 MT1 OTP required - beneficiary will be deleted after OTP verification");
      // Note: Actual deletion will happen in mt1VerifyBeneficiaryDelete after OTP verification
    }

    return res.status(200).json(
      new ApiResponse(200, apiData, "MT1 Beneficiary deletion initiated successfully")
    );

  } catch (error) {
    console.error("MT1 Beneficiary Delete Error:", error);
    
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [req.user.id, 'mt1BeneficiaryDelete', JSON.stringify({ remitterMobileNumber, beneficiaryId }), JSON.stringify({ error: error.message }), 'ERROR']
    );

    throw new ApiError(500, error.response?.data?.status || "Failed to delete MT1 beneficiary");
  }
});

// 9. MT1 Beneficiary Delete Verify
const mt1VerifyBeneficiaryDelete = asyncHandler(async (req, res) => {
  const { remitterMobileNumber, referenceKey, otp, beneficiaryId, deleteType = 'soft' } = req.body;

  console.log("=== MT1 Beneficiary Delete Verify Started ===");
  console.log("Remitter Mobile:", remitterMobileNumber);
  console.log("Beneficiary ID:", beneficiaryId);

  if (!remitterMobileNumber || !referenceKey || !otp) {
    throw new ApiError(400, "Remitter mobile, reference key and OTP are required for MT1 beneficiary delete verification");
  }

  try {
    const requestData = {
      remitterMobileNumber,
      referenceKey,
      otp
    };

    const response = await axios.post(
      `${MT1_BASE_URL}beneficiaryDeleteVerify`,
      requestData,
      { headers: createMT1InstantPayHeaders() }
    );

    const apiData = response.data;
    console.log("MT1 Beneficiary Delete Verify Response:", apiData);

    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'mt1BeneficiaryDeleteVerify',
        JSON.stringify({ ...requestData, otp: "***HIDDEN***" }),
        JSON.stringify(apiData),
        apiData.statuscode || 'UNKNOWN'
      ]
    );

    // If deletion verification is successful and beneficiaryId is provided, delete from database
    if (apiData.statuscode === "TXN" && beneficiaryId) {
      console.log(`🗑️ MT1 Delete verified - ${deleteType === 'hard' ? 'Hard' : 'Soft'} deleting beneficiary from database`);
      await deleteBeneficiaryFromDatabase(req.user.id, remitterMobileNumber, beneficiaryId, deleteType);
    }

    return res.status(200).json(
      new ApiResponse(200, apiData, "MT1 Beneficiary deletion verified successfully")
    );

  } catch (error) {
    console.error("MT1 Beneficiary Delete Verify Error:", error);
    
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [req.user.id, 'mt1BeneficiaryDeleteVerify', JSON.stringify({ remitterMobileNumber }), JSON.stringify({ error: error.message }), 'ERROR']
    );

    throw new ApiError(500, error.response?.data?.status || "Failed to verify MT1 beneficiary deletion");
  }
});

// 10. MT1 Generate Transaction OTP
const mt1GenerateTransactionOtp = asyncHandler(async (req, res) => {
  const { remitterMobileNumber, referenceKey, beneficiaryId, amount } = req.body;

  console.log("=== MT1 Generate Transaction OTP Started ===");
  console.log("Remitter Mobile:", remitterMobileNumber);
  console.log("Beneficiary ID:", beneficiaryId);
  console.log("Amount:", amount);

  if (!remitterMobileNumber || !referenceKey || !beneficiaryId || !amount) {
    throw new ApiError(400, "All fields are required for MT1 transaction OTP generation");
  }

 // try {
    const requestData = {
      remitterMobileNumber,
      referenceKey,
      beneficiaryId,
      amount: parseFloat(amount)
    };

    const response = await axios.post(
      `${MT1_BASE_URL}generateTransactionOtp`,
      requestData,
      { headers: createMT1InstantPayHeaders() }
    );

    const apiData = response.data;
    console.log("MT1 Generate Transaction OTP Response:", apiData);

    if( apiData.statuscode !== "TXN" && apiData.statuscode !== "OTP") {
      console.log("❌ Failed to generate MT1 transaction OTP:", apiData.status);
      throw new ApiError(400, apiData.status);
    }

    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'mt1GenerateTransactionOtp',
        JSON.stringify(requestData),
        JSON.stringify(apiData),
        apiData.statuscode || 'UNKNOWN'
      ]
    );

    return res.status(200).json(
      new ApiResponse(200, apiData, "MT1 Transaction OTP generated successfully")
    );

  // } catch (error) {
  //   console.error("MT1 Generate Transaction OTP Error:", error);
    
  //   await db.query(
  //     `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
  //      VALUES (?, ?, ?, ?, ?, NOW())`,
  //     [req.user.id, 'mt1GenerateTransactionOtp', JSON.stringify({ remitterMobileNumber, beneficiaryId, amount }), JSON.stringify({ error: error.message }), 'ERROR']
  //   );

  //   throw new ApiError(500, error.response?.data?.status || "Failed to generate MT1 transaction OTP");
  // }
});

// 11. MT1 Transaction
const mt1Transaction = asyncHandler(async (req, res) => {
  let { 
    remitterMobileNumber, 
    accountNumber, 
    ifsc, 
    transferMode, 
    transferAmount, 
    latitude, 
    longitude, 
    referenceKey, 
    otp, 
    externalRef,
    beneficiaryId,
    beneficiaryName
  } = req.body;

  console.log("req.body:", req.body);

  console.log("=== MT1 Transaction Started ===");
  console.log("📱 Remitter Mobile:", remitterMobileNumber);
  console.log("💰 Transfer Amount:", transferAmount);
  console.log("🔄 Transfer Mode:", transferMode);
  console.log("🏦 Account Number:", accountNumber);
  console.log("🏦 IFSC:", ifsc);
  console.log("🔢 OTP:", otp ? "***PROVIDED***" : "Not provided");
  console.log("👤 User ID:", req.user.id);
  console.log("🌐 Request IP:", req.ip);
  console.log("⏰ Timestamp:", new Date().toISOString());

  let account = accountNumber;

  if (!remitterMobileNumber || !accountNumber || !ifsc || !transferMode || !transferAmount  || !referenceKey || !otp || !externalRef) {
    console.log("❌ Validation failed: Missing required fields");
    throw new ApiError(400, "All fields are required for MT1 transaction");
  }

  // Validate amount
  let amount = parseFloat(transferAmount);
  if (amount < 1 || amount > 200000) {
    console.log("❌ Amount validation failed:", amount);
    throw new ApiError(400, "Amount should be between ₹1 and ₹2,00,000");
  }

  console.log("🔍 Checking Money Transfer operator...");
  await checkMoneyTransferOperator();

  let userId = req.user.id;
  const balance1 = req.user.balance;
  let balance = parseFloat(balance1);
  
  // Get fresh user data
  const [[user]] = await db.query(`SELECT * FROM users WHERE id = ?`, [userId]);
  balance = parseFloat(user.balance);

  if (balance < amount) {
    throw new ApiError(400, "Insufficient balance");
  }

  console.log("🔍 Looking up Money Transfer 1 keyword...");
  const [keywordRows] = await db.query("SELECT * FROM keywords WHERE description = ? and status = ?", [
    'Money Transfer 1', 1
  ]);

  if (keywordRows.length === 0) throw new ApiError(404, "Money Transfer 1 keyword not found or inactive");

  const keywordDetails = keywordRows[0];
  console.log("Keyword Details:", keywordDetails);
  let keywordId = keywordDetails.id;
  console.log("Keyword ID:", keywordId);

  // Validate account/number length and amount limits
  if (keywordDetails.min_digits > account.length)
    throw new ApiError(400, "Customer number is too short");
  if (keywordDetails.max_digits < account.length)
    throw new ApiError(400, "Customer number is too long");

  if (parseFloat(keywordDetails.min_recharge) > amount)
    throw new ApiError(400, "Amount is too low");
  if (parseFloat(keywordDetails.max_recharge) < amount)
    throw new ApiError(400, "Amount is too high");

  // Check for duplicate transactions
  const [setting] = await db.query(
    `SELECT * FROM settings WHERE key_name = ?`,
    ["time_diff"]
  );

  let seconds = parseInt(setting[0].key_value);
  seconds = seconds - 240;

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

  console.log("Old recharged transactions:", oldRecharged);
  if (oldRecharged.length > 0) {
    const createdAt = new Date(oldRecharged[0].created_at).getTime();
    const now = Date.now();
    const diff = now - createdAt;
    if (diff < seconds * 1000) {
      let remainingTime = seconds * 1000 - diff;
      let minutes = Math.floor(remainingTime / 60000);
      let secondsLeft = Math.floor((remainingTime % 60000) / 1000);
      throw new ApiError(
        400,
        `Duplicate transaction detected. Please wait before trying again after ${minutes} minutes and ${secondsLeft} seconds.`
      );
    }
  }

  console.log("🔍 Finding active lines for keyword:", keywordId);

  let [lines] = await db.query(
    `SELECT kl.*, kf.balance as balance
     from keyword_lines kl 
     JOIN kl_financials kf ON kf.kl_id = kl.id
     WHERE kl.keyword_id = ? 
       AND kl.status = 1 
       AND ABS(kf.balance) > ?
       AND kf.today_amount < COALESCE(kf.daily_max_amount, 9999999)
       AND kf.today_count < COALESCE(kf.daily_max_count, 9999999)
     ORDER BY kl.priority ASC`,
    [keywordId, amount]
  );

  console.log("Active lines found:", lines);

  if (!lines || lines.length === 0) {
    console.log("❌ No active lines found for the given amount");
    throw new ApiError(404, "No active lines found for the given amount");
  }

//fetching dmt charges

  const [dmtChargeKeyword] = await db.query(
    `SELECT keywords.* FROM keywords 
    join operators on operators.id = keywords.operator_id
    WHERE operators.code = ? AND keywords.status = 1 and keywords.min_recharge <= ? and keywords.max_recharge >= ?`,
    ['DMT1' , amount, amount]
  );


  //now get the charges for thsi keywod via the cumission sytem
  if (dmtChargeKeyword.length === 0) {
    console.log("❌ DMT charges keyword not found for the given amount");
    throw new ApiError(404, "DMT charges keyword not found for the given amount");
  }

  const dmtChargeKeywordDetails = dmtChargeKeyword[0];
  console.log("DMT Charge Keyword Details:", dmtChargeKeywordDetails);
  const dmtChargeKeywordId = dmtChargeKeywordDetails.id;
   
const [[retailerMargin]] = await db.query(
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
    [userId, userId, dmtChargeKeywordId]
  );

  console.log("dmt charge keyword" , dmtChargeKeywordId);

  console.log("Retailer Margin Details:", retailerMargin);

  // just fetch teh value of amount that should be extra in users account accordngin to retailer margin
   let retailerAdd = parseFloat(retailerMargin.margin);
   let parsedAmount = parseFloat(amount.toFixed(2));

   let retailerAddition1 =
    retailerAdd * (parsedAmount / 100) +
    (retailerMargin.is_charges_fixed
      ? parseFloat(retailerMargin.additional_charges)
      : amount * (parseFloat(retailerMargin.additional_charges) / 100));


  // Calculate the total amount to be deducted from user balance

   retailerAddition1 = parseFloat(retailerAddition1.toFixed(2));


  // Calculate initial deduction if user has flat margin
  let initialDeductedAmount = 0;
  if (user.is_flat_margin) {
    initialDeductedAmount = user.margin_rates ? (amount * user.margin_rates) / 100 : 0;
  }

  if (balance - initialDeductedAmount + retailerAddition1 < amount) {
    throw new ApiError(400, "Insufficient balance");
  }

  let totalDeduction = parseFloat(amount) + initialDeductedAmount;

  console.log("💰 Deducting balance:", totalDeduction);
  const [updateBalance] = await db.query(
    `UPDATE users SET balance = balance - ? WHERE id = ?`,
    [totalDeduction, userId]
  );
  if (updateBalance.affectedRows === 0) {
    throw new ApiError(404, "TRY AGAIN");
  }

  console.log("✅ User balance updated successfully");
  let customerNumber = remitterMobileNumber;

  const randomPart = Math.floor(Math.random() * 90) + 10;
  let reqId = `${keywordId}${userId}${Date.now().toString().slice(-5)}${randomPart}`;
  let params = {
    reqid: reqId,
    userId: userId,
    keywordId: keywordId,
    customerNumber: customerNumber,
    account: account,
    amount: amount,
    otp: otp,
    transferMode: transferMode,
    referenceKey: referenceKey || ""
  };

  const currentline = lines[0];
  console.log("Current line:", currentline);

  let finalStatus = "initiated";
  let finalMessage = "Transaction is pending";
  let finalLineId = currentline.id;

  let rechargeId = null;
  let addRecharge = null;

  [addRecharge] = await db.query(
    `INSERT INTO recharges (user_id, keyword_id, account, number, amount, deducted_amount, params, user_prev_balance, user_new_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      keywordId,
      account,
      customerNumber,
      amount,
      totalDeduction,
      JSON.stringify(params),
      balance,
      balance - totalDeduction
    ]
  );

  if (addRecharge.affectedRows === 0) {
    throw new ApiError(500, "Failed to create recharge request.");
  }
  rechargeId = addRecharge.insertId;
  reqId = addRecharge.insertId;

  await db.query(`UPDATE recharges SET reqid = ? WHERE id = ?`, [
    reqId,
    rechargeId
  ]);

  const [addgigs] = await db.query(
    "INSERT INTO recharge_gigs (rech_id, user_id, line_id, api_id, provider_id, amount, prev_balance, config, request) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      rechargeId,
      userId,
      currentline.id,
      currentline.recharge_api,
      currentline.api_provider,
      amount,
      currentline.balance,
      "MT1 Transaction",
      JSON.stringify(params)
    ]
  );

  const gigId = addgigs.insertId;
  console.log("Recharge gig created with ID:", gigId);

  console.log("✅ All validations passed");

  console.log("📤 Preparing MT1 transaction request...");
  const requestData = {
    remitterMobileNumber,
    accountNumber,
    ifsc,
    transferMode: transferMode || "IMPS",
    transferAmount: parseFloat(transferAmount).toFixed(2),
    latitude: latitude || "26.94642",
    longitude: longitude || "75.72912",
    referenceKey,
    otp,
    externalRef: 'MT1' + reqId.toString()
  };

  console.log("📤 Request data:", {
    ...requestData,
    otp: "***HIDDEN***"
  });

  console.log("🌐 Making API call to InstantPay MT1...");
  
  //try {
    const response = await axios.post(
      `${MT1_BASE_URL}transaction`,
      requestData,
      { headers: createMT1InstantPayHeaders() }
    );

    const apiData = response.data;

    console.log("=== InstantPay MT1 Transaction Response ===");
    console.log("📥 HTTP Status:", response.status);
    console.log("📥 Response data:", JSON.stringify(response.data, null, 2));

    console.log("💾 Logging transaction to database...");
    // Log transaction in database
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'mt1Transaction',
        JSON.stringify({ ...requestData, otp: "***HIDDEN***" }),
        JSON.stringify(response.data),
        response.data.statuscode
      ]
    );
    console.log("✅ Transaction logged to database");

    // Store detailed transaction record regardless of success/failure
    console.log("💾 Storing detailed transaction record...");

    const apiResponseData = response.data;
    const transactionData = apiResponseData.data || {};
    const poolData = transactionData.pool || {};


    let [[beneficiaryDetails]] = await db.query(
      "SELECT * FROM dmt_beneficiaries WHERE beneficiary_id = ? AND mobile_number = ? AND user_id = ? AND is_active = 1",
      [beneficiaryId, remitterMobileNumber, req.user.id]
    );
        console.log("Beneficiary Details:", beneficiaryDetails);

        if(beneficiaryDetails === undefined || beneficiaryDetails === null){
      console.log("❌ Beneficiary not found or inactive");
      [[beneficiaryDetails]] = await db.query(
      "SELECT * FROM dmt_beneficiaries WHERE id = ? AND mobile_number = ? AND user_id = ? AND is_active = 1",
      [beneficiaryId, remitterMobileNumber, req.user.id]
    );

    }

    // Insert detailed transaction record
    // Ensure beneficiaryId is not null: fallback to transactionData.beneficiaryId or empty string
    // Use transactionData from API response if available, fallback to beneficiaryDetails/db
    const safeBeneficiaryId = transactionData.beneficiaryId || beneficiaryId || beneficiaryDetails?.beneficiary_id || '';
    const safeBeneficiaryName = transactionData.beneficiaryName || beneficiaryName || beneficiaryDetails?.beneficiary_name || 'Unknown Beneficiary';
    // Prefer account/ifsc/name from transactionData if present
    accountNumber = transactionData.beneficiaryAccount || accountNumber;
    ifsc = transactionData.beneficiaryIfsc || ifsc;
    beneficiaryDetails.bank_name = beneficiaryDetails.bank_name || 'Unknown Bank';

    const [detailedTransaction] = await db.query(
      `INSERT INTO dmt_transaction_details (
      recharge_id, user_id, remitter_mobile, beneficiary_id, beneficiary_name, 
      beneficiary_account, beneficiary_ifsc, beneficiary_bank_name, beneficiary_mobile,
      transaction_amount, transfer_mode, transaction_charges, gst_amount, total_deducted,
      external_ref, pool_reference_id, txn_reference_id, ipay_uuid, order_id,
      pool_account, pool_opening_balance, pool_closing_balance,
      status, api_status_code, api_status_message, user_balance_before, user_balance_after,
      latitude, longitude, transaction_timestamp, environment, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
      rechargeId,
      req.user.id,
      remitterMobileNumber,
      safeBeneficiaryId,
      safeBeneficiaryName,
      accountNumber,
      ifsc,
      beneficiaryDetails.bank_name,
      beneficiaryDetails.beneficiary_mobile || '',
      parseFloat(amount),
      transferMode,
      0, // Will be calculated based on pool data
      0, // Will be calculated based on pool data  
      totalDeduction,
      transactionData.externalRef || `MT1-${rechargeId}`,
      transactionData.poolReferenceId || null,
      transactionData.txnReferenceId || null,
      apiResponseData.ipay_uuid || null,
      apiResponseData.orderid || null,
      poolData.account || null,
      poolData.openingBal ? parseFloat(poolData.openingBal) : null,
      poolData.closingBal ? parseFloat(poolData.closingBal) : null,
      apiResponseData.statuscode === "TXN" ? 'SUCCESS' : 'FAILED',
      apiResponseData.statuscode || null,
      apiResponseData.status || null,
      balance,
      balance - totalDeduction,
      latitude || null,
      longitude || null,
      apiResponseData.timestamp ? new Date(apiResponseData.timestamp) : new Date(),
      apiResponseData.environment || 'LIVE'
      ]
    );

    console.log("✅ Detailed transaction record created with ID:", detailedTransaction.insertId);

    // If transaction is successful
    if (response.data.statuscode === "TXN") {
      console.log("✅ Transaction successful! Storing fund transfer record...");

      // Calculate actual charges from pool data
      let actualCharges = 0;
      if (poolData.amount && poolData.mode === "DR") {
        actualCharges = parseFloat(poolData.amount) - parseFloat(amount);
      }

      // Update the detailed transaction record with calculated charges
      await db.query(
        `UPDATE dmt_transaction_details SET 
         transaction_charges = ?, 
         gst_amount = ? 
         WHERE id = ?`,
        [
          actualCharges > 0 ? actualCharges : 0,
          0,
          detailedTransaction.insertId
        ]
      );

      await db.query(
        `INSERT INTO dmt_fund_transfers (user_id, remitter_mobile, beneficiary_id, amount, channel, 
         transaction_id, ref_id, status, charge, gst, total_amount, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          req.user.id,
          remitterMobileNumber,
          safeBeneficiaryId,
          parseFloat(amount),
          transferMode,
          
          transactionData.poolReferenceId || null,
          transactionData.txnReferenceId || null,
          'SUCCESS',
          actualCharges,
          0,
          parseFloat(poolData.amount || amount)
        ]
      );
      console.log("✅ Fund transfer record created");

      finalStatus = "success";
      finalMessage = "Transaction completed successfully";
      finalLineId = currentline.id;

    }else if(
      response.data.statuscode === "TUP"
    ){
      finalStatus = "PENDING";
      finalMessage = "Transaction is under process, please check back later";

      //transactio under process

    }
    
    else {
      console.log("❌ Transaction failed with status code:", response.data.statuscode);
      finalMessage = apiResponseData.status || "Transaction got failed";
      if (response.data.statuscode === "EOP") {
        finalMessage = apiResponseData.status;
      }

      // Update detailed transaction record with failure reason
      await db.query(
        `UPDATE dmt_transaction_details SET 
         failure_reason = ?,
         status = 'FAILED'
         WHERE id = ?`,
        [
          apiResponseData.status || "Transaction failed",
          detailedTransaction.insertId
        ]
      );

      finalStatus = "failed";
      console.log("❌ Transaction failed with status:", response.data.statuscode);
    }

    console.log("Final Status:", finalStatus);
    console.log("Final Message:", finalMessage);

    // Process final status and update records
    if (finalStatus == "failed") {
      console.log("Transaction failed, reverting changes...");
      const [updateRecharge] = await db.query(
        `UPDATE recharges SET status = ?, txnid = ?, opId = ?, message = ?, user_new_balance = user_new_balance + ?, completed_at = ? WHERE id = ?`,
        [finalStatus, apiResponseData.orderid || null, apiResponseData.ipay_uuid || null, finalMessage, totalDeduction, new Date(), rechargeId]
      );

      const [updateUser] = await db.query(
        `UPDATE users SET balance = balance + ? WHERE id = ?`,
        [totalDeduction, userId]
      );

      await db.query(
        `UPDATE recharge_gigs SET status = ?, response = ?, response_complete = ?, message = ? WHERE id = ?`,
        [
          finalStatus,
         
          JSON.stringify(apiResponseData),
          1,
          finalMessage ?? "Transaction Failed",
          gigId
        ]
      );

      // Update detailed transaction record for failed transaction
      await db.query(
        `UPDATE dmt_transaction_details SET 
         status = 'FAILED',
         failure_reason = ?,
         user_balance_after = user_balance_before
         WHERE recharge_id = ?`,
        [finalMessage, rechargeId]
      );


      throw new ApiError(400, finalMessage || "Transaction failed");

    } else if (finalStatus == "success") {
      console.log("Processing successful transaction...");
      const result1 = await calculateUserMargins({
        userId: user.id,
        parentId: user.parent_id,
        keywordId: keywordId,
        amount: amount,
        linesMargin: currentline.margin_status === 1 ? currentline : null
      });

     // console.log("Calculated Margins:", result);

      result1.retailerAddition =
        result1.retailerAddition +
        (currentline.is_charges_by_user === 1
          ? currentline.is_additional_charges_fixed === 1
            ? parseFloat(currentline.additional_charges)
            : amount * (parseFloat(currentline.additional_charges) / 100)
          : 0);

      const admin_margin =
        (currentline.admin_margin * amount) / 100 -
        result1.retailerAddition -
        result1.parentAddition -
        result1.superAddition +
        (currentline.is_charges_by_admin === 1
          ? currentline.is_additional_charges_fixed === 1
            ? parseFloat(currentline.additional_charges)
            : amount * (parseFloat(currentline.additional_charges) / 100)
          : 0);


      const result2 = await calculateUserMargins({
        userId: user.id,
        parentId: user.parent_id,
        keywordId: dmtChargeKeywordId,
        amount: amount,
        linesMargin: currentline.margin_status === 1 ? currentline : null
      });

      const result = {
        retailerAddition: result1.retailerAddition + result2.retailerAddition,
        parentAddition: result1.parentAddition + result2.parentAddition,
        superAddition: result1.superAddition + result2.superAddition,
        superParentId: user.super_parent_id,
        isDirect: user.is_direct_margin === 1
      };

      console.log("Calculated Margins:", result);

     
      
      const [updateRecharge] = await db.query(
        `UPDATE recharges SET status = ?, deducted_amount = deducted_amount - ?, user_new_balance = user_new_balance + ?, txnid = ?, opId = ?, message = ?, com_retailer = ?, com_parent = ?, com_superparent = ?, com_admin = ?, parent_id = ?, superparent_id = ?, completed_at = ? WHERE id = ?`,
        [
          finalStatus,
          result.retailerAddition,
          result.retailerAddition,
          apiResponseData.orderid || null,
          apiResponseData.ipay_uuid || null,
          finalMessage ?? "Transaction Processed",
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
        const [updateSuperParent] = await db.query(
          `UPDATE users SET balance = balance + ? WHERE id = ?`,
          [result.superAddition, result.superParentId]
        );
      }

      [updateLine] = await db.query(
        `UPDATE kl_financials
         SET balance = balance - ? - ?, 
           today_profit = today_profit + ?,
           today_amount = today_amount + ?, 
           today_count = today_count + 1 
         WHERE kl_id = ?`,
        [amount, admin_margin, admin_margin, amount, finalLineId]
      );

      if (updateLine.affectedRows === 0) {
        console.log("⚠️ Warning: Line balance update failed");
      }

      await db.query(
        `UPDATE recharge_gigs SET status = ?,  response = ?, response_complete = ?, message = ? WHERE id = ?`,
        [
          finalStatus,
         
          JSON.stringify(apiResponseData),
          JSON.stringify(apiResponseData),
          finalMessage ?? "Transaction Success",
          gigId
        ]
      );

      const [updateGigs] = await db.query(
        `UPDATE recharge_gigs SET status = ?, new_balance = ?, message = ? WHERE rech_id = ? and line_id = ?`,
        [
          finalStatus,
          balance - amount - admin_margin,
          finalMessage ?? "Transaction Processed",
          rechargeId,
          finalLineId
        ]
      );

      // Update detailed transaction record with commission details
      await db.query(
        `UPDATE dmt_transaction_details SET 
         status = 'SUCCESS',
         commission_earned = ?,
         user_balance_after = user_balance_before - ? + ?
         WHERE recharge_id = ?`,
        [
          result.retailerAddition,
          totalDeduction,
          result.retailerAddition,
          rechargeId
        ]
      );

    } else {
      const [updateRecharge] = await db.query(
        `UPDATE recharges SET status = ?, txnid = ?, opId = ?, message = ?, completed_at = ? WHERE id = ?`,
        [finalStatus, apiResponseData.orderid || null, apiResponseData.ipay_uuid || null, finalMessage, new Date(), rechargeId]
      );

      const [getFinalLineBalance] = await db.query(
        `SELECT balance FROM kl_financials WHERE kl_id = ?`,
        [finalLineId]
      );

         await db.query(
        `UPDATE recharge_gigs SET status = ?, txnid = ?, opId = ?, response = ?, response_complete = ?, message = ? WHERE id = ?`,
        [
          finalStatus,
          apiResponseData.orderid || null,
          apiResponseData.ipay_uuid || null,
          JSON.stringify(apiResponseData),
          1,
          finalMessage ?? "Transaction Pending",
          gigId
        ]
      );

      if (getFinalLineBalance.length > 0) {
        const finalLineBalance = getFinalLineBalance[0].balance;
        const [updateGigs] = await db.query(
          `UPDATE recharge_gigs SET status = ?, new_balance = ?, message = ? WHERE rech_id = ? and line_id = ?`,
          [finalStatus, finalLineBalance ?? 0, finalMessage, rechargeId, finalLineId]
        );
      }

      // Update detailed transaction record for pending status
      await db.query(
        `UPDATE dmt_transaction_details SET 
         status = 'PENDING'
         WHERE recharge_id = ?`,
        [rechargeId]
      );
    }

    console.log("📤 Sending response to client...");
    return res.status(200).json(new ApiResponse(200, apiData, "MT1 Transaction completed successfully"));

  // } catch (error) {
  //   console.error("❌ MT1 Transaction Error occurred:");
  //   console.error("❌ Error message:", error.message);
  //   console.error("❌ Error stack:", error.stack);
  //   console.error("❌ API Response data:", error.response?.data);
  //   console.error("❌ API Response status:", error.response?.status);

  //   // Revert balance on error
  //   await db.query(
  //     `UPDATE users SET balance = balance + ? WHERE id = ?`,
  //     [totalDeduction, userId]
  //   );

  //   // Update recharge status to failed
  //   await db.query(
  //     `UPDATE recharges SET status = 'failed', user_new_balance = user_new_balance + ?, completed_at = ? WHERE id = ?`,
  //     [totalDeduction, new Date(), rechargeId]
  //   );

  //   // Update recharge gigs
  //   await db.query(
  //     `UPDATE recharge_gigs SET status = 'failed', response = ?, message = ? WHERE id = ?`,
  //     [
  //       JSON.stringify({ error: error.message }),
  //       "MT1 Transaction Error: " + error.message,
  //       gigId
  //     ]
  //   );

  //   console.log("💾 Logging error to database...");
  //   await db.query(
  //     `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
  //      VALUES (?, ?, ?, ?, ?, NOW())`,
  //     [
  //       req.user.id,
  //       'mt1Transaction',
  //       JSON.stringify({ remitterMobileNumber, transferAmount, externalRef }),
  //       JSON.stringify({ error: error.message }),
  //       'ERROR'
  //     ]
  //   );
  //   console.log("✅ Error logged to database");

  //   throw new ApiError(500, error.response?.data?.status || "Failed to complete MT1 transaction");
  // }
});

// 12. MT1 Transaction Refund OTP
const mt1TransactionRefundOtp = asyncHandler(async (req, res) => {
  const { ipayId } = req.body;

  console.log("=== MT1 Transaction Refund OTP Started ===");
  console.log("iPay ID:", ipayId);

  if (!ipayId) {
    throw new ApiError(400, "iPay ID is required for MT1 transaction refund OTP");
  }

  try {
    const requestData = { ipayId };

    const response = await axios.post(
      `${MT1_BASE_URL}transactionRefundOtp`,
      requestData,
      { headers: createMT1InstantPayHeaders() }
    );

    const apiData = response.data;
    console.log("MT1 Transaction Refund OTP Response:", apiData);

    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'mt1TransactionRefundOtp',
        JSON.stringify(requestData),
        JSON.stringify(apiData),
        apiData.statuscode || 'UNKNOWN'
      ]
    );

    return res.status(200).json(
      new ApiResponse(200, apiData, "MT1 Transaction refund OTP generated successfully")
    );

  } catch (error) {
    console.error("MT1 Transaction Refund OTP Error:", error);
    
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [req.user.id, 'mt1TransactionRefundOtp', JSON.stringify({ ipayId }), JSON.stringify({ error: error.message }), 'ERROR']
    );

    throw new ApiError(500, error.response?.data?.status || "Failed to generate MT1 transaction refund OTP");
  }
});

// 13. MT1 Transaction Refund
const mt1TransactionRefund = asyncHandler(async (req, res) => {
  const { ipayId, referenceKey, otp } = req.body;

  console.log("=== MT1 Transaction Refund Started ===");
  console.log("iPay ID:", ipayId);

  if (!ipayId || !referenceKey || !otp) {
    throw new ApiError(400, "All fields are required for MT1 transaction refund");
  }

  try {
    const requestData = {
      ipayId,
      referenceKey,
      otp
    };

    const response = await axios.post(
      `${MT1_BASE_URL}transactionRefund`,
      requestData,
      { headers: createMT1InstantPayHeaders() }
    );

    const apiData = response.data;
    console.log("MT1 Transaction Refund Response:", apiData);

    // Log the API call
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        req.user.id,
        'mt1TransactionRefund',
        JSON.stringify({ ...requestData, otp: "***HIDDEN***" }),
        JSON.stringify(apiData),
        apiData.statuscode || 'UNKNOWN'
      ]
    );

    return res.status(200).json(
      new ApiResponse(200, apiData, "MT1 Transaction refund completed successfully")
    );

  } catch (error) {
    console.error("MT1 Transaction Refund Error:", error);
    
    await db.query(
      `INSERT INTO dmt_transactions (user_id, api_endpoint, request_data, response_data, status, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [req.user.id, 'mt1TransactionRefund', JSON.stringify({ ipayId }), JSON.stringify({ error: error.message }), 'ERROR']
    );

    throw new ApiError(500, error.response?.data?.status || "Failed to complete MT1 transaction refund");
  }
});

// ...existing code...

module.exports = {
  merchantOnboarding,
  merchantOnboardingVerify,
  getMerchantStatus,
  getTestingMockResponse,
  checkRemitterProfile,
  registerRemitter,
  verifyRemitterOtp,
  remitterKyc,
  registerBeneficiary,
  verifyBeneficiaryOtp,
  verifyBankAccount,
  manualBankVerification,
  deleteBeneficiary,
  verifyBeneficiaryDeleteOtp,
  getRemitters,
  getBeneficiaries,
  getTransactionHistory,
  getDetailedTransactionHistory,
  getDetailedTransaction,
  generateTransactionOtp,
 // bioAuthTransaction,
  transaction,
  // Bank management functions
  syncBankList,
  getBankList,
  forceSyncBankList,
  getBankSyncStatus,
  scheduleAutoBankSync,
  // MT1 API functions
  mt1GetBankList,
  mt1CheckRemitterProfile,
  mt1RegisterRemitter,
  mt1VerifyRemitterRegistration,
  mt1RemitterKyc,
  mt1GetBeneficiaryList,
  mt1RegisterBeneficiary,
  mt1DeleteBeneficiary,
  mt1VerifyBeneficiaryDelete,
  mt1GenerateTransactionOtp,
  mt1Transaction,
  mt1TransactionRefundOtp,
  mt1TransactionRefund
};
