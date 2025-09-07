const  {Router}  = require("express");
const controller= require("../controllers/notifications.controllers.js");
const verifyAuth = require("../middlewares/auth.middleware.js");

const router = Router();

router.route("/").get(verifyAuth, controller.getNotifications);
router.route("/unread-count").get(verifyAuth, controller.getUnreadCount);
router.route("/read").get(verifyAuth, controller.markAsRead);
router.route("/mark-all-read").get(verifyAuth, controller.markAllAsRead);
router.route("/").post(verifyAuth, controller.createNotification);


module.exports = router;

