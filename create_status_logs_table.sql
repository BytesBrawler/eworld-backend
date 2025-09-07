-- Create transaction status logs table for audit trail
USE svrecharge;

CREATE TABLE IF NOT EXISTS transaction_status_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL,
    transaction_id INT,
    gateway ENUM('TEZ', 'GETEPAY', 'RAZORPAY', 'PHONEPE', 'PAYU') NOT NULL,
    check_type ENUM('status_check', 'requery', 'callback', 'webhook') NOT NULL,
    
    -- Separate columns for key fields (for easy querying)
    gateway_txn_id VARCHAR(255),
    gateway_status VARCHAR(50),
    payment_mode VARCHAR(50),
    txn_amount DECIMAL(10, 2),
    settlement_amount DECIMAL(10, 2),
    bank_ref_no VARCHAR(255),
    payment_id VARCHAR(255),
    txn_date DATETIME,
    settlement_date DATETIME,
    error_code VARCHAR(50),
    error_message TEXT,
    
    -- Complete response as JSON for full audit trail
    gateway_response JSON,
    
    -- Request details
    request_data JSON,
    
    -- Status mapping
    previous_status VARCHAR(50),
    updated_status VARCHAR(50),
    status_changed BOOLEAN DEFAULT FALSE,
    
    -- Processing details
    balance_added DECIMAL(10, 2) DEFAULT 0.00,
    balance_processed BOOLEAN DEFAULT FALSE,
    admin_balance_sufficient BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_order_id (order_id),
    INDEX idx_transaction_id (transaction_id),
    INDEX idx_gateway (gateway),
    INDEX idx_check_type (check_type),
    INDEX idx_gateway_status (gateway_status),
    INDEX idx_created_at (created_at),
    INDEX idx_order_gateway (order_id, gateway),
    
    -- Foreign key constraint
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);

-- Create index for common queries
CREATE INDEX idx_status_logs_order_type ON transaction_status_logs(order_id, check_type);
CREATE INDEX idx_status_logs_gateway_status ON transaction_status_logs(gateway, gateway_status);
CREATE INDEX idx_status_logs_date_range ON transaction_status_logs(created_at, gateway);
