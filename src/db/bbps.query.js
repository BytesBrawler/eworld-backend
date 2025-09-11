const db = require('./index');

// BBPS Billers Queries
const bbpsQueries = {
    // Get all active billers
    getAllBillers: async (start = 0, limit = 100) => {
        const query = `
            SELECT biller_id, biller_name, biller_category, biller_mode, 
                   coverage, biller_fetch_requirement, payment_requirement, 
                   payment_amount_exactness, status, created_at, updated_at
            FROM billers 
            WHERE status = 'active' 
            ORDER BY biller_name 
            LIMIT ?, ?
        `;
        const [rows] = await db.execute(query, [parseInt(start), parseInt(limit)]);
        return rows;
    },

    // Get biller by ID
    getBillerById: async (billerId) => {
        const query = `
            SELECT * FROM billers 
            WHERE biller_id = ? AND status = 'active'
        `;
        const [rows] = await db.execute(query, [billerId]);
        return rows[0] || null;
    },

    // Get billers by category
    getBillersByCategory: async (category) => {
        const query = `
            SELECT * FROM billers 
            WHERE biller_category = ? AND status = 'active'
            ORDER BY biller_name
        `;
        const [rows] = await db.execute(query, [category]);
        return rows;
    },

    // Insert new biller
    insertBiller: async (billerData) => {
        const query = `
            INSERT INTO billers 
            (biller_id, biller_name, biller_category, biller_mode, coverage, 
             biller_fetch_requirement, payment_requirement, payment_amount_exactness, 
             created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;
        const [result] = await db.execute(query, [
            billerData.biller_id,
            billerData.biller_name,
            billerData.biller_category,
            billerData.biller_mode,
            billerData.coverage,
            billerData.biller_fetch_requirement,
            billerData.payment_requirement,
            billerData.payment_amount_exactness
        ]);
        return result;
    }
};

// BBPS Transactions Queries
const transactionQueries = {
    // Create new transaction
    createTransaction: async (transactionData) => {
        const query = `
            INSERT INTO bbps_transactions 
            (retailer_id, retailer_mobile, biller_id, customer_number, amount, 
             reference_id, customer_name, customer_mobile, bill_number, 
             request_data, status, transaction_type, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        const [result] = await db.execute(query, [
            transactionData.retailer_id,
            transactionData.retailer_mobile,
            transactionData.biller_id,
            transactionData.customer_number,
            transactionData.amount,
            transactionData.reference_id,
            transactionData.customer_name || null,
            transactionData.customer_mobile || null,
            transactionData.bill_number || null,
            JSON.stringify(transactionData.request_data),
            transactionData.status || 'pending',
            transactionData.transaction_type || 'fetch'
        ]);
        return result;
    },

    // Update transaction
    updateTransaction: async (referenceId, updateData) => {
        const query = `
            UPDATE bbps_transactions 
            SET status = ?, response_data = ?, txn_ref_id = ?, updated_at = NOW()
            WHERE reference_id = ?
        `;
        const [result] = await db.execute(query, [
            updateData.status,
            JSON.stringify(updateData.response_data),
            updateData.txn_ref_id || null,
            referenceId
        ]);
        return result;
    },

    // Get transaction by reference ID
    getTransactionByRefId: async (referenceId) => {
        const query = `
            SELECT * FROM bbps_transactions 
            WHERE reference_id = ?
        `;
        const [rows] = await db.execute(query, [referenceId]);
        return rows[0] || null;
    },

    // Get transactions by retailer
    getTransactionsByRetailer: async (retailerMobile, startDate, endDate, page = 1, limit = 10) => {
        let query = `
            SELECT reference_id, txn_ref_id, biller_id, customer_number, amount, 
                   status, transaction_type, created_at, updated_at
            FROM bbps_transactions 
            WHERE retailer_mobile = ?
        `;
        const params = [retailerMobile];

        if (startDate && endDate) {
            query += ` AND DATE(created_at) BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

        const [rows] = await db.execute(query, params);
        return rows;
    },

    // Search transactions
    searchTransactions: async (searchParams) => {
        let query = `
            SELECT t.*, u.person as retailer_name 
            FROM bbps_transactions t
            LEFT JOIN users u ON t.retailer_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (searchParams.referenceId) {
            query += ` AND t.reference_id = ?`;
            params.push(searchParams.referenceId);
        }

        if (searchParams.txnRefId) {
            query += ` AND t.txn_ref_id = ?`;
            params.push(searchParams.txnRefId);
        }

        if (searchParams.retailerMobile) {
            query += ` AND t.retailer_mobile = ?`;
            params.push(searchParams.retailerMobile);
        }

        if (searchParams.billerId) {
            query += ` AND t.biller_id = ?`;
            params.push(searchParams.billerId);
        }

        if (searchParams.startDate && searchParams.endDate) {
            query += ` AND DATE(t.created_at) BETWEEN ? AND ?`;
            params.push(searchParams.startDate, searchParams.endDate);
        }

        if (searchParams.status) {
            query += ` AND t.status = ?`;
            params.push(searchParams.status);
        }

        query += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
        params.push(
            parseInt(searchParams.limit || 10), 
            (parseInt(searchParams.page || 1) - 1) * parseInt(searchParams.limit || 10)
        );

        const [rows] = await db.execute(query, params);
        return rows;
    }
};

// BBPS Complaints Queries
const complaintQueries = {
    // Create complaint
    createComplaint: async (complaintData) => {
        const query = `
            INSERT INTO bbps_complaints 
            (complaint_id, txn_ref_id, complaint_type, complaint_desc, 
             retailer_mobile, customer_mobile, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'open', NOW())
        `;
        const [result] = await db.execute(query, [
            complaintData.complaint_id,
            complaintData.txn_ref_id,
            complaintData.complaint_type,
            complaintData.complaint_desc || '',
            complaintData.retailer_mobile,
            complaintData.customer_mobile || ''
        ]);
        return result;
    },

    // Get complaint by ID
    getComplaintById: async (complaintId, retailerMobile) => {
        const query = `
            SELECT complaint_id, txn_ref_id, complaint_type, complaint_desc, 
                   status, created_at, updated_at, resolution_desc
            FROM bbps_complaints 
            WHERE complaint_id = ? AND retailer_mobile = ?
        `;
        const [rows] = await db.execute(query, [complaintId, retailerMobile]);
        return rows[0] || null;
    },

    // Update complaint status
    updateComplaintStatus: async (complaintId, status, resolutionDesc = null) => {
        const query = `
            UPDATE bbps_complaints 
            SET status = ?, resolution_desc = ?, updated_at = NOW()
            WHERE complaint_id = ?
        `;
        const [result] = await db.execute(query, [status, resolutionDesc, complaintId]);
        return result;
    },

    // Get complaints by retailer
    getComplaintsByRetailer: async (retailerMobile, page = 1, limit = 10) => {
        const query = `
            SELECT complaint_id, txn_ref_id, complaint_type, status, 
                   created_at, updated_at
            FROM bbps_complaints 
            WHERE retailer_mobile = ?
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `;
        const [rows] = await db.execute(query, [
            retailerMobile,
            parseInt(limit),
            (parseInt(page) - 1) * parseInt(limit)
        ]);
        return rows;
    }
};

// BBPS Statistics Queries
const statsQueries = {
    // Get daily transaction stats
    getDailyStats: async (date) => {
        const query = `
            SELECT 
                COUNT(*) as total_transactions,
                COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_transactions,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions,
                SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END) as total_amount,
                COUNT(DISTINCT retailer_id) as unique_retailers
            FROM bbps_transactions 
            WHERE DATE(created_at) = ?
        `;
        const [rows] = await db.execute(query, [date]);
        return rows[0] || {};
    },

    // Get monthly transaction stats
    getMonthlyStats: async (year, month) => {
        const query = `
            SELECT 
                DATE(created_at) as transaction_date,
                COUNT(*) as total_transactions,
                COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_transactions,
                SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END) as total_amount
            FROM bbps_transactions 
            WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?
            GROUP BY DATE(created_at)
            ORDER BY transaction_date
        `;
        const [rows] = await db.execute(query, [year, month]);
        return rows;
    },

    // Get retailer wise stats
    getRetailerStats: async (startDate, endDate) => {
        const query = `
            SELECT 
                t.retailer_mobile,
                u.person as retailer_name,
                COUNT(*) as total_transactions,
                COUNT(CASE WHEN t.status = 'success' THEN 1 END) as successful_transactions,
                SUM(CASE WHEN t.status = 'success' THEN t.amount ELSE 0 END) as total_amount
            FROM bbps_transactions t
            LEFT JOIN users u ON t.retailer_id = u.id
            WHERE DATE(t.created_at) BETWEEN ? AND ?
            GROUP BY t.retailer_mobile, u.person
            ORDER BY total_amount DESC
        `;
        const [rows] = await db.execute(query, [startDate, endDate]);
        return rows;
    }
};

module.exports = {
    bbpsQueries,
    transactionQueries,
    complaintQueries,
    statsQueries
};
