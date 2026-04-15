import { body, param } from 'express-validator'
import { Approval, Transaction, UserCompanyRole, Company, Investment, User } from '../models/index.js'
import { pushNotification } from '../services/notificationService.js'

export const decisionValidators = [
  param('transactionId').isUUID(),
  body('decision').isIn(['approved', 'rejected']),
  body('rationale').notEmpty()
]

export const listApprovals = async (req, res, next) => {
  try {
    const memberships = await UserCompanyRole.findAll({ where: { userId: req.user.id } })
    const companyIds = memberships.map((m) => m.companyId)
    const whereTxn = req.companyContext
      ? { companyId: req.companyContext.companyId }
      : companyIds.length
        ? { companyId: companyIds }
        : {}

    const approvals = await Approval.findAll({
      include: [
        {
          model: Transaction,
          where: whereTxn,
          include: [
            { model: Company },
            { model: Investment, required: false },
            { model: User, as: 'approver', attributes: ['id', 'name', 'email'], required: false }
          ]
        },
        { model: User, as: 'requester', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'approver', attributes: ['id', 'name', 'email'], required: false }
      ],
      order: [['requestedAt', 'DESC']],
      limit: 100
    })
    res.json(approvals)
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
    if (!membership) return res.status(403).json({ message: 'No access to company' })

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
