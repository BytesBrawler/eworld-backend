const { Router } = require("express");
const {
    merchantOnboarding,
    merchantOnboardingVerify,
    getMerchantStatus,
    getTestingMockResponse,
    checkRemitterProfile,
    registerRemitter,
    verifyRemitterOtp,
    remitterKyc,
    registerBeneficiary,
    verifyBeneficiaryOtp,
    verifyBankAccount,
    manualBankVerification,
    deleteBeneficiary,
    verifyBeneficiaryDeleteOtp,
    getRemitters,
    getBeneficiaries,
    getTransactionHistory,
    getDetailedTransactionHistory,
    getDetailedTransaction,
    generateTransactionOtp,
    bioAuthTransaction,
    transaction,
    // Bank management functions
    getBankList,
    forceSyncBankList,
    getBankSyncStatus,
    // MT1 API functions
    mt1GetBankList,
    mt1CheckRemitterProfile,
    mt1RegisterRemitter,
    mt1VerifyRemitterRegistration,
    mt1RemitterKyc,
    mt1GetBeneficiaryList,
    mt1RegisterBeneficiary,
    mt1DeleteBeneficiary,
    mt1VerifyBeneficiaryDelete,
    mt1GenerateTransactionOtp,
    mt1Transaction,
    mt1TransactionRefundOtp,
    mt1TransactionRefund
} = require("../controllers/dmt.controller.js");
const verifyAuth = require("../middlewares/auth.middleware.js");

const router = Router();

// All DMT routes require authentication
router.use(verifyAuth);

// Merchant Onboarding (Must be done first)
router.route("/merchant/onboarding").post(merchantOnboarding);
router.route("/merchant/onboarding/verify").post(merchantOnboardingVerify);
router.route("/merchant/status").get(getMerchantStatus);

// Testing endpoint for mock responses
router.route("/testing/mock/:endpoint/:mockType?").get(getTestingMockResponse);

// Bank Management
router.route("/banks").get(getBankList);
router.route("/banks/sync").post(forceSyncBankList);
router.route("/banks/sync/status").get(getBankSyncStatus);

// Remitter Profile Management
router.route("/remitter/profile").post(checkRemitterProfile);
router.route("/remitter/register").post(registerRemitter);
router.route("/remitter/verify-otp").post(verifyRemitterOtp);
router.route("/remitter/kyc").post(remitterKyc);
router.route("/remitters").get(getRemitters);

// Beneficiary Management
router.route("/beneficiary/register").post(registerBeneficiary);
router.route("/beneficiary/verify-otp").post(verifyBeneficiaryOtp);
router.route("/beneficiary/verify-bank-account").post(verifyBankAccount);
router.route("/beneficiary/manual-bank-verify").post(manualBankVerification);
router.route("/beneficiary/delete").post(deleteBeneficiary);
router.route("/beneficiary/verify-delete-otp").post(verifyBeneficiaryDeleteOtp);
router.route("/beneficiaries/:mobileNumber").get(getBeneficiaries);

// Transaction History
router.route("/transactions").get(getTransactionHistory);
router.route("/transactions/detailed").get(getDetailedTransactionHistory);
router.route("/transaction/detailed/:transactionId").get(getDetailedTransaction);

// Transaction APIs
router.route("/transaction/generate-otp").post(generateTransactionOtp);
//router.route("/transaction/bio-auth").post(bioAuthTransaction);
router.route("/transaction/transfer").post(transaction);

// MT1 (Money Transfer 1) APIs - Enhanced Security Flow
router.route("/mt1/banks").get(mt1GetBankList);
router.route("/mt1/remitter/profile").post(mt1CheckRemitterProfile);
router.route("/mt1/remitter/register").post(mt1RegisterRemitter);
router.route("/mt1/remitter/register/verify").post(mt1VerifyRemitterRegistration);
router.route("/mt1/remitter/kyc").post(mt1RemitterKyc);
router.route("/mt1/beneficiaries").get(mt1GetBeneficiaryList);
router.route("/mt1/beneficiary/register").post(mt1RegisterBeneficiary);
router.route("/mt1/beneficiary/delete").post(mt1DeleteBeneficiary);
router.route("/mt1/beneficiary/delete/verify").post(mt1VerifyBeneficiaryDelete);
router.route("/mt1/transaction/generate-otp").post(mt1GenerateTransactionOtp);
router.route("/mt1/transaction").post(mt1Transaction);
router.route("/mt1/transaction/refund/otp").post(mt1TransactionRefundOtp);
router.route("/mt1/transaction/refund").post(mt1TransactionRefund);

module.exports = router;
