--  create database recharges;

-- use recharges; 

-- CREATE TABLE roles (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     role ENUM('sa', 'a', 'mtd', 'd', 'r', 'api') UNIQUE NOT NULL,
--     description VARCHAR(255),
--     allowed_actions JSON,  -- List of allowed actions/features for the role
--     allowed_parents JSON, -- List of roles that can be parents of this role
--     allowed_actions_web JSON
-- );



-- INSERT INTO roles (role, description, allowed_actions, allowed_parents, allowed_actions_web) VALUES
-- ('sa', 'Super Admin', 
--     JSON_ARRAY(
--     '{"name": "Pendings", "childrens": null, "icon": "assets/icons/file.png"}',
--     '{"name": "Admin", "childrens": null, "icon": "assets/icons/shop.png"}',
--     '{"name": "All users", "childrens": null, "icon": "assets/icons/shopping-store.png"}',
--     '{"name": "Generate balance", "childrens": null, "icon": "assets/icons/money-exchange.png"}',
--     '{"name": "Bal transactions", "childrens": null, "icon": "assets/icons/money-transfer.png"}',
--     '{"name": "Sales", "childrens": null, "icon": "assets/icons/business-report.png"}',
--     '{"name": "Online Tra.", "childrens": null, "icon": "assets/icons/report.png"}',
--     '{"name": "News", "childrens": null, "icon": "assets/icons/news.png"}'
--     ), 
--     JSON_ARRAY(),
--     JSON_ARRAY(
--     '{"icon": "home", "name": "Home", "childrens": null}',
--     '{"icon": "list", "name": "Pendings", "childrens": null}',
--     '{"icon": "users", "name": "Admin", "childrens": [{"icon": "userPlus", "name": "Add Admin"}, {"icon": "alternateListAlt", "name": "View Admin"}]}',
--     '{"icon": "users", "name": "Api Resellers", "childrens": [{"icon": "userPlus", "name": "Add Reseller"}, {"icon": "alternateListAlt", "name": "View Reseller"}]}',
--     '{"icon": "alternateListAlt", "name": "All Users"}',
--     '{"icon": "paypalCreditCard", "name": "Wallet"}',
--     '{"icon": "paypalCreditCard", "name": "Generate balance"}',
--     '{"icon": "bity", "name": "Operators & API", "childrens": [{"icon": "i-cursor", "name": "Operator Types"}, {"icon": "external-link", "name": "Create Operator"}, {"icon": "external-link", "name": "View Operators"}, {"icon": "external-link", "name": "Create API Providers"}, {"icon": "external-link", "name": "View API Providers"}, {"icon": "external-link", "name": "Create APIs"}, {"icon": "external-link", "name": "View APIs"}, {"icon": "external-link", "name": "Create Keyword"}, {"icon": "external-link", "name": "View Keywords"}]}',
--     '{"icon": "list", "name": "Reports", "childrens": [{"icon": "paste", "name": "History", "childrens": null}, {"icon": "paste", "name": "Sales", "childrens": null}, {"icon": "paste", "name": "Online Transactions", "childrens": null}, {"icon": "paste", "name": "Earnings", "childrens": null}, {"icon": "list", "name": "Messages Report", "childrens": null}]}',
--     '{"icon": "paste", "name": "History", "childrens": null}',
--     '{"icon": "ad", "name": "Add News", "childrens": null}',
--     '{"icon": "newspaper", "name": "News", "childrens": null}',
--     '{"icon": "lock", "name": "Settings", "childrens": null}',
--     '{"icon": "unlock", "name": "Reset Password", "childrens": null}'
--     )
-- ),
-- ('a', 'Admin', 
--     JSON_ARRAY(
--     '{"name": "Pendings", "childrens": null, "icon": "assets/icons/file.png"}',
--     '{"name": "Master Distributors", "childrens": [{"name": "Add Master Distributor", "icon": "assets/icons/shop.png"}, {"name": "View Master Distributor", "icon": "assets/icons/shopping-store.png"}], "icon": "assets/icons/shop.png"}',
--     '{"name": "All users", "childrens": null, "icon": "assets/icons/shopping-store.png"}',
--     '{"name": "Bal transactions", "childrens": null, "icon": "assets/icons/money-transfer.png"}',
--     '{"name": "Sales", "childrens": null, "icon": "assets/icons/business-report.png"}',
--     '{"name": "Online Tra.", "childrens": null, "icon": "assets/icons/report.png"}',
--     '{"name": "News", "childrens": null, "icon": "assets/icons/news.png"}'
--     ), 
--     JSON_ARRAY('sa'),
--     JSON_ARRAY(
--     '{"icon": "home", "name": "Home", "childrens": null}',
--     '{"icon": "list", "name": "Pendings", "childrens": null}',
--     '{"icon": "users", "name": "Master Distributors", "childrens": [{"icon": "userPlus", "name": "Add Master Distributor"}, {"icon": "alternateListAlt", "name": "View Master Distributor"}]}',
--     '{"icon": "users", "name": "Api Resellers", "childrens": [{"icon": "userPlus", "name": "Add Reseller"}, {"icon": "alternateListAlt", "name": "View Reseller"}]}',
--     '{"icon": "alternateListAlt", "name": "All Users"}',
--     '{"icon": "paypalCreditCard", "name": "Wallet"}',
--     '{"icon": "bity", "name": "Operators & API", "childrens": [{"icon": "i-cursor", "name": "Operator Types"}, {"icon": "external-link", "name": "Create Operator"}, {"icon": "external-link", "name": "View Operators"}, {"icon": "external-link", "name": "Create API Providers"}, {"icon": "external-link", "name": "View API Providers"}, {"icon": "external-link", "name": "Create APIs"}, {"icon": "external-link", "name": "View APIs"}, {"icon": "external-link", "name": "Create Keyword"}, {"icon": "external-link", "name": "View Keywords"}]}',
--     '{"icon": "list", "name": "Reports", "childrens": [{"icon": "paste", "name": "History", "childrens": null}, {"icon": "paste", "name": "Sales", "childrens": null}, {"icon": "paste", "name": "Online Transactions", "childrens": null}, {"icon": "paste", "name": "Earnings", "childrens": null}, {"icon": "list", "name": "Messages Report", "childrens": null}]}',
--     '{"icon": "paste", "name": "History", "childrens": null}',
--     '{"icon": "ad", "name": "Add News", "childrens": null}',
--     '{"icon": "newspaper", "name": "News", "childrens": null}',
--     '{"icon": "unlock", "name": "Reset Password", "childrens": null}'
--     )
-- ),
-- ('mtd', 'Master Distributor', 
--     JSON_ARRAY(
--     '{"name": "Distributors", "childrens": [{"name": "Add Distributor", "icon": "assets/icons/shop.png"}, {"name": "View Distributor", "icon": "assets/icons/shopping-store.png"}], "icon": "assets/icons/shopping-store.png"}',
--     '{"name": "Retailers", "childrens": [{"name": "Add Retailers", "icon": "assets/icons/shop.png"}, {"name": "View Retailers", "icon": "assets/icons/shopping-store.png"}], "icon": "assets/icons/shop.png"}',
--     '{"name": "Transactions", "childrens": null, "icon": "assets/icons/report.png"}',
--     '{"name": "Purchases", "childrens": null, "icon": "assets/icons/purchase-order.png"}',
--     '{"name": "Earnings", "childrens": null, "icon": "assets/icons/money-exchange.png"}',
--     '{"name": "News", "childrens": null, "icon": "assets/icons/news.png"}',
--     '{"name": "Reset Password", "childrens": null, "icon": "assets/icons/key.png"}'
--     ), 
--     JSON_ARRAY('sa', 'a'),
--     JSON_ARRAY(
--     '{"icon": "home", "name": "Home", "childrens": null}',
--     '{"icon": "users", "name": "Distributors", "childrens": [{"icon": "userPlus", "name": "Add Distributor"}, {"icon": "alternateListAlt", "name": "View Distributor"}]}',
--     '{"icon": "user", "name": "Retailers", "childrens": [{"icon": "userPlus", "name": "Add Retailers"}, {"icon": "alternateListAlt", "name": "View Retailers"}]}',
--     '{"icon": "paypalCreditCard", "name": "Wallet"}',
--     '{"icon": "flipboard", "name": "Margin"}',
--     '{"icon": "paste", "name": "History", "childrens": null}',
--     '{"icon": "list", "name": "Purchase", "childrens": null}',
--     '{"icon": "list", "name": "Earnings", "childrens": null}',
--     '{"icon": "newspaper", "name": "News", "childrens": null}',
--     '{"icon": "unlock", "name": "Reset Password", "childrens": null}'
--     )
-- ),
-- ('d', 'Distributor', 
--     JSON_ARRAY(
--     '{"name": "Retailers", "childrens": [{"name": "Add Retailers", "icon": "assets/icons/shop.png"}, {"name": "View Retailers", "icon": "assets/icons/shopping-store.png"}], "icon": "assets/icons/shop.png"}',
--     '{"name": "Transactions", "childrens": null, "icon": "assets/icons/report.png"}',
--     '{"name": "Purchases", "childrens": null, "icon": "assets/icons/purchase-order.png"}',
--     '{"name": "Earnings", "childrens": null, "icon": "assets/icons/money-exchange.png"}',
--     '{"name": "News", "childrens": null, "icon": "assets/icons/news.png"}',
--     '{"name": "Reset Password", "childrens": null, "icon": "assets/icons/key.png"}'
--     ), 
--     JSON_ARRAY('sa', 'a', 'mtd'),
--     JSON_ARRAY(
--     '{"icon": "home", "name": "Home", "childrens": null}',
--     '{"icon": "user", "name": "Retailers", "childrens": [{"icon": "userPlus", "name": "Add Retailers"}, {"icon": "alternateListAlt", "name": "View Retailers"}]}',
--     '{"icon": "paypalCreditCard", "name": "Wallet"}',
--     '{"icon": "paypalCreditCard", "name": "Get balance"}',
--     '{"icon": "flipboard", "name": "Margin"}',
--     '{"icon": "paste", "name": "History", "childrens": null}',
--     '{"icon": "list", "name": "Purchase", "childrens": null}',
--     '{"icon": "list", "name": "Earnings", "childrens": null}',
--     '{"icon": "newspaper", "name": "News", "childrens": null}',
--     '{"icon": "unlock", "name": "Reset Password", "childrens": null}'
--     )
-- ),
-- ('r', 'Retailer', 
--     JSON_ARRAY(
--     '{"name": "Mobile Recharge", "childrens": null, "icon": "assets/icons/mobile-phone.png"}',
--     '{"name": "DTH Recharge", "childrens": null, "icon": "assets/icons/online.png"}',
--     '{"name": "History", "childrens": null, "icon": "assets/icons/report.png"}',
--     '{"name": "Purchases", "childrens": null, "icon": "assets/icons/purchase-order.png"}',
--     '{"name": "News", "childrens": null, "icon": "assets/icons/news.png"}',
--     '{"name": "Reset Password", "childrens": null, "icon": "assets/icons/key.png"}'
--     ), 
--     JSON_ARRAY('d'),
--     JSON_ARRAY()
-- ),
-- ('api', 'API User', 
--     JSON_ARRAY(
--     '{"name": "Mobile Recharge", "childrens": null, "icon": "assets/icons/mobile-phone.png"}',
--     '{"name": "DTH Recharge", "childrens": null, "icon": "assets/icons/online.png"}',
--     '{"name": "Api Config", "childrens": null, "icon": "assets/icons/business-report.png"}',
--     '{"name": "History", "childrens": null, "icon": "assets/icons/report.png"}',
--     '{"name": "Purchases", "childrens": null, "icon": "assets/icons/purchase-order.png"}',
--     '{"name": "News", "childrens": null, "icon": "assets/icons/news.png"}',
--     '{"name": "Reset Password", "childrens": null, "icon": "assets/icons/key.png"}'
--     ), 
--     JSON_ARRAY('sa', 'a'),
--     JSON_ARRAY()
-- );


-- CREATE TABLE users (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     person VARCHAR(100) NOT NULL,
--     password VARCHAR(255) NOT NULL,
--     mobile VARCHAR(15) UNIQUE NOT NULL,
--     company VARCHAR(200),
--     email VARCHAR(100),
--     address TEXT,
--     role_id INT NOT NULL default 5,
--     parent_id INT NOT NULL,
--     balance DECIMAL(10,2) DEFAULT 0.00,
--     is_flat_margin BOOLEAN DEFAULT false,
--     margin_rates DOUBLE DEFAULT null,
--     can_withdraw BOOLEAN DEFAULT true,
--     can_set_margin BOOLEAN DEFAULT true,
--     can_edit BOOLEAN DEFAULT true,
--     margin_type ENUM('flat', 'user', 'standard', 'customised'),
--     status ENUM('active', 'inactive') DEFAULT 'active',
--     callback_url text default null,
--      isWalletAllowed boolean default true,
--      api_key VARCHAR(255) UNIQUE DEFAULT NULL,
--      marginAllowed boolean default true,

--     created_from JSON NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     updated_from JSON default NULL,
--     FOREIGN KEY (parent_id) REFERENCES users(id),
--     FOREIGN KEY (role_id) REFERENCES roles(id),
--     INDEX idx_mobile (mobile),
--     INDEX idx_status (status),
--     INDEX idx_role_id (role_id)
-- );



-- CREATE TABLE reseller_ips (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     user_id INT NOT NULL,
--     ip VARCHAR(45) NOT NULL,
--     status BOOLEAN DEFAULT TRUE, -- TRUE = active, FALSE = blocked
--     added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (user_id) REFERENCES users(id)
-- );

-- INSERT INTO users (
--     person,
--     password,
--     mobile,
--     company,
--     email,
--     role_id,
--     parent_id,
--     created_from
-- ) VALUES (
--     'imran',
--     '$2a$10$NQWQvS32qaO4ttds5nYd6uCzoKoSZQT7HLZnRwNIuWy0UF.oKIhRe',
--     '9667027786',
--     'MTC',
--     'imranchopdar13@gmail.com',
--     1,
--     1,
--     '{"ip":"::1","userAgent":"PostmanRuntime/7.43.0","latitude":"123","longitude":"456"}'
-- );





-- -- User Activity Logs
-- CREATE TABLE user_logs (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     user_id INT NOT NULL,
--     token VARCHAR(30) not NULL  ,
--     action VARCHAR(100) NOT NULL,
--     ip_address VARCHAR(45),
--     device_info TEXT,
--     location TEXT,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     fbkey text,
--      extra text,

--     FOREIGN KEY (user_id) REFERENCES users(id),
--     INDEX idx_token (token),
--     INDEX idx_created_at (created_at)
-- );







-- -- -- Fund Requests
-- CREATE TABLE fund_request (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     user_id INT NOT NULL,
--     amount DECIMAL(10,2) NOT NULL,
--     status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
--     approved_by INT,
--     user_remark TEXT,
--     remark TEXT,
--     payment_proof TEXT,
--     payment_mode VARCHAR(50),
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (user_id) REFERENCES users(id),
--     FOREIGN KEY (approved_by) REFERENCES users(id),
--     INDEX idx_status (status),
--     INDEX idx_created_at (created_at)
-- );


-- -- -- Transactions
-- CREATE TABLE transactions (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     user_id INT NOT NULL,
--     amount DECIMAL(10,2) NOT NULL,
--     status ENUM('initiated', 'pending', 'success', 'failed') DEFAULT 'initiated',
--     reference_id VARCHAR(100),
--     payment_mode VARCHAR(50),
--     order_id VARCHAR(50),
--     payment_details JSON,
--     gateway_response JSON,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     FOREIGN KEY (user_id) REFERENCES users(id),
--     INDEX idx_reference_id (reference_id),
--     INDEX idx_status (status),
--     INDEX idx_created_at (created_at)
-- );




-- -- -- Balance transactions with improved status tracking
-- CREATE TABLE bal_transactions (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     user_id INT ,
--     to_id INT NOT NULL,
--     transaction_type ENUM('online', 'offline') NOT NULL,
--     is_through_fund_request BOOLEAN DEFAULT false,
--     fund_request_id INT,
--     amount DECIMAL(10,2) NOT NULL,
--     original_amount Decimal(10,2) not null,
--     status ENUM('initiated', 'pending', 'success', 'failed') DEFAULT 'initiated',
--     prev_balance DECIMAL(10,2) NOT NULL,
--     new_balance DECIMAL(10,2) NOT NULL,
-- 	maalik_prev_balance DECIMAL(10,2) NOT NULL ,
--     maalik_new_balance DECIMAL(10,2) NOT NULL,
--     reference_id VARCHAR(100),
--     txn_id int default null,
--     remark VARCHAR(500),
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     FOREIGN KEY (user_id) REFERENCES users(id),
--     FOREIGN KEY (to_id) REFERENCES users(id),
--     FOREIGN KEY (fund_request_id) REFERENCES fund_request(id),
--     FOREIGN KEY (txn_id) REFERENCES transactions(id),
--     INDEX idx_status (status),
--     INDEX idx_transaction_type (transaction_type)
-- ); 


-- -- -- News/Announcements
-- CREATE TABLE news (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     title VARCHAR(255) ,
--     type ENUM('text', 'image') NOT NULL,
--     expiry_time TIMESTAMP,
--     description TEXT,
--     image TEXT,
--     priority INT DEFAULT 0,
--     role  JSON not null,
--     is_public BOOLEAN DEFAULT true,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     INDEX idx_expiry_time (expiry_time)
-- );




-- --  Operator types with improved categorization
-- CREATE TABLE operator_types (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     name VARCHAR(50) UNIQUE NOT NULL,
--     description TEXT,
--     status ENUM('active', 'inactive') DEFAULT 'active',
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     INDEX idx_status (status)
-- );





-- -- -- Operators with improved margin handling
-- CREATE TABLE operators (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     name VARCHAR(100) NOT NULL,
--     code VARCHAR(40) NOT NULL UNIQUE,
--     logo TEXT NOT NULL,
--     alert_balance int default 0,
--     lock_amt int default 0,
--     type INT NOT NULL,
--     status BOOLEAN DEFAULT TRUE, 
--     delay int default 0,
-- 	margin double default 0.00,
--     pending_limit int default 0,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     FOREIGN KEY (type) REFERENCES operator_types(id),
--     INDEX idx_code (code),
--     INDEX idx_status (status)
-- );




-- -- -- Keywords table with improved structure
-- CREATE TABLE keywords (
--      id INT AUTO_INCREMENT PRIMARY KEY,
--      description VARCHAR(100) NOT NULL,
--      code varchar(25)  not null,
--      operator_id INT NOT NULL,
--      flat_margin Decimal(10,3),
--      min_digits INT NOT NULL,
--      max_digits INT NOT NULL,
-- 	 gap INT,
--      additional_charges DECIMAL(10,3) DEFAULT 0,
--      is_additional_charges_fixed BOOLEAN DEFAULT true,
-- 	 min_recharge DECIMAL(10,2) ,
--      max_recharge DECIMAL(10,2) ,
-- 	 admin_margin DECIMAL(10,3) ,
--      ret_std_margin DECIMAL(10,3),
--      dist_std_margin DECIMAL(10,3),
--      mdist_std_margin DECIMAL(10,3), 
--      status BOOLEAN DEFAULT TRUE,
--      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--      FOREIGN KEY (operator_id) REFERENCES operators(id),
--      INDEX idx_status (status)
--  );


-- CREATE TABLE keyword_settings (
--     id INT PRIMARY KEY AUTO_INCREMENT,
--     user_id INT NOT NULL,
--     keyword_id INT NOT NULL,
--     custom_margin DECIMAL(10,2) DEFAULT NULL,
--     enabled BOOLEAN DEFAULT 1,
--     additional_charges decimal(10,3),
--     is_charges_fixed boolean default true,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     UNIQUE KEY (user_id, keyword_id),
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
--     FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE
-- );


-- create table keyword_record(
-- id int auto_increment primary key,
-- user_id INT NOT NULL,
-- keyword_id INT NOT NULL,
-- role int NOT NULL,
-- custom_margin DECIMAL(10,2) DEFAULT NULL,
-- enabled BOOLEAN DEFAULT 1,
-- additional_charges decimal(10,3),
-- is_charges_fixed boolean default true,
-- created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
-- updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
-- UNIQUE KEY (user_id, keyword_id, role),
-- FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
-- FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE
-- );


-- CREATE TABLE api_providers (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     name VARCHAR(255) NOT NULL,
--     base_url TEXT NOT NULL,
--     headers JSON DEFAULT NULL,      -- Stores headers as JSON
--     query_params JSON DEFAULT NULL, -- Stores query parameters as JSON
--     body_params JSON DEFAULT NULL,  -- Stores body parameters as JSON
--     balance_threshold DECIMAL(10,2) DEFAULT NULL,
--     notification_email VARCHAR(255) DEFAULT NULL,
--     status boolean default 1,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     INDEX idx_status (status)
-- );



-- CREATE TABLE apis (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     description VARCHAR(100) NOT NULL,
--     type enum('recharge','offercheck','balancecheck','statuscheck','message', 'others' ),
--     request_port TEXT,
--     request_url_endpoint TEXT NOT NULL,
--     request_type ENUM('get', 'post') NOT NULL,
--     body_params JSON DEFAULT NULL,
--     headers JSON DEFAULT NULL,
--     query_params JSON DEFAULT NULL,
--     response_format_type ENUM('XML', 'JSON[]', 'JSON{}', 'text'),
--   divider varchar(20) default null,
--     key1 VARCHAR(30) NOT NULL,
--     key2 VARCHAR(30) DEFAULT NULL,
--     msg_filter TEXT DEFAULT NULL,
--     cust_filter TEXT,
--     response_filter TEXT,
--     amt_filter TEXT,
--     bal_filter TEXT,
--     tid_filter TEXT,
--     reqId_filter TEXT,
--     forward_start TEXT,
--     forward_before TEXT,
--     retry_count INT DEFAULT 3,
--     timeout_seconds INT DEFAULT 30,
--     status BOOLEAN DEFAULT 1,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );
-- use recharge_db;
--  alter table apis add column opId_filter Text;


-- create table offercheckLines(
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     keyword_id INT NOT NULL,
--     description VARCHAR(100) NOT NULL,
--     merchant_code VARCHAR(30),
--     api_provider INT not null,
--     offercheck_api int not null,
--     lock_amt int DEFAULT null,
--     additional_charges DECIMAL(10,3) DEFAULT 0,
--     status BOOLEAN DEFAULT TRUE,
--     
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     FOREIGN KEY (api_provider) REFERENCES api_providers(id) ON DELETE CASCADE,
--     FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE
-- );
-- use recharge_db;

-- drop table offercheckLines;
-- drop table extraLines;
-- create table extraLines(
-- id INT AUTO_INCREMENT PRIMARY KEY,
-- keyword_id INT not null,
-- description VARCHAR(100) not null,
--  merchant_code VARCHAR(30),
-- api_provider INT not null,
-- api int not null,
-- type VARCHAR(100),
-- status BOOLEAN DEFAULT TRUE,
-- circles_id int default null,
-- name_filter text,
-- description_filter text,
-- extra_info_filter text,
-- account_filter text,
-- due_date_filter text,
-- bill_date_filter text,
-- rs_filter text,
-- is_main_response boolean,

-- created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
-- updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
-- FOREIGN KEY (api_provider) REFERENCES api_providers(id) ON DELETE CASCADE,
-- FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE
-- );



-- create table keyword_lines(
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     keyword_id INT NOT NULL,
--     description VARCHAR(100) NOT NULL,
--     merchant_code VARCHAR(30),
--     api_provider INT not null,
--     recharge_api int not null,
--     balance_check_api int,
--     status_check_api int,
--     lock_amt int DEFAULT null,
--     min_amt DECIMAL(10,2) DEFAULT null,
--     max_amt DECIMAL(10,2) DEFAULT null,
--     min_digits INT DEFAULT null,
--     max_digits INT DEFAULT null,
--     gap INT DEFAULT null,
--     additional_charges DECIMAL(10,3) DEFAULT 0,
--     is_additional_charges_fixed BOOLEAN DEFAULT true,
--     is_charges_by_user BOOLEAN DEFAULT false,
--     is_charges_by_admin BOOLEAN DEFAULT false,
--     ret_margin DECIMAL(10,3),
--     dist_margin DECIMAL(10,3),
--     mdist_margin DECIMAL(10,3), 
--     flat_margin DECIMAL(10,3),
--     margin_status BOOLEAN DEFAULT false,
--     admin_margin DECIMAL(10,3),
--     priority INT DEFAULT 1,
--     status BOOLEAN DEFAULT TRUE,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     FOREIGN KEY (api_provider) REFERENCES api_providers(id) ON DELETE CASCADE,
--     FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE,
--     FOREIGN KEY (recharge_api) REFERENCES apis(id) ON DELETE CASCADE,
--     FOREIGN KEY (balance_check_api) REFERENCES apis(id) ON DELETE CASCADE,
--     Foreign Key (status_check_api) REFERENCES apis(id)
-- );

-- create table kl_financials(
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     kl_id INT NOT NULL,
--     balance DECIMAL(10,2) DEFAULT 0,
--     today_amount DECIMAL(10,2) DEFAULT 0,
--     today_count INT DEFAULT null,
--     today_profit Decimal(10,2) default 0,
--     daily_max_count INT DEFAULT null,
--     daily_max_amount DECIMAL(10,2) DEFAULT null,
--     last_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     Foreign Key (kl_id) REFERENCES keyword_lines(id) on delete cascade
-- );

-- create table kl_prevalues(
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     kl_id INT NOT NULL,
--     amount int DEFAULT null,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     FOREIGN KEY (kl_id) REFERENCES keyword_lines(id) ON DELETE CASCADE
-- );



-- -- Recharges with improved tracking
-- CREATE TABLE recharges (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     user_id INT NOT NULL,
--     keyword_id INT NOT NULL,
--     account VARCHAR(255) NOT NULL,
--     number VARCHAR(255) NOT NULL,
--     amount DECIMAL(15,2) NOT NULL,
--     deducted_amount DECIMAL(15,2) NOT NULL,
--     com_retailer DECIMAL(15,2) DEFAULT 0.00,
--     com_parent DECIMAL(15,2) DEFAULT 0.00,
--     com_superparent DECIMAL(15,2) DEFAULT 0.00,
--     com_admin decimal(15,3),
--    status ENUM('success', 'pending', 'failed', 'initiated') DEFAULT 'initiated',
--     message text,
--     params TEXT,
--     retry_count INT DEFAULT 0,
--     txnid VARCHAR(100),
--     reqid VARCHAR(100),
--     parent_id INT,
--     superparent_id INT,
--     channel ENUM('own','api') default 'own',
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     completed_at TIMESTAMP,
--     FOREIGN KEY (user_id) REFERENCES users(id),
--     INDEX idx_status (status),
--     INDEX idx_mobile (number),
--     INDEX idx_created_at (created_at)
-- );

-- alter table recharges add column user_prev_balance decimal(15,3) ;
-- alter table recharges add column user_new_balance decimal(15,3);
-- alter table recharges add column opId text;




-- create table recharge_gigs(
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     rech_id INT NOT NULL,
--     user_id INT NOT NULL,
--     line_id int NOT NULL,
--     api_id int NOT NULL,
--     provider_id int NOT NULL,
--     status ENUM('success', 'pending', 'failed') DEFAULT 'pending',
--     amount DECIMAL(15,2) NOT NULL,
--     prev_balance DECIMAL(15,2),
--     new_balance DECIMAL(15,2),
--     message text,
--     request text ,
--     response text,
--     config text,
--     response_complete text,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     FOREIGN KEY (rech_id) REFERENCES recharges(id) ON DELETE CASCADE
-- );





-- CREATE TABLE rules (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     api_id INT NOT NULL,
--     key1 VARCHAR(100) NOT NULL,
--     key2 VARCHAR(100) default NULL,
--     condition1 VARCHAR(50) NOT NULL,
--     value1 VARCHAR(255) NOT NULL,
--     condition2 VARCHAR(50) default NULL,
--     value2 VARCHAR(255) default null NULL,
--     action VARCHAR(255) NOT NULL,
--     forwardMessage TEXT DEFAULT NULL,
--     FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE
-- );



-- create table messages(
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     user_id INT NOT NULL,
--     message TEXT NOT NULL,
--     type ENUM('number','app') default 'number',
--     response text,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
-- );

-- alter table messages add column status boolean default true;


-- create table settings(
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     key_name VARCHAR(100) NOT NULL,
--     key_value TEXT NOT NULL,
--     isDeletable BOOLEAN DEFAULT true,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
-- );




-- -- USERS
-- CREATE INDEX idx_users_mobile ON users(mobile);
-- CREATE INDEX idx_users_status ON users(status);
-- CREATE INDEX idx_users_role_id ON users(role_id);
-- CREATE INDEX idx_users_parent_id ON users(parent_id);
-- CREATE INDEX idx_users_api_key ON users(api_key);
-- CREATE INDEX idx_users_created_at ON users(created_at);
-- CREATE INDEX idx_users_balance ON users(balance);

-- -- USER LOGS
-- CREATE INDEX idx_user_logs_user_id ON user_logs(user_id);
-- CREATE INDEX idx_user_logs_token ON user_logs(token);
-- CREATE INDEX idx_user_logs_action ON user_logs(action);
-- CREATE INDEX idx_user_logs_created_at ON user_logs(created_at);

-- -- BALANCE TRANSACTIONS
-- CREATE INDEX idx_bal_transactions_user_id ON bal_transactions(user_id);
-- CREATE INDEX idx_bal_transactions_to_id ON bal_transactions(to_id);
-- CREATE INDEX idx_bal_transactions_status ON bal_transactions(status);
-- CREATE INDEX idx_bal_transactions_type ON bal_transactions(transaction_type);
-- CREATE INDEX idx_bal_transactions_txn_id ON bal_transactions(txn_id);
-- CREATE INDEX idx_bal_transactions_reference_id ON bal_transactions(reference_id);
-- CREATE INDEX idx_bal_transactions_created_at ON bal_transactions(created_at);

-- -- TRANSACTIONS (Recharge & Utility)
-- CREATE INDEX idx_transactions_user_id ON transactions(user_id);
-- CREATE INDEX idx_transactions_status ON transactions(status);
-- CREATE INDEX idx_transactions_order_id ON transactions(order_id);
-- CREATE INDEX idx_transactions_reference_id ON transactions(reference_id);


-- -- OPERATORS
-- CREATE INDEX idx_operators_code ON operators(code);
-- CREATE INDEX idx_operators_type ON operators(type);
-- CREATE INDEX idx_operators_status ON operators(status);

-- -- KEYWORDS
-- CREATE INDEX idx_keywords_operator_id ON keywords(operator_id);
-- CREATE INDEX idx_keywords_status ON keywords(status);
-- CREATE INDEX idx_keywords_code ON keywords(code);

-- -- KEYWORD SETTINGS
-- CREATE INDEX idx_keyword_settings_user_id ON keyword_settings(user_id);
-- CREATE INDEX idx_keyword_settings_keyword_id ON keyword_settings(keyword_id);
-- CREATE INDEX idx_keyword_settings_enabled ON keyword_settings(enabled);

-- -- KEYWORD RECORD
-- CREATE INDEX idx_keyword_record_user_id ON keyword_record(user_id);
-- CREATE INDEX idx_keyword_record_keyword_id ON keyword_record(keyword_id);
-- CREATE INDEX idx_keyword_record_enabled ON keyword_record(enabled);

-- -- NEWS
-- CREATE INDEX idx_news_type ON news(type);
-- CREATE INDEX idx_news_is_public ON news(is_public);
-- CREATE INDEX idx_news_created_at ON news(created_at);

-- -- API PROVIDERS
-- CREATE INDEX idx_api_providers_name ON api_providers(name);
-- CREATE INDEX idx_api_providers_status ON api_providers(status);

-- -- APIS
-- CREATE INDEX idx_apis_type ON apis(type);

-- CREATE INDEX idx_apis_status ON apis(status);

-- -- RESELLER IPs
-- CREATE INDEX idx_reseller_ips_user_id ON reseller_ips(user_id);
-- CREATE INDEX idx_reseller_ips_status ON reseller_ips(status);
-- CREATE INDEX idx_reseller_ips_ip_address ON reseller_ips(ip);

-- CREATE INDEX idx_keyword_lines_keyword_id ON keyword_lines(keyword_id);

-- CREATE INDEX idx_keyword_lines_created_at ON keyword_lines(created_at);



-- create table circles(
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     name VARCHAR(100) NOT NULL,
--     code VARCHAR(100) NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
-- );
--  drop table customCircles;
-- create table customCircles(
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     name text,
--     codes json not null,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
-- );


-- INSERT into circles (name, code) values
-- ('Maharashtra', 'MH'),
-- ('Gujarat', 'GJ'),
-- ('Delhi', 'DL'),
-- ('Karnataka', 'KA'),
-- ('Tamil Nadu', 'TN'),
-- ('Andhra Pradesh', 'AP'),
-- ('Telangana', 'TG'),
-- ('Uttar Pradesh', 'UP'),
-- ('Bihar', 'BR'),
-- ('West Bengal', 'WB'),
-- ('Rajasthan', 'RJ'),
-- ('Punjab', 'PB'),
-- ('Haryana', 'HR'),
-- ('Kerala', 'KL'),
-- ('Odisha', 'OR'),
-- ('Assam', 'AS');


-- create table plans(
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     keyword_id INT NOT NULL,
--     circle_id INT NOT NULL,
--     plans json not null,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
-- )

-- -- Update Super Admin (sa)
-- use recharge_db;
-- UPDATE roles 
-- SET allowed_actions_web = JSON_ARRAY(
--     '{"icon": "home", "name": "Home", "childrens": null}',
--     '{"icon": "list", "name": "Pendings", "childrens": null}',
--     '{"icon": "users", "name": "Admin", "childrens": [{"icon": "userPlus", "name": "Add Admin"}, {"icon": "alternateListAlt", "name": "View Admin"}]}',
--     '{"icon": "users", "name": "Api Resellers", "childrens": [{"icon": "userPlus", "name": "Add Reseller"}, {"icon": "alternateListAlt", "name": "View Reseller"}]}',
--     '{"icon": "alternateListAlt", "name": "All Users"}',
--     '{"icon": "paypalCreditCard", "name": "Wallet"}',
--     '{"icon": "paypalCreditCard", "name": "Generate balance"}',
--     '{"icon": "bity", "name": "Operators & API", "childrens": [{"icon": "i-cursor", "name": "Operator Types"}, {"icon": "external-link", "name": "Create Operator"}, {"icon": "external-link", "name": "View Operators"}, {"icon": "external-link", "name": "Create API Providers"}, {"icon": "external-link", "name": "View API Providers"}, {"icon": "external-link", "name": "Create APIs"}, {"icon": "external-link", "name": "View APIs"}, {"icon": "external-link", "name": "Create Keyword"}, {"icon": "external-link", "name": "View Keywords"}]}',
--     '{"icon": "list", "name": "Reports", "childrens": [{"icon": "paste", "name": "History", "childrens": null}, {"icon": "paste", "name": "Earnings(operator-wise)", "childrens": null}, {"icon": "paste", "name": "Online Transactions", "childrens": null}, {"icon": "paste", "name": "Earnings", "childrens": null}, {"icon": "list", "name": "Messages Report", "childrens": null}]}',
--     '{"icon": "paste", "name": "History", "childrens": null}',
--     '{"icon": "users", "name": "Transfer User", "childrens": null}',
--     '{"icon": "ad", "name": "Add News", "childrens": null}',
--     '{"icon": "newspaper", "name": "News", "childrens": null}',
--     '{"icon": "lock", "name": "Settings", "childrens": null}',
--     '{"icon": "unlock", "name": "Reset Password", "childrens": null}'
-- )
-- WHERE role = 'sa';

-- -- Update Admin (a) - Add missing Earnings(operator-wise)
-- UPDATE roles 
-- SET allowed_actions_web = JSON_ARRAY(
--     '{"icon": "home", "name": "Home", "childrens": null}',
--     '{"icon": "list", "name": "Pendings", "childrens": null}',
--     '{"icon": "users", "name": "Master Distributors", "childrens": [{"icon": "userPlus", "name": "Add Master Distributor"}, {"icon": "alternateListAlt", "name": "View Master Distributor"}]}',
--     '{"icon": "users", "name": "Api Resellers", "childrens": [{"icon": "userPlus", "name": "Add Reseller"}, {"icon": "alternateListAlt", "name": "View Reseller"}]}',
--     '{"icon": "alternateListAlt", "name": "All Users"}',
--     '{"icon": "paypalCreditCard", "name": "Wallet"}',
--     '{"icon": "bity", "name": "Operators & API", "childrens": [{"icon": "i-cursor", "name": "Operator Types"}, {"icon": "external-link", "name": "Create Operator"}, {"icon": "external-link", "name": "View Operators"}, {"icon": "external-link", "name": "Create API Providers"}, {"icon": "external-link", "name": "View API Providers"}, {"icon": "external-link", "name": "Create APIs"}, {"icon": "external-link", "name": "View APIs"}, {"icon": "external-link", "name": "Create Keyword"}, {"icon": "external-link", "name": "View Keywords"}]}',
--     '{"icon": "list", "name": "Reports", "childrens": [{"icon": "paste", "name": "History", "childrens": null}, {"icon": "paste", "name": "Earnings(operator-wise)", "childrens": null}, {"icon": "paste", "name": "Online Transactions", "childrens": null}, {"icon": "paste", "name": "Earnings", "childrens": null}, {"icon": "list", "name": "Messages Report", "childrens": null}]}',
--     '{"icon": "paste", "name": "History", "childrens": null}',
--     '{"icon": "ad", "name": "Add News", "childrens": null}',
--     '{"icon": "newspaper", "name": "News", "childrens": null}',
--     '{"icon": "unlock", "name": "Reset Password", "childrens": null}'
-- )
-- WHERE role = 'a';

-- -- Update Master Distributor (mtd) - Add missing Earnings(operator-wise)
-- UPDATE roles 
-- SET allowed_actions_web = JSON_ARRAY(
--     '{"icon": "home", "name": "Home", "childrens": null}',
--     '{"icon": "users", "name": "Distributors", "childrens": [{"icon": "userPlus", "name": "Add Distributor"}, {"icon": "alternateListAlt", "name": "View Distributor"}]}',
--     '{"icon": "user", "name": "Retailers", "childrens": [{"icon": "userPlus", "name": "Add Retailers"}, {"icon": "alternateListAlt", "name": "View Retailers"}]}',
--     '{"icon": "paypalCreditCard", "name": "Wallet"}',
--     '{"icon": "flipboard", "name": "Margin"}',
--     '{"icon": "paste", "name": "History", "childrens": null}',
--     '{"icon": "list", "name": "Purchase", "childrens": null}',
--     '{"icon": "list", "name": "Earnings", "childrens": null}',
--     '{"icon": "list", "name": "Earnings(operator-wise)", "childrens": null}',
--     '{"icon": "newspaper", "name": "News", "childrens": null}',
--     '{"icon": "unlock", "name": "Reset Password", "childrens": null}'
-- )
-- WHERE role = 'mtd';

-- -- Update Distributor (d) - Add missing Earnings(operator-wise)
-- UPDATE roles 
-- SET allowed_actions_web = JSON_ARRAY(
--     '{"icon": "home", "name": "Home", "childrens": null}',
--     '{"icon": "user", "name": "Retailers", "childrens": [{"icon": "userPlus", "name": "Add Retailers"}, {"icon": "alternateListAlt", "name": "View Retailers"}]}',
--     '{"icon": "paypalCreditCard", "name": "Wallet"}',
--     '{"icon": "paypalCreditCard", "name": "Get balance"}',
--     '{"icon": "flipboard", "name": "Margin"}',
--     '{"icon": "paste", "name": "History", "childrens": null}',
--     '{"icon": "list", "name": "Purchase", "childrens": null}',
--     '{"icon": "list", "name": "Earnings", "childrens": null}',
--     '{"icon": "list", "name": "Earnings(operator-wise)", "childrens": null}',
--     '{"icon": "newspaper", "name": "News", "childrens": null}',
--     '{"icon": "unlock", "name": "Reset Password", "childrens": null}'
-- )
-- WHERE role = 'd';

-- -- Update Retailer (r) - Fix JSON syntax and add new services
-- UPDATE roles 
-- SET allowed_actions = JSON_ARRAY(
--     '{"name": "Mobile Recharge", "childrens": null, "icon": "assets/icons/mobile-phone.png"}',
--     '{"name": "DTH Recharge", "childrens": null, "icon": "assets/icons/online.png"}',
--     '{"name": "Postpaid Recharge", "childrens": null, "icon": "assets/icons/mobile-phone.png"}',
--     '{"name": "Utility Bill", "childrens": null, "icon": "assets/icons/home.png"}',
--     '{"name": "Loan", "childrens": null, "icon": "assets/icons/loan.png"}',
--     '{"name": "Water Bill", "childrens": null, "icon": "assets/icons/water-bill.png"}',
--     '{"name": "History", "childrens": null, "icon": "assets/icons/report.png"}',
--     '{"name": "Purchases", "childrens": null, "icon": "assets/icons/purchase-order.png"}',
--     '{"name": "News", "childrens": null, "icon": "assets/icons/news.png"}',
--     '{"name": "Reset Password", "childrens": null, "icon": "assets/icons/key.png"}'
-- )
-- WHERE role = 'r';

-- -- Update API User (api) - Fix JSON syntax and add new services
-- UPDATE roles 
-- SET allowed_actions = JSON_ARRAY(
--     '{"name": "Mobile Recharge", "childrens": null, "icon": "assets/icons/mobile-phone.png"}',
--     '{"name": "DTH Recharge", "childrens": null, "icon": "assets/icons/online.png"}',
--     '{"name": "Postpaid Recharge", "childrens": null, "icon": "assets/icons/mobile-phone.png"}',
--     '{"name": "Utility Bill", "childrens": null, "icon": "assets/icons/home.png"}',
--     '{"name": "Loan", "childrens": null, "icon": "assets/icons/loan.png"}',
--     '{"name": "Water Bill", "childrens": null, "icon": "assets/icons/water-bill.png"}',
--     '{"name": "Api Config", "childrens": null, "icon": "assets/icons/business-report.png"}',
--     '{"name": "History", "childrens": null, "icon": "assets/icons/report.png"}',
--     '{"name": "Purchases", "childrens": null, "icon": "assets/icons/purchase-order.png"}',
--     '{"name": "News", "childrens": null, "icon": "assets/icons/news.png"}',
--     '{"name": "Reset Password", "childrens": null, "icon": "assets/icons/key.png"}'
-- )
-- WHERE role = 'api';


-- use recharge_db;

-- create table otps(
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     user_id INT NOT NULL,
--     otp VARCHAR(10) NOT NULL,
--     status ENUM('active', 'used') DEFAULT 'active',
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     FOREIGN KEY (user_id) REFERENCES users(id),
--     INDEX idx_status (status),
--     INDEX idx_created_at (created_at)
-- );

-- alter table user_logs
-- modify column token VARCHAR(30) ;

-- alter table recharges
-- modify column status ENUM('success', 'pending', 'failed', 'refunded', 'initiated') DEFAULT 'initiated';



-- table for balabe history
-- CREATE TABLE balance_history (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     user_id INT NOT NULL,





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


ALTER TABLE dmt_beneficiaries 
ADD COLUMN bank_verified TINYINT(1) DEFAULT 0 COMMENT 'Bank account verification status',
ADD COLUMN bank_verification_date DATETIME NULL COMMENT 'Date when bank was verified',
ADD COLUMN name_match_percent DECIMAL(5,2) NULL COMMENT 'Name match percentage from bank verification',
ADD COLUMN bank_registered_name VARCHAR(255) NULL COMMENT 'Name registered with the bank';

-- Add index for better performance
CREATE INDEX idx_bank_verified ON dmt_beneficiaries(bank_verified);
CREATE INDEX idx_bank_verification_date ON dmt_beneficiaries(bank_verification_date);



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



CREATE TABLE IF NOT EXISTS `dmt_transaction_details` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `recharge_id` bigint(20) DEFAULT NULL COMMENT 'Reference to recharges table',
  `user_id` bigint(20) NOT NULL COMMENT 'User who initiated the transaction',
  `remitter_mobile` varchar(15) NOT NULL COMMENT 'Remitter mobile number',
  `remitter_name` varchar(255) DEFAULT NULL COMMENT 'Remitter full name',
  `beneficiary_id` varchar(50) NOT NULL COMMENT 'Beneficiary ID from InstantPay',
  `beneficiary_name` varchar(255) NOT NULL COMMENT 'Beneficiary name',
  `beneficiary_account` varchar(50) NOT NULL COMMENT 'Beneficiary account number',
  `beneficiary_ifsc` varchar(15) NOT NULL COMMENT 'Beneficiary IFSC code',
  `beneficiary_bank_name` varchar(255) DEFAULT NULL COMMENT 'Bank name',
  `beneficiary_mobile` varchar(15) DEFAULT NULL COMMENT 'Beneficiary mobile number',
  `transaction_amount` decimal(10,2) NOT NULL COMMENT 'Transaction amount',
  `transfer_mode` varchar(10) NOT NULL DEFAULT 'IMPS' COMMENT 'Transfer mode - IMPS/NEFT/RTGS',
  `transaction_charges` decimal(10,2) DEFAULT 0.00 COMMENT 'Transaction charges',
  `gst_amount` decimal(10,2) DEFAULT 0.00 COMMENT 'GST amount',
  `total_deducted` decimal(10,2) NOT NULL COMMENT 'Total amount deducted from user',
  `external_ref` varchar(100) DEFAULT NULL COMMENT 'External reference ID',
  `pool_reference_id` varchar(100) DEFAULT NULL COMMENT 'Pool reference ID from InstantPay',
  `txn_reference_id` varchar(100) DEFAULT NULL COMMENT 'Transaction reference ID',
  `ipay_uuid` varchar(255) DEFAULT NULL COMMENT 'InstantPay UUID',
  `order_id` varchar(100) DEFAULT NULL COMMENT 'Order ID from InstantPay',
  `pool_account` varchar(20) DEFAULT NULL COMMENT 'Pool account used',
  `pool_opening_balance` decimal(15,2) DEFAULT NULL COMMENT 'Pool opening balance',
  `pool_closing_balance` decimal(15,2) DEFAULT NULL COMMENT 'Pool closing balance',
  `status` enum('SUCCESS','FAILED','PENDING','REFUNDED') NOT NULL DEFAULT 'PENDING' COMMENT 'Transaction status',
  `api_status_code` varchar(10) DEFAULT NULL COMMENT 'API status code from InstantPay',
  `api_status_message` text DEFAULT NULL COMMENT 'API status message',
  `failure_reason` text DEFAULT NULL COMMENT 'Failure reason if transaction failed',
  `user_balance_before` decimal(15,2) DEFAULT NULL COMMENT 'User balance before transaction',
  `user_balance_after` decimal(15,2) DEFAULT NULL COMMENT 'User balance after transaction',
  `commission_earned` decimal(10,2) DEFAULT 0.00 COMMENT 'Commission earned by user',
  `latitude` decimal(10,8) DEFAULT NULL COMMENT 'Transaction latitude',
  `longitude` decimal(11,8) DEFAULT NULL COMMENT 'Transaction longitude',
  `transaction_timestamp` timestamp NULL DEFAULT NULL COMMENT 'Transaction timestamp from API',
  `environment` varchar(10) DEFAULT 'LIVE' COMMENT 'Environment - LIVE/TEST',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_remitter_mobile` (`remitter_mobile`),
  KEY `idx_beneficiary_id` (`beneficiary_id`),
  KEY `idx_beneficiary_account` (`beneficiary_account`),
  KEY `idx_external_ref` (`external_ref`),
  KEY `idx_pool_reference_id` (`pool_reference_id`),
  KEY `idx_txn_reference_id` (`txn_reference_id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_ipay_uuid` (`ipay_uuid`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_recharge_id` (`recharge_id`),
  KEY `idx_transaction_date_user` (`user_id`, `created_at`),
  KEY `idx_beneficiary_user` (`user_id`, `beneficiary_account`),
  KEY `idx_remitter_user` (`user_id`, `remitter_mobile`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Detailed DMT transaction records for user view';





ALTER TABLE dmt_beneficiaries 
ADD COLUMN  bank_verification_status ENUM('NOT_VERIFIED', 'VERIFIED', 'FAILED', 'PENDING') DEFAULT 'NOT_VERIFIED' COMMENT 'Detailed bank verification status';


SET SQL_SAFE_UPDATES = 0;

UPDATE dmt_beneficiaries 
SET bank_verification_status = 'NOT_VERIFIED' 
WHERE bank_verification_status IS NULL;



