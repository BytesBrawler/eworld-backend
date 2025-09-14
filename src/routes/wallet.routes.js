const  {Router}  = require("express");
const controller= require("../controllers/wallet.controllers.js");
const verifyAuth = require("../middlewares/auth.middleware.js");

const router = Router();

router.route("/getBalance").get(verifyAuth ,controller.getBalance);
router.route("/getBalanceByParent").get(verifyAuth ,controller.getBalanceByParent);
router.route("/addBalance").post(verifyAuth ,controller.addBalance);
router.route("/withDrawBalance").post(verifyAuth ,controller.withDrawBalance);
router.route("/generateBalance").post(verifyAuth ,controller.generateBalance);
router.route("/generateOrder").post(verifyAuth ,controller.generateOrder);
router.route("/tez/webhook").get(controller.webhookCallback);
router.route("/statusCheck").post(verifyAuth, controller.statusCheck);
router.route("/addMoney").post(verifyAuth ,controller.addMoney);
router.route("/redirectGateway").get(controller.redirect);
router.route("/fundRequest").post( verifyAuth,controller.fundRequest);
router.route("/getAllFundRequests").get( verifyAuth,controller.getAllFundRequest);
router.route("/getAllFundRequestforParent").get( verifyAuth,controller.getAllFundRequestforParent);
router.route("/approveFund/").post(verifyAuth , controller.approveFund);
router.route("/getBalReport").get(verifyAuth ,controller.getBalReport);
router.route("/getTransactions").get(verifyAuth ,controller.getTransactions);

// Getepay routes
router.route("/getepay/generateOrder").post(verifyAuth, controller.getepayGenerateOrder);
router.route("/getepay/callback").post(controller.getepayCallback);
router.route("/getepay/statusCheck").post(verifyAuth, controller.getepayStatusCheck);
router.route("/getepay/requery").post(verifyAuth, controller.getepayRequery);
router.route("/getepay/refund").post(verifyAuth, controller.getepayRefund);
router.route("/getepay/status-logs/:orderId").get(verifyAuth, controller.getTransactionStatusLogs);
router.route("/getepay/recent-transactions").get(verifyAuth, controller.getRecentTransactions);

// Admin transfer routes
router.route("/admin/search-parents").get(verifyAuth, controller.searchParentUsers);
router.route("/admin/parent-children/:parentId").get(verifyAuth, controller.getParentChildren);
router.route("/admin/transfer-balance").post(verifyAuth, controller.adminTransferBalance);
router.route("/admin/refund-balance").post(verifyAuth, controller.adminRefundBalance);

module.exports = router ;