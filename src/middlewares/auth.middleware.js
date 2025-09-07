// middlewares/auth.middleware.js
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");
const query = require("../db/queries");

const verifyAuth = asyncHandler(async (req, res, next) => {
    const token = req.cookies?.authToken || req.header("Authorization");
    console.log(token);

    if (!token) {
        throw new ApiError(405, "Unauthorized request");
    }


    const tokenData = await query.validateToken(token);


    if (!tokenData) {
        throw new ApiError(405, "Invalid or expired token");
    }

    if (tokenData.status !== 'active') {
        throw new ApiError(405, "Account is inactive");
    }

    if(tokenData.token !== token) {
        throw new ApiError(405, "Invalid or expired token");
    }

    // Attach user info to request
    req.user = {
        id: tokenData.user_id,
        token: token,
        parent: tokenData.parent_id,
      
   //   role: 1 ,
        role: tokenData.role_id ,
        balance: tokenData.balance,
    };

    next();
});

module.exports = verifyAuth;