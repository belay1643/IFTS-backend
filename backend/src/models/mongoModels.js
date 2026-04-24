import crypto from 'crypto'
import mongoose from 'mongoose'

const mongoDatabaseName = process.env.MONGO_DB_NAME || 'IFTS-SYSTEMS'

const resolveMongoUri = (rawUri, dbName) => {
  if (!rawUri) return `mongodb://127.0.0.1:27017/${dbName}`

  try {
    const parsed = new URL(rawUri)
    const hasDbName = parsed.pathname && parsed.pathname !== '/'
    if (!hasDbName) {
      parsed.pathname = `/${dbName}`
      return parsed.toString()
    }
    return rawUri
  } catch {
    return rawUri
  }
}

const mongoUri = resolveMongoUri(process.env.MONGO_URI, mongoDatabaseName)

mongoose.set('strictQuery', true)

const connectPromiseState = {
  promise: null
}

const connectDatabase = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection
  if (!connectPromiseState.promise) {
    connectPromiseState.promise = mongoose
      .connect(mongoUri, {
        autoIndex: true,
        serverSelectionTimeoutMS: 5000
      })
      .then(() => mongoose.connection)
      .finally(() => {
        connectPromiseState.promise = null
      })
  }
  return connectPromiseState.promise
}

const generateId = () => crypto.randomUUID()

const createSchema = (fields, options = {}) => new mongoose.Schema(
  {
    _id: { type: String, default: generateId },
    ...fields
  },
  {
    timestamps: true,
    versionKey: false,
    strict: false,
    ...options
  }
)

const isDateValue = (value) => value instanceof Date || Object.prototype.toString.call(value) === '[object Date]'

const toComparable = (value) => {
  if (value == null) return value
  if (isDateValue(value)) return value.getTime()
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return value
    const numeric = Number(trimmed)
    if (!Number.isNaN(numeric)) return numeric
    const parsed = Date.parse(trimmed)
    if (!Number.isNaN(parsed) && /[-:T]/.test(trimmed)) return parsed
  }
  return value
}

const compareValues = (left, right) => {
  const comparableLeft = toComparable(left)
  const comparableRight = toComparable(right)

  if (typeof comparableLeft === 'number' && typeof comparableRight === 'number') {
    return comparableLeft - comparableRight
  }

  return String(comparableLeft ?? '').localeCompare(String(comparableRight ?? ''))
}

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const likeToRegex = (pattern) => {
  const escaped = escapeRegExp(pattern)
    .replace(/%/g, '.*')
    .replace(/_/g, '.')
  return new RegExp(`^${escaped}$`, 'i')
}

const getPathValue = (source, path) => {
  if (!source || !path) return undefined
  return path.split('.').reduce((current, part) => (current == null ? undefined : current[part]), source)
}

const getWhereEntries = (where = {}) => [
  ...Object.entries(where),
  ...Object.getOwnPropertySymbols(where).map((symbol) => [symbol, where[symbol]])
]

const matchesCondition = (actual, condition) => {
  if (Array.isArray(condition)) {
    return condition.some((entry) => matchesCondition(actual, entry))
  }

  if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
    const entries = getWhereEntries(condition)
    const symbolEntries = entries.filter(([key]) => typeof key === 'symbol')

    if (symbolEntries.length > 0) {
      return symbolEntries.every(([operator, expected]) => {
        if (operator === Op.in) {
          const values = Array.isArray(expected) ? expected : [expected]
          return values.some((value) => String(actual) === String(value))
        }
        if (operator === Op.gt) return compareValues(actual, expected) > 0
        if (operator === Op.gte) return compareValues(actual, expected) >= 0
        if (operator === Op.lt) return compareValues(actual, expected) < 0
        if (operator === Op.lte) return compareValues(actual, expected) <= 0
        if (operator === Op.ne) return String(actual) !== String(expected)
        if (operator === Op.like) return likeToRegex(expected).test(String(actual ?? ''))
        return true
      })
    }
  }

  return String(actual ?? '') === String(condition ?? '')
}

const matchesWhere = (record, where = {}) => {
  const entries = getWhereEntries(where)

  return entries.every(([key, value]) => {
    if (typeof key === 'symbol') {
      if (key === Op.or) {
        return Array.isArray(value) && value.some((branch) => matchesWhere(record, branch))
      }
      if (key === Op.and) {
        return Array.isArray(value) && value.every((branch) => matchesWhere(record, branch))
      }
      return true
    }

    const actual = key.startsWith('$') && key.endsWith('$')
      ? getPathValue(record, key.slice(1, -1))
      : getPathValue(record, key)

    return matchesCondition(actual, value)
  })
}

const cloneForOutput = (value) => {
  if (Array.isArray(value)) return value.map((item) => cloneForOutput(item))
  if (value && typeof value === 'object') {
    if (typeof value.toJSON === 'function' && !value.__doc) return cloneForOutput(value.toJSON())
    const output = {}
    Object.entries(value).forEach(([key, entryValue]) => {
      if (key === '__doc' || key === '__api') return
      output[key] = cloneForOutput(entryValue)
    })
    return output
  }
  return value
}

const schemaFieldNames = (mongooseModel) => Object.keys(mongooseModel.schema.paths).filter((field) => field !== '__v')

const createApi = (modelName, mongooseModel, relations = []) => {
  const api = {
    modelName,
    mongooseModel,
    relations,
    schemaFieldNames: schemaFieldNames(mongooseModel)
  }

  const wrap = (doc) => {
    if (!doc) return null
    const plain = doc.toObject({ virtuals: true, getters: true })
    const record = { ...plain }

    Object.defineProperties(record, {
      __doc: { value: doc, enumerable: false, writable: true },
      __api: { value: api, enumerable: false, writable: true },
      save: {
        enumerable: false,
        value: async () => {
          const payload = {}
          api.schemaFieldNames.forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(record, field)) {
              payload[field] = record[field]
            }
          })
          Object.assign(doc, payload)
          await doc.save()
          return wrap(doc)
        }
      },
      update: {
        enumerable: false,
        value: async (values) => {
          Object.assign(record, values)
          return record.save()
        }
      },
      destroy: {
        enumerable: false,
        value: async () => {
          await doc.deleteOne()
        }
      },
      toJSON: {
        enumerable: false,
        value: () => cloneForOutput(record)
      }
    })

    return record
  }

  const normalizeInclude = (include) => {
    if (!include) return []
    if (Array.isArray(include)) return include.flatMap((entry) => normalizeInclude(entry))
    if (include.modelName && !include.model) return [{ model: include }]
    return [include]
  }

  const resolveRelation = (include) => {
    const targetApi = include.model?.modelName ? include.model : null
    const targetModelName = targetApi?.modelName || include.model?.name || include.modelName || include.as
    const targetAs = include.as || null

    return relations.find((relation) => {
      if (targetAs && relation.as === targetAs) return true
      if (targetModelName && relation.targetName === targetModelName) return true
      return false
    })
  }

  const applyIncludes = async (record, include) => {
    const includeItems = normalizeInclude(include)
    for (const includeItem of includeItems) {
      const relation = resolveRelation(includeItem)
      const targetApi = includeItem.model?.modelName ? includeItem.model : apiRegistry[includeItem.model?.modelName || includeItem.modelName]
      if (!relation || !targetApi) {
        continue
      }

      const alias = includeItem.as || relation.as || targetApi.modelName
      const foreignValue = record[relation.foreignKey]
      let related = foreignValue != null ? await targetApi.findByPk(foreignValue, { include: includeItem.include }) : null

      if (related && includeItem.where && !matchesWhere(related, includeItem.where)) {
        if (includeItem.required === false) {
          record[alias] = null
          continue
        }
        return null
      }

      if (!related && includeItem.required !== false && includeItem.where) {
        return null
      }

      if (related && includeItem.include) {
        related = await targetApi._applyIncludes(related, includeItem.include)
        if (!related) return null
      }

      record[alias] = related || null
      if (!related && includeItem.required) return null
    }

    return record
  }

  const applyAttributes = (record, attributes) => {
    if (!attributes) return record
    if (Array.isArray(attributes)) {
      const projected = {}
      attributes.forEach((field) => {
        projected[field] = record[field]
      })
      return { ...projected, id: record.id, _id: record._id, toJSON: record.toJSON }
    }
    return record
  }

  const sortRecords = (records, order) => {
    if (!Array.isArray(order) || order.length === 0) return records
    return [...records].sort((left, right) => {
      for (const [field, direction] of order) {
        const diff = compareValues(getPathValue(left, field), getPathValue(right, field))
        if (diff !== 0) return String(direction).toUpperCase() === 'DESC' ? -diff : diff
      }
      return 0
    })
  }

  const findAll = async (options = {}) => {
    await connectDatabase()
    const { where = {}, include = [], order, limit, offset = 0, attributes } = options
    const docs = await mongooseModel.find({}).exec()
    let records = docs.map((doc) => wrap(doc))

    if (include && (Array.isArray(include) ? include.length > 0 : true)) {
      const includedRecords = []
      for (const record of records) {
        const withIncludes = await applyIncludes(record, include)
        if (withIncludes) includedRecords.push(withIncludes)
      }
      records = includedRecords
    }

    records = records.filter((record) => matchesWhere(record, where))
    records = sortRecords(records, order)

    if (offset) records = records.slice(offset)
    if (typeof limit === 'number') records = records.slice(0, limit)

    return records.map((record) => applyAttributes(record, attributes))
  }

  const findOne = async (options = {}) => {
    const records = await findAll({ ...options, limit: 1 })
    return records[0] || null
  }

  const findByPk = async (id, options = {}) => {
    if (id == null) return null
    return findOne({ ...options, where: { _id: id } })
  }

  const create = async (values = {}) => {
    await connectDatabase()
    const doc = await mongooseModel.create(values)
    return wrap(doc)
  }

  const update = async (values = {}, options = {}) => {
    const records = await findAll(options)
    for (const record of records) {
      Object.assign(record, values)
      await record.save()
    }
    return [records.length]
  }

  const destroy = async (options = {}) => {
    const records = await findAll(options)
    for (const record of records) {
      await record.destroy()
    }
    return records.length
  }

  const findOrCreate = async ({ where = {}, defaults = {} } = {}) => {
    const existing = await findOne({ where })
    if (existing) return [existing, false]
    const created = await create({ ...defaults, ...where })
    return [created, true]
  }

  const findAndCountAll = async (options = {}) => {
    const rows = await findAll(options)
    return { rows, count: rows.length }
  }

  const count = async (options = {}) => {
    const rows = await findAll(options)
    return rows.length
  }

  const sync = async ({ force = false } = {}) => {
    await connectDatabase()
    if (force) {
      await mongoose.connection.dropDatabase()
    }
    await mongooseModel.createCollection().catch(() => null)
    await mongooseModel.syncIndexes().catch(() => null)
  }

  api._applyIncludes = applyIncludes
  api.findAll = findAll
  api.findOne = findOne
  api.findByPk = findByPk
  api.create = create
  api.update = update
  api.destroy = destroy
  api.findOrCreate = findOrCreate
  api.findAndCountAll = findAndCountAll
  api.count = count
  api.sync = sync

  return api
}

const UserSchema = createSchema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  phone: { type: String },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'viewer'], default: 'viewer' },
  isVerified: { type: Boolean, default: false },
  failedLogins: { type: Number, default: 0 },
  lockedUntil: { type: Date }
}, { collection: 'users' })

const CompanySchema = createSchema({
  name: { type: String, required: true },
  description: { type: String },
  approvalThreshold: { type: Number, default: 0 },
  reportingPreferences: { type: String, default: 'summary' },
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  createdBy: { type: String, required: true }
}, { collection: 'companies' })

const UserCompanyRoleSchema = createSchema({
  userId: { type: String, required: true, index: true },
  companyId: { type: String, required: true, index: true },
  role: { type: String, enum: ['admin', 'manager', 'viewer'], default: 'viewer' },
  assignedBy: { type: String },
  assignedAt: { type: Date, default: Date.now }
}, { collection: 'user_company_roles' })

const InvestmentSchema = createSchema({
  companyId: { type: String, required: true, index: true },
  assetType: { type: String, enum: ['savings', 'bonds', 'shares', 't-bills', 'other'], required: true },
  assetName: { type: String },
  principal: { type: Number, required: true },
  interestRate: { type: Number, required: true },
  duration: { type: Number, required: true },
  startDate: { type: Date, required: true },
  maturityDate: { type: Date, required: true },
  calculatedInterest: { type: Number, default: 0 },
  capitalGainResult: { type: Number, default: 0 },
  dividendResult: { type: Number, default: 0 },
  sellingPrice: { type: Number },
  buyingPrice: { type: Number },
  shares: { type: Number },
  dividendRate: { type: Number },
  notes: { type: String },
  notifyStakeholders: { type: Boolean, default: false },
  sendToApproval: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'closed', 'pending'], default: 'active' },
  createdBy: { type: String, required: true }
}, { collection: 'investments' })

const TransactionSchema = createSchema({
  companyId: { type: String, required: true, index: true },
  investmentId: { type: String },
  transactionType: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  description: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'posted'], default: 'pending' },
  requiresApproval: { type: Boolean, default: false },
  approvedBy: { type: String },
  approvedAt: { type: Date }
}, { collection: 'transactions' })

const ApprovalSchema = createSchema({
  transactionId: { type: String, required: true, index: true },
  requestedBy: { type: String, required: true },
  approvedBy: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rationale: { type: String },
  requestedAt: { type: Date, default: Date.now },
  decisionAt: { type: Date }
}, { collection: 'approvals' })

const AuditLogSchema = createSchema({
  userId: { type: String },
  companyId: { type: String },
  action: { type: String, enum: ['INSERT', 'UPDATE', 'DELETE', 'LOGIN'], required: true },
  tableName: { type: String, required: true },
  recordId: { type: String },
  oldValue: { type: mongoose.Schema.Types.Mixed },
  newValue: { type: mongoose.Schema.Types.Mixed },
  ipAddress: { type: String },
  category: { type: String, default: 'other' },
  result: { type: String, enum: ['success', 'failure', 'pending'], default: 'success' },
  previousHash: { type: String, default: 'GENESIS' },
  eventHash: { type: String, default: '' },
  signature: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { collection: 'audit_logs', updatedAt: false })

const NotificationSchema = createSchema({
  userId: { type: String, index: true },
  companyId: { type: String, index: true },
  type: { type: String, default: 'system', required: true },
  title: { type: String, default: '' },
  message: { type: String, required: true },
  status: { type: String, enum: ['unread', 'read', 'archived'], default: 'unread' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
  link: { type: String },
  roleTarget: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  isRead: { type: Boolean, default: false },
  expiryDate: { type: Date }
}, { collection: 'notifications' })

const EmailVerificationSchema = createSchema({
  userId: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date }
}, { collection: 'email_verifications', updatedAt: false })

const PasswordResetSchema = createSchema({
  userId: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date }
}, { collection: 'password_resets', updatedAt: false })

const RefreshTokenSchema = createSchema({
  userId: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
  replacedBy: { type: String },
  revokedAt: { type: Date }
}, { collection: 'refresh_tokens', updatedAt: false })

const LoginAttemptSchema = createSchema({
  userId: { type: String },
  email: { type: String },
  ip: { type: String },
  success: { type: Boolean, required: true },
  reason: { type: String }
}, { collection: 'login_attempts', updatedAt: false })

const UserModel = mongoose.model('User', UserSchema)
const CompanyModel = mongoose.model('Company', CompanySchema)
const UserCompanyRoleModel = mongoose.model('UserCompanyRole', UserCompanyRoleSchema)
const InvestmentModel = mongoose.model('Investment', InvestmentSchema)
const TransactionModel = mongoose.model('Transaction', TransactionSchema)
const ApprovalModel = mongoose.model('Approval', ApprovalSchema)
const AuditLogModel = mongoose.model('AuditLog', AuditLogSchema)
const NotificationModel = mongoose.model('Notification', NotificationSchema)
const EmailVerificationModel = mongoose.model('EmailVerification', EmailVerificationSchema)
const PasswordResetModel = mongoose.model('PasswordReset', PasswordResetSchema)
const RefreshTokenModel = mongoose.model('RefreshToken', RefreshTokenSchema)
const LoginAttemptModel = mongoose.model('LoginAttempt', LoginAttemptSchema)

const apiRegistry = {}

const relationConfig = {
  User: [],
  Company: [{ targetName: 'User', foreignKey: 'createdBy', as: 'creator' }],
  UserCompanyRole: [
    { targetName: 'User', foreignKey: 'userId', as: 'User' },
    { targetName: 'Company', foreignKey: 'companyId', as: 'Company' }
  ],
  Investment: [
    { targetName: 'Company', foreignKey: 'companyId', as: 'Company' },
    { targetName: 'User', foreignKey: 'createdBy', as: 'creator' }
  ],
  Transaction: [
    { targetName: 'Company', foreignKey: 'companyId', as: 'Company' },
    { targetName: 'Investment', foreignKey: 'investmentId', as: 'Investment' },
    { targetName: 'User', foreignKey: 'approvedBy', as: 'approver' }
  ],
  Approval: [
    { targetName: 'Transaction', foreignKey: 'transactionId', as: 'Transaction' },
    { targetName: 'User', foreignKey: 'requestedBy', as: 'requester' },
    { targetName: 'User', foreignKey: 'approvedBy', as: 'approver' }
  ],
  AuditLog: [
    { targetName: 'User', foreignKey: 'userId', as: 'User' },
    { targetName: 'Company', foreignKey: 'companyId', as: 'Company' }
  ],
  Notification: [
    { targetName: 'User', foreignKey: 'userId', as: 'User' },
    { targetName: 'Company', foreignKey: 'companyId', as: 'Company' }
  ],
  EmailVerification: [{ targetName: 'User', foreignKey: 'userId', as: 'User' }],
  PasswordReset: [{ targetName: 'User', foreignKey: 'userId', as: 'User' }],
  RefreshToken: [{ targetName: 'User', foreignKey: 'userId', as: 'User' }],
  LoginAttempt: [{ targetName: 'User', foreignKey: 'userId', as: 'User' }]
}

const buildApi = (modelName, mongooseModel) => createApi(modelName, mongooseModel, relationConfig[modelName] || [])

const User = buildApi('User', UserModel)
const Company = buildApi('Company', CompanyModel)
const UserCompanyRole = buildApi('UserCompanyRole', UserCompanyRoleModel)
const Investment = buildApi('Investment', InvestmentModel)
const Transaction = buildApi('Transaction', TransactionModel)
const Approval = buildApi('Approval', ApprovalModel)
const AuditLog = buildApi('AuditLog', AuditLogModel)
const Notification = buildApi('Notification', NotificationModel)
const EmailVerification = buildApi('EmailVerification', EmailVerificationModel)
const PasswordReset = buildApi('PasswordReset', PasswordResetModel)
const RefreshToken = buildApi('RefreshToken', RefreshTokenModel)
const LoginAttempt = buildApi('LoginAttempt', LoginAttemptModel)

Object.assign(apiRegistry, {
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
})

const sequelize = {
  authenticate: connectDatabase,
  sync: async (options = {}) => {
    await connectDatabase()
    if (options.force || process.env.DB_RESET === 'true') {
      await mongoose.connection.dropDatabase()
    }
    for (const api of Object.values(apiRegistry)) {
      await api.mongooseModel.createCollection().catch(() => null)
      await api.mongooseModel.syncIndexes().catch(() => null)
    }
  },
  close: async () => mongoose.disconnect()
}

const syncDb = sequelize.sync

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
