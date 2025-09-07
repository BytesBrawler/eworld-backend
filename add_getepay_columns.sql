-- Add gateway column to transactions table to differentiate between payment gateways
ALTER TABLE transactions ADD COLUMN gateway VARCHAR(50) DEFAULT 'tez';

-- Add index for better query performance
CREATE INDEX idx_transactions_gateway ON transactions(gateway);
CREATE INDEX idx_transactions_status_gateway ON transactions(status, gateway);

-- Create refund_requests table if it doesn't exist
CREATE TABLE IF NOT EXISTS refund_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id INT NOT NULL,
    user_id INT NOT NULL,
    refund_amount DECIMAL(10,2) NOT NULL,
    refund_note TEXT,
    gateway_response JSON,
    status ENUM('pending', 'approved', 'rejected', 'processed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_refund_transaction_id (transaction_id),
    INDEX idx_refund_user_id (user_id),
    INDEX idx_refund_status (status),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
