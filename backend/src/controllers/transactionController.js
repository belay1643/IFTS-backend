import { body, param, query } from 'express-validator'
import { Transaction, Investment, Company, UserCompanyRole, Approval } from '../models/index.js'
import { pushNotification } from '../services/notificationService.js'

export const createTransactionValidators = [
  body('companyId').isUUID(),
  body('investmentId').optional({ nullable: true }).isUUID(),
  body('transactionType').notEmpty(),
  body('amount').isFloat({ gt: 0 }),
  body('date').isISO8601(),
  body('status').optional().isIn(['pending', 'approved', 'rejected', 'posted'])
]

export const updateTransactionValidators = [
  param('id').isUUID(),
  body('status').optional().isIn(['pending', 'approved', 'rejected', 'posted'])
]

export const listTransactionsValidators = [query('companyId').optional().isUUID()]
export const metricsValidators = [query('companyId').optional().isUUID()]

export const listTransactions = async (req, res, next) => {
  try {
    const where = req.companyContext
      ? { companyId: req.companyContext.companyId }
      : req.query.companyId
        ? { companyId: req.query.companyId }
        : {}
    const transactions = await Transaction.findAll({ where, order: [['date', 'DESC']], limit: 200 })
    res.json(transactions)
  } catch (err) {
    next(err)
  }
}

export const createTransaction = async (req, res, next) => {
  try {
    const payload = { ...req.body }
    if (req.companyContext && payload.companyId !== req.companyContext.companyId) {
      return res.status(403).json({ message: 'Company context mismatch' })
    }

    const company = await Company.findByPk(payload.companyId)
    if (!company) return res.status(404).json({ message: 'Company not found' })
    const investment = payload.investmentId ? await Investment.findByPk(payload.investmentId) : null

    // ensure user has membership before creating transactions
    const membership = await UserCompanyRole.findOne({ where: { userId: req.user.id, companyId: payload.companyId } })
    if (!membership) return res.status(403).json({ message: 'No access to company' })

    const approvalThreshold = Number(company.approvalThreshold || 10000)
    const amount = Number(payload.amount)
    const description = String(payload.description || '').trim()
    if (amount >= approvalThreshold && !description) {
      return res.status(400).json({ message: 'Description is required for transactions at or above the approval threshold' })
    }

    const needsApproval = amount >= approvalThreshold
    payload.requiresApproval = needsApproval
    if (needsApproval) {
      payload.status = 'pending'
      payload.approvedBy = null
      payload.approvedAt = null
    }

    const txn = await Transaction.create(payload)
    if (needsApproval) {
      await Approval.create({ transactionId: txn.id, requestedBy: req.user.id })
    }
    if (needsApproval) {
      await pushNotification({
        userId: req.user.id,
        companyId: payload.companyId,
        type: 'approval',
        title: `Transaction ${txn.id} requires approval`,
        message: `Transaction ${txn.id} requires approval`,
        link: `/transactions/${txn.id}`,
        metadata: {
          transactionId: txn.id,
          transactionType: txn.transactionType,
          amount: Number(txn.amount),
          company: company.name,
          companyName: company.name,
          investment: investment?.name || investment?.assetType,
          investmentName: investment?.name || investment?.assetType,
          requestedBy: req.user?.name || req.user?.email,
          requestedAt: txn.createdAt
        }
      })
    }
    res.status(201).json(txn)
  } catch (err) {
    next(err)
  }
}

export const updateTransaction = async (req, res, next) => {
  try {
    const txn = await Transaction.findByPk(req.params.id)
    if (!txn) return res.status(404).json({ message: 'Transaction not found' })
    if (req.companyContext && txn.companyId !== req.companyContext.companyId) return res.status(403).json({ message: 'Company context mismatch' })

    const membership = await UserCompanyRole.findOne({ where: { userId: req.user.id, companyId: txn.companyId } })
    if (!membership) return res.status(403).json({ message: 'No access to company' })

    const company = await Company.findByPk(txn.companyId)
    const amount = req.body.amount !== undefined ? req.body.amount : txn.amount
    const requestedPending = req.body.status === 'pending'
    const needsApproval = requestedPending || Number(amount) >= Number(company?.approvalThreshold || 0)

    const updates = { ...req.body, requiresApproval: needsApproval }
    if (needsApproval) {
      updates.status = 'pending'
      updates.approvedBy = null
      updates.approvedAt = null
      const existingApproval = await Approval.findOne({ where: { transactionId: txn.id } })
      if (!existingApproval) await Approval.create({ transactionId: txn.id, requestedBy: req.user.id })
      else if (requestedPending) {
        existingApproval.status = 'pending'
        existingApproval.requestedBy = existingApproval.requestedBy || req.user.id
        await existingApproval.save()
      }
    }

    res.locals.oldValue = txn.toJSON()
    await txn.update(updates)
    res.locals.newValue = txn.toJSON()
    res.locals.recordId = txn.id
    res.json(txn)
  } catch (err) {
    next(err)
  }
}

export const transactionMetrics = async (req, res, next) => {
  try {
    const where = req.companyContext
      ? { companyId: req.companyContext.companyId }
      : req.query.companyId
        ? { companyId: req.query.companyId }
        : {}
    const transactions = await Transaction.findAll({ where })
    const creditTypes = ['interest', 'dividend', 'sell', 'gain']
    const totalAmount = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0)
    const inflow = transactions
      .filter((t) => creditTypes.includes((t.transactionType || '').toLowerCase()))
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
    const outflow = totalAmount - inflow
    const pending = transactions.filter((t) => t.status === 'pending').length
    const approved = transactions.filter((t) => t.status === 'approved').length
    const posted = transactions.filter((t) => t.status === 'posted').length
    const rejected = transactions.filter((t) => t.status === 'rejected').length

    res.json({ totalAmount, inflow, outflow, pending, approved, posted, rejected })
  } catch (err) {
    next(err)
  }
}
