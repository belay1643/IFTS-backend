import { AuditLog } from '../models/index.js'
import { computeEventHash, computeSignature, getGenesisHash, inferAuditCategory, inferAuditResult } from '../services/auditChainService.js'

const audit = (action, tableName) => async (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        const previous = await AuditLog.findOne({
          attributes: ['eventHash'],
          order: [['createdAt', 'DESC'], ['id', 'DESC']]
        })

        const createdAt = new Date()
        const metadata = {
          userAgent: req.get('user-agent') || null,
          sessionId: req.get('x-session-id') || null,
          requestId: req.get('x-request-id') || null,
          method: req.method,
          path: req.originalUrl
        }

        const entry = {
          action,
          tableName,
          recordId: res.locals.recordId,
          userId: req.user?.id,
          companyId: req.companyContext?.companyId,
          oldValue: res.locals.oldValue || null,
          newValue: res.locals.newValue || null,
          ipAddress: req.ip,
          category: inferAuditCategory({ action, tableName, oldValue: res.locals.oldValue, newValue: res.locals.newValue }),
          result: inferAuditResult({ statusCode: res.statusCode, oldValue: res.locals.oldValue, newValue: res.locals.newValue }),
          metadata,
          createdAt
        }

        const previousHash = previous?.eventHash || getGenesisHash()
        const eventHash = computeEventHash(entry)
        const signature = computeSignature({ previousHash, eventHash })

        await AuditLog.create({
          ...entry,
          previousHash,
          eventHash,
          signature
        })
      }
    } catch (err) {
      console.error('Audit log failed', err)
    }
  })
  next()
}

export default audit
