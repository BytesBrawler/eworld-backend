const query = require("../db/queries.js");
const generalQuery = require("../db/general.query.js");
const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");





const getNews = asyncHandler(async (req, res) => {
  const role = req.user.role;
  console.log("role is " + role);

  const news = await generalQuery.getNews( role);
  console.log("news is " + news);

  if(news.length === 0) { 
    return res
    .status(202)
    .json(new ApiResponse(202, news, "No news available"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, news, "News retrieved successfully"));
});

const addNews = asyncHandler(async (req, res) => {
  const { type, title, description, image, expiry, roles } = req.body;
  console.log(req.body);

  if (type == "image") {
    if (!image || !expiry || !roles) {
      throw new ApiError(400, "All required fields must be provided");
    }

    const news = await generalQuery.addImageNews({
      image,
      expiry,
      roles,
      type: "image"
    });
    console.log(news);
    return res
      .status(201)
      .json(new ApiResponse(201, news, "News added successfully"));
  } else {
    if (!title || !description || !expiry || !roles) {
      throw new ApiError(400, "All required fields must be provided");
    }

    const news = await generalQuery.addTextNews({
      title,
      description,
      expiry,
      roles,
      type: "text"
    });
    console.log(news);
    return res
      .status(201)
      .json(new ApiResponse(201, news, "News added successfully"));
  }
});

const updateNews = asyncHandler(async (req, res) => {
  const { id, title, description, image, expiry, roles, is_public } = req.body;
  console.log(req.body);

  if (!id) {
    throw new ApiError(400, "News ID is required");
  }

  const news = await generalQuery.updateNews({
    id,
    title,
    description,
    image,
    expiry,
    roles,
    is_public
  });
  console.log(news);

  return res
    .status(200)
    .json(new ApiResponse(200, news, "News updated successfully"));
});







async function getRoleAccess(
  parentRole,
  childRole,
  parent_id,
  children_parent_id
) {
  console.log(parentRole, childRole, parent_id, children_parent_id);
  // Role Hierarchy Definition
  const ROLES = {
    SUPER_ADMIN: 1,
    ADMIN: 2,
    MASTER_DISTRIBUTOR: 3,
    DISTRIBUTOR: 4,
    RETAILER: 5,
    API_RESELLER: 6
  };

  // Role Hierarchy Matrix
  // Each role can access roles directly below it in the same branch
  const ROLE_HIERARCHY = {
    [ROLES.SUPER_ADMIN]: [
      ROLES.ADMIN,
      ROLES.MASTER_DISTRIBUTOR,
      ROLES.DISTRIBUTOR,
      ROLES.RETAILER,
      ROLES.API_RESELLER
    ],
    [ROLES.ADMIN]: [
      ROLES.MASTER_DISTRIBUTOR,
      ROLES.DISTRIBUTOR,
      ,
      ROLES.RETAILER,
      ROLES.API_RESELLER
    ],
    [ROLES.MASTER_DISTRIBUTOR]: [ROLES.DISTRIBUTOR, ROLES.RETAILER],
    [ROLES.DISTRIBUTOR]: [ROLES.RETAILER],
    [ROLES.RETAILER]: [], // Retailers can't access any lower levels
    [ROLES.API_RESELLER]: [] // API Resellers can't access any lower levels
  };

  if (parentRole === ROLES.SUPER_ADMIN || parentRole === ROLES.ADMIN) {
    return true;
  }

  // Immediate access for higher roles
  if (parentRole >= childRole) {
    return false;
  }

  // Check if the child role is directly accessible by the parent role
  if (!ROLE_HIERARCHY[parentRole]?.includes(childRole)) {
    return false;
  }

  // If parent and children have the same parent_id, it's a direct branch access
  console.log("parent_id", parent_id);
  console.log("children_parent_id", children_parent_id);
  if (parent_id === children_parent_id) {
    console.log("Direct branch access");
    return true;
  }

  try {
    // Trace the hierarchical path to verify branch access
    let currentParentId = children_parent_id;
    let depth = 0;
    const MAX_DEPTH = 4; // Prevent potential infinite loops

    while (currentParentId && depth < MAX_DEPTH) {
      // Fetch parent user details
      const [parentUser] = await query.users({
        factor: "select",
        columns: ["role_id", "parent_id"],
        id: currentParentId
      });
      console.log(parentUser);

      // If we reach the direct parent in the hierarchy
      if (parentUser.parent_id === parent_id) {
        return true;
      }

      // Move up the hierarchy
      currentParentId = parentUser.parent_id;
      depth++;
    }

    return false;
  } catch (error) {
    console.error("Error tracing parent hierarchy:", error);
    return false;
  }
}





module.exports = {
  addNews,
  getNews,
  updateNews,
  getRoleAccess
};
