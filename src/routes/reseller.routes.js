// routes/auth.routes.js
const { Router } = require("express");
const controller = require("../controllers/reseller.controller.js");
const verifyAuth = require("../middlewares/auth.middleware.js");
const verifyReseller = require("../middlewares/reseller.middleware.js");

const router = Router();


router.route("/getApiData").get(verifyAuth, controller.getApiData);
router.route("/generateNewApiKey").get(verifyAuth, controller.generateNewApiKey);
router.route("/addIp").post(verifyAuth, controller.addIp);
router.route("/deleteIp").post(verifyAuth, controller.deleteIp);
router.route("/editIp").post(verifyAuth, controller.EditIp);
router.route("/updateCallBackUrl").post(verifyAuth, controller.updateCallBackUrl);

router.route("/recharge").get(verifyReseller, controller.recharge);
router.route("/checkBalance").get(verifyReseller, controller.balanceCheck);
router.route("/statuscheck").get(verifyReseller, controller.statusCheck);

// New callback route for external API providers to send recharge updates
router.route("/callback").post(controller.rechargeCallback);
router.route("/callback").get(controller.rechargeCallback);

// router.route("/getNews").get(verifyAuth, controller.getNews);
// router.route("/addNews").post(verifyAuth, controller.addNews);
// router.route("/updateNews").post(verifyAuth, controller.updateNews);


// router.route("/getOperators").get(verifyAuth, controller.getOperators);
// router.route("/getOperatorsOffer").post(verifyAuth, controller.getOperatorsOffer);
// router.route("/recharge").post(verifyAuth, controller.recharge);


module.exports = router;