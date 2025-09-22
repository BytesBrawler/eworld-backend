const  {Router}  = require("express");
const express = require("express");
const controller= require("../controllers/wallet.controllers.js");
const verifyAuth = require("../middlewares/auth.middleware.js");

const router = Router();

const getepayParser = [
  express.urlencoded({ extended: true, limit: "1mb" }),
  express.json({ limit: "1mb" }),
  (req, res, next) => {
    console.log("📥 [Getepay Middleware] Headers:", req.headers);
    console.log("📥 [Getepay Middleware] Body:", req.body);
    console.log("📥 [Getepay Middleware] Query:", req.query);
    next();
  },
];


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
router.route("/getepay/callback").post(getepayParser,controller.getepayCallback);
router.route("/getepay/callback").get(controller.getepayCallback);
router.route("/getepay/statusCheck").post(verifyAuth, controller.getepayStatusCheck);
router.route("/getepay/requery").post(verifyAuth, controller.getepayRequery);
router.route("/getepay/refund").post(verifyAuth, controller.getepayRefund);
router.route("/getepay/status-logs/:orderId").get(verifyAuth, controller.getTransactionStatusLogs);
router.route("/getepay/recent-transactions").get(verifyAuth, controller.getRecentTransactions);
router.route("/getepay/markSuccess").post(verifyAuth, controller.getepayMarkSuccess);
router.route("/getepay/markFailed").post(verifyAuth, controller.getepayMarkFailed);

// Admin transfer routes
router.route("/admin/search-parents").get(verifyAuth, controller.searchParentUsers);
router.route("/admin/parent-children/:parentId").get(verifyAuth, controller.getParentChildren);
router.route("/admin/transfer-balance").post(verifyAuth, controller.adminTransferBalance);
router.route("/admin/refund-balance").post(verifyAuth, controller.adminRefundBalance);



module.exports = router ;