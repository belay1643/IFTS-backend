ALTER TABLE AuditLogs
  ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'other',
  ADD COLUMN result ENUM('success','failure','pending') NOT NULL DEFAULT 'success',
  ADD COLUMN previousHash VARCHAR(128) NOT NULL DEFAULT 'GENESIS',
  ADD COLUMN eventHash VARCHAR(128) NOT NULL DEFAULT '',
  ADD COLUMN signature VARCHAR(128) NOT NULL DEFAULT '',
  ADD COLUMN metadata JSON NULL;

CREATE INDEX idx_auditlogs_createdAt ON AuditLogs (createdAt);
CREATE INDEX idx_auditlogs_company_category_result ON AuditLogs (companyId, category, result);
CREATE INDEX idx_auditlogs_userId ON AuditLogs (userId);
