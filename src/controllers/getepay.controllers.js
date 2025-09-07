const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const query = require("../db/queries.js");
const db = require("../db");
const getepay = require("../utils/getepay");

/**
 * Generate Getepay order and initiate payment
 */
const generateGetepayOrder = asyncHandler(async (req, res) => {
    const { amount, mobile, email, companyName } = req.body;
    
    // Validation
    if (!amount || amount <= 0) {
        throw new ApiError(400, "Invalid amount");
    }
    
    if (!mobile) {
        throw new ApiError(400, "Mobile number is required");
    }

    try {
        // Generate unique order ID
        const orderId = `GETEPAY_${Date.now()}_${req.user.id}`;
        
        // Get Getepay configuration
        const config = await getepay.getConfig();
        
        // Create payment request
        const paymentRequest = getepay.createPaymentRequest({
            mid: config.mid,
            terminalId: config.terminalId,
            amount: amount,
            merchantTransactionId: orderId,
            mobileNo: mobile,
            emailId: email || req.user.email || "",
            companyName: companyName || "EWorld Recharge",
            callbackUrl: `${process.env.BASE_URL || 'http://localhost:5000'}/api/v1/wallet/getepay/callback`
        });

        // Store transaction in database
        const insertQuery = `
            INSERT INTO transactions (
                user_id, order_id, amount, status, gateway, 
                mobile_no, email, company_name, created_at
            ) VALUES (?, ?, ?, 'PENDING', 'GETEPAY', ?, ?, ?, NOW())
        `;
        
        await db.query(insertQuery, [
            req.user.id,
            orderId,
            amount,
            mobile,
            email || "",
            companyName || "EWorld Recharge"
        ]);

        // Generate payment order
        const orderResponse = await getepay.generateRequest(config, paymentRequest);
        
        if (orderResponse.error) {
            // Update transaction status to failed
            await db.query(
                "UPDATE transactions SET status = 'FAILED', error_message = ? WHERE order_id = ?",
                [orderResponse.error, orderId]
            );
            throw new ApiError(400, `Payment order generation failed: ${orderResponse.error}`);
        }

        // Update transaction with gateway response
        await db.query(
            "UPDATE transactions SET gateway_order_id = ?, gateway_response = ? WHERE order_id = ?",
            [orderResponse.orderId || orderResponse.id, JSON.stringify(orderResponse), orderId]
        );

        res.status(200).json(new ApiResponse(200, {
            orderId: orderId,
            gatewayOrderId: orderResponse.orderId || orderResponse.id,
            amount: amount,
            paymentUrl: orderResponse.paymentUrl || orderResponse.redirectUrl,
            ...orderResponse
        }, "Getepay order generated successfully"));

    } catch (error) {
        console.error("Getepay order generation error:", error);
        throw new ApiError(500, error.message || "Failed to generate payment order");
    }
});

/**
 * Handle Getepay callback
 */
const getepayCallback = asyncHandler(async (req, res) => {
    try {
        console.log("Getepay Callback received:", req.body);
        
        const { response, orderId, merchantTransactionId } = req.body;
        
        if (!response) {
            throw new ApiError(400, "Invalid callback data");
        }

        // Get Getepay configuration
        const config = await getepay.getConfig();
        
        // Decrypt the response
        const decryptedResponse = getepay.getepayResponse(config, response);
        console.log("Decrypted callback response:", decryptedResponse);

        const orderIdToUse = merchantTransactionId || orderId;
        
        // Find transaction in database
        const transaction = await db.query(
            "SELECT * FROM transactions WHERE order_id = ? AND gateway = 'GETEPAY'",
            [orderIdToUse]
        );

        if (!transaction || transaction.length === 0) {
            throw new ApiError(404, "Transaction not found");
        }

        const txn = transaction[0];
        
        // Update transaction based on response
        let status = 'FAILED';
        let errorMessage = '';
        
        if (decryptedResponse.status === 'SUCCESS' || decryptedResponse.txnStatus === 'SUCCESS') {
            status = 'SUCCESS';
            
            // Add money to user's wallet
            await db.query(
                "UPDATE users SET balance = balance + ? WHERE id = ?",
                [txn.amount, txn.user_id]
            );
            
            // Insert wallet transaction record
            await db.query(`
                INSERT INTO wallet_transactions (
                    user_id, type, amount, description, reference_id, created_at
                ) VALUES (?, 'CREDIT', ?, 'Money added via Getepay', ?, NOW())
            `, [txn.user_id, txn.amount, orderIdToUse]);
            
        } else {
            errorMessage = decryptedResponse.message || decryptedResponse.statusDesc || 'Transaction failed';
        }

        // Update transaction status
        await db.query(`
            UPDATE transactions 
            SET status = ?, callback_response = ?, error_message = ?, updated_at = NOW()
            WHERE order_id = ?
        `, [status, JSON.stringify(decryptedResponse), errorMessage, orderIdToUse]);

        // Send response back to Getepay
        res.status(200).json({ status: "OK", message: "Callback processed" });

    } catch (error) {
        console.error("Getepay callback error:", error);
        res.status(500).json({ status: "ERROR", message: error.message });
    }
});

/**
 * Check Getepay transaction status
 */
const checkGetepayStatus = asyncHandler(async (req, res) => {
    const { orderId } = req.body;
    
    if (!orderId) {
        throw new ApiError(400, "Order ID is required");
    }

    try {
        // Find transaction in database
        const transaction = await db.query(
            "SELECT * FROM transactions WHERE order_id = ? AND user_id = ? AND gateway = 'GETEPAY'",
            [orderId, req.user.id]
        );

        if (!transaction || transaction.length === 0) {
            throw new ApiError(404, "Transaction not found");
        }

        const txn = transaction[0];
        
        // If transaction is still pending, query Getepay for status
        if (txn.status === 'PENDING') {
            const config = await getepay.getConfig();
            
            const requeryRequest = {
                merchantTransactionId: orderId,
                transactionDate: txn.created_at
            };
            
            const statusResponse = await getepay.requeryRequest(config, requeryRequest);
            
            if (statusResponse) {
                let newStatus = 'FAILED';
                let errorMessage = '';
                
                if (statusResponse.status === 'SUCCESS' || statusResponse.txnStatus === 'SUCCESS') {
                    newStatus = 'SUCCESS';
                    
                    // Add money to user's wallet if not already added
                    await db.query(
                        "UPDATE users SET balance = balance + ? WHERE id = ?",
                        [txn.amount, txn.user_id]
                    );
                    
                    // Insert wallet transaction record
                    await db.query(`
                        INSERT INTO wallet_transactions (
                            user_id, type, amount, description, reference_id, created_at
                        ) VALUES (?, 'CREDIT', ?, 'Money added via Getepay', ?, NOW())
                    `, [txn.user_id, txn.amount, orderId]);
                    
                } else {
                    errorMessage = statusResponse.message || statusResponse.statusDesc || 'Transaction failed';
                }

                // Update transaction status
                await db.query(`
                    UPDATE transactions 
                    SET status = ?, gateway_response = ?, error_message = ?, updated_at = NOW()
                    WHERE order_id = ?
                `, [newStatus, JSON.stringify(statusResponse), errorMessage, orderId]);
                
                txn.status = newStatus;
                txn.error_message = errorMessage;
            }
        }

        res.status(200).json(new ApiResponse(200, {
            orderId: txn.order_id,
            amount: txn.amount,
            status: txn.status,
            gateway: txn.gateway,
            createdAt: txn.created_at,
            updatedAt: txn.updated_at,
            errorMessage: txn.error_message
        }, "Transaction status fetched successfully"));

    } catch (error) {
        console.error("Getepay status check error:", error);
        throw new ApiError(500, error.message || "Failed to check transaction status");
    }
});

/**
 * Refund Getepay transaction
 */
const refundGetepayTransaction = asyncHandler(async (req, res) => {
    const { orderId, refundAmount, reason } = req.body;
    
    if (!orderId) {
        throw new ApiError(400, "Order ID is required");
    }
    
    if (!refundAmount || refundAmount <= 0) {
        throw new ApiError(400, "Invalid refund amount");
    }

    try {
        // Find successful transaction
        const transaction = await db.query(
            "SELECT * FROM transactions WHERE order_id = ? AND status = 'SUCCESS' AND gateway = 'GETEPAY'",
            [orderId]
        );

        if (!transaction || transaction.length === 0) {
            throw new ApiError(404, "Successful transaction not found");
        }

        const txn = transaction[0];
        
        // Check if refund amount is valid
        if (refundAmount > txn.amount) {
            throw new ApiError(400, "Refund amount cannot be greater than transaction amount");
        }

        // Check user permission
        if (txn.user_id !== req.user.id && req.user.role !== 'admin') {
            throw new ApiError(403, "Not authorized to refund this transaction");
        }

        const config = await getepay.getConfig();
        
        const refundRequest = {
            merchantTransactionId: orderId,
            refundAmount: `${refundAmount}.00`,
            refundReason: reason || "Customer request",
            refundId: `REFUND_${Date.now()}_${orderId}`
        };
        
        const refundResponse = await getepay.refundRequest(config, refundRequest);
        
        if (!refundResponse || refundResponse.error) {
            throw new ApiError(400, `Refund failed: ${refundResponse?.error || 'Unknown error'}`);
        }

        // Record refund in database
        const refundQuery = `
            INSERT INTO refunds (
                user_id, order_id, original_amount, refund_amount, 
                reason, gateway, gateway_response, status, created_at
            ) VALUES (?, ?, ?, ?, ?, 'GETEPAY', ?, 'PENDING', NOW())
        `;
        
        await db.query(refundQuery, [
            txn.user_id,
            orderId,
            txn.amount,
            refundAmount,
            reason || "Customer request",
            JSON.stringify(refundResponse)
        ]);

        res.status(200).json(new ApiResponse(200, {
            orderId: orderId,
            refundAmount: refundAmount,
            refundId: refundRequest.refundId,
            status: refundResponse.status || 'PENDING',
            ...refundResponse
        }, "Refund initiated successfully"));

    } catch (error) {
        console.error("Getepay refund error:", error);
        throw new ApiError(500, error.message || "Failed to initiate refund");
    }
});

/**
 * Get all Getepay transactions for a user
 */
const getGetepayTransactions = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    try {
        let whereClause = "WHERE user_id = ? AND gateway = 'GETEPAY'";
        const queryParams = [req.user.id];

        if (status) {
            whereClause += " AND status = ?";
            queryParams.push(status);
        }

        const transactions = await db.query(`
            SELECT 
                order_id, amount, status, gateway, mobile_no, 
                email, company_name, created_at, updated_at, error_message
            FROM transactions 
            ${whereClause}
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `, [...queryParams, parseInt(limit), offset]);

        const countResult = await db.query(`
            SELECT COUNT(*) as total 
            FROM transactions 
            ${whereClause}
        `, queryParams);

        const total = countResult[0].total;

        res.status(200).json(new ApiResponse(200, {
            transactions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        }, "Getepay transactions fetched successfully"));

    } catch (error) {
        console.error("Get Getepay transactions error:", error);
        throw new ApiError(500, "Failed to fetch transactions");
    }
});

module.exports = {
    generateGetepayOrder,
    getepayCallback,
    checkGetepayStatus,
    refundGetepayTransaction,
    getGetepayTransactions
};
