import { body, param, query } from 'express-validator'
import { Investment } from '../models/index.js'
import { recalcInvestment } from '../services/calculationService.js'

export const createInvestmentValidators = [
  body('companyId').isUUID(),
  body('assetType').isIn(['savings', 'bonds', 'shares', 't-bills', 'other']),
  body('principal').isFloat({ gt: 0 }),
  body('interestRate').isFloat({ gt: 0 }),
  body('duration').isInt({ gt: 0 }),
  body('startDate').isISO8601(),
  body('sellingPrice').optional().isFloat({ gt: 0 }),
  body('buyingPrice').optional().isFloat({ gt: 0 }),
  body('shares').optional().isFloat({ gt: 0 }),
  body('dividendRate').optional().isFloat({ gt: 0 }),
  body('notifyStakeholders').optional().isBoolean(),
  body('sendToApproval').optional().isBoolean(),
  body('notes').optional().isString()
]

export const updateInvestmentValidators = [
  param('id').isUUID(),
  body('assetType').optional().isIn(['savings', 'bonds', 'shares', 't-bills', 'other']),
  body('principal').optional().isFloat({ gt: 0 }),
  body('interestRate').optional().isFloat({ gt: 0 }),
  body('duration').optional().isInt({ gt: 0 }),
  body('startDate').optional().isISO8601(),
  body('status').optional().isIn(['active', 'closed', 'pending']),
  body('sellingPrice').optional().isFloat({ gt: 0 }),
  body('buyingPrice').optional().isFloat({ gt: 0 }),
  body('shares').optional().isFloat({ gt: 0 }),
  body('dividendRate').optional().isFloat({ gt: 0 }),
  body('notifyStakeholders').optional().isBoolean(),
  body('sendToApproval').optional().isBoolean(),
  body('notes').optional().isString()
]

export const listInvestmentsValidators = [query('companyId').optional().isUUID()]
export const metricsValidators = [query('companyId').optional().isUUID()]
export const deleteInvestmentValidators = [param('id').isUUID()]

export const listInvestments = async (req, res, next) => {
  try {
    const where = req.companyContext
      ? { companyId: req.companyContext.companyId }
      : req.query.companyId
        ? { companyId: req.query.companyId }
        : {}
    const investments = await Investment.findAll({ where })
    res.json(investments)
  } catch (err) {
    next(err)
  }
}

export const createInvestment = async (req, res, next) => {
  try {
    const payload = { ...req.body, createdBy: req.user.id }
    if (req.companyContext && payload.companyId !== req.companyContext.companyId) {
      return res.status(403).json({ message: 'Company context mismatch' })
    }
    const { maturityDate, interest, capGain, div } = recalcInvestment(payload)
    const investment = await Investment.create({
      ...payload,
      maturityDate,
      calculatedInterest: interest,
      capitalGainResult: capGain,
      dividendResult: div
    })
    res.status(201).json(investment)
  } catch (err) {
    next(err)
  }
}

export const updateInvestment = async (req, res, next) => {
  try {
    const investment = await Investment.findByPk(req.params.id)
    if (!investment) return res.status(404).json({ message: 'Investment not found' })
    if (req.companyContext && investment.companyId !== req.companyContext.companyId) return res.status(403).json({ message: 'Company context mismatch' })
    res.locals.oldValue = investment.toJSON()
    const updates = { ...req.body }
    if (updates.principal || updates.interestRate || updates.duration || updates.startDate || updates.sellingPrice || updates.buyingPrice || updates.shares || updates.dividendRate) {
      const { maturityDate, interest, capGain, div } = recalcInvestment({ ...investment.toJSON(), ...updates })
      updates.maturityDate = maturityDate
      updates.calculatedInterest = interest
      updates.capitalGainResult = capGain
      updates.dividendResult = div
    }
    await investment.update(updates)
    res.locals.newValue = investment.toJSON()
    res.locals.recordId = investment.id
    res.json(investment)
  } catch (err) {
    next(err)
  }
}

export const deleteInvestment = async (req, res, next) => {
  try {
    const investment = await Investment.findByPk(req.params.id)
    if (!investment) return res.status(404).json({ message: 'Investment not found' })
    if (req.companyContext && investment.companyId !== req.companyContext.companyId) return res.status(403).json({ message: 'Company context mismatch' })
    res.locals.recordId = investment.id
    res.locals.oldValue = investment.toJSON()
    await investment.destroy()
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export const investmentMetrics = async (req, res, next) => {
  try {
    const where = req.companyContext
      ? { companyId: req.companyContext.companyId }
      : req.query.companyId
        ? { companyId: req.query.companyId }
        : {}
    const investments = await Investment.findAll({ where })
    const now = new Date()
    const totalPrincipal = investments.reduce((sum, i) => sum + Number(i.principal || 0), 0)
    const averageRate = investments.length
      ? investments.reduce((sum, i) => sum + Number(i.interestRate || 0), 0) / investments.length
      : 0
    const averageDuration = investments.length
      ? investments.reduce((sum, i) => sum + Number(i.duration || 0), 0) / investments.length
      : 0
    const activeCount = investments.filter((i) => i.status === 'active').length
    const pendingCount = investments.filter((i) => i.status === 'pending').length
    const closedCount = investments.filter((i) => i.status === 'closed').length
    const upcomingMaturities = investments.filter((i) => i.maturityDate && new Date(i.maturityDate) >= now && new Date(i.maturityDate) <= new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)).length
    const overdueMaturities = investments.filter((i) => i.maturityDate && new Date(i.maturityDate) < now && i.status !== 'closed').length

    res.json({
      totalPrincipal,
      averageRate,
      averageDuration,
      activeCount,
      pendingCount,
      closedCount,
      upcomingMaturities,
      overdueMaturities
    })
  } catch (err) {
    next(err)
  }
}
