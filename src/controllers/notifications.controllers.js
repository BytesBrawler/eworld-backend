// controllers/notification.controller.js
const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const query = require("../db/queries");

const getNotifications = asyncHandler(async (req, res) => {
  const user_id = req.user.id; // Assuming you have user info in request after authentication
  const notifications = await query.notifications({ user_id });

  if (!notifications) throw new ApiError(500, "Internal server error");

  return res
    .status(200)
    .json(
      new ApiResponse(200, notifications, "Notifications fetched successfully")
    );
});

const getUnreadCount = asyncHandler(async (req, res) => {
  const user_id = req.user.id;
  const is_read = false;

  const result = await query.notifications({
    factor: "count",
    user_id,
    is_read
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { count: result.total },
        "Unread count fetched successfully"
      )
    );
});

const markAsRead = asyncHandler(async (req, res) => {
  const  id  = req.query.id;
  const user_id = req.user.id;

  console.log("id", id);  

  
  if (!id) {
    throw new ApiError(400, "Notification id is required");
  }

  await query.updateNotificationStatus(id, user_id);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Notification marked as read"));
});

const markAllAsRead = asyncHandler(async (req, res) => {
  const user_id = req.user.id;

  await query.updateNotificationStatus(null, user_id);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "All notifications marked as read"));
});

const createNotification = asyncHandler(async (req, res) => {
  const { title, message, type = "info" } = req.body;
  console.log(type);

  const userId = req.user.id;
  const user = await query.users({ id: userId });
  if(!user) {
    throw new ApiError(404, "User not found");
  }

  const result = await query.createNotification(
    userId,
    title,
    message,
    type,
    
  );




  return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          { id: result.insertId },
          "Notification created successfully"
        )
      );

  
});

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createNotification
};
