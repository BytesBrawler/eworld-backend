const { Router } = require("express");
const controller = require("../controllers/getepay.controllers.js");
const verifyAuth = require("../middlewares/auth.middleware.js");

const router = Router();

// Generate Getepay payment order
router.route("/generateOrder").post(verifyAuth, controller.generateGetepayOrder);

// Getepay callback handler (no auth required as it's called by Getepay)
router.route("/callback").post(controller.getepayCallback);

// Check transaction status
router.route("/statusCheck").post(verifyAuth, controller.checkGetepayStatus);

// Refund transaction
router.route("/refund").post(verifyAuth, controller.refundGetepayTransaction);

// Get user's Getepay transactions
router.route("/transactions").get(verifyAuth, controller.getGetepayTransactions);

module.exports = router;
