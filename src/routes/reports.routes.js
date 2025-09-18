const  {Router}  = require("express");
const controller= require("../controllers/reports.controllers.js");
const verifyAuth = require("../middlewares/auth.middleware.js");

const router = Router();

router.route("/getHistory").get(verifyAuth ,controller.getHistory);
router.route("/getPurchases").get(verifyAuth ,controller.getPurchases);
router.route("/getRecents").get(verifyAuth ,controller.getRecents);
router.route("/getBalReports").get(verifyAuth ,controller.getReports);
router.route("/getStatement").get(verifyAuth, controller.getStatement);
router.route("/getRechargeHistory").get( verifyAuth,controller.getRechargeHistory);
router.route("/getPurchasesOnline").get(verifyAuth, controller.getPurchasesOnline);
//router.route("/getBalReports").get(verifyAuth ,controller.getReports);



module.exports = router ;