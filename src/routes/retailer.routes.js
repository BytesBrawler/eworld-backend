// routes/auth.routes.js
const { Router } = require("express");
const controller = require("../controllers/retailer.controller.js");
const verifyAuth = require("../middlewares/auth.middleware.js");

const router = Router();

router.route("/getOperators").get(verifyAuth, controller.getOperators);
router.route("/getCircles").get(verifyAuth, controller.getCircles);
router.route("/getOperatorsOffer").post(verifyAuth, controller.getOperatorsOffer);
router.route("/recharge").post(verifyAuth, controller.recharge);
router.route("/planFetch").post(verifyAuth, controller.planFetch);
router.route("/getDthInfo").post(verifyAuth, controller.getDTHInfo);
router.route("/billFetch").post(verifyAuth, controller.billFetch);
router.route("/demoApi").get(controller.demoApi);
// router.route("/recharge").post(verifyAuth, controller.recharge);

// Public routes
// router.route("/register").post(verifyAuth , registerUser);
// router.route("/login").post(loginUser);
// router.route("/reset_password").post(resetPassword);

// // Protected routes
// router.route("/logout").get(verifyAuth, logoutUser);

module.exports = router;