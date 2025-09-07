-- Create transactions table for payment gateway transactions
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    order_id VARCHAR(255) UNIQUE NOT NULL,
    gateway_order_id VARCHAR(255),
    amount DECIMAL(10, 2) NOT NULL,
    status ENUM('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED') DEFAULT 'PENDING',
    gateway ENUM('RAZORPAY', 'PHONEPE', 'PAYU', 'GETEPAY') NOT NULL,
    mobile_no VARCHAR(15),
    email VARCHAR(255),
    company_name VARCHAR(255),
    gateway_response TEXT,
    callback_response TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_order_id (order_id),
    INDEX idx_status (status),
    INDEX idx_gateway (gateway),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create refunds table for refund transactions
CREATE TABLE IF NOT EXISTS refunds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    order_id VARCHAR(255) NOT NULL,
    refund_id VARCHAR(255) UNIQUE,
    original_amount DECIMAL(10, 2) NOT NULL,
    refund_amount DECIMAL(10, 2) NOT NULL,
    reason TEXT,
    gateway ENUM('RAZORPAY', 'PHONEPE', 'PAYU', 'GETEPAY') NOT NULL,
    gateway_response TEXT,
    status ENUM('PENDING', 'SUCCESS', 'FAILED') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_order_id (order_id),
    INDEX idx_refund_id (refund_id),
    INDEX idx_status (status),
    INDEX idx_gateway (gateway),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create wallet_transactions table for tracking wallet credit/debit operations
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('CREDIT', 'DEBIT') NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    reference_id VARCHAR(255),
    balance_before DECIMAL(10, 2),
    balance_after DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_reference_id (reference_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create getepay_config table for storing Getepay configuration
CREATE TABLE IF NOT EXISTS getepay_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mid VARCHAR(255) NOT NULL,
    terminal_id VARCHAR(255) NOT NULL,
    encryption_key TEXT NOT NULL,
    encryption_iv TEXT NOT NULL,
    base_url VARCHAR(500) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    environment ENUM('SANDBOX', 'PRODUCTION') DEFAULT 'SANDBOX',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default Getepay configuration
INSERT INTO getepay_config (
    mid, 
    terminal_id, 
    encryption_key, 
    encryption_iv, 
    base_url, 
    environment,
    is_active
) VALUES (
    '1232623',
    'getepay.merchant130805@icici',
    'gqd/0xqwKy2VX0BGMzwXnxL371ihOZU4trOWI9w13w0=',
    'LHPaBO5CtLWc8H2dtXaGgQ==',
    'https://portal.getepay.in:8443/getepayPortal/pg/generateInvoice',
    'PRODUCTION',
    TRUE
) ON DUPLICATE KEY UPDATE
    mid = VALUES(mid),
    terminal_id = VALUES(terminal_id),
    encryption_key = VALUES(encryption_key),
    encryption_iv = VALUES(encryption_iv),
    base_url = VALUES(base_url),
    environment = VALUES(environment),
    updated_at = CURRENT_TIMESTAMP;
