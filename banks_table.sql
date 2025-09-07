-- Banks Table for DMT
-- This table stores the list of banks fetched from InstantPay API

CREATE TABLE IF NOT EXISTS `banks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bank_id` varchar(50) NOT NULL,
  `bank_name` varchar(200) NOT NULL,
  `ifsc_alias` varchar(20) DEFAULT NULL,
  `ifsc_global` varchar(20) DEFAULT NULL,
  `neft_enabled` tinyint(1) DEFAULT 0,
  `neft_failure_rate` varchar(10) DEFAULT '0',
  `imps_enabled` tinyint(1) DEFAULT 0,
  `imps_failure_rate` varchar(10) DEFAULT '0',
  `upi_enabled` tinyint(1) DEFAULT 0,
  `upi_failure_rate` varchar(10) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_bank_id` (`bank_id`),
  KEY `idx_bank_name` (`bank_name`),
  KEY `idx_active` (`is_active`),
  KEY `idx_neft_enabled` (`neft_enabled`),
  KEY `idx_imps_enabled` (`imps_enabled`),
  KEY `idx_upi_enabled` (`upi_enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bank Sync Log Table (to track when bank list was last updated)
CREATE TABLE IF NOT EXISTS `bank_sync_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sync_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `total_banks` int(11) DEFAULT 0,
  `status` enum('SUCCESS','FAILED') DEFAULT 'SUCCESS',
  `error_message` text DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
