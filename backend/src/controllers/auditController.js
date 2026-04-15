import { query } from 'express-validator'
import { AuditLog, User, Company } from '../models/index.js'
import { Op } from 'sequelize'
import { getGenesisHash, verifyAuditLogRecord } from '../services/auditChainService.js'

const isUnknownColumnError = (err) => {
  const message = String(err?.message || '').toLowerCase()
  return err?.name === 'SequelizeDatabaseError' && message.includes('unknown column')
}

const buildBaseWhere = (req) => {
  const where = {}
  if (req.query.userId) where.userId = req.query.userId
  if (req.query.companyId) where.companyId = req.query.companyId
  if (req.query.action) where.action = req.query.action
  if (req.query.dateFrom || req.query.dateTo) {
    where.createdAt = {}
    if (req.query.dateFrom) where.createdAt[Op.gte] = new Date(req.query.dateFrom)
    if (req.query.dateTo) where.createdAt[Op.lte] = new Date(req.query.dateTo)
  }
  return where
}

const applySearch = (where, req) => {
  if (!req.query.q) return
  const q = `%${req.query.q.trim()}%`
  where[Op.or] = [
    { tableName: { [Op.like]: q } },
    { recordId: { [Op.like]: q } },
    { ipAddress: { [Op.like]: q } },
    { action: { [Op.like]: q } },
    { '$User.email$': { [Op.like]: q } },
    { '$User.name$': { [Op.like]: q } },
    { '$Company.name$': { [Op.like]: q } }
  ]
}

const mapLegacyRecord = (row) => ({
  ...row,
  category: row.category || 'other',
  result: row.result || 'success',
  previousHash: row.previousHash || getGenesisHash(),
  eventHash: row.eventHash || null,
  signature: row.signature || null,
  metadata: row.metadata || null
})

export const auditValidators = [
  query('userId').optional().isUUID(),
  query('companyId').optional().isUUID(),
  query('action').optional().isIn(['INSERT', 'UPDATE', 'DELETE', 'LOGIN']),
  query('category').optional().isString(),
  query('result').optional().isIn(['success', 'failure', 'pending']),
  query('q').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 200 }),
  query('verifySignatures').optional().isIn(['true', 'false'])
]

export const verifyChainValidators = [
  query('companyId').optional().isUUID(),
  query('limit').optional().isInt({ min: 1, max: 20000 })
]

export const listAuditLogs = async (req, res, next) => {
  try {
    const where = buildBaseWhere(req)
    const page = Math.max(1, Number(req.query.page || 1))
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize || 25)))
    const offset = (page - 1) * pageSize

    if (req.query.category) where.category = req.query.category
    if (req.query.result) where.result = req.query.result
    applySearch(where, req)

    let result
    try {
      result = await AuditLog.findAndCountAll({
        where,
        include: [
          { model: User, attributes: ['id', 'name', 'email', 'role'] },
          { model: Company, attributes: ['id', 'name'] }
        ],
        distinct: true,
        offset,
        limit: pageSize,
        subQuery: false,
        order: [['createdAt', 'DESC']],
        attributes: {
          include: ['category', 'result', 'previousHash', 'eventHash', 'signature', 'metadata']
        }
      })
    } catch (queryErr) {
      if (!isUnknownColumnError(queryErr)) throw queryErr

      // Backward-compatible path for databases that have not yet applied audit-chain columns.
      const fallbackWhere = buildBaseWhere(req)
      applySearch(fallbackWhere, req)

      result = await AuditLog.findAndCountAll({
        where: fallbackWhere,
        attributes: [
          'id',
          'userId',
          'companyId',
          'action',
          'tableName',
          'recordId',
          'oldValue',
          'newValue',
          'ipAddress',
          'createdAt'
        ],
        include: [
          { model: User, attributes: ['id', 'name', 'email', 'role'] },
          { model: Company, attributes: ['id', 'name'] }
        ],
        distinct: true,
        offset,
        limit: pageSize,
        subQuery: false,
        order: [['createdAt', 'DESC']]
      })
    }

    const verifySignatures = req.query.verifySignatures === 'true'
    let rows = result.rows.map((row) => mapLegacyRecord(row.toJSON()))

    // Apply category/result filters in memory when running against legacy schema.
    if (req.query.category) rows = rows.filter((row) => row.category === req.query.category)
    if (req.query.result) rows = rows.filter((row) => row.result === req.query.result)

    const records = rows.map((row, index) => {
      if (!verifySignatures || !row.eventHash || !row.signature) {
        return {
          ...row,
          integrity: {
            eventHashValid: null,
            signatureValid: null,
            chainLinkValid: null,
            reason: 'unavailable'
          }
        }
      }

      const integrity = verifyAuditLogRecord(row)
      const olderRow = rows[index + 1]
      const chainLinkValid = olderRow && olderRow.eventHash ? row.previousHash === olderRow.eventHash : null
      return {
        ...row,
        integrity: {
          ...integrity,
          chainLinkValid
        }
      }
    })

    const total = req.query.category || req.query.result ? records.length : result.count
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    res.json({
      data: records,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    })
  } catch (err) {
    next(err)
  }
}

export const verifyAuditChain = async (req, res, next) => {
  try {
    const where = {}
    const limit = Math.min(20000, Math.max(1, Number(req.query.limit || 5000)))
    if (req.query.companyId) where.companyId = req.query.companyId

    let logs
    try {
      logs = await AuditLog.findAll({
        where,
        order: [['createdAt', 'ASC'], ['id', 'ASC']],
        limit
      })
    } catch (queryErr) {
      if (isUnknownColumnError(queryErr)) {
        return res.json({
          verified: null,
          checked: 0,
          brokenCount: 0,
          broken: [],
          generatedAt: new Date().toISOString(),
          message: 'Audit-chain columns are not available yet. Apply migration 20260407_audit_chain.sql.'
        })
      }
      throw queryErr
    }

    let previousHash = getGenesisHash()
    const broken = []

    logs.forEach((log, index) => {
      const row = mapLegacyRecord(log.toJSON())
      if (!row.eventHash || !row.signature) {
        broken.push({
          index,
          id: row.id,
          createdAt: row.createdAt,
          eventHashValid: false,
          signatureValid: false,
          chainLinkValid: false,
          expectedPreviousHash: previousHash,
          actualPreviousHash: row.previousHash,
          reason: 'missing_chain_columns'
        })
        return
      }

      const integrity = verifyAuditLogRecord(row)
      const chainLinkValid = row.previousHash === previousHash

      if (!integrity.eventHashValid || !integrity.signatureValid || !chainLinkValid) {
        broken.push({
          index,
          id: row.id,
          createdAt: row.createdAt,
          eventHashValid: integrity.eventHashValid,
          signatureValid: integrity.signatureValid,
          chainLinkValid,
          expectedPreviousHash: previousHash,
          actualPreviousHash: row.previousHash
        })
      }

      previousHash = row.eventHash || previousHash
    })

    res.json({
      verified: broken.length === 0,
      checked: logs.length,
      brokenCount: broken.length,
      broken: broken.slice(0, 20),
      generatedAt: new Date().toISOString()
    })
  } catch (err) {
    next(err)
  }
}
