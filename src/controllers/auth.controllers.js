const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const query = require("../db/queries");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { getRoleAccess } = require("./general.controller");
const messageUtils = require("../utils/sendMessage");

const generateCustomToken = () => {
  // Generate a random 30 character token
  return crypto.randomBytes(15).toString("hex");
};

const generateRandomPassword = () => {
 // return "123";
   return crypto.randomBytes(3).toString("hex");
};
const generateRandomPasswordEasy = () => {
  // Generate a random 6-digit numeric password as a string
  return Math.floor(100000 + Math.random() * 900000).toString().slice(0, 6);
};

const createUser = asyncHandler(async (req, res) => {
  let {
    person,
    mobile,
    company,
    email,
    address,
    role,
    lat,
    long,
    is_flat_rate,
    margin_rates,
    can_edit,
    can_withdraw,
    can_set_margin
  } = req.body;

  console.log(req.body);

  if (!person || !mobile || !email || !company || !address || !role) {
    throw new ApiError(400, "All required fields must be provided");
  }

  if (role < req.user.role) {
    throw new ApiError(403, "You are not authorized to create this user");
  }

  const existingMobile = await query.users({ mobile });
  // const existingMobile = await query.findUserByMobile(mobile);
  if (existingMobile) {
    throw new ApiError(409, "Mobile number already registered");
  }

  const password = generateRandomPasswordEasy();
  //Send message

  const hashedPassword = await bcrypt.hash(password, 10);
  const created_from = {
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    latitude: lat,
    longitude: long
  };

  //const parent_id =  0;
  const parent_id = req.user.id;
  let margin_type = "standard";

  if (is_flat_rate) {
    margin_type = "flat";
  }

  if (margin_rates == "") {
    margin_rates = null;
  }


  const user = await query.createUser({
    person,
    password: hashedPassword,
    mobile,
    address,
    company,
    email,
    role_id: role,
    margin_rates: margin_rates || null,
    is_flat_margin: is_flat_rate,
    can_edit: can_edit,
    can_withdraw: can_withdraw,
    can_set_margin: can_set_margin,
    parent_id,
    margin_type,
    created_from: JSON.stringify(created_from)
  });

  const createdUser = await query.users({ id: user.insertId });
  // const createdUser = await query.findUserById(user.insertId);

  if (!createdUser) {
    throw new ApiError(500, "Error while registering user");
  }

  const [existingMarginRates] = await query.db.query(
    `Select * from keyword_record where user_id = ? and role = ?`,
    [req.user.id , role]
  );

  if (existingMarginRates && existingMarginRates.length !== 0) {
    console.log("existing margin rates", existingMarginRates);
  
    // Loop through all existingMarginRates rows and insert/update each one
    for (const marginRate of existingMarginRates) {
      await query.db.query(
        `INSERT INTO keyword_settings 
          (user_id, keyword_id, custom_margin, enabled, additional_charges, is_charges_fixed) 
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            custom_margin = COALESCE(?, custom_margin),
            enabled = COALESCE(?, enabled),
            additional_charges = COALESCE(?, additional_charges),
            is_charges_fixed = COALESCE(?, is_charges_fixed)`,
        [
          user.insertId,
          marginRate.keyword_id,
          marginRate.custom_margin,
          marginRate.enabled ?? true,
          marginRate.additional_charges,
          marginRate.is_charges_fixed ?? true,
          marginRate.custom_margin,
          marginRate.enabled,
          marginRate.additional_charges,
          marginRate.is_charges_fixed
        ]
      );
    }
  
    await query.db.query(
      `update users set margin_type = "customised" WHERE id = ?`,
      [user.insertId]
    );
  }



  messageUtils.sendMessageToUser(
    user.insertId,
    `Welcome ${person}, your E-World account has been created successfully. Your password is ${password}. Send HELP to 9024312345 for assistance.`,
    "number"
  );
  messageUtils.sendMessageToUser(
    req.user.id,
    `Dear User, You have succesfully created ${person}, a new user with mobile number ${mobile}.`,
    "number"
  );

  return res
    .status(201)
    .json(new ApiResponse(200, [], "User registered successfully"));
});

const updateUser = asyncHandler(async (req, res) => {
  let {
    id,
    person,
    mobile,
    company,
    email,
    address,
    role,
    lat,
    long,
    is_flat_rate,
    margin_rates,
    can_edit_retailer,
    can_withdraw,
    can_set_margin,
    status
  } = req.body;
  console.log(req.body);

  // Validate required fields
  if (!id || !person || !mobile || !email || !company || !address) {
    throw new ApiError(400, "All required fields must be provided");
  }

  // Fetch existing user details
  const existingUser = await query.users({ id });
  if (!existingUser) {
    throw new ApiError(404, "User not found");
  }

  console.log(req.user);

  // Check role access
  const hasRoleAccess = await getRoleAccess(
    req.user.role,
    role || existingUser.role_id,
    req.user.id,
    existingUser.parent_id
  );

  if (!hasRoleAccess) {
    throw new ApiError(403, "Not authorized to update this user");
  }

  // Check if mobile number is already in use by another user
  const mobileCheck = await query.users({ mobile });
  if (mobileCheck && mobileCheck.id !== id) {
    throw new ApiError(409, "Mobile number already registered");
  }

  console.log("margin rates", margin_rates);
  if (margin_rates !== existingUser.margin_rates) {
    console.log("this is not equal");
    if (margin_rates == "") {
      margin_rates = null;
    }
  }
  // Prepare update data
  const updateData = {
    person,
    mobile,
    address,
    company,
    email,
    role_id: role || existingUser.role_id,
    margin_rates: margin_rates,
    is_flat_margin: is_flat_rate ?? existingUser.is_flat_margin,
    can_edit_retailer: can_edit_retailer ?? existingUser.can_edit_retailer,
    can_withdraw: can_withdraw ?? existingUser.can_withdraw,
    can_set_margin: can_set_margin ?? existingUser.can_set_margin,
    status: status ?? existingUser.status,
    updated_from: JSON.stringify({
      updated_by: req.user.id,
      updated_at: new Date(),
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      latitude: lat,
      longitude: long
    })
  };

  // Perform the update
  const updatedUser = await query.updateUser(id, updateData);

  if (!updatedUser) {
    throw new ApiError(500, "Error while updating user");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, [], "User updated successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { mobile, password, lat, long, isApp } = req.body;
  console.log("req.body", req.body);

  if (!mobile) {
    throw new ApiError(400, "Mobile number is required");
  }

  // For web, password is required. For mobile app, password is optional
  if (!isApp && !password) {
    throw new ApiError(400, "Password is required for web login");
  }

  const user = await query.users({ mobile });

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  // For web login, validate password. For mobile app, skip password validation
  if (!isApp) {
    if (!password) {
      throw new ApiError(400, "Password is required for web login");
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid credentials");
    }
  }

  if (user.status !== "active") {
    throw new ApiError(403, "Account is inactive");
  }

  if (isApp) {
    // Mobile app flow - send OTP regardless of password
    const [[existingOtp]] = await query.db.query(
      `SELECT * FROM otps WHERE user_id = ? AND created_at > NOW() - INTERVAL 2 MINUTE and status = 'active' order by created_at desc limit 1`,
      [user.id]
    );

    let otp;
    if (existingOtp) {
      otp = existingOtp.otp;
    } else {
      // otp = '123456'
      otp = generateOtp();
      // Save OTP to database
      await query.db.query(
        `INSERT INTO otps (user_id, otp, created_at, status) VALUES (?, ?, NOW(), 'active')`,
        [user.id, otp]
      );
    }

    console.log("otp", otp);
    // Send OTP to user with updated branding
    messageUtils.sendMessageToUser(
      user.id,
      `Dear E-World user, ${otp} is your OTP for login in E-World and is valid for 5 min. Do not share this OTP with anyone.`,
      "number"
    );

    //save OTP to database
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "OTP sent successfully"));
  }

  // Web login flow - direct login with password
  let token = generateCustomToken();
  const deviceInfo = req.headers["user-agent"] + " " + req.ip;
  console.log("device info", deviceInfo);

  // Clean up old sessions (older than 40 days)
  await query.db.query(
    `DELETE FROM user_logs 
     WHERE created_at < NOW() - INTERVAL 40 DAY 
     AND action = 'login'`
  );

  // Check if user has any existing active sessions
  let tokenOld = await query.getUserToken(user.id);
  let isNew = !tokenOld; // isNew = true only if no existing active sessions

  // Always create a new entry for each login (better for audit trail and session management)
  await query.db.query(
    `INSERT INTO user_logs (user_id, token, action, ip_address, device_info, location)
     VALUES (?, ?, 'login', ?, ?, ?)`,
    [
      user.id,
      token,
      req.ip,
      deviceInfo,
      JSON.stringify({ latitude: lat, longitude: long })
    ]
  );

  console.log("token", token);

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production"
  };
  console.log(user);

  messageUtils.sendMessageToUser(
    user.id,
    `Welcome back ${user.person}, you have successfully logged in to E-World`,
    "number"
  );

  return res
    .status(200)
    .cookie("authToken", token, options)
    .json(
      new ApiResponse(
        200,
        {
          user: {
            username: user.person,
            company: user.company,
            role: user.role_id
          },
          token: token,
          isNew: isNew,
        },
        "User logged in successfully"
      )
    );
});

// const loginUser = asyncHandler(async (req, res) => {
//   const { mobile, password, lat, long, isApp } = req.body;
//   console.log(password);
//   console.log("req.body", req.body);

//   if (!mobile || !password) {
//     throw new ApiError(400, "number and password are required");
//   }

//   const user = await query.users({ mobile });
  
//   // const user = await query.findUserByMobile(mobile);
//   if (!user) {
//     throw new ApiError(401, "Invalid credentials");
//   }

//   const isPasswordValid = await bcrypt.compare(password, user.password);

//   if (!isPasswordValid) {
//     throw new ApiError(401, "Invalid credentials");
//   }

//   if (user.status !== "active") {
//     throw new ApiError(403, "Account is inactive");
//   }

//   if(isApp){
//    const [[existingOtp]] = await query.db.query(
//     `SELECT * FROM otps WHERE user_id = ? AND created_at > NOW() - INTERVAL 2 MINUTE and status = 'active' order by created_at desc limit 1`,
//     [user.id]
//   );
// let otp;

// if(existingOtp){
//   otp = existingOtp.otp;
// }
// else{
//  // otp = '123456'
//   otp = generateOtp();
//   // Save OTP to database
//   await query.db.query(
//     `INSERT INTO otps (user_id, otp, created_at, status) VALUES (?, ?, NOW(), 'active')`,
//     [user.id, otp]
//   );
// }

// console.log("otp", otp);
//   // Send OTP to user

//   messageUtils.sendMessageToUser(
//     user.id,
//     `Dear Eworld user, ${otp} is your otp for login in eworld and is valid for 5 min. Do not share this OTP with anyone.`,
//     "number"
//   );



//   //save OTP to database

//   return res
//     .status(200)
//     .json(new ApiResponse(200, {}, "OTP sent successfully"));
//   }

//   let token = generateCustomToken();
//   const deviceInfo = req.headers["user-agent"] + " " + req.ip;
//   console.log("device info", deviceInfo);

//   const [isExisting] = await query.db.query(
//     `SELECT * FROM user_logs 
//     WHERE user_id = ? AND device_info = ?`,
//     [user.id, deviceInfo]
//   );

//   let isNew = true;

//   if (isExisting.length !== 0) {
//     await query.db.query(
//       `UPDATE user_logs 
//       SET token = ?, action = 'login', ip_address = ?, location = ?, created_at = NOW()
//       WHERE user_id = ? AND device_info = ?;
//       WHERE user_id = ? AND device_info = ?
//       `,
//       [
//         token,
//         req.ip,
//         JSON.stringify({ latitude: lat, longitude: long }),
//         user.id,
//         deviceInfo
//       ]
//     );
//     // Only check for old token if user log exists
//     let tokenOld = await query.getUserToken(user.id);
//     if(tokenOld) {
//       isNew = false;
//     }
//     isNew = true;
//     await query.db.query(
//       `INSERT INTO user_logs (user_id, token, action, ip_address, device_info, location)
//       VALUES (?, ?, 'login', ?, ?, ?)
//       `,
//       [
//         user.id,
//         token,
//         req.ip,
//         deviceInfo,
//         JSON.stringify({ latitude: lat, longitude: long })
//       ]
//     );
//   }

//   console.log("token", token);



//   const options = {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === "production"
//   };
//   console.log(user);

//   messageUtils.sendMessageToUser(
//     user.id,
//     `Welcome back ${user.person}, you have successfully logged in to eworld`,
//     "number"
//   );

//   return res
//     .status(200)
//     .cookie("authToken", token, options)
//     .json(
//       new ApiResponse(
//         200,
//         {
//           user: {
//             username: user.person,
//             company: user.company,
//             role: user.role_id
//           },

//           token: token ,
//           isNew: isNew,
//         },
//         "User logged in successfully"
//       )
//     );
// });

const logoutOthers = asyncHandler(async (req, res) => {
  const { token } = req.body;
  console.log("req.body", req.body);

  if (!token) {
    throw new ApiError(400, "Token is required");
  }

  const user = await query.validateToken(token);
  if (!user) {
    throw new ApiError(401, "Invalid token");
  }

  console.log("removing users", user);

await query.db.query(
    `UPDATE user_logs
    SET  token = null, action = 'logout_others', created_at = NOW()
    WHERE user_id = ? AND token != ?;
    
    `,
    [user.user_id, token]
  );

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "User logged out from other devices"));
});

const logoutUser = asyncHandler(async (req, res) => {
  if (!req.user.token) {
    throw new ApiError(401, "No token provided");
  }



await query.db.query(
  `UPDATE user_logs
  SET action = 'logout', created_at = NOW()
  WHERE user_id = ? AND token = ?;
  
  `,
  [req.user.id, req.user.token]
);

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production"
  };

  messageUtils.sendMessageToUser(
    req.user.id,
    `Goodbye user, you have successfully logged out from E-World. `,
    "number"
  );



  return res
    .status(200)
    .clearCookie("authToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});

const forgetPassword = asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  if (!mobile) {
    throw new ApiError(400, "Mobile number is required");
  }
  const [user] = await query.db.query(
    `SELECT * FROM users WHERE mobile = ?`,
    [mobile]
  );
  if (user.length === 0) {
    throw new ApiError(404, "User not found");
  }

 // const password = "123";
   const password = generateRandomPasswordEasy();
  console.log("password", password);
  const hashedPassword = await bcrypt.hash(password, 10);
  // const update = await query.updates.users(
  //   { password: hashedPassword },
  //   { mobile }
  // );
  const update = await query.updatePassword(hashedPassword, mobile);
  //dea3cb
  if (!update) {
    throw new ApiError(500, "Error while updating password");
  }

  messageUtils.sendMessageToUser(
    user[0].id,
    `Your password has been reset successfully. Your new password for E-World portals is ${password}`,
    "number"
  );

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password reset successfully"));
});

const resetPassword = asyncHandler(async (req, res) => {
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) {
    throw new ApiError(400, "Old password and new password are required");
  }

  const user = await query.users({ id: req.user.id });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await bcrypt.compare(old_password, user.password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid old password");
  }

  const hashedPassword = await bcrypt.hash(new_password, 10);
  const update = await query.updatePassword(hashedPassword, user.mobile);
  if (!update) {
    throw new ApiError(500, "Error while updating password");
  }

  messageUtils.sendMessageToUser(
    req.user.id,
    `Your password has been reset successfully. Your new password for E-World is ${new_password}`,
    "number"
  );

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password reset successfully"));
});

const generateOtp = () => {
  // Generate a random 6-digit OTP
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOtp = asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  if (!mobile) {
    throw new ApiError(400, "Mobile number is required");
  }

  const user = await query.users({ mobile });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

//getotp from dtaabse otp table fro user_id if already pesant before 2 minutes and haven`t used
  const [[existingOtp]] = await query.db.query(
    `SELECT * FROM otp WHERE user_id = ? AND created_at > NOW() - INTERVAL 2 MINUTE and status = 'active' order by created_at desc limit 1`,
    [user.id]
  );
let otp;

if(existingOtp){
  otp = existingOtp.otp;
}
else{
  otp = generateOtp();
  // Save OTP to database
  await query.db.query(
    `INSERT INTO otp (user_id, otp, created_at, status) VALUES (?, ?, NOW(), 'active')`,
    [user.id, otp]
  );
}
  // Send OTP to user
  messageUtils.sendMessageToUser(
    user.id,
    `Dear E-World user, ${otp} is your OTP for login in E-World and is valid for 5 min. Do not share this OTP with anyone.`,
    "number"
  );
   



  //save OTP to database

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "OTP sent successfully"));
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { mobile, otp, lat, long } = req.body;
  
  if (!mobile || !otp) {
    throw new ApiError(400, "Mobile number and OTP are required");
  }
  
  const user = await query.users({ mobile });
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  
  // Verify OTP
  const [[existingOtp]] = await query.db.query(
    `SELECT * FROM otps WHERE user_id = ? AND otp = ? AND status = 'active'`,
    [user.id, otp]
  );
  
  if (!existingOtp) {
    throw new ApiError(401, "Invalid OTP");
  }
  
  // Update OTP status to used
  await query.db.query(
    `UPDATE otps SET status = 'used' WHERE id = ?`,
    [existingOtp.id]
  );

  let token = generateCustomToken();
  const deviceInfo = req.headers["user-agent"] + " " + req.ip;
  console.log("device info", deviceInfo);

  // Clean up old sessions (older than 40 days)
  await query.db.query(
    `DELETE FROM user_logs 
     WHERE created_at < NOW() - INTERVAL 40 DAY 
     AND action = 'login'`
  );

  // Check if user has any existing active sessions
  let tokenOld = await query.getUserToken(user.id);
  let isNew = !tokenOld; // isNew = true only if no existing active sessions

  // Always create a new entry for each login (better for audit trail and session management)
  await query.db.query(
    `INSERT INTO user_logs (user_id, token, action, ip_address, device_info, location)
     VALUES (?, ?, 'login', ?, ?, ?)`,
    [
      user.id,
      token,
      req.ip,
      deviceInfo,
      JSON.stringify({ latitude: lat, longitude: long })
    ]
  );

  console.log("token", token);
  
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production"
  };
  
  console.log(user);
  
  messageUtils.sendMessageToUser(
    user.id,
    `Welcome back ${user.person}, you have successfully logged in to E-World`,
    "number"
  );
  
  return res
    .status(200)
    .cookie("authToken", token, options)
    .json(
      new ApiResponse(
        200,
        {
          user: {
            username: user.person,
            company: user.company,
            role: user.role_id
          },
          token: token,
          isNew: isNew,
        },
        "User logged in successfully"
      )
    );
});

// const verifyOtp = asyncHandler(async (req, res) => {
//   const { mobile, otp ,lat,long} = req.body;

//   if (!mobile || !otp) {
//     throw new ApiError(400, "Mobile number and OTP are required");
//   }

//   const user = await query.users({ mobile });
//   if (!user) {
//     throw new ApiError(404, "User not found");
//   }

//   // Verify OTP
//   const [[existingOtp]] = await query.db.query(
//     `SELECT * FROM otps WHERE user_id = ? AND otp = ? AND status = 'active'`,
//     [user.id, otp]
//   );

//   if (!existingOtp) {
//     throw new ApiError(401, "Invalid OTP");
//   }

//   // Update OTP status to used
//   await query.db.query(
//     `UPDATE otps SET status = 'used' WHERE id = ?`,
//     [existingOtp.id]
//   );

// let token = generateCustomToken();
//   const deviceInfo = req.headers["user-agent"] + " " + req.ip;
//   console.log("device info", deviceInfo);

//   const [isExisting] = await query.db.query(
//     `SELECT * FROM user_logs 
//     WHERE user_id = ? AND device_info = ?;
//     `,
//     [user.id, deviceInfo]
//   );

//   let isNew = true;

//   let tokenOld = await query.getUserToken(user.id);
//   if(tokenOld) {
//    isNew = false;
//    }

//   if (isExisting.length !== 0) {
//     await query.db.query(
//       `UPDATE user_logs 
//       SET token = ?, action = 'login', ip_address = ?, location = ?, created_at = NOW()
//       WHERE user_id = ? AND device_info = ?;
//       `,
//       [
//         token,
//         req.ip,
//         JSON.stringify({ latitude: lat, longitude: long }),
//         user.id,
//         deviceInfo
//       ]
//     );
//   } else {
//     isNew = true;
//     await query.db.query(
//       `INSERT INTO user_logs (user_id, token, action, ip_address, device_info, location)
//       VALUES (?, ?, 'login', ?, ?, ?)
//       `,
//       [
//         user.id,
//         token,
//         req.ip,
//         deviceInfo,
//         JSON.stringify({ latitude: lat, longitude: long })
//       ]
//     );
//   }



//   //   // let tokenNew = null;

//   //   console.log("token", token);

//   //   // // Generate custom token
//   //  //  const token = "6bc1805555de0a89a27089aa63cddc";
//   //  //if(!token){
//   // let  tokenNew = generateCustomToken();
//   //    console.log("tokenNew", tokenNew);
//   //  //}

//   // token = (token !== 'null' && token !== null) ? token : tokenNew;

//   // const location = {
//   //   latitude: lat,
//   //   longitude: long
//   // };

//   // console.log("location", location);
//   console.log("token", token);



//   const options = {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === "production"
//   };
//   console.log(user);

//   messageUtils.sendMessageToUser(
//     user.id,
//     `Welcome back ${user.person}, you have successfully logged in to eworld`,
//     "number"
//   );

//   return res
//     .status(200)
//     .cookie("authToken", token, options)
//     .json(
//       new ApiResponse(
//         200,
//         {
//           user: {
//             username: user.person,
//             company: user.company,
//             role: user.role_id
//           },

//           token: token ,
//           isNew: isNew,
//         },
//         "User logged in successfully"
//       )
//     );
// });

module.exports = {
  createUser,
  updateUser,
  loginUser,
  logoutUser,
  forgetPassword,
  resetPassword,
  logoutOthers,
  verifyOtp
};
