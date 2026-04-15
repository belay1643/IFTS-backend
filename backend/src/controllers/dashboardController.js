import { query } from 'express-validator'
import { companySummary, consolidatedSummary } from '../services/reportService.js'

export const dashboardValidators = [
  query('companyIds').optional().isString(),
  query('companyId').optional().isString()
]

const resolveSummary = async (req) => {
  if (req.query.companyIds) {
    const ids = req.query.companyIds.split(',').filter(Boolean)
    return consolidatedSummary(ids)
  }
  const companyId = req.query.companyId || req.companyContext?.companyId
  return companySummary(companyId)
}

export const summary = async (req, res, next) => {
  try {
    const report = await resolveSummary(req)
    res.json(report)
  } catch (err) {
    next(err)
  }
}

export const growth = async (req, res, next) => {
  try {
    const report = await resolveSummary(req)
    res.json({ cashflow: report.cashflow })
  } catch (err) {
    next(err)
  }
}

export const assetAllocation = async (req, res, next) => {
  try {
    const report = await resolveSummary(req)
    res.json({ perAsset: report.perAsset })
  } catch (err) {
    next(err)
  }
}

export const transactions = async (req, res, next) => {
  try {
    const report = await resolveSummary(req)
    res.json({ recentTransactions: report.recentTransactions })
  } catch (err) {
    next(err)
  }
}
