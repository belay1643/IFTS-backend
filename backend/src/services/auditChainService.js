import crypto from 'crypto'

const AUDIT_CHAIN_SECRET = process.env.AUDIT_CHAIN_SECRET || process.env.JWT_SECRET || 'ifts-dev-audit-secret'
const GENESIS_HASH = 'GENESIS'

const sortObject = (value) => {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value.map((item) => sortObject(item))
  if (typeof value !== 'object') return value

  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortObject(value[key])
      return acc
    }, {})
}

export const stableStringify = (value) => JSON.stringify(sortObject(value))

export const inferAuditCategory = ({ action, tableName, oldValue, newValue }) => {
  const source = `${action || ''} ${tableName || ''} ${stableStringify(oldValue)} ${stableStringify(newValue)}`.toLowerCase()

  if (source.includes('approval')) return 'approval'
  if (source.includes('transaction')) return 'transaction'
  if (source.includes('company')) return 'company'
  if (source.includes('login')) return 'login'
  if (source.includes('role')) return 'role'
  if (source.includes('report')) return 'report'
  return 'other'
}

export const inferAuditResult = ({ statusCode, oldValue, newValue }) => {
  const source = `${stableStringify(oldValue)} ${stableStringify(newValue)}`.toLowerCase()

  if ((statusCode || 200) >= 400) return 'failure'
  if (source.includes('pending')) return 'pending'
  if (source.includes('failed') || source.includes('failure') || source.includes('error') || source.includes('rejected') || source.includes('invalid')) return 'failure'
  return 'success'
}

const buildHashPayload = (entry) => ({
  createdAt: entry.createdAt,
  action: entry.action,
  tableName: entry.tableName,
  recordId: entry.recordId || null,
  userId: entry.userId || null,
  companyId: entry.companyId || null,
  oldValue: entry.oldValue || null,
  newValue: entry.newValue || null,
  ipAddress: entry.ipAddress || null,
  category: entry.category || null,
  result: entry.result || null,
  metadata: entry.metadata || null
})

export const computeEventHash = (entry) => {
  const payload = stableStringify(buildHashPayload(entry))
  return crypto.createHash('sha256').update(payload).digest('hex')
}

export const computeSignature = ({ previousHash, eventHash }) => {
  return crypto.createHmac('sha256', AUDIT_CHAIN_SECRET).update(`${previousHash || GENESIS_HASH}|${eventHash}`).digest('hex')
}

export const verifyAuditLogRecord = (log) => {
  const previousHash = log.previousHash || GENESIS_HASH
  const expectedEventHash = computeEventHash(log)
  const expectedSignature = computeSignature({ previousHash, eventHash: expectedEventHash })

  return {
    expectedEventHash,
    expectedSignature,
    eventHashValid: expectedEventHash === log.eventHash,
    signatureValid: expectedSignature === log.signature
  }
}

export const getGenesisHash = () => GENESIS_HASH
