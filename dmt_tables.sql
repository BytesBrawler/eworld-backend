-- DMT Database Schema
-- Create tables for Domestic Money Transfer functionality

-- 1. DMT Merchants Table (Merchant Onboarding)
CREATE TABLE IF NOT EXISTS `dmt_merchants` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `mobile_number` varchar(15) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `shop_name` varchar(200) NOT NULL,
  `address` text NOT NULL,
  `pincode` varchar(10) NOT NULL,
  `city` varchar(100) NOT NULL,
  `state` varchar(100) NOT NULL,
  `aadhaar_number` varchar(100) NOT NULL,
  `pan_number` varchar(20) NOT NULL,
  `account_number` varchar(50) NOT NULL,
  `ifsc` varchar(20) NOT NULL,
  `latitude` varchar(20) NOT NULL,
  `longitude` varchar(20) NOT NULL,
  `business_type` varchar(50) DEFAULT 'INDIVIDUAL',
  `gst_number` varchar(20) DEFAULT NULL,
  `merchant_id` varchar(100) DEFAULT NULL,
  `reference_key` text DEFAULT NULL,
  `validity` datetime DEFAULT NULL,
  `is_verified` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_mobile` (`user_id`, `mobile_number`),
  KEY `idx_mobile` (`mobile_number`),
  KEY `idx_merchant_id` (`merchant_id`),
  KEY `idx_user_id` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. DMT Remitters Table
CREATE TABLE IF NOT EXISTS `dmt_remitters` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `mobile_number` varchar(15) NOT NULL,
  `aadhaar_number` varchar(100) DEFAULT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `pincode` varchar(10) DEFAULT NULL,
  `limit_per_transaction` decimal(10,2) DEFAULT 0.00,
  `limit_total` decimal(10,2) DEFAULT 0.00,
  `limit_consumed` decimal(10,2) DEFAULT 0.00,
  `limit_available` decimal(10,2) DEFAULT 0.00,
  `is_verified` tinyint(1) DEFAULT 0,
  `reference_key` text DEFAULT NULL,
  `validity` datetime DEFAULT NULL,
  `is_txn_otp_required` tinyint(1) DEFAULT 1,
  `is_txn_bio_auth_required` tinyint(1) DEFAULT 0,
  `is_face_auth_available` tinyint(1) DEFAULT 0,
  `pid_option_wadh` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_mobile` (`user_id`, `mobile_number`),
  KEY `idx_mobile` (`mobile_number`),
  KEY `idx_user_id` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. DMT Beneficiaries Table
CREATE TABLE IF NOT EXISTS `dmt_beneficiaries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `mobile_number` varchar(15) NOT NULL,
  `beneficiary_id` varchar(100) NOT NULL,
  `name` varchar(200) NOT NULL,
  `account_number` varchar(50) NOT NULL,
  `ifsc` varchar(20) NOT NULL,
  `bank_name` varchar(200) NOT NULL,
  `beneficiary_mobile` varchar(15) DEFAULT NULL,
  `verification_date` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_beneficiary` (`beneficiary_id`, `mobile_number`),
  KEY `idx_mobile_number` (`mobile_number`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_beneficiary_id` (`beneficiary_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


alter table dmt_beneficiaries
add column bank_verified bool,
add column bank_verification_date timestamp,
add column name_match_percent double,
add column  bank_registered_name text;

-- 3. DMT Transactions Table
CREATE TABLE IF NOT EXISTS `dmt_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `mobile_number` varchar(15) DEFAULT NULL,
  `beneficiary_id` varchar(100) DEFAULT NULL,
  `transaction_id` varchar(100) DEFAULT NULL,
  `order_id` varchar(100) DEFAULT NULL,
  `ipay_uuid` varchar(100) DEFAULT NULL,
  `api_endpoint` varchar(100) NOT NULL,
  `request_data` longtext DEFAULT NULL,
  `response_data` longtext DEFAULT NULL,
  `amount` decimal(10,2) DEFAULT 0.00,
  `mode` enum('IMPS', 'NEFT') DEFAULT NULL,
  `status` varchar(50) NOT NULL,
  `statuscode` varchar(10) DEFAULT NULL,
  `commission` decimal(10,2) DEFAULT 0.00,
  `charge` decimal(10,2) DEFAULT 0.00,
  `opening_balance` decimal(10,2) DEFAULT 0.00,
  `closing_balance` decimal(10,2) DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_mobile_number` (`mobile_number`),
  KEY `idx_transaction_id` (`transaction_id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. DMT Fund Transfers Table (Successful Transactions)
CREATE TABLE IF NOT EXISTS `dmt_fund_transfers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `remitter_mobile` varchar(15) NOT NULL,
  `beneficiary_id` varchar(100) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `channel` enum('IMPS', 'NEFT') NOT NULL DEFAULT 'IMPS',
  `transaction_id` varchar(100) DEFAULT NULL,
  `ref_id` varchar(100) DEFAULT NULL,
  `rrn` varchar(100) DEFAULT NULL,
  `bank_rrn` varchar(100) DEFAULT NULL,
  `status` enum('SUCCESS', 'FAILED', 'PENDING') NOT NULL DEFAULT 'PENDING',
  `charge` decimal(10,2) DEFAULT 0.00,
  `gst` decimal(10,2) DEFAULT 0.00,
  `total_amount` decimal(10,2) NOT NULL,
  `commission` decimal(10,2) DEFAULT 0.00,
  `opening_balance` decimal(10,2) DEFAULT 0.00,
  `closing_balance` decimal(10,2) DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_remitter_mobile` (`remitter_mobile`),
  KEY `idx_beneficiary_id` (`beneficiary_id`),
  KEY `idx_transaction_id` (`transaction_id`),
  KEY `idx_ref_id` (`ref_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. DMT Configuration Table
CREATE TABLE IF NOT EXISTS `dmt_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `config_key` varchar(100) NOT NULL,
  `config_value` text NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. DMT Charges Table
CREATE TABLE IF NOT EXISTS `dmt_charges` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `role_id` int(11) NOT NULL,
  `min_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `max_amount` decimal(10,2) NOT NULL DEFAULT 999999.99,
  `charge_type` enum('FLAT', 'PERCENTAGE') NOT NULL DEFAULT 'FLAT',
  `charge_value` decimal(10,4) NOT NULL DEFAULT 0.00,
  `commission_type` enum('FLAT', 'PERCENTAGE') NOT NULL DEFAULT 'FLAT',
  `commission_value` decimal(10,4) NOT NULL DEFAULT 0.00,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_amount_range` (`min_amount`, `max_amount`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default configuration values
INSERT INTO `dmt_config` (`config_key`, `config_value`, `description`) VALUES
('service_status', '1', 'DMT Service Status (1=Active, 0=Inactive)'),
('min_transaction_amount', '10', 'Minimum transaction amount allowed'),
('max_transaction_amount', '25000', 'Maximum transaction amount allowed'),
('daily_limit', '25000', 'Daily transaction limit per remitter'),
('monthly_limit', '100000', 'Monthly transaction limit per remitter'),
('imps_charges', '5', 'IMPS transaction charges'),
('neft_charges', '3', 'NEFT transaction charges'),
('service_downtime_message', 'DMT service is temporarily unavailable. Please try again later.', 'Message to show when service is down')
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);

-- Insert default charge structure
INSERT INTO `dmt_charges` (`role_id`, `min_amount`, `max_amount`, `charge_type`, `charge_value`, `commission_type`, `commission_value`) VALUES
(1, 10, 1000, 'FLAT', 5.00, 'FLAT', 2.00),
(1, 1001, 5000, 'FLAT', 10.00, 'FLAT', 4.00),
(1, 5001, 25000, 'FLAT', 15.00, 'FLAT', 6.00),
(2, 10, 1000, 'FLAT', 7.00, 'FLAT', 1.50),
(2, 1001, 5000, 'FLAT', 12.00, 'FLAT', 3.00),
(2, 5001, 25000, 'FLAT', 18.00, 'FLAT', 5.00),
(3, 10, 1000, 'FLAT', 10.00, 'FLAT', 1.00),
(3, 1001, 5000, 'FLAT', 15.00, 'FLAT', 2.00),
(3, 5001, 25000, 'FLAT', 20.00, 'FLAT', 3.00)
ON DUPLICATE KEY UPDATE charge_value = VALUES(charge_value), commission_value = VALUES(commission_value);
