// routes/auth.routes.js
const { Router } = require("express");
const controller = require("../controllers/general.controller.js");
const verifyAuth = require("../middlewares/auth.middleware.js");

const router = Router();

router.route("/getNews").get(verifyAuth, controller.getNews);
router.route("/addNews").post(verifyAuth, controller.addNews);
router.route("/updateNews").post(verifyAuth, controller.updateNews);


// router.route("/getOperators").get(verifyAuth, controller.getOperators);
// router.route("/getOperatorsOffer").post(verifyAuth, controller.getOperatorsOffer);
// router.route("/recharge").post(verifyAuth, controller.recharge);


module.exports = router;