-- Create callback_logs table for tracking callback attempts and debugging
CREATE TABLE IF NOT EXISTS callback_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recharge_id INT NULL,
    callback_data JSON,
    status VARCHAR(50),
    error_message TEXT NULL,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_recharge_id (recharge_id),
    INDEX idx_status (status),
    INDEX idx_processed_at (processed_at),
    FOREIGN KEY (recharge_id) REFERENCES recharges(id) ON DELETE SET NULL
);
