ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL DEFAULT '' AFTER type,
  ADD COLUMN IF NOT EXISTS status ENUM('unread','read','archived') NOT NULL DEFAULT 'unread' AFTER message,
  ADD COLUMN IF NOT EXISTS priority ENUM('low','medium','high','critical') NOT NULL DEFAULT 'low' AFTER status,
  ADD COLUMN IF NOT EXISTS link VARCHAR(255) NULL AFTER priority,
  ADD COLUMN IF NOT EXISTS role_target VARCHAR(100) NULL AFTER link,
  ADD COLUMN IF NOT EXISTS metadata JSON NULL AFTER role_target,
  ADD COLUMN IF NOT EXISTS expiry_date DATETIME NULL AFTER created_at;

CREATE INDEX IF NOT EXISTS notifications_user_id_is_read ON notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS notifications_status ON notifications (status);
CREATE INDEX IF NOT EXISTS notifications_type ON notifications (type);
CREATE INDEX IF NOT EXISTS notifications_company_id_created_at ON notifications (company_id, created_at);
