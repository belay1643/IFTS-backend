import { Investment, Transaction, Company, Approval } from '../models/index.js'
import { Op } from 'sequelize'

const toNumber = (val) => Number(val || 0)
const normalize = (val) => String(val || '').toLowerCase()
const DASHBOARD_STATUSES = new Set(['completed', 'approved', 'posted'])

const createEmptySingleSummary = () => ({
  totalInvestment: 0,
  totalPortfolioValue: 0,
  totalProfit: 0,
  activeAssets: 0,
  upcomingMaturities: 0,
  pendingApprovalsCount: 0,
  perAsset: [],
  cashflow: [],
  holdings: [],
  recentTransactions: [],
  notifications: [],
  pendingApprovals: [],
  deltas: { investment: 0, profit: 0 }
})

const createEmptyConsolidatedSummary = () => ({
  totalInvestment: 0,
  totalPortfolioValue: 0,
  totalProfit: 0,
  activeAssets: 0,
  upcomingMaturities: 0,
  pendingApprovalsCount: 0,
  perAsset: [],
  cashflow: [],
  holdings: [],
  recentTransactions: [],
  companyBreakdown: [],
  companies: [],
  notifications: [],
  pendingApprovals: [],
  deltas: { investment: 0, profit: 0 }
})

const transactionBucket = (type) => {
  const value = normalize(type)
  if (['buy', 'purchase', 'investment', 'acquisition', 'contribution', 'deposit'].includes(value)) return 'buy'
  if (['sell', 'sale', 'withdrawal', 'disposal'].includes(value)) return 'sell'
  if (['interest', 'coupon'].includes(value)) return 'interest'
  if (['dividend', 'payout'].includes(value)) return 'dividend'
  if (['gain', 'return', 'profit', 'income'].includes(value)) return 'gain'
  return 'other'
}

const isCompleted = (status) => DASHBOARD_STATUSES.has(normalize(status))

const signedDashboardAmount = (t) => {
  const bucket = transactionBucket(t.transactionType)
  const amount = toNumber(t.amount)
  if (bucket === 'sell') return -amount
  if (bucket === 'buy' || bucket === 'interest' || bucket === 'dividend' || bucket === 'gain') return amount
  return 0
}

const aggregateTransactions = (transactions, investments = []) => {
  const totals = { buy: 0, sell: 0, interest: 0, dividend: 0, gain: 0 }

  transactions
    .filter((t) => isCompleted(t.status))
    .forEach((t) => {
      const bucket = transactionBucket(t.transactionType)
      const amount = toNumber(t.amount)
      if (bucket in totals) totals[bucket] += amount
    })

  let portfolioValue = totals.buy - totals.sell
  let profit = totals.sell - totals.buy + totals.interest + totals.dividend + totals.gain

  // If transaction history is sparse, derive baseline from recorded investments.
  if (portfolioValue <= 0) {
    const principalTotal = investments.reduce((sum, inv) => sum + toNumber(inv.principal), 0)
    portfolioValue = principalTotal
    if (profit === 0) profit = totals.interest + totals.dividend + totals.gain
  }

  return { totals, portfolioValue, profit }
}

const buildAssetBreakdown = (investments) => {
  const grouped = investments.reduce((acc, inv) => {
    const key = inv.assetType || 'Unknown'
    acc[key] = (acc[key] || 0) + toNumber(inv.principal)
    return acc
  }, {})
  return Object.entries(grouped).map(([name, value]) => ({ name, value }))
}

const buildHoldings = (investments) =>
  investments
    .sort((a, b) => toNumber(b.principal) - toNumber(a.principal))
    .slice(0, 5)
    .map((i) => ({
      id: i.id,
      name: i.assetName || i.assetType || 'Asset',
      assetType: i.assetType,
      principal: toNumber(i.principal),
      amount: toNumber(i.principal),
      maturityDate: i.maturityDate,
      status: i.status
    }))

const buildRecentTransactions = (transactions, limit = 8) =>
  transactions.slice(0, limit).map((t) => ({
    id: t.id,
    transactionType: t.transactionType,
    amount: toNumber(t.amount),
    status: t.status,
    requiresApproval: Boolean(t.requiresApproval),
    transactionDate: t.date || t.createdAt,
    companyId: t.companyId
  }))

const buildPendingApprovals = (approvals) =>
  approvals.map((a) => ({
    id: a.id,
    transactionId: a.transactionId,
    amount: toNumber(a.Transaction?.amount),
    status: a.status,
    requestedAt: a.requestedAt,
    note: a.rationale || 'Waiting for Manager Approval'
  }))

const buildCashflow = (transactions, investments = [], monthsBack = 6) => {
  const now = new Date()
  const monthly = []

  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = dt.toLocaleString('en-US', { month: 'short' })
    const month = dt.getMonth()
    const year = dt.getFullYear()
    const net = transactions
      .filter((t) => {
        const txDate = t.date ? new Date(t.date) : new Date(t.createdAt)
        return txDate.getMonth() === month && txDate.getFullYear() === year && isCompleted(t.status)
      })
      .reduce((sum, t) => sum + signedDashboardAmount(t), 0)

    monthly.push({ month: label, net })
  }

  let running = 0
  if (monthly.every((m) => toNumber(m.net) === 0)) {
    const baseline = investments.reduce((sum, inv) => sum + toNumber(inv.principal), 0)
    const growthStep = baseline > 0 ? baseline / Math.max(1, monthsBack) : 0
    return monthly.map((row, idx) => ({ month: row.month, amount: Math.round(growthStep * (idx + 1)) }))
  }

  return monthly.map((row) => {
    running += row.net
    return { month: row.month, amount: running }
  })
}

const buildDeltas = (cashflow) => {
  if (!Array.isArray(cashflow) || cashflow.length < 2) return { investment: 0, profit: 0 }
  const prev = toNumber(cashflow[cashflow.length - 2]?.amount)
  const curr = toNumber(cashflow[cashflow.length - 1]?.amount)
  if (prev === 0) return { investment: curr > 0 ? 100 : 0, profit: curr > 0 ? 100 : 0 }
  const pct = ((curr - prev) / Math.abs(prev)) * 100
  return { investment: pct, profit: pct }
}

const upcomingWithin30Days = (investment) => {
  if (!investment.maturityDate) return false
  const now = new Date()
  const maturity = new Date(investment.maturityDate)
  const diff = maturity.getTime() - now.getTime()
  const days = diff / (1000 * 60 * 60 * 24)
  return days >= 0 && days <= 30
}

const buildCompanySnapshot = (company, investments, transactions, approvals) => {
  const { totals, portfolioValue, profit } = aggregateTransactions(transactions, investments)
  const cashflow = buildCashflow(transactions, investments)
  const holdings = buildHoldings(investments)
  const recentTransactions = buildRecentTransactions(transactions)
  const pendingApprovals = buildPendingApprovals(approvals)
  const activeAssets = investments.filter((i) => normalize(i.status) === 'active').length
  const upcomingMaturities = investments.filter((i) => upcomingWithin30Days(i)).length
  const perAsset = buildAssetBreakdown(investments)
  const deltas = buildDeltas(cashflow)

  return {
    companyId: company?.id,
    companyName: company?.name,
    totalInvestment: totals.buy,
    totalPortfolioValue: portfolioValue,
    totalProfit: profit,
    activeAssets,
    upcomingMaturities,
    pendingApprovalsCount: pendingApprovals.length,
    perAsset,
    cashflow,
    holdings,
    recentTransactions,
    notifications: [],
    pendingApprovals,
    deltas
  }
}

export const companySummary = async (companyId) => {
  if (!companyId) return createEmptySingleSummary()

  const [company, investments, transactions] = await Promise.all([
    Company.findByPk(companyId),
    Investment.findAll({ where: { companyId } }),
    Transaction.findAll({ where: { companyId }, order: [['date', 'DESC']] })
  ])

  const pendingTxnIds = transactions.filter((t) => t.status === 'pending').map((t) => t.id)
  const approvals = pendingTxnIds.length > 0
    ? await Approval.findAll({ where: { transactionId: pendingTxnIds, status: 'pending' }, limit: 15 })
    : []

  // attach transaction to approval manually
  const txnMap = Object.fromEntries(transactions.map((t) => [t.id, t]))
  const approvalsWithTxn = approvals.map((a) => ({ ...a.toJSON(), Transaction: txnMap[a.transactionId] }))

  return buildCompanySnapshot(company, investments, transactions, approvalsWithTxn)
}

export const consolidatedSummary = async (companyIds) => {
  const ids = Array.isArray(companyIds) ? companyIds.filter(Boolean) : []
  if (ids.length === 0) return createEmptyConsolidatedSummary()

  const [companies, investments, transactions] = await Promise.all([
    Company.findAll({ where: { id: { [Op.in]: ids } } }),
    Investment.findAll({ where: { companyId: { [Op.in]: ids } } }),
    Transaction.findAll({ where: { companyId: { [Op.in]: ids } }, order: [['date', 'DESC']] })
  ])

  const pendingTxnIds = transactions.filter((t) => t.status === 'pending').map((t) => t.id)
  const approvals = pendingTxnIds.length > 0
    ? await Approval.findAll({ where: { transactionId: pendingTxnIds, status: 'pending' }, limit: 30 })
    : []

  const txnMap = Object.fromEntries(transactions.map((t) => [t.id, t]))
  const approvalsWithTxn = approvals.map((a) => ({ ...a.toJSON(), Transaction: txnMap[a.transactionId] }))

  const investmentsByCompany = investments.reduce((acc, inv) => {
    acc[inv.companyId] = acc[inv.companyId] || []
    acc[inv.companyId].push(inv)
    return acc
  }, {})

  const transactionsByCompany = transactions.reduce((acc, tx) => {
    acc[tx.companyId] = acc[tx.companyId] || []
    acc[tx.companyId].push(tx)
    return acc
  }, {})

  const approvalsByCompany = approvalsWithTxn.reduce((acc, approval) => {
    const companyId = approval.Transaction?.companyId
    if (!companyId) return acc
    acc[companyId] = acc[companyId] || []
    acc[companyId].push(approval)
    return acc
  }, {})

  const companyBreakdown = companies.map((company) =>
    buildCompanySnapshot(company, investmentsByCompany[company.id] || [], transactionsByCompany[company.id] || [], approvalsByCompany[company.id] || [])
  )

  const aggregatedTransactions = aggregateTransactions(transactions, investments)
  const perAsset = buildAssetBreakdown(investments)
  const cashflow = buildCashflow(transactions, investments)
  const recentTransactions = buildRecentTransactions(transactions)
  const pendingApprovals = companyBreakdown.flatMap((c) => c.pendingApprovals || []).slice(0, 20)
  const deltas = buildDeltas(cashflow)

  return {
    totalInvestment: aggregatedTransactions.totals.buy,
    totalPortfolioValue: aggregatedTransactions.portfolioValue,
    totalProfit: aggregatedTransactions.profit,
    activeAssets: companyBreakdown.reduce((sum, c) => sum + c.activeAssets, 0),
    upcomingMaturities: companyBreakdown.reduce((sum, c) => sum + c.upcomingMaturities, 0),
    pendingApprovalsCount: pendingApprovals.length,
    perAsset,
    cashflow,
    holdings: buildHoldings(investments),
    recentTransactions,
    companyBreakdown,
    companies,
    notifications: [],
    pendingApprovals,
    deltas
  }
}
