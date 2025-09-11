const { Router } = require("express");
const {
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
} = require("../controllers/bbps.controller.js");
const verifyAuth = require("../middlewares/auth.middleware.js");

const router = Router();

// Public routes (for webhook/notifications)
router.route("/notifications").post((req, res) => {
    console.log("BBPS Notification received:", req.body);
    res.status(200).json({ status: "received" });
});

// Fetch routes from old system
router.route("/fetch/payment_modes").get(verifyAuth, getPaymentModes);
router.route("/fetch/params").get(verifyAuth, getBillerParams); // -- done
router.route("/fetch/billersByCategory").get(verifyAuth, getBillersByCategory); // -- done 
router.route("/fetch/homeScreenData").get(verifyAuth, getHomeScreenData);  // -- -- done 
router.route("/fetch/bills").get(verifyAuth, getBills);

// Protected routes - require authentication
router.route("/storedBillers").get(getStoredBillers); // Get billers from database
router.route("/billerInfo").get( getBillerInfo); // Fetch from API and update database ---------------- dobe
router.route("/billFetch").post(verifyAuth, billFetch); // -------- done
router.route("/billPayment").post(verifyAuth, billPayment);
router.route("/quickPayValidation").post(verifyAuth, quickPayValidation);
router.route("/complainRegistration").post(verifyAuth, complainRegistration);
router.route("/complainTracking").post(verifyAuth, complainTracking);
router.route("/searchTransaction").get(verifyAuth, searchTransaction);

// File management routes
router.route("/validateBillerFile").get( validateBillerFileEndpoint);
router.route("/getBillerFileData").get( getBillerFileData);

// Alternative route naming to match old structure
router.route("/fetch/bbps/billfetch").post(verifyAuth, billFetch);
router.route("/fetch/bbps/fetchedBillpay").post(verifyAuth, billPayment);
router.route("/fetch/bbps/quickPayValidation").post(verifyAuth, quickPayValidation);
router.route("/fetch/bbps/quickPay").post(verifyAuth, billPayment);

module.exports = router;
