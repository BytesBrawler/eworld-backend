-- Add manual update tracking columns to transactions table
-- This allows tracking when admin users manually update transaction status

-- Add column to track which admin user made the manual update
ALTER TABLE transactions 
ADD COLUMN manual_update_by INT NULL,
ADD CONSTRAINT fk_manual_update_by FOREIGN KEY (manual_update_by) REFERENCES users(id);

-- Add column to store the reason for manual update
ALTER TABLE transactions 
ADD COLUMN manual_update_reason TEXT NULL;

-- Add index for better query performance
CREATE INDEX idx_manual_update_by ON transactions(manual_update_by);

-- Add gateway column if it doesn't exist (for transaction categorization)
ALTER TABLE transactions 
ADD COLUMN gateway VARCHAR(50) NULL DEFAULT 'UNKNOWN';

-- Update existing Getepay transactions to have correct gateway value
UPDATE transactions 
SET gateway = 'GETEPAY' 
WHERE gateway IS NULL AND (
    order_id LIKE 'GETEPAY_%' OR 
    payment_mode LIKE '%getepay%' OR 
    JSON_EXTRACT(gateway_response, '$.gateway') = 'getepay'
);

-- Add error_message column if it doesn't exist
ALTER TABLE transactions 
ADD COLUMN error_message TEXT NULL;

-- Show current table structure after updates
DESCRIBE transactions;