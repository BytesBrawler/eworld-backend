-- Add bank verification columns to dmt_beneficiaries table
ALTER TABLE dmt_beneficiaries 
ADD COLUMN bank_verified TINYINT(1) DEFAULT 0 COMMENT 'Bank account verification status',
ADD COLUMN bank_verification_date DATETIME NULL COMMENT 'Date when bank was verified',
ADD COLUMN name_match_percent DECIMAL(5,2) NULL COMMENT 'Name match percentage from bank verification',
ADD COLUMN bank_registered_name VARCHAR(255) NULL COMMENT 'Name registered with the bank';

-- Add index for better performance
CREATE INDEX idx_bank_verified ON dmt_beneficiaries(bank_verified);
CREATE INDEX idx_bank_verification_date ON dmt_beneficiaries(bank_verification_date);
