import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  phone: { type: DataTypes.STRING },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('admin', 'manager', 'viewer'), defaultValue: 'viewer' },
  isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
  failedLogins: { type: DataTypes.INTEGER, defaultValue: 0 },
  lockedUntil: { type: DataTypes.DATE }
}, { tableName: 'users', underscored: true })

const Company = sequelize.define('Company', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  approvalThreshold: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  reportingPreferences: { type: DataTypes.STRING, defaultValue: 'summary' },
  status: { type: DataTypes.ENUM('active', 'archived'), defaultValue: 'active' },
  createdBy: { type: DataTypes.UUID, allowNull: false }
}, { tableName: 'companies', underscored: true })

const UserCompanyRole = sequelize.define('UserCompanyRole', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  companyId: { type: DataTypes.UUID, allowNull: false },
  role: { type: DataTypes.ENUM('admin', 'manager', 'viewer'), defaultValue: 'viewer' },
  assignedBy: { type: DataTypes.UUID },
  assignedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'user_company_roles', underscored: true, updatedAt: false })

const Investment = sequelize.define('Investment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  companyId: { type: DataTypes.UUID, allowNull: false },
  assetType: { type: DataTypes.ENUM('savings', 'bonds', 'shares', 't-bills', 'other'), allowNull: false },
  assetName: { type: DataTypes.STRING },
  principal: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  interestRate: { type: DataTypes.DECIMAL(10, 4), allowNull: false },
  duration: { type: DataTypes.INTEGER, allowNull: false },
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  maturityDate: { type: DataTypes.DATEONLY },
  calculatedInterest: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  capitalGainResult: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  dividendResult: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  sellingPrice: { type: DataTypes.DECIMAL(15, 2) },
  buyingPrice: { type: DataTypes.DECIMAL(15, 2) },
  shares: { type: DataTypes.DECIMAL(15, 4) },
  dividendRate: { type: DataTypes.DECIMAL(10, 4) },
  notes: { type: DataTypes.TEXT },
  notifyStakeholders: { type: DataTypes.BOOLEAN, defaultValue: false },
  sendToApproval: { type: DataTypes.BOOLEAN, defaultValue: false },
  status: { type: DataTypes.ENUM('active', 'closed', 'pending'), defaultValue: 'active' },
  createdBy: { type: DataTypes.UUID, allowNull: false }
}, { tableName: 'investments', underscored: true })

const Transaction = sequelize.define('Transaction', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  companyId: { type: DataTypes.UUID, allowNull: false },
  investmentId: { type: DataTypes.UUID },
  transactionType: { type: DataTypes.STRING, allowNull: false },
  amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  description: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected', 'posted'), defaultValue: 'pending' },
  requiresApproval: { type: DataTypes.BOOLEAN, defaultValue: false },
  approvedBy: { type: DataTypes.UUID },
  approvedAt: { type: DataTypes.DATE }
}, { tableName: 'transactions', underscored: true })

const Approval = sequelize.define('Approval', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  transactionId: { type: DataTypes.UUID, allowNull: false },
  requestedBy: { type: DataTypes.UUID, allowNull: false },
  approvedBy: { type: DataTypes.UUID },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' },
  rationale: { type: DataTypes.TEXT },
  requestedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  decisionAt: { type: DataTypes.DATE }
}, { tableName: 'approvals', underscored: true, updatedAt: false })

const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID },
  companyId: { type: DataTypes.UUID },
  action: { type: DataTypes.ENUM('INSERT', 'UPDATE', 'DELETE', 'LOGIN'), allowNull: false },
  tableName: { type: DataTypes.STRING, allowNull: false },
  recordId: { type: DataTypes.UUID },
  oldValue: { type: DataTypes.JSONB },
  newValue: { type: DataTypes.JSONB },
  ipAddress: { type: DataTypes.STRING },
  category: { type: DataTypes.STRING, defaultValue: 'other' },
  result: { type: DataTypes.ENUM('success', 'failure', 'pending'), defaultValue: 'success' },
  previousHash: { type: DataTypes.STRING, defaultValue: 'GENESIS' },
  eventHash: { type: DataTypes.STRING, defaultValue: '' },
  signature: { type: DataTypes.STRING, defaultValue: '' },
  metadata: { type: DataTypes.JSONB }
}, { tableName: 'audit_logs', underscored: true, updatedAt: false })

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID },
  companyId: { type: DataTypes.UUID },
  type: { type: DataTypes.STRING, defaultValue: 'system', allowNull: false },
  title: { type: DataTypes.STRING, defaultValue: '' },
  message: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.ENUM('unread', 'read', 'archived'), defaultValue: 'unread' },
  priority: { type: DataTypes.ENUM('low', 'medium', 'high', 'critical'), defaultValue: 'low' },
  link: { type: DataTypes.STRING },
  roleTarget: { type: DataTypes.STRING },
  metadata: { type: DataTypes.JSONB },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  expiryDate: { type: DataTypes.DATE }
}, { tableName: 'notifications', underscored: true })

const EmailVerification = sequelize.define('EmailVerification', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  tokenHash: { type: DataTypes.STRING, allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  usedAt: { type: DataTypes.DATE }
}, { tableName: 'email_verifications', underscored: true, updatedAt: false })

const PasswordReset = sequelize.define('PasswordReset', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  tokenHash: { type: DataTypes.STRING, allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  usedAt: { type: DataTypes.DATE }
}, { tableName: 'password_resets', underscored: true, updatedAt: false })

const RefreshToken = sequelize.define('RefreshToken', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  tokenHash: { type: DataTypes.STRING, allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  replacedBy: { type: DataTypes.STRING },
  revokedAt: { type: DataTypes.DATE }
}, { tableName: 'refresh_tokens', underscored: true, updatedAt: false })

const LoginAttempt = sequelize.define('LoginAttempt', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID },
  email: { type: DataTypes.STRING },
  ip: { type: DataTypes.STRING },
  success: { type: DataTypes.BOOLEAN, allowNull: false },
  reason: { type: DataTypes.STRING }
}, { tableName: 'login_attempts', underscored: true, updatedAt: false })

// Associations
UserCompanyRole.belongsTo(User, { foreignKey: 'userId', as: 'User' })
UserCompanyRole.belongsTo(Company, { foreignKey: 'companyId', as: 'Company' })
Company.hasMany(UserCompanyRole, { foreignKey: 'companyId' })
User.hasMany(UserCompanyRole, { foreignKey: 'userId' })

Transaction.belongsTo(Company, { foreignKey: 'companyId', as: 'Company' })
Transaction.belongsTo(Investment, { foreignKey: 'investmentId', as: 'Investment' })
Transaction.belongsTo(User, { foreignKey: 'approvedBy', as: 'approver' })

Approval.belongsTo(Transaction, { foreignKey: 'transactionId', as: 'Transaction' })
Approval.belongsTo(User, { foreignKey: 'requestedBy', as: 'requester' })
Approval.belongsTo(User, { foreignKey: 'approvedBy', as: 'approver' })

AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'User' })
AuditLog.belongsTo(Company, { foreignKey: 'companyId', as: 'Company' })

Notification.belongsTo(User, { foreignKey: 'userId', as: 'User' })
Notification.belongsTo(Company, { foreignKey: 'companyId', as: 'Company' })

export {
  sequelize,
  User,
  Company,
  UserCompanyRole,
  Investment,
  Transaction,
  Approval,
  AuditLog,
  Notification,
  EmailVerification,
  PasswordReset,
  RefreshToken,
  LoginAttempt
}
