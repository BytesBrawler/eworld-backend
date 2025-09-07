-- Updated Banks Table for DMT with new API response format
-- This table stores the list of banks fetched from InstantPay API

CREATE TABLE IF NOT EXISTS `banks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bank_id` varchar(50) NOT NULL COMMENT 'Bank ID from API response (bankId)',
  `bank_name` varchar(200) NOT NULL COMMENT 'Bank name from API response (name)',
  `ifsc_alias` varchar(20) DEFAULT NULL COMMENT 'IFSC alias from API response (ifscAlias)',
  `ifsc_global` varchar(20) DEFAULT NULL COMMENT 'Global IFSC code from API response (ifscGlobal)',
  `neft_enabled` tinyint(1) DEFAULT 0 COMMENT 'NEFT enabled status (neftEnabled)',
  `neft_failure_rate` varchar(10) DEFAULT '0' COMMENT 'NEFT failure rate (neftFailureRate)',
  `imps_enabled` tinyint(1) DEFAULT 0 COMMENT 'IMPS enabled status (impsEnabled)',
  `imps_failure_rate` varchar(10) DEFAULT '0' COMMENT 'IMPS failure rate (impsFailureRate)',
  `upi_enabled` tinyint(1) DEFAULT 0 COMMENT 'UPI enabled status (upiEnabled)',
  `upi_failure_rate` varchar(10) DEFAULT '0' COMMENT 'UPI failure rate (upiFailureRate)',
  `is_active` tinyint(1) DEFAULT 1 COMMENT 'Local active status',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_bank_id` (`bank_id`),
  KEY `idx_bank_name` (`bank_name`),
  KEY `idx_active` (`is_active`),
  KEY `idx_neft_enabled` (`neft_enabled`),
  KEY `idx_imps_enabled` (`imps_enabled`),
  KEY `idx_upi_enabled` (`upi_enabled`),
  KEY `idx_ifsc_alias` (`ifsc_alias`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bank Sync Log Table (to track when bank list was last updated)
CREATE TABLE IF NOT EXISTS `bank_sync_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sync_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `total_banks` int(11) DEFAULT 0,
  `status` enum('SUCCESS','FAILED') DEFAULT 'SUCCESS',
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Sample data structure for reference
-- {
--   "bankId": 1,
--   "name": "AIRTEL PAYMENTS BANK",
--   "ifscAlias": "AIRP",
--   "ifscGlobal": "AIRP0000001",
--   "neftEnabled": 1,
--   "neftFailureRate": "0",
--   "impsEnabled": 1,
--   "impsFailureRate": "0",
--   "upiEnabled": 0,
--   "upiFailureRate": "0"
-- }
