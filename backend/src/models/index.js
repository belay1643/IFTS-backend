import { DataTypes } from 'sequelize'
import sequelize from '../config/database.js'

const uuidCol = { type: DataTypes.STRING(36), defaultValue: DataTypes.UUIDV4 }

const User = sequelize.define('User', {
  id: { ...uuidCol, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('admin', 'manager', 'viewer'), allowNull: false, defaultValue: 'viewer' },
  isVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  failedLogins: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  lockedUntil: { type: DataTypes.DATE }
})

const Company = sequelize.define('Company', {
  id: { ...uuidCol, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  approvalThreshold: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  reportingPreferences: { type: DataTypes.STRING, defaultValue: 'summary' },
  status: { type: DataTypes.ENUM('active', 'archived'), defaultValue: 'active' },
  createdBy: { type: DataTypes.STRING(36), allowNull: false }
})

const UserCompanyRole = sequelize.define('UserCompanyRole', {
  id: { ...uuidCol, primaryKey: true },
  userId: { type: DataTypes.STRING(36), allowNull: false },
  companyId: { type: DataTypes.STRING(36), allowNull: false },
  role: { type: DataTypes.ENUM('admin', 'manager', 'viewer'), allowNull: false, defaultValue: 'viewer' },
  assignedBy: { type: DataTypes.STRING(36), allowNull: true },
  assignedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
})

const Investment = sequelize.define('Investment', {
  id: { ...uuidCol, primaryKey: true },
  companyId: { type: DataTypes.STRING(36), allowNull: false },
  assetType: { type: DataTypes.ENUM('savings', 'bonds', 'shares', 't-bills', 'other'), allowNull: false },
  principal: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  interestRate: { type: DataTypes.DECIMAL(10, 4), allowNull: false },
  duration: { type: DataTypes.INTEGER, allowNull: false },
  startDate: { type: DataTypes.DATE, allowNull: false },
  maturityDate: { type: DataTypes.DATE, allowNull: false },
   calculatedInterest: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
   capitalGainResult: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
   dividendResult: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
   sellingPrice: { type: DataTypes.DECIMAL(15, 2) },
   buyingPrice: { type: DataTypes.DECIMAL(15, 2) },
   shares: { type: DataTypes.DECIMAL(15, 2) },
   dividendRate: { type: DataTypes.DECIMAL(15, 4) },
   notes: { type: DataTypes.TEXT },
   notifyStakeholders: { type: DataTypes.BOOLEAN, defaultValue: false },
   sendToApproval: { type: DataTypes.BOOLEAN, defaultValue: false },
  status: { type: DataTypes.ENUM('active', 'closed', 'pending'), defaultValue: 'active' },
  createdBy: { type: DataTypes.STRING(36), allowNull: false }
})

const Transaction = sequelize.define('Transaction', {
  id: { ...uuidCol, primaryKey: true },
  companyId: { type: DataTypes.STRING(36), allowNull: false },
  investmentId: { type: DataTypes.STRING(36), allowNull: true },
  transactionType: { type: DataTypes.STRING, allowNull: false },
  amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  date: { type: DataTypes.DATE, allowNull: false },
  description: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected', 'posted'), defaultValue: 'pending' },
  requiresApproval: { type: DataTypes.BOOLEAN, defaultValue: false },
  approvedBy: { type: DataTypes.STRING(36) },
  approvedAt: { type: DataTypes.DATE }
})

const Approval = sequelize.define('Approval', {
  id: { ...uuidCol, primaryKey: true },
  transactionId: { type: DataTypes.STRING(36), allowNull: false },
  requestedBy: { type: DataTypes.STRING(36), allowNull: false },
  approvedBy: { type: DataTypes.STRING(36) },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' },
  rationale: { type: DataTypes.TEXT },
  requestedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  decisionAt: { type: DataTypes.DATE }
})

const AuditLog = sequelize.define('AuditLog', {
  id: { ...uuidCol, primaryKey: true },
  userId: { type: DataTypes.STRING(36) },
  companyId: { type: DataTypes.STRING(36) },
  action: { type: DataTypes.ENUM('INSERT', 'UPDATE', 'DELETE', 'LOGIN'), allowNull: false },
  tableName: { type: DataTypes.STRING, allowNull: false },
  recordId: { type: DataTypes.STRING(36) },
  oldValue: { type: DataTypes.JSON },
  newValue: { type: DataTypes.JSON },
  ipAddress: { type: DataTypes.STRING },
  category: { type: DataTypes.STRING, allowNull: false, defaultValue: 'other' },
  result: { type: DataTypes.ENUM('success', 'failure', 'pending'), allowNull: false, defaultValue: 'success' },
  previousHash: { type: DataTypes.STRING(128), allowNull: false, defaultValue: 'GENESIS' },
  eventHash: { type: DataTypes.STRING(128), allowNull: false, defaultValue: '' },
  signature: { type: DataTypes.STRING(128), allowNull: false, defaultValue: '' },
  metadata: { type: DataTypes.JSON }
}, {
  updatedAt: false
})

const Notification = sequelize.define('Notification', {
  id: { ...uuidCol, primaryKey: true },
  userId: { type: DataTypes.STRING(36), field: 'user_id' },
  companyId: { type: DataTypes.STRING(36), field: 'company_id' },
  type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'system' },
  title: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
  message: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.ENUM('unread', 'read', 'archived'), allowNull: false, defaultValue: 'unread' },
  priority: { type: DataTypes.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'low' },
  link: { type: DataTypes.STRING },
  roleTarget: { type: DataTypes.STRING, field: 'role_target' },
  metadata: { type: DataTypes.JSON },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_read' },
  expiryDate: { type: DataTypes.DATE, field: 'expiry_date' }
}, {
  indexes: [
    { name: 'notifications_user_id_is_read', fields: ['user_id', 'is_read'] },
    { fields: ['status'] },
    { fields: ['type'] },
    { name: 'notifications_company_id_created_at', fields: ['company_id', 'createdAt'] }
  ]
})

// Auth token + verification tables
const EmailVerification = sequelize.define('EmailVerification', {
  id: { ...uuidCol, primaryKey: true },
  userId: { type: DataTypes.STRING(36), allowNull: false },
  tokenHash: { type: DataTypes.STRING(128), allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  usedAt: { type: DataTypes.DATE }
}, { updatedAt: false })

const PasswordReset = sequelize.define('PasswordReset', {
  id: { ...uuidCol, primaryKey: true },
  userId: { type: DataTypes.STRING(36), allowNull: false },
  tokenHash: { type: DataTypes.STRING(128), allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  usedAt: { type: DataTypes.DATE }
}, { updatedAt: false })

const RefreshToken = sequelize.define('RefreshToken', {
  id: { ...uuidCol, primaryKey: true },
  userId: { type: DataTypes.STRING(36), allowNull: false },
  tokenHash: { type: DataTypes.STRING(128), allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  replacedBy: { type: DataTypes.STRING(36) },
  revokedAt: { type: DataTypes.DATE }
}, { updatedAt: false })

const LoginAttempt = sequelize.define('LoginAttempt', {
  id: { ...uuidCol, primaryKey: true },
  userId: { type: DataTypes.STRING(36) },
  email: { type: DataTypes.STRING },
  ip: { type: DataTypes.STRING },
  success: { type: DataTypes.BOOLEAN, allowNull: false },
  reason: { type: DataTypes.STRING }
}, { updatedAt: false })

// Associations
Company.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' })
Company.hasMany(Investment, { foreignKey: 'companyId' })
Company.hasMany(Transaction, { foreignKey: 'companyId' })
Company.hasMany(Notification, { foreignKey: 'companyId' })
Company.hasMany(AuditLog, { foreignKey: 'companyId' })

User.belongsToMany(Company, { through: UserCompanyRole, foreignKey: 'userId', otherKey: 'companyId' })
Company.belongsToMany(User, { through: UserCompanyRole, foreignKey: 'companyId', otherKey: 'userId' })
User.hasMany(UserCompanyRole, { foreignKey: 'userId' })
UserCompanyRole.belongsTo(User, { foreignKey: 'userId' })
UserCompanyRole.belongsTo(Company, { foreignKey: 'companyId' })

Investment.belongsTo(Company, { foreignKey: 'companyId' })
Investment.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' })
Investment.hasMany(Transaction, { foreignKey: 'investmentId' })

Transaction.belongsTo(Company, { foreignKey: 'companyId' })
Transaction.belongsTo(Investment, { foreignKey: 'investmentId' })
Transaction.belongsTo(User, { foreignKey: 'approvedBy', as: 'approver' })
Transaction.hasOne(Approval, { foreignKey: 'transactionId' })

Approval.belongsTo(Transaction, { foreignKey: 'transactionId' })
Approval.belongsTo(User, { foreignKey: 'requestedBy', as: 'requester' })
Approval.belongsTo(User, { foreignKey: 'approvedBy', as: 'approver' })

AuditLog.belongsTo(User, { foreignKey: 'userId' })
AuditLog.belongsTo(Company, { foreignKey: 'companyId' })

Notification.belongsTo(User, { foreignKey: 'userId' })
Notification.belongsTo(Company, { foreignKey: 'companyId' })

EmailVerification.belongsTo(User, { foreignKey: 'userId' })
PasswordReset.belongsTo(User, { foreignKey: 'userId' })
RefreshToken.belongsTo(User, { foreignKey: 'userId' })
LoginAttempt.belongsTo(User, { foreignKey: 'userId' })

const syncDb = async () => {
  const force = process.env.DB_RESET === 'true'
  const alter = process.env.DB_ALTER === 'true'
  await sequelize.sync({ alter, force })
}

export {
  sequelize,
  syncDb,
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
