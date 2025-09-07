const  {Router}  = require("express");
const controller = require("../controllers/users.controllers.js");
const verifyAuth = require("../middlewares/auth.middleware.js");


const router = Router()

router.route("/profile").get(verifyAuth , controller.getProfile);
router.route("/find-user").get(controller.findUser);
router.route("/all-user").get(verifyAuth,controller.getAllUsers);
router.route("/get-user-parent").get(verifyAuth , controller.getUsersbyParentId);
router.route("/get-users-by-role").get(verifyAuth, controller.getUsers);
router.route("/update-wallet").post(verifyAuth , controller.updateWallet);
router.route("/update-margin-allowed").post(verifyAuth , controller.updateMarginStatus);
router.route("/update-status").post(verifyAuth , controller.updateStatus);
router.route("/getSearch").get(verifyAuth , controller.getSearch);


module.exports = router ;