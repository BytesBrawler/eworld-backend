const { Router } = require("express");
const controller = require("../controllers/opeartor.retaielr.js");
const verifyAuth = require("../middlewares/auth.middleware.js");

const router = Router();

router.route("/updateKeywordMargin").post(verifyAuth, controller.updateKeywordSettings );
router.route("/getMargin").get(verifyAuth, controller.getUserMargin);
router.route("/removeCustomMargin").get(verifyAuth, controller.deleteCustomMargin);
router.route("/updateLineBalance").post(verifyAuth, controller.updateLineBalance);
router.route("/getCircles").get(verifyAuth, controller.getCircles);


module.exports = router;
