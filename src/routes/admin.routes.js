const { Router } = require("express");
const controller = require("../controllers/admin.controller.js");
const verifyAuth = require("../middlewares/auth.middleware.js");

const router = Router();

router.route("/getUsers").get(verifyAuth, controller.getUsers);
router.route("/updateTxn").post(verifyAuth, controller.updateTxn);

router
  .route("/keywordperformance")
  .get(verifyAuth, controller.getOperatorPerformance);

router.route("/resetPassword").post(verifyAuth, controller.resetPassword);

// Recharge reports with filters
router.route("/rechargeReports").get(controller.getRechargeReports);
router.route("/updateRecharge/:id").post(controller.updateRecharge);

router.route("/getMessages").get(verifyAuth, controller.getMessages);
router.route("/resendMessages/:id").get(verifyAuth, controller.resendMessage);
router.route("/resendBulk").post(verifyAuth, controller.resendBulkMessage);

router.route("/transferUser").post(verifyAuth, controller.transferUser);
router.route("/getLinesDetails").post(verifyAuth, controller.getLinesDetails);
router.route("/getKeywordDetails").get(verifyAuth, controller.getKeywordDetails);







// User transaction reports
router
  .route("/user-transactions")
  .get(verifyAuth, controller.getUserTransactions);

// Commission reports
router
  .route("/commission-reports")
  .get(verifyAuth, controller.getCommissionReports);

// Summary/Dashboard reports
router
  .route("/dashboard-summary")
  .get(verifyAuth, controller.getDashboardSummary);

router.route("/getSettings").get(verifyAuth, controller.getSettings);
router.route("/updateSettings").post(verifyAuth, controller.updateSettings);
router.route("/insertSettings").post(verifyAuth, controller.insertSettings);
//secured routes
//router.route("/logout").post(verifyJWT,  logoutUser)

module.exports = router;
