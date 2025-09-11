const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const { bbpsQueries, transactionQueries, complaintQueries, statsQueries } = require("../db/bbps.query");

// Admin function to add new biller
const addBiller = asyncHandler(async (req, res) => {
    try {
        const {
            biller_id,
            biller_name,
            biller_category,
            biller_mode,
            coverage,
            fetch_requirement,
            payment_requirement,
            payment_amount_exactness
        } = req.body;

        // Validate required fields
        if (!biller_id || !biller_name || !biller_category) {
            throw new ApiError(400, "Biller ID, name, and category are required");
        }

        // Check if biller already exists
        const existingBiller = await bbpsQueries.getBillerById(biller_id);
        if (existingBiller) {
            throw new ApiError(409, "Biller with this ID already exists");
        }

        // Insert new biller
        const result = await bbpsQueries.insertBiller({
            biller_id,
            biller_name,
            biller_category,
            biller_mode: biller_mode || 'online',
            coverage: coverage || '',
            fetch_requirement: fetch_requirement || '',
            payment_requirement: payment_requirement || '',
            payment_amount_exactness: payment_amount_exactness || 'any'
        });

        return res.status(201).json(
            new ApiResponse(201, { biller_id }, "Biller added successfully")
        );

    } catch (error) {
        console.error("Error adding biller:", error);
        throw new ApiError(500, error.message || "Failed to add biller");
    }
});

// Get BBPS dashboard statistics
const getBBPSStats = asyncHandler(async (req, res) => {
    try {
        const { date, startDate, endDate } = req.query;
        const currentDate = date || new Date().toISOString().split('T')[0];

        // Get daily stats
        const dailyStats = await statsQueries.getDailyStats(currentDate);

        // Get monthly stats if date range provided
        let monthlyStats = [];
        if (startDate && endDate) {
            monthlyStats = await statsQueries.getRetailerStats(startDate, endDate);
        }

        return res.status(200).json(
            new ApiResponse(200, {
                dailyStats,
                monthlyStats,
                date: currentDate
            }, "BBPS statistics fetched successfully")
        );

    } catch (error) {
        console.error("Error fetching BBPS stats:", error);
        throw new ApiError(500, error.message || "Failed to fetch statistics");
    }
});

// Get all transactions for admin
const getAllTransactions = asyncHandler(async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            billerId,
            startDate,
            endDate,
            retailerMobile
        } = req.query;

        const searchParams = {
            page,
            limit,
            status,
            billerId,
            startDate,
            endDate,
            retailerMobile
        };

        const transactions = await transactionQueries.searchTransactions(searchParams);

        return res.status(200).json(
            new ApiResponse(200, transactions, "Transactions fetched successfully")
        );

    } catch (error) {
        console.error("Error fetching transactions:", error);
        throw new ApiError(500, error.message || "Failed to fetch transactions");
    }
});

// Get all complaints for admin
const getAllComplaints = asyncHandler(async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        // This would need a modified query to get all complaints
        // For now, we'll use a basic approach
        const db = require("../db/index");
        const query = `
            SELECT c.*, t.biller_id, t.amount, u.person as retailer_name
            FROM bbps_complaints c
            LEFT JOIN bbps_transactions t ON c.txn_ref_id = t.txn_ref_id
            LEFT JOIN users u ON c.retailer_mobile = u.mobile
            ORDER BY c.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const [complaints] = await db.execute(query, [
            parseInt(limit),
            (parseInt(page) - 1) * parseInt(limit)
        ]);

        return res.status(200).json(
            new ApiResponse(200, complaints, "Complaints fetched successfully")
        );

    } catch (error) {
        console.error("Error fetching complaints:", error);
        throw new ApiError(500, error.message || "Failed to fetch complaints");
    }
});

// Update complaint status
const updateComplaintStatus = asyncHandler(async (req, res) => {
    try {
        const { complaintId } = req.params;
        const { status, resolutionDesc } = req.body;

        if (!complaintId || !status) {
            throw new ApiError(400, "Complaint ID and status are required");
        }

        const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
        if (!validStatuses.includes(status)) {
            throw new ApiError(400, "Invalid status value");
        }

        const result = await complaintQueries.updateComplaintStatus(
            complaintId,
            status,
            resolutionDesc || null
        );

        if (result.affectedRows === 0) {
            throw new ApiError(404, "Complaint not found");
        }

        return res.status(200).json(
            new ApiResponse(200, { complaintId, status }, "Complaint status updated successfully")
        );

    } catch (error) {
        console.error("Error updating complaint status:", error);
        throw new ApiError(500, error.message || "Failed to update complaint status");
    }
});

module.exports = {
    addBiller,
    getBBPSStats,
    getAllTransactions,
    getAllComplaints,
    updateComplaintStatus
};
