CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS companies (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  approval_threshold DECIMAL(15,2) DEFAULT 0,
  reporting_preferences VARCHAR(100) DEFAULT 'summary',
  status ENUM('active','archived') DEFAULT 'active',
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_company_roles (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  company_id CHAR(36) NOT NULL,
  role ENUM('admin','manager','viewer') NOT NULL DEFAULT 'viewer',
  assigned_by CHAR(36),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS investments (
  id CHAR(36) PRIMARY KEY,
  company_id CHAR(36) NOT NULL,
  asset_type ENUM('savings','bonds','shares') NOT NULL,
  principal DECIMAL(15,2) NOT NULL,
  interest_rate DECIMAL(10,4) NOT NULL,
  duration INT NOT NULL,
  start_date DATE NOT NULL,
  maturity_date DATE NOT NULL,
  status ENUM('active','closed','pending') DEFAULT 'active',
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id CHAR(36) PRIMARY KEY,
  company_id CHAR(36) NOT NULL,
  investment_id CHAR(36),
  transaction_type VARCHAR(100) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  status ENUM('pending','approved','rejected','posted') DEFAULT 'pending',
  requires_approval BOOLEAN DEFAULT FALSE,
  approved_by CHAR(36),
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (investment_id) REFERENCES investments(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS approvals (
  id CHAR(36) PRIMARY KEY,
  transaction_id CHAR(36) NOT NULL,
  requested_by CHAR(36) NOT NULL,
  approved_by CHAR(36),
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  rationale TEXT,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  decision_at TIMESTAMP NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36),
  company_id CHAR(36),
  action ENUM('INSERT','UPDATE','DELETE','LOGIN') NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  record_id CHAR(36),
  old_value JSON,
  new_value JSON,
  ip_address VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36),
  company_id CHAR(36),
  type VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiry_date TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);
