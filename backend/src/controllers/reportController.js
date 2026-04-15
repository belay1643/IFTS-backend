import { query } from 'express-validator'
import { companySummary, consolidatedSummary } from '../services/reportService.js'

export const reportValidators = [
  query('companyIds').optional().isString(),
  query('companyId').optional().isString()
]

export const summary = async (req, res, next) => {
  try {
    if (req.query.companyIds) {
      const ids = req.query.companyIds.split(',').filter(Boolean)
      const report = await consolidatedSummary(ids)
      return res.json(report)
    }
    const companyId = req.query.companyId || req.companyContext?.companyId
    const report = await companySummary(companyId)
    res.json(report)
  } catch (err) {
    next(err)
  }
}
