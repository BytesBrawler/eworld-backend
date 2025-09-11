const { Router } = require("express");
const {
    addBiller,
    getBBPSStats,
    getAllTransactions,
    getAllComplaints,
    updateComplaintStatus
} = require("../controllers/bbpsAdmin.controller.js");
const verifyAuth = require("../middlewares/auth.middleware.js");

const router = Router();

// Admin routes - require authentication and admin role
router.route("/addBiller").post(verifyAuth, addBiller);
router.route("/stats").get(verifyAuth, getBBPSStats);
router.route("/transactions").get(verifyAuth, getAllTransactions);
router.route("/complaints").get(verifyAuth, getAllComplaints);
router.route("/complaints/:complaintId/status").put(verifyAuth, updateComplaintStatus);

module.exports = router;
