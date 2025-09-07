const { Router } = require("express");
const controller = require("../controllers/configuration.controllers.js");
const verifyAuth = require("../middlewares/auth.middleware.js");
const upload = require("../middlewares/multer.middleware");

const router = Router();

router
  .route("/createOperatorType")
  .post(verifyAuth, controller.createOperatorType);

router.route("/getOperatorTypes").get(verifyAuth, controller.getOperatorTypes);
router
  .route("/updateOperatorType/:id")
  .post(verifyAuth, controller.updateOperatorType);

router
  .route("/deleteOperatorType/:id")
  .get(verifyAuth, controller.deleteOperatorType);

router.route("/createOperators").post(
  verifyAuth,
  // Middleware for logo upload
  controller.createOperator
);

router.route("/getOperators").get(verifyAuth, controller.getOperators);
router.route("/deleteOperators/:id").get(verifyAuth, controller.deleteOperator);

// routes/operator.routes.js
router
  .route("/updateOperators/:id")
  .post(verifyAuth, controller.updateOperator);

// Create a new API Provider
router
  .route("/createApiProvider")
  .post(verifyAuth, controller.createApiProvider);

// Get API Providers with optional filtering
router.route("/getApiProviders").get(verifyAuth, controller.getApiProviders);

// Get a specific API Provider by ID
router
  .route("/getApiProviders/:id")
  .get(verifyAuth, controller.getApiProviderById);

// Update an existing API Provider
router
  .route("/updateApiProvider/:id")
  .post(verifyAuth, controller.updateApiProvider);

// Delete an API Provider (soft delete by changing status)
router
  .route("/deleteApiProvider/:id")
  .get(verifyAuth, controller.deleteApiProvider);

// // Create a new Recharge API
router.route("/createApi").post(verifyAuth, controller.createApi);

// // Get Recharge APIs with optional filtering
router.route("/getApis").get(verifyAuth, controller.getApis);

// // Get a specific Recharge API by ID
router.route("/getApis/:id").get(verifyAuth, controller.getApiById);

// // Update an existing Recharge API
router.route("/UpdateApi/:id").post(verifyAuth, controller.updateApi);

// // Delete a Recharge API (soft delete by changing status)
router.route("/deleteApi/:id").get(verifyAuth, controller.deleteApi);

router.route("/createKeyword").post(verifyAuth, controller.createKeyword);

router.route("/getKeywords").get(verifyAuth, controller.getKeywords);

router.route("/updateKeyword/:id").post(verifyAuth, controller.updateKeyword);

router.route("/deleteKeyword/:id").get(verifyAuth, controller.deleteKeyword);

router.route("/getParams").get(verifyAuth, controller.getParametersForKeyword);

router
  .route("/createKeywordLine")
  .post(verifyAuth, controller.createKeywordLine);
router
  .route("/getKeywordLines/:id")
  .get(verifyAuth, controller.getKeywordLines);
router
  .route("/updateKeywordLine/:id")
  .post(verifyAuth, controller.updateKeywordLine);
router
  .route("/deleteKeywordLine/:id")
  .get(verifyAuth, controller.deleteKeywordLine);
router
  .route("/getKeywordLineDetail/:id")
  .get(verifyAuth, controller.getKeywordLineById);

router
  .route("/createExtraLine")
  .post(verifyAuth, controller.createExtraLine);
router
  .route("/getExtraLines/:id")
  .get(verifyAuth, controller.getExtraLines);
router
  .route("/updateExtraLines/:id")
  .post(verifyAuth, controller.updateExtraLine);
router
  .route("/deleteExtraLines/:id")
  .get(verifyAuth, controller.deleteExtraLine);
router
  .route("/getExtraLinesDetail/:id")
  .get(verifyAuth, controller.getExtraLineById);

  router.route("/getCirclesProviders").get(verifyAuth, controller.getCircleProviders);
  router.route("/getCircles").get(verifyAuth, controller.getCircles);
  router.route("/getCustomCircle/:id").get(verifyAuth, controller.getCustomCircle);
  router.route("/createCustomCircle").post(verifyAuth, controller.createCustomCircle);
  router.route("/updateCustomCircle").post(verifyAuth, controller.updateCustomCircle);


 // router.route("/getCircles").get(verifyAuth, controller.getCircles);


router.route("/createPreValues").post(verifyAuth, controller.createPreValues);
router.route("/getPreValues/:id").get(verifyAuth, controller.getPreValues);
router.route("/deletePreValues/:id").get(verifyAuth, controller.deletePreValues);

module.exports = router;
