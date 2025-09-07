// routes/auth.routes.js
const { Router } = require("express");
const {
    createUser,
    updateUser,
    loginUser,
    logoutUser ,
    forgetPassword,
    resetPassword,
    logoutOthers,

    verifyOtp,
} = require("../controllers/auth.controllers.js");
const verifyAuth = require("../middlewares/auth.middleware.js");

const router = Router();

// Public routes
router.route("/create").post(verifyAuth , createUser);
router.route("/update").post(verifyAuth , updateUser);
router.route("/login").post(loginUser);
router.route("/logoutOthers").post(verifyAuth, logoutOthers);
router.route("/forget_password").post(forgetPassword);
router.route("/reset_password").post(verifyAuth,resetPassword);

router.route("/verifyOtp").post(verifyOtp);

// Protected routes
router.route("/logout").get(verifyAuth, logoutUser);

module.exports = router;