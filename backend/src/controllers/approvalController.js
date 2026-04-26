import { body, param } from 'express-validator'
import { Approval, Transaction, UserCompanyRole, Company, Investment, User } from '../models/index.js'
import { isSuperAdminEmail } from '../utils/superAdmin.js'
import { pushNotification } from '../services/notificationService.js'

export const decisionValidators = [
  param('transactionId').isUUID(),
  body('decision').isIn(['approved', 'rejected']),
  body('rationale').notEmpty()
]

export const listApprovals = async (req, res, next) => {
  try {
    const superAdmin = isSuperAdminEmail(req.user?.email)

    // Get accessible company IDs
    let companyIds = []
    if (superAdmin) {
      const allCompanies = await Company.findAll({ attributes: ['id'] })
      companyIds = allCompanies.map((c) => c.id)
    } else {
      const memberships = await UserCompanyRole.findAll({ where: { userId: req.user.id } })
      companyIds = memberships.map((m) => m.companyId)
    }

    if (req.companyContext) companyIds = [req.companyContext.companyId]
    if (companyIds.length === 0) return res.json([])

    // Fetch transactions for those companies
    const transactions = await Transaction.findAll({
      where: { companyId: companyIds },
      order: [['createdAt', 'DESC']],
      limit: 200
    })
    const txnIds = transactions.map((t) => t.id)
    if (txnIds.length === 0) return res.json([])

    const txnMap = Object.fromEntries(transactions.map((t) => [t.id, t.toJSON()]))

    // Fetch approvals for those transactions
    const approvals = await Approval.findAll({
      where: { transactionId: txnIds },
      order: [['requestedAt', 'DESC']],
      limit: 100
    })

    // Fetch related users
    const userIds = [...new Set([
      ...approvals.map((a) => a.requestedBy),
      ...approvals.map((a) => a.approvedBy)
    ].filter(Boolean))]
    const users = userIds.length > 0 ? await User.findAll({ where: { id: userIds }, attributes: ['id', 'name', 'email'] }) : []
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.toJSON()]))

    // Fetch companies
    const companies = await Company.findAll({ where: { id: companyIds }, attributes: ['id', 'name'] })
    const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.toJSON()]))

    const result = approvals.map((a) => {
      const txn = txnMap[a.transactionId] || {}
      return {
        ...a.toJSON(),
        Transaction: {
          ...txn,
          Company: companyMap[txn.companyId] || null
        },
        requester: userMap[a.requestedBy] || null,
        approver: userMap[a.approvedBy] || null
      }
    })

    res.json(result)
  } catch (err) {
    next(err)
  }
}

export const decide = async (req, res, next) => {
  try {
    const txn = await Transaction.findByPk(req.params.transactionId)
    if (!txn) return res.status(404).json({ message: 'Transaction not found' })
    if (req.companyContext && txn.companyId !== req.companyContext.companyId) return res.status(403).json({ message: 'Company context mismatch' })

    const membership = await UserCompanyRole.findOne({ where: { userId: req.user.id, companyId: txn.companyId } })
    if (!isSuperAdminEmail(req.user?.email) && !membership) return res.status(403).json({ message: 'No access to company' })

    let approval = await Approval.findOne({ where: { transactionId: txn.id } })
    if (!approval) approval = await Approval.create({ transactionId: txn.id, requestedBy: req.user.id })
    approval.status = req.body.decision
    approval.rationale = req.body.rationale
    approval.approvedBy = req.user.id
    approval.decisionAt = new Date()
    await approval.save()
    txn.status = req.body.decision === 'approved' ? 'approved' : 'rejected'
    txn.approvedBy = req.user.id
    txn.approvedAt = new Date()
    await txn.save()
    const company = await Company.findByPk(txn.companyId)
    const investment = txn.investmentId ? await Investment.findByPk(txn.investmentId) : null
    const requester = await User.findByPk(approval.requestedBy)
    await pushNotification({
      userId: approval.requestedBy,
      companyId: txn.companyId,
      type: 'approval',
      title: `Transaction ${txn.id} was ${approval.status}`,
      message: `Transaction ${txn.id} was ${approval.status} by ${req.user.name || 'an admin'}`,
      link: `/transactions/${txn.id}`,
      metadata: {
        transactionId: txn.id,
        transactionType: txn.transactionType,
        amount: Number(txn.amount),
        company: company?.name,
        companyName: company?.name,
        investment: investment?.name || investment?.assetType,
        investmentName: investment?.name || investment?.assetType,
        requestedBy: requester?.name || requester?.email || approval.requestedBy,
        requestedAt: approval.requestedAt || txn.createdAt,
        decisionBy: req.user?.name || req.user?.email,
        decisionAt: approval.decisionAt,
        status: approval.status
      }
    })
    res.locals.recordId = approval.id
    res.json({ approval, transaction: txn })
  } catch (err) {
    next(err)
  }
}
