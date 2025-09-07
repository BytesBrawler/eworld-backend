-- Migration script to update banks table structure for new API response format
-- Run this script to update your existing banks table

-- Step 1: Add new columns to the existing banks table
ALTER TABLE `banks` 
ADD COLUMN `ifsc_alias` varchar(20) DEFAULT NULL AFTER `bank_name`,
ADD COLUMN `ifsc_global` varchar(20) DEFAULT NULL AFTER `ifsc_alias`,
ADD COLUMN `neft_enabled` tinyint(1) DEFAULT 0 AFTER `ifsc_global`,
ADD COLUMN `neft_failure_rate` varchar(10) DEFAULT '0' AFTER `neft_enabled`,
ADD COLUMN `imps_enabled` tinyint(1) DEFAULT 0 AFTER `neft_failure_rate`,
ADD COLUMN `imps_failure_rate` varchar(10) DEFAULT '0' AFTER `imps_enabled`,
ADD COLUMN `upi_enabled` tinyint(1) DEFAULT 0 AFTER `imps_failure_rate`,
ADD COLUMN `upi_failure_rate` varchar(10) DEFAULT '0' AFTER `upi_enabled`;

-- Step 2: Add indexes for better performance
ALTER TABLE `banks` 
ADD KEY `idx_neft_enabled` (`neft_enabled`),
ADD KEY `idx_imps_enabled` (`imps_enabled`),
ADD KEY `idx_upi_enabled` (`upi_enabled`);

-- Step 3: Drop old columns that are no longer needed (optional - uncomment if you want to remove them)
-- ALTER TABLE `banks` DROP COLUMN `bank_code`;
-- ALTER TABLE `banks` DROP COLUMN `ifsc_prefix`;

-- Step 4: Update existing data (if any) to set default values
UPDATE `banks` SET 
  `neft_enabled` = 1,
  `imps_enabled` = 1,
  `upi_enabled` = 0
WHERE `neft_enabled` IS NULL OR `imps_enabled` IS NULL OR `upi_enabled` IS NULL;

-- Verify the changes
SELECT * FROM `banks` LIMIT 5;
