-- Migration to add DMT Transaction Details table
-- Run this SQL script to create the new table

-- First, create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS `dmt_transaction_details` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `recharge_id` bigint(20) DEFAULT NULL COMMENT 'Reference to recharges table',
  `user_id` bigint(20) NOT NULL COMMENT 'User who initiated the transaction',
  `remitter_mobile` varchar(15) NOT NULL COMMENT 'Remitter mobile number',
  `remitter_name` varchar(255) DEFAULT NULL COMMENT 'Remitter full name',
  `beneficiary_id` varchar(50) NOT NULL COMMENT 'Beneficiary ID from InstantPay',
  `beneficiary_name` varchar(255) NOT NULL COMMENT 'Beneficiary name',
  `beneficiary_account` varchar(50) NOT NULL COMMENT 'Beneficiary account number',
  `beneficiary_ifsc` varchar(15) NOT NULL COMMENT 'Beneficiary IFSC code',
  `beneficiary_bank_name` varchar(255) DEFAULT NULL COMMENT 'Bank name',
  `beneficiary_mobile` varchar(15) DEFAULT NULL COMMENT 'Beneficiary mobile number',
  `transaction_amount` decimal(10,2) NOT NULL COMMENT 'Transaction amount',
  `transfer_mode` varchar(10) NOT NULL DEFAULT 'IMPS' COMMENT 'Transfer mode - IMPS/NEFT/RTGS',
  `transaction_charges` decimal(10,2) DEFAULT 0.00 COMMENT 'Transaction charges',
  `gst_amount` decimal(10,2) DEFAULT 0.00 COMMENT 'GST amount',
  `total_deducted` decimal(10,2) NOT NULL COMMENT 'Total amount deducted from user',
  `external_ref` varchar(100) DEFAULT NULL COMMENT 'External reference ID',
  `pool_reference_id` varchar(100) DEFAULT NULL COMMENT 'Pool reference ID from InstantPay',
  `txn_reference_id` varchar(100) DEFAULT NULL COMMENT 'Transaction reference ID',
  `ipay_uuid` varchar(255) DEFAULT NULL COMMENT 'InstantPay UUID',
  `order_id` varchar(100) DEFAULT NULL COMMENT 'Order ID from InstantPay',
  `pool_account` varchar(20) DEFAULT NULL COMMENT 'Pool account used',
  `pool_opening_balance` decimal(15,2) DEFAULT NULL COMMENT 'Pool opening balance',
  `pool_closing_balance` decimal(15,2) DEFAULT NULL COMMENT 'Pool closing balance',
  `status` enum('SUCCESS','FAILED','PENDING','REFUNDED') NOT NULL DEFAULT 'PENDING' COMMENT 'Transaction status',
  `api_status_code` varchar(10) DEFAULT NULL COMMENT 'API status code from InstantPay',
  `api_status_message` text DEFAULT NULL COMMENT 'API status message',
  `failure_reason` text DEFAULT NULL COMMENT 'Failure reason if transaction failed',
  `user_balance_before` decimal(15,2) DEFAULT NULL COMMENT 'User balance before transaction',
  `user_balance_after` decimal(15,2) DEFAULT NULL COMMENT 'User balance after transaction',
  `commission_earned` decimal(10,2) DEFAULT 0.00 COMMENT 'Commission earned by user',
  `latitude` decimal(10,8) DEFAULT NULL COMMENT 'Transaction latitude',
  `longitude` decimal(11,8) DEFAULT NULL COMMENT 'Transaction longitude',
  `transaction_timestamp` timestamp NULL DEFAULT NULL COMMENT 'Transaction timestamp from API',
  `environment` varchar(10) DEFAULT 'LIVE' COMMENT 'Environment - LIVE/TEST',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_remitter_mobile` (`remitter_mobile`),
  KEY `idx_beneficiary_id` (`beneficiary_id`),
  KEY `idx_beneficiary_account` (`beneficiary_account`),
  KEY `idx_external_ref` (`external_ref`),
  KEY `idx_pool_reference_id` (`pool_reference_id`),
  KEY `idx_txn_reference_id` (`txn_reference_id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_ipay_uuid` (`ipay_uuid`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_recharge_id` (`recharge_id`),
  KEY `idx_transaction_date_user` (`user_id`, `created_at`),
  KEY `idx_beneficiary_user` (`user_id`, `beneficiary_account`),
  KEY `idx_remitter_user` (`user_id`, `remitter_mobile`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Detailed DMT transaction records for user view';

-- Add foreign key constraints (only if the referenced tables exist)
-- Note: Comment out these lines if you don't want foreign key constraints

-- ALTER TABLE `dmt_transaction_details` 
-- ADD CONSTRAINT `fk_dmt_transaction_details_user` 
-- FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

-- ALTER TABLE `dmt_transaction_details` 
-- ADD CONSTRAINT `fk_dmt_transaction_details_recharge` 
-- FOREIGN KEY (`recharge_id`) REFERENCES `recharges` (`id`) ON DELETE SET NULL;

-- Insert a test record (optional - remove if not needed)
-- INSERT INTO `dmt_transaction_details` (
--   `user_id`, `remitter_mobile`, `beneficiary_id`, `beneficiary_name`, 
--   `beneficiary_account`, `beneficiary_ifsc`, `beneficiary_bank_name`,
--   `transaction_amount`, `transfer_mode`, `status`, `api_status_code`, 
--   `api_status_message`, `environment`
-- ) VALUES (
--   1, '9999999999', 'TEST_BEN_001', 'Test Beneficiary', 
--   '1234567890', 'HDFC0000001', 'HDFC Bank',
--   100.00, 'IMPS', 'SUCCESS', 'TXN', 
--   'Transaction Successful', 'TEST'
-- );

-- Verify the table was created successfully
SHOW CREATE TABLE `dmt_transaction_details`;
