const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const db = require("../db/index");
const { encrypt, decrypt, generateRandomString, generatePDF } = require("../utils/bbpsUtils");
const { getBillerIdsFromFile, validateBillerFile } = require("../utils/fileReader");
const axios = require("axios");
const xml2js = require("xml2js");
const convert = require("xml-js");
const path = require("path");

// BBPS Configuration
const BBPS_CONFIG = {
    workingKey: "25B5C8B439877F42BC9657C591C322E0",
    agentId: "CV35",
    accessCode: "AVPO84NW36BO83YIOI",
    baseUrl: "https://bbps.api.example.com", // Replace with actual BBPS API URL
    billerFilePath: path.join(__dirname, '../public/billers.xlsx') // Default biller file path
};

// Utility function to parse XML to JSON
const xmlResponseToJSON = (xmlResponse) => {
    return new Promise((resolve, reject) => {
        xml2js.parseString(xmlResponse, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
};

// Get reference ID from response
const getReferenceId = (inputString) => {
    const regex = /Request ID:(\d+)/;
    const match = inputString.match(regex);
    return match && match.length > 1 ? match[1] : null;
};

// Get payment modes
const getPaymentModes = asyncHandler(async (req, res) => {
    try {
        const query = `
            SELECT * FROM payment_method 
            WHERE status = 'TRUE' 
            ORDER BY id
        `;
        
        const [paymentModes] = await db.execute(query);
        
        return res.status(200).json(
            new ApiResponse(200, paymentModes, "Payment modes fetched successfully")
        );
    } catch (error) {
        console.error("Error fetching payment modes:", error);
        throw new ApiError(500, "Failed to fetch payment modes");
    }
});

// Get biller parameters by biller ID
const getBillerParams = asyncHandler(async (req, res) => {
    try {
        const { biller_id } = req.query;
        
        if (!biller_id) {
            throw new ApiError(400, "Biller ID parameter is required");
        }
        
        const query = `
            SELECT p.parameter_name, p.data_type, p.is_optional, p.min_length, p.max_length, p.min_amount
            FROM parameters p
            INNER JOIN billers b ON p.biller_id = b.biller_id 
            INNER JOIN payment_channels pc ON pc.biller_id = b.biller_id
            WHERE b.biller_id = ? AND pc.channel_name = 'AGT'
        `;
        
        const [parameters] = await db.execute(query, [biller_id]);
        
        return res.status(200).json(
            new ApiResponse(200, parameters, "Biller parameters fetched successfully")
        );
    } catch (error) {
        console.error("Error fetching biller parameters:", error);
        throw new ApiError(500, "Failed to fetch biller parameters");
    }
});

// Get billers by category
const getBillersByCategory = asyncHandler(async (req, res) => {
    try {
        const { category_id, name } = req.query; // Using category_id instead of category
        const userId = req.user.id;
        
        if (!category_id) {
            throw new ApiError(400, "Category ID parameter is required");
        }
        
        // First, verify the category (keyword) exists and is enabled for this user
        const categoryVerifyQuery = `
            SELECT 
                k.id,
                k.description as category_name,
                k.status as keyword_status,
                o.name as operator_name,
                ot.name as operator_type,
                CASE 
                    WHEN ks.enabled IS NULL THEN k.status
                    ELSE ks.enabled
                END as is_enabled
            FROM keywords k
            INNER JOIN operators o ON k.operator_id = o.id
            INNER JOIN operator_types ot ON o.type = ot.id
            LEFT JOIN keyword_settings ks ON k.id = ks.keyword_id AND ks.user_id = ?
            WHERE k.id = ? 
                AND k.status = 1
                AND o.status = 1
                AND ot.name = 'BBPS'
        `;
        
        const [categoryResult] = await db.execute(categoryVerifyQuery, [userId, category_id]);
        
        if (categoryResult.length === 0) {
            throw new ApiError(404, "Category not found or not a BBPS category");
        }
        
        const category = categoryResult[0];
        
        if (!category.is_enabled) {
            throw new ApiError(403, "Category is not enabled for this user");
        }
        
        // Now fetch billers for this category
        // Assuming biller_category matches the keyword description
        let billerQuery = `
            SELECT 
                biller_id,
                biller_name, 
                biller_category,
                biller_fetch_requirement,
                biller_description,
                status
            FROM billers 
            WHERE biller_category = ? 
                AND status = 'active'
        `;
        
        const params = [category.category_name];
        
        if (name) {
            billerQuery += ` AND biller_name LIKE ?`;
            params.push(`%${name}%`);
        }
        
        billerQuery += ` ORDER BY biller_name`;
        
        const [billers] = await db.execute(billerQuery, params);
        
        return res.status(200).json(
            new ApiResponse(200, {
                category: {
                    id: category.id,
                    name: category.category_name,
                    operator_type: category.operator_type
                },
                billers: billers,
                total_billers: billers.length
            }, "Billers fetched successfully")
        );
        
    } catch (error) {
        console.error("Error fetching billers by category:", error);
        throw new ApiError(500, error.message || "Failed to fetch billers by category");
    }
});

// Get home screen data based on user keywords
const getHomeScreenData = asyncHandler(async (req, res) => {
    try {
        const userId = req.user.id; // Using id instead of member_id
        
        // Fetch BBPS categories from keywords table where operator type is BBPS
        // Use keyword description as category name
        const categoryQuery = `
            SELECT DISTINCT
                k.description as category_name,
                k.id as category_id,
                k.description as heading,
                'default_icon.png' as icon,
                CASE 
                    WHEN ks.enabled IS NULL THEN k.status
                    ELSE ks.enabled
                END as is_enabled
            FROM keywords k
            INNER JOIN operators o ON k.operator_id = o.id
            INNER JOIN operator_types ot ON o.type = ot.id
            LEFT JOIN keyword_settings ks ON k.id = ks.keyword_id AND ks.user_id = ?
            WHERE k.status = 1 
                AND o.status = 1
                AND ot.name = 'BBPS'
            ORDER BY k.description
        `;
        
        const [categories] = await db.execute(categoryQuery, [userId]);
        
        // Filter categories to only include enabled ones
        const enabledCategories = categories.filter(category => category.is_enabled);
        
        // Return unique categories (keyword descriptions as category names)
        const uniqueCategories = enabledCategories.map(category => ({
            category_name: category.category_name,
            category_id: category.category_id,
            heading: category.heading,
            icon: category.icon
        }));
        
        return res.status(200).json(
            new ApiResponse(200, {
                retailerIsActive: "ACTIVE",
                result: uniqueCategories
            }, "Home screen data fetched successfully")
        );
        
    } catch (error) {
        console.error("Error fetching home screen data:", error);
        throw new ApiError(500, error.message || "Failed to fetch home screen data");
    }
});

// Get bills with filtering
const getBills = asyncHandler(async (req, res) => {
    try {
        const { 
            biller_id, 
            requestId, 
            retailerNumber, 
            customerNumber, 
            responseStatus, 
            roboCode 
        } = req.query;
        
        let query = `SELECT * FROM bills`;
        const conditions = [];
        const params = [];
        
        if (biller_id) {
            conditions.push('biller_id = ?');
            params.push(biller_id);
        }
        if (requestId) {
            conditions.push('requestId = ?');
            params.push(requestId);
        }
        if (retailerNumber) {
            conditions.push('retailerNumber = ?');
            params.push(retailerNumber);
        }
        if (customerNumber) {
            conditions.push('customerNumber = ?');
            params.push(customerNumber);
        }
        if (responseStatus) {
            conditions.push('responseStatus = ?');
            params.push(responseStatus);
        }
        if (roboCode) {
            conditions.push('roboRefrenceId = ?');
            params.push(roboCode);
        }
        
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        query += ` ORDER BY datetime DESC`;
        
        const [bills] = await db.execute(query, params);
        
        return res.status(200).json(
            new ApiResponse(200, bills, "Bills fetched successfully")
        );
        
    } catch (error) {
        console.error("Error fetching bills:", error);
        throw new ApiError(500, "Failed to fetch bills");
    }
});

// Get stored biller information from database
const getStoredBillers = asyncHandler(async (req, res) => {
    try {
        const { start = 0, limit = 100 } = req.query;
        
        // Fetch billers from database
        const query = `
            SELECT * FROM billers 
            WHERE status = 'active' 
            ORDER BY biller_name 
            LIMIT ${parseInt(limit)} OFFSET ${parseInt(start)}
        `;
        
        const [billers] = await db.execute(query, []);
        
        return res.status(200).json(
            new ApiResponse(200, billers, "Stored biller information fetched successfully")
        );
    } catch (error) {
        console.error("Error fetching stored biller info:", error);
        throw new ApiError(500, "Failed to fetch stored biller information");
    }
});

// Fetch biller information from BBPS API and store in database
const getBillerInfo = asyncHandler(async (req, res) => {
    // Helper function to extract value from array or direct value
    const getValue = (field, defaultValue = '') => {
        if (Array.isArray(field)) {
            return field[0] || defaultValue;
        }
        return field?._text || field || defaultValue;
    };
    
    // Helper function to map data types to valid enum values
    const mapDataType = (dataType) => {
        if (!dataType) return 'text';
        
        const type = dataType.toLowerCase().trim();
        
        // Map common data type variations to our enum values
        switch (type) {
            case 'text':
            case 'string':
            case 'varchar':
            case 'alphanumeric':
            case 'alpha':
                return 'text';
            case 'number':
            case 'numeric':
            case 'integer':
            case 'int':
            case 'decimal':
            case 'amount':
                return 'number';
            case 'date':
            case 'datetime':
            case 'timestamp':
                return 'date';
            case 'dropdown':
            case 'select':
            case 'list':
                return 'dropdown';
            case 'radio':
            case 'option':
                return 'radio';
            default:
                console.log(`Unknown data type: ${dataType}, defaulting to 'text'`);
                return 'text';
        }
    };
    
    // Helper function to validate and cap amount values for database constraints
    const validateAmount = (amount, fieldName = 'amount') => {
        const numAmount = parseInt(amount) || 0;
        
        // For decimal(10,2) columns, max value is 99,999,999.99
        const MAX_AMOUNT = 99999999;
        const MIN_AMOUNT = 0;
        
        if (numAmount > MAX_AMOUNT) {
            console.log(`${fieldName} ${numAmount} exceeds maximum ${MAX_AMOUNT}, capping to maximum`);
            return MAX_AMOUNT;
        }
        
        if (numAmount < MIN_AMOUNT) {
            console.log(`${fieldName} ${numAmount} below minimum ${MIN_AMOUNT}, setting to minimum`);
            return MIN_AMOUNT;
        }
        
        return numAmount;
    };
    
    // Helper function to map payment exactness values to valid enum values
    const mapPaymentExactness = (exactness) => {
        if (!exactness) return 'any';
        
        const value = exactness.toLowerCase().trim();
        
        // Map common payment exactness variations to our enum values
        switch (value) {
            case 'exact':
            case 'exact amount':
            case 'exact only':
                return 'exact';
            case 'exact and above':
            case 'exact or above':
            case 'minimum':
            case 'exact and more':
            case 'at least':
                return 'maximum'; // Using 'maximum' for "exact and above" scenarios
            case 'any':
            case 'any amount':
            case 'flexible':
            case 'variable':
                return 'any';
            case 'maximum':
            case 'max':
            case 'up to':
                return 'maximum';
            default:
                console.log(`Unknown payment exactness: ${exactness}, defaulting to 'any'`);
                return 'any';
        }
    };
    
    try {
        const { start = 0, limit = 2000 } = req.query;
        
        // Path to the biller CSV/Excel file
        const billerFilePath = BBPS_CONFIG.billerFilePath;
        
        // Validate file exists and has correct format
        const validation = await validateBillerFile(billerFilePath);
        if (!validation.isValid) {
            throw new ApiError(400, `Biller file validation failed: ${validation.error}`);
        }
        
        // Get biller IDs from file (excluding education category)
        const billerIds = await getBillerIdsFromFile(billerFilePath, parseInt(start), parseInt(limit));
        
        if (billerIds.length === 0) {
            return res.status(200).json(
                new ApiResponse(200, [], "No billers found in file to fetch info for")
            );
        }
        
        console.log("Fetching info for billers from file:", billerIds);
        
        // Create XML payload with all biller IDs
        let billerIdElements = "";
        for (const billerId of billerIds) {
            billerIdElements += `<billerId>${billerId}</billerId>`;
        }
        
        const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
            <billerInfoRequest>
                ${billerIdElements}
            </billerInfoRequest>`;
            console.log("XML Payload:", xmlPayload);
        
        // Encrypt the request
        const encRequest = encrypt(xmlPayload, BBPS_CONFIG.workingKey);
        
        // Generate reference ID
        const requestId = generateRandomString();
        
        const requestData = {
            accessCode: BBPS_CONFIG.accessCode,
            requestId: requestId,
            encRequest: encRequest,
            ver: "1.0",
            instituteId: BBPS_CONFIG.agentId,
        };

        console.log("Request Data:", requestData);
        
        // Make API call to BBPS provider
        const url = `https://api.billavenue.com/billpay/extMdmCntrl/mdmRequestNew/xml?accessCode=${requestData.accessCode}&requestId=${requestData.requestId}&ver=${requestData.ver}&instituteId=${requestData.instituteId}`;
        
        const response = await axios.post(url, requestData.encRequest, {
            headers: {
                "Content-Type": "application/xml",
            },
        });

        console.log("BBPS API Response Status:", response.status);
   //     console.log("BBPS API Response Data:", response.data);
        
        if (response.status !== 200) {
            throw new ApiError(500, "Failed to fetch biller info from BBPS API");
        }

        console.log("Raw BBPS API Response Data:", response.data);
        
        // Decrypt and parse response
        const xmlData = decrypt(response.data, BBPS_CONFIG.workingKey);
        const jdata = await xmlResponseToJSON(xmlData);
        console.log("Decrypted Data:", jdata);
        // if(jdata.billerInfoResponse.responseCode !== "000"){
        //     console.log("BBPS API Error Response:", jdata.billerInfoResponse.errorInfo);
        //     throw new ApiError(500, `BBPS API Error: ${jdata.billerInfoResponse.responseMessage}`);

        // }
        
        if (!jdata.billerInfoResponse || !jdata.billerInfoResponse.biller) {
            throw new ApiError(500, "Invalid response from BBPS API");
        }
        
        const billers = Array.isArray(jdata.billerInfoResponse.biller) 
            ? jdata.billerInfoResponse.biller 
            : [jdata.billerInfoResponse.biller];

            console.log("Parsed Billers:", billers);
        
        const updatedBillers = [];
        
        // Process each biller
        for (const biller of billers) {
            try {


               
                
                console.log("Processing biller:", JSON.stringify(biller, null, 2));
                
                // Extract biller data handling both array and object structures
                const billerId = getValue(biller.billerId);
                const billerName = getValue(biller.billerName);
                const billerCategory = getValue(biller.billerCategory);
                const billerCoverage = getValue(biller.billerCoverage);
                const billerFetchRequirement = getValue(biller.billerFetchRequiremet);
                const rawPaymentExactness = getValue(biller.billerPaymentExactness, 'any');
                const billerPaymentExactness = mapPaymentExactness(rawPaymentExactness);
                const billerAdhoc = getValue(biller.billerAdhoc) === "true" ? 1 : 0;
                const billerSupportBillValidation = getValue(biller.billerSupportBillValidation);
                const supportPendingStatus = getValue(biller.supportPendingStatus) === "Yes" ? 1 : 0;
                const supportDeemed = getValue(biller.supportDeemed) === "Yes" ? 1 : 0;
                const billerTimeout = parseInt(getValue(biller.billerTimeout)) || 100;
                const billerAmountOptions = getValue(biller.billerAmountOptions);
                const billerPaymentModes = getValue(biller.billerPaymentModes);
                const billerDescription = getValue(biller.billerDescription);
                const rechargeAmountInValidationRequest = getValue(biller.rechargeAmountInValidationRequest);
                const planMdmRequirement = getValue(biller.planMdmRequirement);
                const billerResponseType = getValue(biller.billerResponseType);
                
                console.log(`Payment Exactness: Raw: ${rawPaymentExactness} → Mapped: ${billerPaymentExactness}`);
                
                // Handle additional info objects
                const billerAdditionalInfo = JSON.stringify(biller.billerAdditionalInfo || {});
                const billerAdditionalInfoPayment = JSON.stringify(biller.billerAdditionalInfoPayment || {});
                const billerPlanResponseParams = JSON.stringify(biller.billerPlanResponseParams || {});
                
                console.log(`Processing biller: ${billerId} - ${billerName}`);
                
                // Insert or Update biller information using UPSERT
                const upsertBillerQuery = `
                    INSERT INTO billers (
                        biller_id,
                        biller_name,
                        biller_category,
                        biller_mode,
                        coverage,
                        biller_fetch_requirement,
                        payment_requirement,
                        payment_amount_exactness,
                        biller_adhoc,
                        biller_support_bill_validation,
                        support_pending_status,
                        support_deemed,
                        biller_timeout,
                        biller_additional_info,
                        biller_amount_options,
                        biller_payment_modes,
                        biller_description,
                        recharge_amount_in_validation_request,
                        biller_additional_info_payment,
                        plan_mdm_requirement,
                        biller_response_type,
                        biller_plan_response_params,
                        status,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())
                    ON DUPLICATE KEY UPDATE
                        biller_name = VALUES(biller_name),
                        biller_category = VALUES(biller_category),
                        biller_mode = VALUES(biller_mode),
                        coverage = VALUES(coverage),
                        biller_fetch_requirement = VALUES(biller_fetch_requirement),
                        payment_requirement = VALUES(payment_requirement),
                        payment_amount_exactness = VALUES(payment_amount_exactness),
                        biller_adhoc = VALUES(biller_adhoc),
                        biller_support_bill_validation = VALUES(biller_support_bill_validation),
                        support_pending_status = VALUES(support_pending_status),
                        support_deemed = VALUES(support_deemed),
                        biller_timeout = VALUES(biller_timeout),
                        biller_additional_info = VALUES(biller_additional_info),
                        biller_amount_options = VALUES(biller_amount_options),
                        biller_payment_modes = VALUES(biller_payment_modes),
                        biller_description = VALUES(biller_description),
                        recharge_amount_in_validation_request = VALUES(recharge_amount_in_validation_request),
                        biller_additional_info_payment = VALUES(biller_additional_info_payment),
                        plan_mdm_requirement = VALUES(plan_mdm_requirement),
                        biller_response_type = VALUES(biller_response_type),
                        biller_plan_response_params = VALUES(biller_plan_response_params),
                        updated_at = NOW()
                `;
                
                const billerValues = [
                    billerId,
                    billerName,
                    billerCategory,
                    'online',
                    billerCoverage,
                    billerFetchRequirement,
                    billerPaymentExactness,
                    billerPaymentExactness,
                    billerAdhoc,
                    billerSupportBillValidation,
                    supportPendingStatus,
                    supportDeemed,
                    billerTimeout,
                    billerAdditionalInfo,
                    billerAmountOptions,
                    billerPaymentModes,
                    billerDescription,
                    rechargeAmountInValidationRequest,
                    billerAdditionalInfoPayment,
                    planMdmRequirement,
                    billerResponseType,
                    billerPlanResponseParams
                ];
                
                await db.execute(upsertBillerQuery, billerValues);
                
                console.log(`Biller ${billerId} upserted successfully.`);
                
                // Verify the biller record exists before inserting related records
                const [billerCheck] = await db.execute('SELECT biller_id FROM billers WHERE biller_id = ?', [billerId]);
                if (billerCheck.length === 0) {
                    throw new Error(`Biller ${billerId} was not created/updated properly`);
                }
                
                console.log(`Verified biller ${billerId} exists in database.`);
                
                // Delete existing parameters for this biller
                await db.execute('DELETE FROM parameters WHERE biller_id = ?', [billerId]);
                
                // Insert updated parameters
                if (biller.billerInputParams) {
                    console.log(`Processing parameters for biller ${billerId}:`, JSON.stringify(biller.billerInputParams, null, 2));
                    
                    let paramInfos = [];
                    
                    // Handle different structures of billerInputParams
                    if (Array.isArray(biller.billerInputParams)) {
                        // If it's an array, get the first element
                        const inputParams = biller.billerInputParams[0];
                        if (inputParams && inputParams.paramInfo) {
                            paramInfos = Array.isArray(inputParams.paramInfo) 
                                ? inputParams.paramInfo 
                                : [inputParams.paramInfo];
                        }
                    } else if (biller.billerInputParams.paramInfo) {
                        // Direct object access
                        paramInfos = Array.isArray(biller.billerInputParams.paramInfo) 
                            ? biller.billerInputParams.paramInfo 
                            : [biller.billerInputParams.paramInfo];
                    }
                    
                    console.log(`Found ${paramInfos.length} parameters to process`);
                    
                    if (paramInfos.length > 0) {
                        const insertParamQuery = `
                            INSERT INTO parameters 
                            (biller_id, parameter_name, data_type, is_optional, min_length, max_length)
                            VALUES (?, ?, ?, ?, ?, ?)
                        `;
                        
                        for (const param of paramInfos) {
                            try {
                                const paramName = getValue(param.paramName);
                                const rawDataType = getValue(param.dataType, 'text');
                                const dataType = mapDataType(rawDataType);
                                const isOptional = getValue(param.isOptional) === "true" ? 1 : 0;
                                const minLength = parseInt(getValue(param.minLength)) || 0;
                                const maxLength = parseInt(getValue(param.maxLength)) || 255;
                                
                                console.log(`Parameter: ${paramName}, Raw DataType: ${rawDataType}, Mapped DataType: ${dataType}`);
                                
                                await db.execute(insertParamQuery, [
                                    billerId,
                                    paramName,
                                    dataType,
                                    isOptional,
                                    minLength,
                                    maxLength
                                ]);
                            } catch (paramError) {
                                console.error(`Error inserting parameter for biller ${billerId}:`, {
                                    parameter: param,
                                    error: paramError.message
                                });
                                // Continue with next parameter instead of failing entire biller
                            }
                        }
                    }
                }
                
                // Delete existing payment channels for this biller
                await db.execute('DELETE FROM payment_channels WHERE biller_id = ?', [billerId]);
                
                // Insert updated payment channels
                if (biller.billerPaymentChannels) {
                    let channelInfos = [];
                    
                    // Handle different structures of billerPaymentChannels
                    if (Array.isArray(biller.billerPaymentChannels)) {
                        // If it's an array, get the first element
                        const paymentChannels = biller.billerPaymentChannels[0];
                        if (paymentChannels && paymentChannels.paymentChannelInfo) {
                            channelInfos = Array.isArray(paymentChannels.paymentChannelInfo) 
                                ? paymentChannels.paymentChannelInfo 
                                : [paymentChannels.paymentChannelInfo];
                        }
                    } else if (biller.billerPaymentChannels.paymentChannelInfo) {
                        // Direct object access
                        channelInfos = Array.isArray(biller.billerPaymentChannels.paymentChannelInfo) 
                            ? biller.billerPaymentChannels.paymentChannelInfo 
                            : [biller.billerPaymentChannels.paymentChannelInfo];
                    }
                    
                    if (channelInfos.length > 0) {
                        const insertChannelQuery = `
                            INSERT INTO payment_channels 
                            (biller_id, channel_name, min_amount, max_amount)
                            VALUES (?, ?, ?, ?)
                        `;
                        
                        for (const channel of channelInfos) {
                            try {
                                const channelName = getValue(channel.paymentChannelName, 'AGT');
                                const rawMinAmount = getValue(channel.minAmount, '0');
                                const rawMaxAmount = getValue(channel.maxAmount, '999999');
                                
                                // Validate and cap amounts to fit database constraints
                                const minAmount = validateAmount(rawMinAmount, 'minAmount');
                                const maxAmount = validateAmount(rawMaxAmount, 'maxAmount');
                                
                                // Ensure maxAmount is not less than minAmount
                                const finalMaxAmount = Math.max(minAmount, maxAmount);
                                
                                console.log(`Channel: ${channelName}, Raw Min: ${rawMinAmount}, Raw Max: ${rawMaxAmount}, Final Min: ${minAmount}, Final Max: ${finalMaxAmount}`);
                                
                                await db.execute(insertChannelQuery, [
                                    billerId,
                                    channelName,
                                    minAmount,
                                    finalMaxAmount
                                ]);
                            } catch (channelError) {
                                console.error(`Error inserting payment channel for biller ${billerId}:`, {
                                    channel: channel,
                                    error: channelError.message
                                });
                                // Continue with next channel instead of failing entire biller
                            }
                        }
                    }
                }
                
      
                
                updatedBillers.push({
                    biller_id: billerId,
                    biller_name: billerName,
                    status: 'updated'
                });
                
            } catch (billerError) {
                // Rollback transaction on error
              //  await db.execute('ROLLBACK');
                
                // Extract biller details for error reporting
                const errorBillerId = getValue(biller.billerId, 'unknown');
                const errorBillerName = getValue(biller.billerName, 'unknown');
                
                console.error(`Error updating biller ${errorBillerId}:`, billerError);
                updatedBillers.push({
                    biller_id: errorBillerId,
                    biller_name: errorBillerName,
                    status: 'error',
                    error: billerError.message
                });
            }
        }
        
        return res.status(200).json(
            new ApiResponse(200, {
                processedBillers: updatedBillers.length,
                updatedBillers,
                requestId
            }, "Biller information fetched and updated successfully")
        );
        
    } catch (error) {
        console.error("Error fetching biller info:", error);
        throw new ApiError(500, error.message || "Failed to fetch biller information");
    }
});

// Bill fetch functionality
const billFetch = asyncHandler(async (req, res) => {
    try {
        const { inputs, biller, mobileNumber } = req.body;
        
        // Validate required fields
        if (!inputs || !biller || !mobileNumber) {
            throw new ApiError(400, "Missing required fields: inputs, biller, mobileNumber");
        }

        // Get retailer info from req.user (authenticated user)
        const retailerNumber = req.user.mobile;
        const userId = req.user.id;
        
        // Get biller information from database
        const billerQuery = `
            SELECT b.biller_id, b.biller_category, b.biller_adhoc, b.payment_amount_exactness as biller_payment_exactness
            FROM billers b
            WHERE b.biller_id = ?
        `;
        
        const [billerData] = await db.execute(billerQuery, [biller]);

        const [keywordDetails] = await db.execute(
            `SELECT k.id, k.description
             FROM keywords k
             WHERE k.status = 1 AND k.description LIKE ?`,
            [`%${billerData[0].biller_category}%`]
        );
        
        if (!billerData.length) {
            throw new ApiError(404, "Biller not found");
        }
        
        const billerInfo = billerData[0];
        const billerId = billerInfo.biller_id;
        const billerAdhoc = billerInfo.biller_adhoc;
        const exactness = billerInfo.biller_payment_exactness;
     //   const roboStatus = billerInfo.robo_status;
        
        // Generate agent ID (using a fixed format as in old code)
        const agentId = "CC01CV35AGTU00000007";
        
        // Generate request ID
        const requestId = generateRandomString();
        
        // Create XML object for bill fetch request
        const xmlObject = {
            billFetchRequest: {
                agentId: agentId,
                agentDeviceInfo: {
                    ip: "192.168.2.73",
                    initChannel: "AGT",
                    mac: "01-23-45-67-89-a",
                },
                customerInfo: {
                    customerMobile: mobileNumber,
                    customerEmail: { _text: "" },
                    customerAdhaar: { _text: "" },
                    customerPan: { _text: "" },
                },
                billerId: billerId,
                inputParams: {
                    input: [],
                },
            },
        };

        // Convert each key-value pair in inputs to XML input element
        Object.entries(inputs).forEach(([key, value]) => {
            xmlObject.billFetchRequest.inputParams.input.push({
                paramName: key,
                paramValue: value.toString(),
            });
        });

        // Convert JSON object to XML
        const convert = require('xml-js');
        const xml = convert.js2xml(xmlObject, { compact: true, spaces: 2 });
        const requestedXml = `<?xml version="1.0" encoding="UTF-8"?> ${xml}`;
        
        console.log("Bill Fetch XML Request:", requestedXml);

        // Encrypt the XML data
        const encryptXmlData = encrypt(requestedXml, BBPS_CONFIG.workingKey);

        // Prepare data for HTTP request
        const data = {
            accessCode: BBPS_CONFIG.accessCode,
            requestId: requestId,
            encRequest: encryptXmlData,
            ver: "1.0",
            instituteId: BBPS_CONFIG.agentId,
        };

        const query = `accessCode=${data.accessCode}&requestId=${data.requestId}&ver=${data.ver}&instituteId=${data.instituteId}&encRequest=${data.encRequest}`;
        const url = `https://api.billavenue.com/billpay/extBillCntrl/billFetchRequest/xml?${query}`;
        
        console.log("Bill Fetch URL:", url);

        // Make API call
        const response = await axios.post(url, data, {
            headers: {
                "Content-Type": "application/xml",
            },
        });

        if (response.status === 200) {
            // Decrypt response
            const xmlResponse = decrypt(response.data, BBPS_CONFIG.workingKey);
            console.log("Decrypted XML Response:", xmlResponse);

            // Parse XML to JSON
            const xml2js = require('xml2js');
            const responseJson = await new Promise((resolve, reject) => {
                xml2js.parseString(xmlResponse, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            console.log("Parsed JSON Response:", JSON.stringify(responseJson, null, 2));

            // Check if response is successful
            if (responseJson.billFetchResponse.responseCode[0] === "000") {
                const billerResponse = responseJson.billFetchResponse.billerResponse[0];
                
                // Extract basic info
                const basicInfo = {
                    billerName: biller,
                    billAmount: billerResponse.billAmount ? billerResponse.billAmount[0] : null,
                    billDate: billerResponse.billDate ? billerResponse.billDate[0] : null,
                    billNumber: billerResponse.billNumber ? billerResponse.billNumber[0] : null,
                    billPeriod: billerResponse.billPeriod ? billerResponse.billPeriod[0] : null,
                    customerName: billerResponse.customerName ? billerResponse.customerName[0] : null,
                    customerNumber: mobileNumber,
                    dueDate: billerResponse.dueDate ? billerResponse.dueDate[0] : null,
                    billerAdhoc: billerAdhoc,
                };

                // Extract input parameters
                let inputParamsList = [];
                if (responseJson.billFetchResponse.inputParams) {
                    const inputParamData = responseJson.billFetchResponse.inputParams[0];
                    if (inputParamData.input) {
                        inputParamsList = inputParamData.input.map((param) => ({
                            paramName: param.paramName[0],
                            paramValue: param.paramValue[0],
                        }));
                    }
                }

                // Extract additional info
                let additionalInfoList = [];
                if (responseJson.billFetchResponse.additionalInfo) {
                    const additionalInfoData = responseJson.billFetchResponse.additionalInfo[0];
                    if (additionalInfoData.info) {
                        additionalInfoList = additionalInfoData.info.map((info) => ({
                            infoName: info.infoName[0],
                            infoValue: info.infoValue[0],
                        }));
                    }
                }

                // Extract amount options
                let amountOptionsList = [];
                if (billerResponse.amountOptions) {
                    const amountOptionsData = billerResponse.amountOptions[0];
                    if (amountOptionsData.option) {
                        amountOptionsList = amountOptionsData.option.map((option) => ({
                            amountName: option.amountName[0],
                            amountValue: option.amountValue[0],
                        }));
                    }
                }

                // Log successful transaction
                const logQuery = `
                    INSERT INTO bbps_transactions 
                    (retailer_id, retailer_mobile, biller_id, customer_number, reference_id, request_data, response_data, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'success', NOW())
                `;
                
                // await db.execute(logQuery, [
                //     userId,
                //     retailerNumber,
                //     billerId,
                //     mobileNumber,
                //     requestId,
                //     JSON.stringify({ inputs, biller, mobileNumber }),
                //     JSON.stringify(responseJson)
                // ]);

                const dataToSend = {
                    status: true,
                    response: {
                        requestId: requestId,
                        basicInfo: basicInfo,
                        additionalInfo: additionalInfoList,
                        amountOptions: amountOptionsList,
                        inputParamsList: inputParamsList,
                        exactness: exactness,
                       // roboStatus: roboStatus,
                    },
                };

                return res.status(200).json(
                    new ApiResponse(200, dataToSend, "Bill fetched successfully")
                );
            } else {
                const errorCode = responseJson.billFetchResponse.responseCode[0];
                let errorMessage = `Please check the values you filled. Error code: ${errorCode}`;
                
                // Extract detailed error information if available
                if (responseJson.billFetchResponse.errorInfo && 
                    responseJson.billFetchResponse.errorInfo[0] && 
                    responseJson.billFetchResponse.errorInfo[0].error) {
                    
                    const errors = responseJson.billFetchResponse.errorInfo[0].error;
                    const errorDetails = errors.map(err => {
                        const code = err.errorCode ? err.errorCode[0] : 'Unknown';
                        const message = err.errorMessage ? err.errorMessage[0] : 'Unknown error';
                        return `${code}: ${message}`;
                    }).join(', ');
                    
                    errorMessage = errorDetails;
                }
                
                // Log failed transaction
                const logQuery = `
                    INSERT INTO bbps_transactions 
                    (retailer_id, retailer_mobile, biller_id, customer_number, reference_id, request_data, response_data, status, error_message, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'failed', ?, NOW())
                `;
                
                // await db.execute(logQuery, [
                //     userId,
                //     retailerNumber,
                //     billerId,
                //     mobileNumber,
                //     requestId,
                //     JSON.stringify({ inputs, biller, mobileNumber }),
                //     JSON.stringify(responseJson),
                //     errorMessage
                // ]);

                const dataToSendIfFailed = {
                    status: false,
                    errorCode: errorCode,
                    message: errorMessage,
                    requestId: requestId
                };

                return res.status(400).json(
                    new ApiResponse(400, dataToSendIfFailed, "Bill fetch failed")
                );
            }
        } else {
            throw new ApiError(500, "BBPS API returned non-200 status");
        }
        
    } catch (error) {
         
        // Log error transaction if we have basic info
        if (req.body.biller && req.body.mobileNumber) {
            try {
                const logQuery = `
                    INSERT INTO bbps_transactions 
                    (retailer_id, retailer_mobile, biller_id, customer_number, reference_id, request_data, status, error_message, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, 'error', ?, NOW())
                `;
                
                // await db.execute(logQuery, [
                //     req.user?.id || null,
                //     req.user?.mobile || null,
                //     null,
                //     req.body.mobileNumber,
                //     generateRandomString(),
                //     JSON.stringify(req.body),
                //     error.message
                // ]);
            } catch (logError) {
                console.error("Error logging transaction:", logError);
            }
        }
        
        throw new ApiError(500, error.message || "Failed to fetch bill");
    }
});

// Bill payment functionality - follows recharge flow with BBPS integration
const billPayment = asyncHandler(async (req, res) => {
    try {
        let {
            inputs,
            biller,
            mobileNumber,
            totalValue,
            requestId,
            basicInfo,
            additionalInfo,
            amountOptions,
            inputParamsList,
            paymentMode = "UPI"
        } = req.body;


            paymentMode = "Cash";
            let paymentInfo = {
                infoName: "Remarks",
                infoValue: "Received"
            };

        // Validate required fields
        if ((!inputs && !inputParamsList) || !biller || !mobileNumber || !totalValue || !requestId || !basicInfo) {
            throw new ApiError(400, "Missing required fields: inputs or inputParamsList, biller, mobileNumber, totalValue, requestId, basicInfo");
        }

        // Use inputParamsList if provided, otherwise fallback to inputs
        const finalInputParams = inputParamsList || inputs;

        // Get user info from authentication
        const userId = req.user.id;
        const userBalance = parseFloat(req.user.balance);
        const parentId = req.user.parent;
        
        // Get retailer number from users table
        const retailerQuery = `
            SELECT mobile, person 
            FROM users 
            WHERE id = ?
        `;
        const [retailerData] = await db.execute(retailerQuery, [userId]);
        
        if (!retailerData.length) {
            throw new ApiError(404, "Retailer not found");
        }
        
        const retailerNumber = retailerData[0].mobile;
        
        // Get superparent_id by fetching parent's parent
        let superparentId = null;
        if (parentId) {
            const parentQuery = `
                SELECT parent_id as superparent_id 
                FROM users 
                WHERE id = ?
            `;
            const [parentData] = await db.execute(parentQuery, [parentId]);
            superparentId = parentData.length > 0 ? parentData[0].superparent_id : null;
        }
        
        const userHierarchy = {
            parent_id: parentId,
            superparent_id: superparentId
        };
        
        // Convert amount from paisa to rupees for balance check
        const amountInRs = Math.ceil(parseInt(totalValue) / 100);
        
        console.log(`Payment Amount: ₹${amountInRs}, User Balance: ₹${userBalance}, Retailer: ${retailerNumber}, Parent: ${parentId}, Superparent: ${superparentId}`);

        // Check sufficient balance
        if (userBalance < amountInRs) {
            throw new ApiError(400, "Insufficient balance");
        }

        // Get biller information to find category
        const billerQuery = `
            SELECT b.biller_id, b.biller_adhoc, b.payment_amount_exactness as biller_payment_exactness, 
                   b.biller_category
            FROM billers b
            WHERE b.biller_id = ?
        `;
        
        const [billerData] = await db.execute(billerQuery, [biller]);
        
        if (!billerData.length) {
            throw new ApiError(404, "Biller not found");
        }
        
        const billerInfo = billerData[0];
        const billerId = billerInfo.biller_id;
        const billerCategory = billerInfo.biller_category;
        
        // Get keyword_id based on category description and BBPS operator type
        const keywordQuery = `
            SELECT k.id as keyword_id,  k.description as category_name
            FROM keywords k
            INNER JOIN operators o ON k.operator_id = o.id
            INNER JOIN operator_types ot ON o.type = ot.id
            WHERE k.description = ? AND ot.name = 'BBPS'
        `;
        
        const [keywordData] = await db.execute(keywordQuery, [billerCategory]);
        
        if (!keywordData.length) {
            throw new ApiError(404, "Keyword not found for this biller category");
        }
        
        const keywordId = keywordData[0].keyword_id;
        
        // Calculate user margins using the same logic as recharge system
        const marginResult = await calculateUserMargins({
            userId,
            parentId,
            keywordId,
            amount: amountInRs
        });
        
        console.log("Calculated Margins:", marginResult);

       

        try {
            // 1. Deduct balance from user
            const deductQuery = `
                UPDATE users 
                SET balance = balance - ?
                WHERE id = ? AND balance >= ?
            `;
            
            const [deductResult] = await db.execute(deductQuery, [amountInRs, userId, amountInRs]);
            
            if (deductResult.affectedRows === 0) {
                throw new ApiError(400, "Failed to deduct amount - insufficient balance");
            }

            // 2. Create recharge record (BBPS payments are treated as recharges in the system)
            const rechargeQuery = `
                INSERT INTO recharges 
                (user_id, keyword_id, account, number, amount, deducted_amount, 
                  message, params, reqid, txnid, user_prev_balance, user_new_balance,
                 parent_id, superparent_id,  created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'BBPS Payment Processing', ?, ?, ?, ?, ?, ?, ?,  NOW())
            `;
            
            const rechargeParams = {
                inputs: finalInputParams,
                biller,
                mobileNumber,
                totalValue,
                basicInfo,
                additionalInfo,
                amountOptions,
                paymentMode
            };

            const [rechargeResult] = await db.execute(rechargeQuery, [
                userId,
                keywordId,
                basicInfo.customerNumber || mobileNumber,
                mobileNumber,
                amountInRs,
                amountInRs,
                JSON.stringify(rechargeParams),
                0, // reqid will be updated with recharge insertId after getting it
                '', // txnid will be updated after BBPS response
                userBalance,
                userBalance - amountInRs,
                parentId || null,
                superparentId || null
            ]);

            const rechargeId = rechargeResult.insertId;
           // requestId = rechargeId;
            // this request id can be od ny number but we need request id to be of 35 characters so can you please  crat somethign by which this rechargeid wil be the last digits f that with initals as EWORLD and tehn random numebrs like EWORLDRANDOMrechargeid
            // Generate a 35-character requestId: "EWORLD" + random (pad to 35 - 6 - rechargeId.length) + rechargeId
           
            const rechargeIdStr = String(rechargeId);
            const randomLength = 35 -  rechargeIdStr.length;
            const randomPart = generateRandomString(randomLength > 0 ? randomLength : 0);
          //  requestId = `${randomPart}${rechargeIdStr}`;

            // Update reqid with the recharge insertId
            await db.execute(
                `UPDATE recharges SET reqid = ? WHERE id = ?`,
                [rechargeId, rechargeId]
            );

            // 3. Create recharge_gigs record to track BBPS API call (matching recharge pattern)
            const bbpsRequestData = {
                inputs: finalInputParams,
                biller,
                mobileNumber,
                totalValue,
                requestId,
                basicInfo,
                additionalInfo,
                amountOptions,
                paymentMode,
                agentId: "CC01CV35AGTU00000007"
            };

            const [gigResult] = await db.execute(
                "INSERT INTO recharge_gigs (rech_id, user_id, line_id, api_id, provider_id, amount, prev_balance, config, request) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    rechargeId,
                    userId,
                    0, // line_id (no specific line for BBPS)
                    0, // api_id (BBPS API)
                    0, // provider_id
                    amountInRs,
                    userBalance,
                    'bbps_payment',
                    JSON.stringify(bbpsRequestData)
                ]
            );

            const gigId = gigResult.insertId;

            // 4. Log BBPS transaction
            const bbpsTransactionQuery = `
                INSERT INTO bbps_transactions 
                (retailer_id, retailer_mobile, biller_id, customer_number, amount, reference_id, 
                 customer_name, customer_mobile, bill_number, request_data, status, 
                 transaction_type, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', 'payment', NOW())
            `;
            //TODO 
            // await db.execute(bbpsTransactionQuery, [
            //     userId,
            //     retailerNumber,
            //     billerId,
            //     basicInfo.customerNumber || mobileNumber,
            //     amountInRs,
            //     requestId, // Using rechargeId as reference_id instead of requestId
            //     basicInfo.customerName || '',
            //     mobileNumber,
            //     basicInfo.billNumber || '',
            //     JSON.stringify(req.body)
            // ]);

            // 5. Make BBPS API call
            const agentId = "CC01CV35AGTU00000007";
            
            // Create XML for bill payment (matching exact sample XML structure)
            // Determine available payment modes from billerInfo.biller_payment_modes
         

            const paymentModesRaw = (billerInfo.biller_payment_modes || "").toUpperCase();

            if (paymentModesRaw.includes("CASH")) {
                  paymentMode = "Cash";
                paymentInfo = {
                    infoName: "Remarks",
                    infoValue: "Received"
                };
               
            } else if (paymentModesRaw.includes("UPI")) {
               paymentMode = "UPI";
                paymentInfo = {
                    infoName: "VPA",
                    infoValue: "9667027786@ptyes"
                };
            } else if (paymentModesRaw.includes("CREDIT")) {
                paymentMode = "Credit_Card";
                paymentInfo = {
                    infoName: "CardNum|AuthCode",
                    infoValue: "1234567890123456|AUTH123"
                };
            } else if (paymentModesRaw.includes("DEBIT")) {
                paymentMode = "Debit_Card";
                paymentInfo = {
                    infoName: "CardNum|AuthCode",
                    infoValue: "1234567890123456|AUTH123"
                };
            } else if (paymentModesRaw.includes("IMPS")) {
                paymentMode = "IMPS";
                paymentInfo = {
                    infoName: "MMID|MobileNo",
                    infoValue: "1234567|9999999999"
                };
            } else if (paymentModesRaw.includes("NEFT")) {
                paymentMode = "NEFT";
                paymentInfo = {
                    infoName: "IFSC|AccountNo",
                    infoValue: "SBIN0000001|1234567890"
                };
            } else if (paymentModesRaw.includes("PREPAID")) {
                paymentMode = "Prepaid_Card";
                paymentInfo = {
                    infoName: "CardNum|AuthCode",
                    infoValue: "1234567890123456|AUTH123"
                };
            }

            const xmlObject = {
                billPaymentRequest: {
                    agentId: "CC01CV35AGTU00000007",
                    billerAdhoc:  true,
                    agentDeviceInfo: {
                        initChannel: "AGT",
                        ip: "192.168.2.73",
                        mac: "01-23-45-67-89-ab",
                    },
                    customerInfo: {
                         customerMobile: basicInfo.customerNumber,
                        customerAdhaar: { _text: "" },
                        customerEmail: { _text: "" },
                        customerPan: { _text: "" },
                
                    },
                    billerId: billerId,
                    inputParams: {
                        input: finalInputParams,
                    },
                    billerResponse: (() => {
                        // Pass billerResponse exactly as received from billFetch without modifications
                        const response = {
                            billAmount: basicInfo.billAmount,
                            customerName: basicInfo.customerName,
                        };
                        
                        // Only add fields if they exist and are not empty in basicInfo
                        if (basicInfo.billDate && basicInfo.billDate.trim() !== '') {
                            response.billDate = basicInfo.billDate;
                        }
                        if (basicInfo.billNumber && basicInfo.billNumber.trim() !== '') {
                            response.billNumber = basicInfo.billNumber;
                        }
                        if (basicInfo.billPeriod && basicInfo.billPeriod.trim() !== '') {
                            response.billPeriod = basicInfo.billPeriod;
                        }
                        if (basicInfo.dueDate && basicInfo.dueDate.trim() !== '') {
                            response.dueDate = basicInfo.dueDate;
                        }
                        
                        // Only add amountOptions if they were in the original billFetch response
                        if (amountOptions && amountOptions.length > 0) {
                            response.amountOptions = {
                                option: amountOptions
                            };
                        }
                        
                        return response;
                    })(),
                    ...(additionalInfo && additionalInfo.length > 0 && {
                        additionalInfo: {
                            info: additionalInfo
                        }
                    }),
                    amountInfo: {
                        amount: totalValue,
                        currency: "356",
                        custConvFee: "0",
                        amountTags: { _text: "" },
                    },
                    paymentMethod: {
                        paymentMode: paymentMode,
                        quickPay: "N",
                        splitPay: "N",
                    },
                    paymentInfo: {
                        info: paymentInfo,
                    },
                    // paymentRefId: `EWORLD${generateRandomString()}`,
                },
            };

            console.log("BBPS Payment XML Object:", JSON.stringify(xmlObject, null, 2));

            // Convert to XML
            const xml = convert.js2xml(xmlObject, { compact: true, spaces: 2 });
            const requestedXml = `<?xml version="1.0" encoding="UTF-8"?> ${xml}`;
            
            console.log("Generated XML Request:", requestedXml);
            
            // Encrypt XML
            const encryptXmlData = encrypt(requestedXml, BBPS_CONFIG.workingKey);
            
            // Prepare API request data
            const apiData = {
                accessCode: BBPS_CONFIG.accessCode,
                requestId: requestId,
                encRequest: encryptXmlData,
                ver: "1.0",
                instituteId: BBPS_CONFIG.agentId,
            };

            const query = `accessCode=${apiData.accessCode}&requestId=${apiData.requestId}&ver=${apiData.ver}&instituteId=${apiData.instituteId}&encRequest=${apiData.encRequest}`;
            const apiUrl = `https://api.billavenue.com/billpay/extBillPayCntrl/billPayRequest/xml?${query}`;
            
            console.log("BBPS Payment API URL:", apiUrl);

            // Make BBPS API call
            const response = await axios.post(apiUrl, apiData, {
                headers: {
                    "Content-Type": "application/xml",
                },
            });

            if (response.status === 200) {
                // Decrypt and parse response
                const xmlResponse = decrypt(response.data, BBPS_CONFIG.workingKey);
                console.log("Decrypted Payment Response:", xmlResponse);

                const convert = require('xml-js');
                const result = convert.xml2js(xmlResponse, { compact: true, spaces: 4 });
                console.log("Parsed Payment Response:", JSON.stringify(result, null, 2));

                let finalStatus = 'failed';
                let txnRefId = '';
                let responseMessage = 'Payment failed';
                let finalResponse = {};

                if (result.ExtBillPayResponse && result.ExtBillPayResponse.responseCode) {
                    const responseCode = result.ExtBillPayResponse.responseCode._text || result.ExtBillPayResponse.responseCode;
                    
                    if (responseCode === "000") {
                        finalStatus = 'success';
                        txnRefId = result.ExtBillPayResponse.txnRefId?._text || result.ExtBillPayResponse.txnRefId || '';
                        responseMessage = 'Payment successful';
                        
                        const billerResponse = result.ExtBillPayResponse;
                        finalResponse = {
                            status: true,
                            rechargeId: rechargeId,
                            txnRefId: txnRefId,
                            responseStatus: billerResponse.responseReason?._text || 'Success',
                            custConvFee: billerResponse.CustConvFee?._text || '0',
                            respAmount: billerResponse.RespAmount?._text || totalValue,
                            respBillDate: billerResponse.RespBillDate?._text || '',
                            respBillNumber: billerResponse.RespBillNumber?._text || '',
                            respBillPeriod: billerResponse.RespBillPeriod?._text || '',
                            respCustomerName: billerResponse.RespCustomerName?._text || '',
                            respDueDate: billerResponse.RespDueDate?._text || '',
                            billerName: biller,
                            requestId: requestId,
                            amount: amountInRs,
                            commission: {
                                retailer: marginResult.retailerAddition,
                                parent: marginResult.parentAddition,
                                superparent: marginResult.superAddition
                            }
                        };

                    } else if (responseCode === "999") {
                        // Check for PNR001 (pending status)
                        const errorInfo = result.ExtBillPayResponse.errorInfo;
                        if (errorInfo && errorInfo.error) {
                            const errors = Array.isArray(errorInfo.error) ? errorInfo.error : [errorInfo.error];
                            const pnrError = errors.find(err => 
                                (err.errorCode?._text || err.errorCode) === "PNR001"
                            );
                            
                            if (pnrError) {
                                finalStatus = 'success'; // Treat PNR001 as success
                                responseMessage = 'Payment successful (pending confirmation)';
                                txnRefId = result.ExtBillPayResponse.txnRefId?._text || result.ExtBillPayResponse.txnRefId || '';
                                
                                finalResponse = {
                                    status: true,
                                    rechargeId: rechargeId,
                                    txnRefId: txnRefId,
                                    responseStatus: 'Pending Confirmation',
                                    billerName: biller,
                                    requestId: requestId,
                                    amount: amountInRs,
                                    commission: {
                                        retailer: marginResult.retailerAddition,
                                        parent: marginResult.parentAddition,
                                        superparent: marginResult.superAddition
                                    }
                                };
                            } else {
                                finalStatus = 'failed';
                                responseMessage = errors.map(err => 
                                    (err.errorMessage?._text || err.errorMessage || 'Unknown error')
                                ).join(', ');
                            }
                        }
                    } else {
                        finalStatus = 'failed';
                        responseMessage = `Payment failed with code: ${responseCode}`;
                    }
                }

                // Handle success case - distribute commissions (like in recharge system)
                if (finalStatus === 'success') {
                    // Update recharge record with commission details
                    await db.execute(
                        `UPDATE recharges SET 
                         status = ?, message = ?, txnid = ?, 
                         com_retailer = ?, com_parent = ?, com_superparent = ?, 
                         deducted_amount = deducted_amount - ?, 
                         user_new_balance = user_new_balance + ?,
                         completed_at = NOW() 
                         WHERE id = ?`,
                        [
                            finalStatus, 
                            responseMessage, 
                            txnRefId,
                            marginResult.retailerAddition,
                            marginResult.parentAddition,
                            marginResult.superAddition,
                            marginResult.retailerAddition, // Reduce deducted amount by retailer commission
                            marginResult.retailerAddition, // Add to user's new balance
                            rechargeId
                        ]
                    );

                    // Distribute commissions to users
                    if (marginResult.retailerAddition > 0) {
                        await db.execute(
                            `UPDATE users SET balance = balance + ? WHERE id = ?`,
                            [marginResult.retailerAddition, userId]
                        );
                    }
                    
                    if (marginResult.parentAddition > 0 && parentId) {
                        await db.execute(
                            `UPDATE users SET balance = balance + ? WHERE id = ?`,
                            [marginResult.parentAddition, parentId]
                        );
                    }
                    
                    if (marginResult.superAddition > 0 && marginResult.superParentId) {
                        await db.execute(
                            `UPDATE users SET balance = balance + ? WHERE id = ?`,
                            [marginResult.superAddition, marginResult.superParentId]
                        );
                    }

                } else {
                    // Handle failed case - refund the amount
                    await db.execute(
                        `UPDATE recharges SET 
                         status = ?, message = ?, txnid = ?, 
                         deducted_amount = deducted_amount + ?, 
                         user_new_balance = user_new_balance + ?,
                         completed_at = NOW() 
                         WHERE id = ?`,
                        [finalStatus, responseMessage, txnRefId, amountInRs, amountInRs, rechargeId]
                    );

                    await db.execute(
                        `UPDATE users SET balance = balance + ? WHERE id = ?`,
                        [amountInRs, userId]
                    );
                    
                    finalResponse = {
                        status: false,
                        message: responseMessage,
                        requestId: requestId,
                        rechargeId: rechargeId
                    };
                }

                // Update BBPS transaction
                await db.execute(
                    `UPDATE bbps_transactions SET status = ?, response_data = ?, txn_ref_id = ?, updated_at = NOW() WHERE reference_id = ?`,
                    [finalStatus, JSON.stringify(result), txnRefId, String(rechargeId)]
                );

                // Update recharge_gigs record with response (matching recharge pattern)
                await db.execute(
                    `UPDATE recharge_gigs SET status = ?, new_balance = ?, response = ?, response_complete = ?, message = ? WHERE id = ?`,
                    [
                        finalStatus, 
                        userBalance - amountInRs + (finalStatus === 'success' ? marginResult.retailerAddition : amountInRs), // new balance after commission/refund
                        JSON.stringify(result), 
                        JSON.stringify(result),
                        responseMessage, 
                        gigId
                    ]
                );

                // Commit transaction
                await db.execute('COMMIT');

                return res.status(finalStatus === 'success' ? 200 : 400).json(
                    new ApiResponse(
                        finalStatus === 'success' ? 200 : 400, 
                        finalResponse, 
                        responseMessage
                    )
                );

            } else {
                throw new ApiError(500, "BBPS API returned non-200 status");
            }

        } catch (error) {
            // Rollback transaction on error and update records
            await db.execute('ROLLBACK');
            
            // If we have rechargeId and gigId, update them with error status
            if (typeof rechargeId !== 'undefined') {
                try {
                    // Update recharge record with error
                    await db.execute(
                        `UPDATE recharges SET 
                         status = 'failed', message = ?, completed_at = NOW(),
                         deducted_amount = deducted_amount + ?, 
                         user_new_balance = user_new_balance + ?
                         WHERE id = ?`,
                        [error.message || 'API call failed', amountInRs, amountInRs, rechargeId]
                    );

                    // Refund user balance
                    await db.execute(
                        `UPDATE users SET balance = balance + ? WHERE id = ?`,
                        [amountInRs, userId]
                    );

                    // Update recharge_gigs record with error (matching recharge pattern)
                    if (typeof gigId !== 'undefined') {
                        await db.execute(
                            `UPDATE recharge_gigs SET status = ?, new_balance = ?, response_complete = ?, message = ? WHERE id = ?`,
                            ['failed', userBalance, JSON.stringify({ error: error.message }), error.message || 'API call failed', gigId]
                        );
                    }
                } catch (updateError) {
                    console.error("Error updating records after API failure:", updateError);
                }
            }
            
            throw error;
        }
        
    } catch (error) {
        console.error("Error in bill payment:", error);
        
        // Log error if we have basic request info
        if (req.body.requestId && req.body.mobileNumber) {
            try {
                const errorLogQuery = `
                    INSERT INTO bbps_transactions 
                    (retailer_id, retailer_mobile, customer_number, reference_id, request_data, 
                     status, error_message, transaction_type, created_at)
                    VALUES (?, ?, ?, ?, ?, 'error', ?, 'payment', NOW())
                `;
                
                await db.execute(errorLogQuery, [
                    req.user?.id || null,
                    req.user?.mobile || null,
                    req.body.mobileNumber,
                    req.body.requestId,
                    JSON.stringify(req.body),
                    error.message
                ]);
            } catch (logError) {
                console.error("Error logging payment transaction:", logError);
            }
        }
        
        throw new ApiError(500, error.message || "Failed to process bill payment");
    }
});

// Quick pay validation
const quickPayValidation = asyncHandler(async (req, res) => {
    try {
        const {
            billerId,
            customerNumber,
            amount,
            retailerNumber
        } = req.body;

        // Validate required fields
        if (!billerId || !customerNumber || !amount || !retailerNumber) {
            throw new ApiError(400, "Missing required fields");
        }

        // Check retailer
        const retailerQuery = `
            SELECT id, person, mobile, balance, status 
            FROM users 
            WHERE mobile = ? AND status = 'active'
        `;
        const [retailerData] = await db.execute(retailerQuery, [retailerNumber]);
        
        if (!retailerData.length) {
            throw new ApiError(404, "Retailer not found or inactive");
        }

        const retailer = retailerData[0];
        const billAmount = parseInt(amount);

        // Validation checks
        const validationResult = {
            retailerValid: true,
            balanceValid: retailer.balance >= billAmount,
            billerValid: true, // This should check against active billers
            amountValid: billAmount > 0 && billAmount <= 100000, // Max amount check
            validationStatus: "success"
        };

        if (!validationResult.balanceValid) {
            validationResult.validationStatus = "failed";
            validationResult.message = "Insufficient balance";
        }

        return res.status(200).json(
            new ApiResponse(200, validationResult, "Validation completed")
        );

    } catch (error) {
        console.error("Error in quick pay validation:", error);
        throw new ApiError(500, error.message || "Validation failed");
    }
});

// Complaint registration
const complainRegistration = asyncHandler(async (req, res) => {
    try {
        const {
            txnRefId,
            complaintType,
            complaintDesc,
            retailerNumber,
            customerMobile
        } = req.body;

        if (!txnRefId || !complaintType || !retailerNumber) {
            throw new ApiError(400, "Missing required fields");
        }

        // Generate complaint ID
        const complaintId = "CMP" + Date.now();

        // Insert complaint
        const complaintQuery = `
            INSERT INTO bbps_complaints 
            (complaint_id, txn_ref_id, complaint_type, complaint_desc, retailer_mobile, 
            customer_mobile, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'open', NOW())
        `;

        await db.execute(complaintQuery, [
            complaintId,
            txnRefId,
            complaintType,
            complaintDesc || "",
            retailerNumber,
            customerMobile || ""
        ]);

        return res.status(200).json(
            new ApiResponse(200, {
                complaintId,
                status: "registered",
                message: "Complaint registered successfully"
            }, "Complaint registered successfully")
        );

    } catch (error) {
        console.error("Error in complaint registration:", error);
        throw new ApiError(500, error.message || "Failed to register complaint");
    }
});

// Complaint tracking
const complainTracking = asyncHandler(async (req, res) => {
    try {
        const { complaintId, retailerNumber } = req.body;

        if (!complaintId || !retailerNumber) {
            throw new ApiError(400, "Missing required fields");
        }

        const trackingQuery = `
            SELECT complaint_id, txn_ref_id, complaint_type, complaint_desc, 
                   status, created_at, updated_at
            FROM bbps_complaints 
            WHERE complaint_id = ? AND retailer_mobile = ?
        `;

        const [complaints] = await db.execute(trackingQuery, [complaintId, retailerNumber]);

        if (!complaints.length) {
            throw new ApiError(404, "Complaint not found");
        }

        return res.status(200).json(
            new ApiResponse(200, complaints[0], "Complaint details fetched successfully")
        );

    } catch (error) {
        console.error("Error in complaint tracking:", error);
        throw new ApiError(500, error.message || "Failed to track complaint");
    }
});

// Search transaction
const searchTransaction = asyncHandler(async (req, res) => {
    try {
        const { 
            referenceId, 
            txnRefId, 
            retailerNumber, 
            startDate, 
            endDate,
            page = 1,
            limit = 10
        } = req.query;

        let query = `
            SELECT reference_id, txn_ref_id, biller_id, customer_number, amount, 
                   status, created_at, updated_at
            FROM bbps_transactions 
            WHERE 1=1
        `;
        
        const params = [];

        if (referenceId) {
            query += ` AND reference_id = ?`;
            params.push(referenceId);
        }

        if (txnRefId) {
            query += ` AND txn_ref_id = ?`;
            params.push(txnRefId);
        }

        if (retailerNumber) {
            query += ` AND retailer_mobile = ?`;
            params.push(retailerNumber);
        }

        if (startDate && endDate) {
            query += ` AND DATE(created_at) BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

        const [transactions] = await db.execute(query, params);

        return res.status(200).json(
            new ApiResponse(200, transactions, "Transactions fetched successfully")
        );

    } catch (error) {
        console.error("Error in transaction search:", error);
        throw new ApiError(500, error.message || "Failed to search transactions");
    }
});

// Validate biller file format and content
const validateBillerFileEndpoint = asyncHandler(async (req, res) => {
    try {
        const filePath = req.query.filePath || BBPS_CONFIG.billerFilePath;
        
        const validation = await validateBillerFile(filePath);
        
        if (!validation.isValid) {
            return res.status(400).json(
                new ApiResponse(400, null, validation.error)
            );
        }
        
        return res.status(200).json(
            new ApiResponse(200, {
                totalRecords: validation.totalRecords,
                sampleData: validation.sampleData,
                filePath: filePath
            }, validation.message)
        );
        
    } catch (error) {
        console.error("Error validating biller file:", error);
        throw new ApiError(500, error.message || "Failed to validate biller file");
    }
});

// Get biller data from file (for testing/preview)
const getBillerFileData = asyncHandler(async (req, res) => {
    try {
        const { start = 0, limit = 100 } = req.query;
        const filePath = req.query.filePath || BBPS_CONFIG.billerFilePath;
        
        const billerIds = await getBillerIdsFromFile(filePath, parseInt(start), parseInt(limit));
        
        return res.status(200).json(
            new ApiResponse(200, {
                billerIds: billerIds,
                count: billerIds.length,
                start: parseInt(start),
                limit: parseInt(limit)
            }, "Biller data fetched from file successfully")
        );
        
    } catch (error) {
        console.error("Error getting biller file data:", error);
        throw new ApiError(500, error.message || "Failed to get biller file data");
    }
});

// Calculate user margins function (same as in retailer controller)
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
    if (parentId) {
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
                      WHEN u.role_id = 2 THEN k.ret_std_margin
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
        if (parentMargin && parentMargin.role == 4) {
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
    }

    console.log("supermargin", superMargin);

    // Default values
    let retailerAdd = retailerMargin ? parseFloat(retailerMargin.margin) : 0;
    let parentAdd = 0;
    let superAdd = 0;

    // Parent margin calculation
    if (parentMargin) {
        if (retailerMargin.margin_type === "flat") {
            parentAdd = parseFloat(parentMargin.margin);
        } else {
            parentAdd = parseFloat(parentMargin.margin) - retailerAdd;
        }

        // Super margin calculation
        if (parentMargin.role == 4 && superMargin) {
            if (parentMargin.margin_type === "flat") {
                superAdd = parseFloat(superMargin.margin);
            } else {
                superAdd = parseFloat(superMargin.margin) - parseFloat(parentMargin.margin);
            }
        }
    }

    const retailerAddition = retailerMargin ? 
        retailerAdd * (parsedAmount / 100) +
        (retailerMargin.is_charges_fixed
            ? parseFloat(retailerMargin.additional_charges)
            : amount * (parseFloat(retailerMargin.additional_charges) / 100)) : 0;

    const parentAddition = parentMargin ?
        parentAdd * (parsedAmount / 100) +
        (parentMargin.is_charges_fixed
            ? parseFloat(parentMargin.additional_charges)
            : amount * (parseFloat(parentMargin.additional_charges) / 100)) : 0;

    const superAddition = (parentMargin && parentMargin.role == 4 && superMargin) ?
        superAdd * (parsedAmount / 100) +
        (superMargin.is_charges_fixed
            ? parseFloat(superMargin.additional_charges)
            : amount * (parseFloat(superMargin.additional_charges) / 100)) : 0;

    return {
        retailerAddition,
        parentAddition,
        superAddition,
        superParentId: parentMargin ? parentMargin.parent : null,
        isDirect: parentMargin ? parentMargin.role != 4 : true,
        rawMargins: {
            retailerMargin: retailerAdd,
            parentMargin: parentAdd,
            superMargin: superAdd
        }
    };
}

module.exports = {
    getPaymentModes,
    getBillerParams,
    getBillersByCategory,
    getHomeScreenData,
    getBills,
    getStoredBillers,
    getBillerInfo,
    billFetch,
    billPayment,
    quickPayValidation,
    complainRegistration,
    complainTracking,
    searchTransaction,
    validateBillerFileEndpoint,
    getBillerFileData
};
