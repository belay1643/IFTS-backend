import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Label,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { fetchSummary, setDashboardMode } from '../store/slices/dashboardSlice.js'
import { setActiveCompany } from '../store/slices/companySlice.js'

const CHART_COLORS = ['#6366F1', '#22C55E', '#F59E0B', '#EF4444', '#14B8A6']
const ASSET_THEME_COLORS = {
  Savings: '#22C55E',
  Bonds: '#F59E0B',
  Shares: '#3B82F6'
}

function normalizeAssetType(value) {
  const raw = String(value || '').toLowerCase()
  if (/bond|treasury|fixed.?income/.test(raw)) return 'Bonds'
  if (/share|equity|stock/.test(raw)) return 'Shares'
  if (/saving|deposit|cash|money.?market|fixed.?deposit/.test(raw)) return 'Savings'
  return toTitle(String(value || 'Asset'))
}

function countAssetTypesFromSummary(summary) {
  const set = new Set()
  const fromPerAsset = Array.isArray(summary?.perAsset) ? summary.perAsset : []
  fromPerAsset.forEach((item) => {
    set.add(normalizeAssetType(item.name || item.assetType || item.type || 'Asset'))
  })
  const fromHoldings = Array.isArray(summary?.holdings) ? summary.holdings : []
  fromHoldings.forEach((item) => {
    set.add(normalizeAssetType(item.assetType || item.type || 'Asset'))
  })
  return [...set].filter(Boolean).length
}

function toSparklineSeries(series, currentValue) {
  const clean = Array.isArray(series) ? series.map(Number).filter(Number.isFinite) : []
  if (clean.length >= 2) return clean.slice(-8)
  if (clean.length === 1) return [clean[0], clean[0]]
  const current = Number(currentValue)
  if (Number.isFinite(current) && current !== 0) return [current, current]
  return []
}

function buildGrowthFromTransactions(transactions) {
  if (!Array.isArray(transactions) || transactions.length === 0) return []

  const grouped = transactions.reduce((acc, tx) => {
    const dateValue = tx.transactionDate || tx.date || tx.createdAt
    if (!dateValue) return acc
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return acc

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const amountRaw = Number(String(tx.amount ?? 0).replace(/[^0-9.-]/g, ''))
    const type = String(tx.transactionType || tx.type || '').toLowerCase()
    const signed = /withdraw|expense|loss|debit/.test(type) ? -Math.abs(amountRaw) : amountRaw
    acc[key] = (acc[key] || 0) + (Number.isFinite(signed) ? signed : 0)
    return acc
  }, {})

  const ordered = Object.entries(grouped)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([key, amount]) => {
      const [year, month] = key.split('-').map(Number)
      return {
        month: formatMonth(new Date(year, (month || 1) - 1, 1)),
        amount: Number(amount || 0)
      }
    })

  return ordered.slice(-12)
}

const DashboardPage = () => {
  const dispatch = useDispatch()
  const { list, active } = useSelector((s) => s.company)
  const { summary, status, mode } = useSelector((s) => s.dashboard)
  const { theme } = useSelector((s) => s.ui)

  const isDark = theme === 'dark'
  const canConsolidate = list.length > 0

  const summaryPayload = useMemo(() => {
    if (mode === 'consolidated') {
      if (list.length === 0) return null
      return { mode: 'consolidated', companyIds: list.map((c) => c.id) }
    }
    if (active) return { mode: 'single', companyIds: [active] }
    return null
  }, [mode, active, list])

  useEffect(() => {
    if (mode === 'consolidated' && !canConsolidate) {
      dispatch(setDashboardMode('single'))
      return
    }

    if (!active && list.length > 0) {
      dispatch(setActiveCompany(list[0].id))
      return
    }

    if (summaryPayload) {
      dispatch(fetchSummary(summaryPayload))
    }
  }, [dispatch, mode, active, list, canConsolidate, summaryPayload])

  useEffect(() => {
    if (!summaryPayload) return undefined
    const timer = setInterval(() => {
      dispatch(fetchSummary(summaryPayload))
    }, 60000)
    return () => clearInterval(timer)
  }, [dispatch, summaryPayload])

  const metrics = useMemo(() => {
    const deltas = summary?.deltas || {}
    const pendingCount = summary?.pendingApprovalsCount ?? (summary?.pendingApprovals ? summary.pendingApprovals.length : 0)
    const portfolioValueRaw = Number(summary?.totalPortfolioValue ?? summary?.totalInvestment ?? 0)
    const profitRaw = Number(summary?.totalProfit ?? 0)
    const activeAssetsRaw = Number(summary?.activeAssets ?? 0)
    const portfolioValue = portfolioValueRaw
    const profitValue = profitRaw > 0 ? profitRaw : 0
    const lossValue = profitRaw < 0 ? Math.abs(profitRaw) : 0
    const activeAssets = activeAssetsRaw
    const pending = pendingCount
    const uniqueAssetTypes = countAssetTypesFromSummary(summary)
    // No sparklines, no icons, no extra signs
    return [
      {
        tone: 'blue',
        title: 'Portfolio Value',
        value: formatCurrency(portfolioValue),
        change: '',
        sparkline: null,
        toneColor: '#4F46E5',
        trendValue: 0
      },
      {
        tone: 'green',
        title: 'Profit',
        value: formatCurrency(profitValue),
        change: '',
        sparkline: null,
        toneColor: '#16A34A',
        trendValue: 0
      },
      {
        tone: 'red',
        title: 'Loss',
        value: formatCurrency(lossValue),
        change: '',
        sparkline: null,
        toneColor: '#DC2626',
        trendValue: 0
      },
      {
        tone: 'violet',
        title: 'Active Assets',
        value: formatNumber(activeAssets),
        change: '',
        sparkline: null,
        toneColor: '#7C3AED',
        trendValue: 0
      },
      {
        tone: 'blue',
        title: 'Pending Approvals',
        value: formatNumber(pending),
        change: '',
        sparkline: null,
        toneColor: '#0284C7',
        trendValue: 0,
        badge: pending > 0 ? `Urgent: ${pending}` : null
      }
    ]
  }, [summary])

  const companyMap = useMemo(
    () => Object.fromEntries(list.map((c) => [c.id, c.name])),
    [list]
  )

  const allocationData = useMemo(() => {
    const raw = Array.isArray(summary?.perAsset) ? summary.perAsset : []
    const normalizedRaw = raw.reduce((acc, item) => {
      const key = normalizeAssetType(String(item.name || item.assetType || item.type || 'Asset').replace(/\d+/g, ' ').trim())
      const value = Number(String(item.value ?? item.amount ?? 0).replace(/[^0-9.-]/g, ''))
      if (!key || !Number.isFinite(value) || value <= 0) return acc
      acc[key] = (acc[key] || 0) + value
      return acc
    }, {})

    const normalizedRawList = Object.entries(normalizedRaw).map(([name, value]) => ({ name, value }))

    if (normalizedRawList.length >= 1) return withCoreAssetTypes(normalizedRawList)

    const holdings = Array.isArray(summary?.holdings) ? summary.holdings : []
    if (holdings.length > 0) {
      const grouped = holdings.reduce((acc, h) => {
        const key = normalizeAssetType(h.assetType || 'Savings')
        const value = Number(h.principal || h.amount || 0)
        acc[key] = (acc[key] || 0) + value
        return acc
      }, {})
      const mapped = Object.entries(grouped).map(([name, value]) => ({ name, value }))
      if (mapped.length >= 1) return withCoreAssetTypes(mapped)
    }

    return []
  }, [summary])
  const allocationTotal = useMemo(() => allocationData.reduce((sum, item) => sum + Number(item.value || 0), 0), [allocationData])
  const growthData = useMemo(() => {
    const raw = Array.isArray(summary?.cashflow) ? summary.cashflow : []
    const normalized = raw
      .map((item, idx) => ({
        month: formatMonth(item.month || item.date || item.label || `M${idx + 1}`),
        amount: Number(String(item.amount ?? item.value ?? 0).replace(/[^0-9.-]/g, ''))
      }))
      .filter((item) => item.month && Number.isFinite(item.amount))

    if (normalized.length >= 1) return normalized

    const txFallback = buildGrowthFromTransactions(summary?.recentTransactions)
    if (txFallback.length >= 1) return txFallback

    return []
  }, [summary])
  const recentTransactions = summary?.recentTransactions || []
  const normalizedRecentTransactions = useMemo(() => {
    if (!Array.isArray(recentTransactions) || recentTransactions.length === 0) return []
    return recentTransactions.map((t) => ({
      ...t,
      companyName: t.companyName || t.company || companyMap[t.companyId] || '-'
    }))
  }, [recentTransactions, companyMap])
  const notifications = useMemo(() => {
    if (Array.isArray(summary?.notifications) && summary.notifications.length > 0) return summary.notifications

    const fromHoldings = (summary?.holdings || []).slice(0, 3).map((h, idx) => {
      const days = daysUntil(h.maturityDate)
      return {
        id: h.id || idx,
        type: idx === 0 ? 'warning' : idx === 1 ? 'info' : 'neutral',
        title: `${toTitle(h.assetType || h.name || 'Investment')} - ${h.companyName || 'Portfolio'}`,
        message: `Matures in ${days > 0 ? days : 7} days`,
        amount: Number(h.principal || h.amount || 0)
      }
    })

    if (fromHoldings.length > 0) return fromHoldings
    return []
  }, [summary])

  const upcomingMaturities = useMemo(() => {
    const holdings = Array.isArray(summary?.holdings) ? summary.holdings : []
    const rows = holdings
      .filter((h) => h.maturityDate)
      .sort((a, b) => new Date(a.maturityDate) - new Date(b.maturityDate))
      .slice(0, 3)
      .map((h, idx) => ({
        id: h.id || `mat-${idx}`,
        asset: toTitle(h.assetType || h.name || 'Asset'),
        date: formatDate(h.maturityDate),
        amount: Number(h.principal || h.amount || 0)
      }))

    if (rows.length > 0) return rows
    return notifications.slice(0, 3).map((n, idx) => ({ id: `mat-note-${idx}`, asset: n.message, date: '-', amount: 0 }))
  }, [summary, notifications])

  const pendingApprovals = useMemo(() => {
    const source = Array.isArray(summary?.pendingApprovals) ? summary.pendingApprovals : []
    if (source.length > 0) {
      return source.slice(0, 3).map((a, idx) => ({
        id: a.id || `apr-${idx}`,
        transactionId: a.transactionId || a.id || '-',
        amount: Number(a.amount || 0),
        note: a.note || a.rationale || 'Waiting for Manager Approval'
      }))
    }

    return recentTransactions
      .filter((t) => String(t.status || '').toLowerCase() === 'pending')
      .slice(0, 3)
      .map((t, idx) => ({
        id: t.id || `apr-tx-${idx}`,
        transactionId: t.id || '-',
        amount: Number(t.amount || 0),
        note: 'Waiting for Manager Approval'
      }))
  }, [summary, recentTransactions])

  const companyBreakdown = useMemo(() => {
    const raw = Array.isArray(summary?.companyBreakdown) ? summary.companyBreakdown : []
    const normalized = raw
      .map((c, idx) => ({
        companyId: c.companyId || c.id || `cmp-${idx}`,
        companyName: c.companyName || c.name || companyMap[c.companyId] || '-',
        totalPortfolioValue: Number(c.totalPortfolioValue ?? c.totalInvestment ?? c.value ?? 0),
        totalInvestment: Number(c.totalInvestment ?? c.value ?? 0),
        totalProfit: Number(c.totalProfit ?? 0),
        cashflow: Array.isArray(c.cashflow) ? c.cashflow : []
      }))
      .filter((c) => c.companyName)

    return normalized
  }, [summary, companyMap])
  const portfolioMeta = {
    monthlyChange: withPercent(summary?.deltas?.investment, '+0.0%'),
    companyCount: companyBreakdown.length || list.length || 0,
    investmentCount: Number(summary?.activeAssets || summary?.holdings?.length || 0)
  }

  const ranking = useMemo(() => {
    return companyBreakdown
      .map((c) => {
        const roi = c.totalInvestment ? (Number(c.totalProfit || 0) / Number(c.totalInvestment || 0)) * 100 : 0
        const trend = trendFromCashflow(c.cashflow || [])
        return {
          companyId: c.companyId,
          companyName: c.companyName,
          roi,
          trend,
          value: c.totalPortfolioValue || c.totalInvestment || 0
        }
      })
      .sort((a, b) => b.roi - a.roi)
  }, [companyBreakdown])

  const activeCompanyName = useMemo(() => list.find((c) => c.id === active)?.name, [list, active])
  const viewLabel = mode === 'single' ? 'Single Company View' : 'Consolidated View'
  const lastUpdatedLabel = summary?.lastUpdated ? formatDate(summary.lastUpdated) : 'Live snapshot'

  return (
    <div className="bg-[var(--bg-base)]">
      <div className="max-w-[1320px] mx-auto px-0.5 sm:px-2 lg:px-4 py-4 sm:py-6 space-y-5 sm:space-y-6">
        <header className="rounded-2xl sm:rounded-3xl border border-[color:var(--panel-border)] bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_40%),radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_38%),var(--bg-card)] px-4 sm:px-6 py-4 sm:py-5 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.5)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] sm:tracking-[0.18em] text-[color:var(--text-muted)]">Dashboard · {viewLabel}</p>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[20px] sm:text-[24px] lg:text-[25px] font-bold tracking-tight text-[color:var(--text-primary)]">Portfolio overview</h1>
                {activeCompanyName && mode === 'single' && (
                  <span className="rounded-full bg-[var(--bg-hover)] px-3 py-1 text-xs font-semibold text-[color:var(--text-secondary)] border border-[color:var(--panel-border)]">{activeCompanyName}</span>
                )}
              </div>
              <p className="max-w-2xl text-[12px] sm:text-[13px] text-[color:var(--text-secondary)]">Monitor performance, approvals, and risk posture in one place.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[color:var(--text-secondary)]">
              <div className="inline-flex items-center rounded-full border border-[color:var(--panel-border)] bg-[var(--bg-card)] p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => dispatch(setDashboardMode('single'))}
                  className={`rounded-full px-3 py-1 text-xs transition ${mode === 'single' ? 'bg-[var(--bg-hover)] text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'}`}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => dispatch(setDashboardMode('consolidated'))}
                  disabled={!canConsolidate}
                  className={`rounded-full px-3 py-1 text-xs transition ${mode === 'consolidated' ? 'bg-[var(--bg-hover)] text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  All Companies
                </button>
              </div>
              {mode === 'single' && list.length > 0 && (
                <select
                  value={active || ''}
                  onChange={(e) => dispatch(setActiveCompany(e.target.value))}
                  className="rounded-full border border-[color:var(--panel-border)] bg-[var(--bg-card)] px-3 py-1 text-xs font-semibold text-[color:var(--text-secondary)] shadow-sm focus:outline-none"
                >
                  {list.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              )}
              <span className="rounded-full border border-[color:var(--panel-border)] bg-[var(--bg-card)] px-3 py-1 shadow-sm">{lastUpdatedLabel}</span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-700 dark:text-emerald-300">{status === 'loading' ? 'Syncing…' : 'Live'}</span>
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sky-700 dark:text-sky-300">Security audit on</span>
            </div>
          </div>
        </header>

        {status === 'failed' && <div className="text-sm text-rose-500">Failed to load dashboard data.</div>}
        {status === 'loading' && <div className="text-sm text-[color:var(--text-muted)]">Loading dashboard...</div>}

        {mode === 'single' ? (
          <SingleCompanyView
            metrics={metrics}
            allocationData={allocationData}
            allocationTotal={allocationTotal}
            growthData={growthData}
            recentTransactions={normalizedRecentTransactions}
            notifications={notifications}
            upcomingMaturities={upcomingMaturities}
            pendingApprovals={pendingApprovals}
            isDark={isDark}
          />
        ) : (
          <ConsolidatedView
            totalPortfolioValue={summary?.totalPortfolioValue}
            portfolioMeta={portfolioMeta}
            companyBreakdown={companyBreakdown}
            ranking={ranking}
            isDark={isDark}
          />
        )}
      </div>
    </div>
  )
}

const SingleCompanyView = ({ metrics, allocationData, allocationTotal, growthData, recentTransactions, notifications, upcomingMaturities, pendingApprovals, isDark }) => (
  <>
    <h2 className="text-[19px] sm:text-[23px] font-bold tracking-tight text-[color:var(--text-primary)]">Key metrics</h2>
    <SectionCard>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <MetricCard key={m.title} icon={m.icon} tone={m.tone} title={m.title} value={m.value} change={m.change} sparkline={m.sparkline} toneColor={m.toneColor} trendValue={m.trendValue} badge={m.badge} />
        ))}
      </div>
    </SectionCard>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <AssetAllocation allocationData={allocationData} allocationTotal={allocationTotal} isDark={isDark} />
      <InvestmentGrowth data={growthData} isDark={isDark} />
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <SectionCard title="Notifications" action="View All" actionHref="/notifications">
        {notifications.length === 0 ? (
          <EmptyPanel icon="🔔" message="No notifications" subtitle="You're all caught up" compact />
        ) : (
          <ul className="space-y-2 text-sm">
            {notifications.map((n) => (
              <li key={n.id} className="rounded-md bg-[var(--bg-hover)] px-3 py-2 text-[color:var(--text-secondary)] border border-[color:var(--panel-border)]/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-[color:var(--text-primary)]">{n.title || 'Notification'}</div>
                    <div className="text-xs text-[color:var(--text-muted)]">{n.message}</div>
                    {n.amount ? <div className="text-xs font-semibold mt-1">{formatCurrency(n.amount)}</div> : null}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${notificationBadgeClass(n.type)}`}>
                    {n.type === 'warning' ? 'High' : n.type === 'info' ? 'Info' : 'Normal'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="⏳ Upcoming Maturities">
        {upcomingMaturities.length === 0 ? (
          <EmptyPanel icon="⏳" message="No upcoming maturities" compact />
        ) : (
          <ul className="space-y-2 text-sm">
            {upcomingMaturities.map((m) => (
              <li key={`maturity-${m.id}`} className="rounded-md bg-[var(--bg-hover)] px-3 py-2 text-[color:var(--text-secondary)]">
                <div className="font-medium text-[color:var(--text-primary)]">{m.asset}</div>
                <div className="text-xs text-[color:var(--text-muted)]">{m.date}</div>
                <div className="text-xs font-semibold text-[color:var(--text-secondary)]">{formatCurrency(m.amount)}</div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Pending Approvals">
        {pendingApprovals.length === 0 ? (
          <EmptyPanel icon="✅" message="No pending approvals" subtitle="Approval queue is clear" compact />
        ) : (
          <ul className="space-y-2 text-sm">
            {pendingApprovals.map((p) => (
              <li key={`approval-${p.id}`} className="rounded-md bg-[var(--bg-hover)] px-3 py-2 text-[color:var(--text-secondary)]">
                <div className="font-medium text-[color:var(--text-primary)]">Transaction #{String(p.transactionId).slice(0, 8)}</div>
                <div className="text-xs font-semibold">{formatCurrency(p.amount)}</div>
                <div className="text-xs text-[color:var(--text-muted)]">{p.note}</div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>

    <SectionCard title="Recent Transactions" action="View All" actionHref="/transactions">
      <QuickTransactionTable transactions={recentTransactions} />
    </SectionCard>
  </>
)

const ConsolidatedView = ({ totalPortfolioValue, portfolioMeta, companyBreakdown, ranking, isDark }) => (
  <>
    <SectionCard title="Total Portfolio Value">
      <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[var(--panel-strong)] px-5 py-5 space-y-2.5">
        <div className="text-3xl font-bold text-[color:var(--text-primary)]">{formatCurrency(totalPortfolioValue)}</div>
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          <span className={`${String(portfolioMeta.monthlyChange).startsWith('-') ? 'text-rose-500' : 'text-emerald-500'} font-semibold tracking-tight`}>
            {String(portfolioMeta.monthlyChange).startsWith('-') ? '↓' : '↑'} {portfolioMeta.monthlyChange} this month
          </span>
          <span className="text-[color:var(--text-muted)]">{portfolioMeta.companyCount} Companies</span>
          <span className="text-[color:var(--text-muted)]">{portfolioMeta.investmentCount} Investments</span>
        </div>
      </div>
    </SectionCard>

    <CompanyComparisonChart data={companyBreakdown} isDark={isDark} />

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <SectionCard title="Performance Ranking (ROI)">
        <RankingList ranking={ranking} />
      </SectionCard>

      <SectionCard title="Company Allocation Split">
        <CompanyAllocationBreakdown data={companyBreakdown} />
      </SectionCard>
    </div>
  </>
)

const SectionCard = ({ title, action, actionHref, onAction, children }) => (
  <section className="overflow-hidden rounded-xl sm:rounded-2xl border border-[color:var(--panel-border)] bg-[linear-gradient(180deg,var(--bg-card),var(--bg-base))] shadow-[0_14px_34px_-26px_rgba(15,23,42,0.5)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_-26px_rgba(15,23,42,0.56)]">
    {(title || action) && (
      <div className="flex items-center justify-between border-b border-[color:var(--panel-border)] px-4 sm:px-5 py-3 bg-[var(--bg-card)]/55 backdrop-blur">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-primary)]">{title}</h3>
        {action ? (
          actionHref ? (
            <Link to={actionHref} className="text-[11px] font-semibold text-[#2563eb] hover:underline">
              {action}
            </Link>
          ) : (
            <button className="text-[11px] font-semibold text-[#2563eb] hover:underline" onClick={onAction}>
              {action}
            </button>
          )
        ) : (
          <span />
        )}
      </div>
    )}
    <div className="p-4 sm:p-5">{children}</div>
  </section>
)

const AssetAllocation = ({ allocationData, allocationTotal, isDark }) => {
  const colors = allocationData.map((entry, idx) => ASSET_THEME_COLORS[entry.name] || CHART_COLORS[idx % CHART_COLORS.length])
  const data = Array.isArray(allocationData) ? allocationData : []
  const total = allocationTotal || data.reduce((s, d) => s + Number(d.value || 0), 0)

  if (data.length === 0) {
    return (
      <SectionCard title="Asset Allocation">
        <EmptyPanel icon="📊" message="No asset allocation data yet" subtitle="Add investments to visualize allocation" compact={false} />
      </SectionCard>
    )
  }

  return (
    <div className="rounded-[18px] sm:rounded-[20px] border border-[color:var(--panel-border)] bg-[var(--bg-card)] p-4 sm:p-5 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.55)] transition duration-300 ease-in-out hover:-translate-y-0.5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-[18px] font-bold tracking-tight text-[color:var(--text-primary)]">Asset Allocation</h3>
          <p className="text-[12px] text-[color:var(--text-muted)]">Portfolio mix by asset class</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,280px)_1fr] gap-4 items-center">
        <div className="h-[220px] sm:h-[280px] drop-shadow-[0_10px_25px_rgba(59,130,246,0.28)]">
          <ResponsiveContainer>
            <PieChart>
              <defs>
                <radialGradient id="donutGlow" cx="50%" cy="50%" r="70%">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
                </radialGradient>
              </defs>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={90}
                outerRadius={125}
                paddingAngle={2}
                stroke="none"
                startAngle={90}
                endAngle={450}
              >
                {data.map((entry, index) => (
                  <Cell key={`asset-${entry.name}-${index}`} fill={colors[index % colors.length]} className="transition-transform duration-300 ease-in-out" />
                ))}
                <Label
                  position="center"
                  content={({ viewBox }) => {
                    const { cx, cy } = viewBox
                    return (
                      <g>
                        <text x={cx} y={cy - 4} textAnchor="middle" fill={isDark ? '#f8fafc' : '#0f172a'} className="text-[28px] font-bold">
                          {formatCurrency(total)}
                        </text>
                        <text x={cx} y={cy + 16} textAnchor="middle" fill={isDark ? '#94a3b8' : '#64748b'} className="text-[12px] font-semibold">
                          Total investment
                        </text>
                      </g>
                    )
                  }}
                />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="grid grid-cols-1 gap-2 text-sm">
          {data.map((entry, index) => (
            <li key={`legend-${entry.name}-${index}`} className="flex items-center justify-between rounded-xl border border-[color:var(--panel-border)] bg-[var(--bg-hover)] px-3 py-2.5 text-[color:var(--text-secondary)]">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                <span className="font-semibold text-[color:var(--text-primary)]">{entry.name}</span>
              </div>
              <div className="text-right space-y-0.5">
                <div className="font-bold text-[color:var(--text-primary)]">{formatCurrency(entry.value)}</div>
                <div className="text-[11px] text-[color:var(--text-muted)]">{formatPercentAbs((entry.value / (total || 1)) * 100)} allocation</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const CompanyComparisonChart = ({ data, isDark }) => {
  const chartData = (data && data.length ? data : []).map((c) => ({
    name: c.companyName || c.name,
    value: Number(c.totalPortfolioValue ?? c.totalInvestment ?? c.value ?? 0)
  })).filter((item) => item.name && item.value > 0)

  if (chartData.length === 0) {
    return (
      <SectionCard title="Company Comparison">
        <EmptyPanel icon="🏢" message="No company comparison data yet" subtitle="Add company transactions to compare portfolio values" compact={false} />
      </SectionCard>
    )
  }

  const axisColor = 'rgba(255,255,255,0.65)'
  const axisLine = 'rgba(255,255,255,0.08)'
  const formatShortCurrency = (value) => {
    const n = Number(value || 0)
    if (Math.abs(n) >= 1000000) return `Br ${(n / 1000000).toFixed(1)}M`
    if (Math.abs(n) >= 1000) return `Br ${(n / 1000).toFixed(0)}K`
    return formatCurrency(n)
  }

  return (
    <div className="rounded-[18px] sm:rounded-[20px] border border-[color:var(--panel-border)] bg-[var(--bg-card)] p-4 sm:p-5 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.55)] transition duration-300 ease-in-out hover:-translate-y-0.5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[18px] font-bold tracking-tight text-[color:var(--text-primary)]">Company Comparison</h3>
          <p className="text-[12px] text-[color:var(--text-muted)]">Portfolio value by company</p>
        </div>
      </div>

      <div className="h-[250px] sm:h-[320px] drop-shadow-[0_10px_25px_rgba(59,130,246,0.28)]">
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 10, right: 14, left: 8, bottom: 24 }} barCategoryGap="22%">
            <defs>
              <linearGradient id="companyBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            <YAxis
              type="number"
              stroke={axisLine}
              tick={{ fill: axisColor, fontSize: 12 }}
              tickFormatter={formatAxisShort}
              tickLine={false}
              axisLine={{ stroke: axisLine }}
            />
            <XAxis
              dataKey="name"
              stroke={axisLine}
              tick={{ fill: axisColor, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: axisLine }}
              interval={0}
              angle={-12}
              textAnchor="end"
              height={52}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#0f172a' : '#0f172a',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12,
                color: '#e2e8f0'
              }}
              formatter={(v, _, item) => [formatCurrency(v), item?.payload?.name]}
            />
            <Bar
              dataKey="value"
              fill="url(#companyBar)"
              radius={[8, 8, 8, 8]}
              animationDuration={800}
              animationEasing="ease-out"
              cursor={{ fill: 'transparent' }}
              activeBar={{
                style: {
                  filter: 'drop-shadow(0 8px 18px rgba(59,130,246,0.45))',
                  transform: 'scale(1.02)',
                  transformOrigin: 'bottom'
                }
              }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${entry.name}-${index}`} className="transition-transform duration-300 ease-out" />
              ))}
              <LabelList dataKey="value" position="top" formatter={formatShortCurrency} fill="#e2e8f0" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const InvestmentGrowth = ({ data, isDark }) => {
  const [range, setRange] = useState('6M')
  const normalizeMonth = (value, idx) => {
    if (value?.month) return value.month
    if (value?.date) return formatMonth(value.date)
    return `M${idx + 1}`
  }
  const series = data && data.length >= 1
    ? data.map((d, idx) => ({ month: normalizeMonth(d, idx), amount: Number(d.amount || 0) }))
    : []

  const filtered = useMemo(() => {
    if (series.length === 0) return []
    const map = {
      '3M': 3,
      '6M': 6,
      YTD: Math.min(series.length, 6),
      '1Y': series.length
    }
    const take = map[range] || series.length
    return series.slice(-take)
  }, [range, series])

  if (filtered.length === 0) {
    return (
      <SectionCard title="Investment Growth">
        <EmptyPanel icon="📈" message="No growth data yet" subtitle="Completed transactions will appear as a trend line" compact={false} />
      </SectionCard>
    )
  }

  const first = filtered[0]
  const lastPoint = filtered[filtered.length - 1]
  const current = Number(lastPoint?.amount || 0)
  const base = Number(first?.amount || 0)
  const growth = current - base
  const returnPct = base > 0 ? (growth / base) * 100 : 0

  return (
    <div className="rounded-[18px] sm:rounded-[20px] border border-[color:var(--panel-border)] bg-[var(--bg-card)] p-4 sm:p-5 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.55)] transition duration-300 ease-in-out hover:-translate-y-0.5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-[18px] font-bold tracking-tight text-[color:var(--text-primary)]">Investment Growth</h3>
          <p className="text-[12px] text-[color:var(--text-muted)]">Performance over time</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[color:var(--panel-border)] bg-[var(--bg-hover)] p-1">
          {['3M', '6M', 'YTD', '1Y'].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`filter-btn px-3 py-1 text-xs font-semibold rounded-full transition duration-300 ${range === r ? 'bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] text-white shadow-[0_0_15px_rgba(59,130,246,0.6)]' : 'bg-[var(--bg-hover)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[230px] sm:h-[280px] drop-shadow-[0_10px_25px_rgba(59,130,246,0.28)]">
        <ResponsiveContainer>
          <AreaChart data={filtered} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="growthArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                <stop offset="90%" stopColor="#0f172a" stopOpacity={0.04} />
              </linearGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke={isDark ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.3)'} vertical={false} />
            <XAxis dataKey="month" stroke={isDark ? '#e2e8f0' : '#334155'} tickLine={false} axisLine={false} tickMargin={10} />
            <YAxis stroke={isDark ? '#e2e8f0' : '#334155'} tickFormatter={formatAxisCurrencyShort} tickLine={false} axisLine={false} tickMargin={10} />
            <Tooltip contentStyle={tooltipStyle(isDark)} formatter={(value) => [formatCurrency(value), 'Portfolio value']} />
            <Area type="monotone" dataKey="amount" stroke="#38bdf8" strokeWidth={3} fill="url(#growthArea)" filter="url(#glow)" dot={false} activeDot={false} />
            {/* Removed last point marker */}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <StatPill label="Current Value" value={formatCurrency(current)} tone="neutral" />
        <StatPill label="Growth" value={`${growth >= 0 ? '+' : '-'}${formatCurrency(Math.abs(growth))}`} tone={growth >= 0 ? 'positive' : 'negative'} />
        <StatPill label="Return" value={`${returnPct >= 0 ? '+' : '-'}${Math.abs(returnPct).toFixed(1)}%`} tone={returnPct >= 0 ? 'positive' : 'negative'} />
      </div>
    </div>
  )
}

const MetricCard = ({ icon, tone, title, value, change, sparkline, toneColor, trendValue = 0, badge = null }) => {
  const trend = String(change || '').trim()
  const negative = Number(trendValue) < 0 || String(change || '').includes('-')
  const positive = !negative && Number(trendValue) > 0
  const toneClass = negative ? 'text-rose-600' : positive ? 'text-emerald-600' : 'text-[color:var(--text-muted)]'
  const trendIcon = negative ? '▼' : positive ? '▲' : '•'
  const iconTone = {
    blue: 'bg-blue-500/15 text-blue-600 border-blue-500/25',
    green: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/25',
    violet: 'bg-violet-500/15 text-violet-600 border-violet-500/25'
  }

  return (
    <div className="elevated-card min-h-[176px] sm:min-h-[216px] px-4 sm:px-5 py-4 sm:py-[18px]">
      <div className="flex items-center gap-3">
        {/* Icon removed as requested */}
        <div className="text-[12px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">{title}</div>
      </div>
      <div className="mt-2.5 text-[24px] sm:text-[29px] leading-none font-extrabold tracking-tight text-[color:var(--text-primary)]">{value}</div>
      <div className={`mt-2.5 text-[11px] font-semibold ${toneClass}`}></div>
      {badge && <div className="mt-2 inline-flex rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-600">🔔 {badge}</div>}
      {/* Sparkline removed as requested */}
    </div>
  )
}

const Sparkline = ({ data, color = '#4F46E5' }) => {
  if (!Array.isArray(data) || data.length < 2) return null
  const w = 160
  const h = 48
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full h-12" preserveAspectRatio="none">
      <polyline fill="none" stroke={`${color}33`} strokeWidth="6" points={points} strokeLinecap="round" />
      <polyline fill="none" stroke={color} strokeWidth="3" points={points} strokeLinecap="round" />
      {/* Removed dot, triangle, and marker */}
    </svg>
  )
}

const StatPill = ({ label, value, tone = 'neutral' }) => {
  const tones = {
    neutral: 'text-[color:var(--text-primary)] bg-[var(--bg-hover)] border-[color:var(--panel-border)]',
    positive: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    negative: 'text-rose-300 bg-rose-500/10 border-rose-500/30'
  }

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${tones[tone] || tones.neutral}`}>
      <div className="text-[12px] uppercase tracking-wide text-[color:var(--text-muted)]">{label}</div>
      <div className="text-[18px] text-[color:var(--text-primary)]">{value}</div>
    </div>
  )
}

const TransactionList = ({ transactions }) => {
  if (transactions.length === 0) return <EmptyPanel message="No transactions yet" compact />

  return (
    <ul className="space-y-2.5 text-sm text-[color:var(--text-secondary)]">
      {transactions.map((t) => (
        <li key={t.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-transparent hover:border-[color:var(--panel-border)] px-2.5 py-2 hover:bg-[var(--bg-hover)] transition-colors">
          <span>
            {formatDate(t.transactionDate)} {toTitle(t.transactionType)}
          </span>
          <span className="font-semibold text-[color:var(--text-primary)]">{compactCurrency(t.amount)}</span>
        </li>
      ))}
    </ul>
  )
}

const QuickTransactionTable = ({ transactions }) => {
  const rows = transactions.length > 0 ? transactions.slice(0, 5) : []

  if (rows.length === 0) return <EmptyPanel message="No recent transactions" subtitle="Transactions will appear here once recorded" compact />

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] table-fixed text-[12.5px]">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
          <th className="pb-2 font-semibold">Date</th>
          <th className="pb-2 font-semibold">Type</th>
          <th className="pb-2 font-semibold">Company</th>
          <th className="pb-2 font-semibold text-right">Amount</th>
          <th className="pb-2 font-semibold">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => (
          <tr key={t.id} className="border-t border-[color:var(--panel-border)] text-[color:var(--text-secondary)] hover:bg-[var(--bg-hover)]">
            <td className="py-2 pr-3 whitespace-nowrap">{formatDate(t.transactionDate || t.date)}</td>
            <td className="py-2 pr-3 whitespace-nowrap">{toTitle(t.transactionType || t.type)}</td>
            <td className="py-2 pr-3 truncate">{t.companyName || '-'}</td>
            <td className="py-2 pr-3 whitespace-nowrap text-right font-semibold text-[color:var(--text-primary)]">{formatCurrency(t.amount)}</td>
            <td className="py-2"><StatusBadge status={t.status} /></td>
          </tr>
        ))}
      </tbody>
      </table>
    </div>
  )
}

const StatusBadge = ({ status }) => {
  const normalized = String(status || 'completed').toLowerCase()
  const map = {
    completed: 'bg-emerald-500/12 text-emerald-600 border-emerald-500/30',
    pending: 'bg-amber-500/12 text-amber-600 border-amber-500/30',
    approved: 'bg-sky-500/12 text-sky-600 border-sky-500/30',
    rejected: 'bg-rose-500/12 text-rose-600 border-rose-500/30'
  }
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${map[normalized] || map.completed}`}>{toTitle(normalized)}</span>
}

const RankingList = ({ ranking }) => {
  if (ranking.length === 0) return <EmptyPanel message="No ranking data" compact />

  const maxRoi = Math.max(...ranking.map((r) => Number(r.roi || 0)), 1)

  return (
    <ul className="space-y-3">
      {ranking.slice(0, 5).map((r, idx) => (
        <li key={r.companyId || idx} className="space-y-1.5 border-b border-[color:var(--panel-border)] pb-3 last:border-b-0 last:pb-0">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <span className="text-sm font-semibold text-[color:var(--text-muted)]">{idx + 1}.</span>
            <span className="text-sm font-semibold text-[color:var(--text-primary)]">{r.companyName}</span>
            <span className="text-sm font-semibold text-[color:var(--text-primary)]">{formatPercent(r.roi)}</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[#3B82F6] to-[#6366F1]" style={{ width: `${Math.max(6, (Number(r.roi || 0) / maxRoi) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

const RankingInsight = ({ ranking }) => {
  if (ranking.length === 0) return <EmptyPanel message="No analytics data" compact />

  const maxTrend = Math.max(...ranking.map((r) => Math.abs(Number(r.trend || 0))), 1)

  return (
    <ul className="space-y-3">
      {ranking.slice(0, 5).map((r, idx) => {
        const up = r.trend >= 0
        return (
          <li key={`${r.companyId || idx}-insight`} className="space-y-1.5 border-b border-[color:var(--panel-border)] pb-3 last:border-b-0 last:pb-0">
            <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3">
              <span className="text-sm font-semibold text-[color:var(--text-muted)]">{idx + 1}.</span>
              <span className="text-sm font-semibold text-[color:var(--text-primary)]">{r.companyName}</span>
              <span className="text-sm text-[color:var(--text-primary)]">{formatPercent(r.roi)}</span>
              <span className={`text-xs font-semibold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
                {up ? '▲' : '▼'} {Math.abs(r.trend).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden">
              <div
                className={`h-full rounded-full ${up ? 'bg-emerald-500/80' : 'bg-rose-500/80'}`}
                style={{ width: `${Math.max(6, (Math.abs(Number(r.trend || 0)) / maxTrend) * 100)}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

const CompanyAllocationBreakdown = ({ data }) => {
  if (!Array.isArray(data) || data.length === 0) return <EmptyPanel message="No company allocation data" compact />
  const total = data.reduce((sum, c) => sum + Number(c.totalPortfolioValue || c.totalInvestment || 0), 0)
  return (
    <ul className="space-y-3">
      {data.slice(0, 5).map((c, idx) => {
        const value = Number(c.totalPortfolioValue || c.totalInvestment || 0)
        const share = total > 0 ? (value / total) * 100 : 0
        return (
          <li key={`${c.companyId || idx}-split`} className="space-y-1.5 border-b border-[color:var(--panel-border)] pb-3 last:border-b-0 last:pb-0">
            <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
              <span className="text-sm font-semibold text-[color:var(--text-primary)]">{c.companyName}</span>
              <span className="text-sm font-semibold text-[color:var(--text-primary)]">{formatCurrency(value)}</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#22C55E] to-[#3B82F6]" style={{ width: `${Math.max(6, share)}%` }} />
            </div>
            <div className="text-xs text-[color:var(--text-muted)]">{share.toFixed(1)}% share</div>
          </li>
        )
      })}
    </ul>
  )
}

const EmptyPanel = ({ icon, message, subtitle, compact = false }) => (
  <div className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-[color:var(--panel-border)] bg-[var(--bg-hover)] text-[color:var(--text-muted)] ${compact ? 'h-20' : 'h-52'}`}>
    {icon && <div className="text-2xl mb-1">{icon}</div>}
    <div className="font-medium text-center">{message}</div>
    {subtitle && <div className="text-xs mt-1 text-center">{subtitle}</div>}
  </div>
)

const withPercent = (value, fallback) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return fallback
  const num = Number(value)
  return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`
}

const deriveTrend = (series = []) => {
  if (!Array.isArray(series) || series.length < 2) return 0
  const prev = Number(series[series.length - 2] || 0)
  const curr = Number(series[series.length - 1] || 0)
  if (!Number.isFinite(prev) || !Number.isFinite(curr)) return 0
  if (prev === 0) return curr > 0 ? 100 : curr < 0 ? -100 : 0
  return ((curr - prev) / Math.abs(prev)) * 100
}

const orderAssetTypes = (rows = []) => {
  const order = { Savings: 0, Bonds: 1, Shares: 2 }
  return [...rows].sort((a, b) => {
    const av = order[a.name] ?? 99
    const bv = order[b.name] ?? 99
    if (av !== bv) return av - bv
    return Number(b.value || 0) - Number(a.value || 0)
  })
}

const withCoreAssetTypes = (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) return []
  const core = ['Savings', 'Bonds', 'Shares']
  const map = rows.reduce((acc, row) => {
    acc[row.name] = (acc[row.name] || 0) + Number(row.value || 0)
    return acc
  }, {})
  core.forEach((name) => {
    if (map[name] === undefined) map[name] = 0
  })
  return orderAssetTypes(Object.entries(map).map(([name, value]) => ({ name, value })))
}

const compactCurrency = (value) => {
  const amount = Number(value || 0)
  if (amount >= 1000000) return `Br ${(amount / 1000000).toFixed(1)}M`
  if (amount >= 1000) return `Br ${(amount / 1000).toFixed(0)}K`
  return formatCurrency(amount)
}

const formatCurrency = (value) => `Br ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(value || 0))}`
const formatSignedCurrency = (value) => {
  const amount = Number(value || 0)
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : ''
  return `Br ${sign}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.abs(amount))}`
}
const formatNumber = (value) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(value || 0))
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`
const formatPercentAbs = (value) => `${Math.abs(Number(value || 0)).toFixed(1)}%`
const formatMonth = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 3)
  return date.toLocaleDateString('en-US', { month: 'short' })
}
const formatAxisShort = (value) => {
  const amount = Number(value || 0)
  if (Math.abs(amount) >= 1000000) {
    const inM = amount / 1000000
    return `${Number.isInteger(inM) ? inM : inM.toFixed(1)}M`
  }
  if (Math.abs(amount) >= 1000) return `${Math.round(amount / 1000)}K`
  return `${amount}`
}
const formatAxisCurrencyShort = (value) => {
  const amount = Number(value || 0)
  if (Math.abs(amount) >= 1000000) {
    const inM = amount / 1000000
    return `Br ${Number.isInteger(inM) ? inM : inM.toFixed(1)}M`
  }
  if (Math.abs(amount) >= 1000) return `Br ${(amount / 1000).toFixed(0)}K`
  return `Br ${amount}`
}
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-')
const toTitle = (value = '') => String(value).replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
const daysUntil = (value) => {
  if (!value) return 0
  const now = new Date()
  const target = new Date(value)
  if (Number.isNaN(target.getTime())) return 0
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

const notificationBadgeClass = (type) => {
  if (type === 'warning') return 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
  if (type === 'info') return 'bg-sky-500/15 text-sky-600 border border-sky-500/30'
  return 'bg-slate-500/15 text-slate-600 border border-slate-500/30'
}

const trendFromCashflow = (cashflow) => {
  if (!Array.isArray(cashflow) || cashflow.length < 2) return 0
  const prev = Number(cashflow[cashflow.length - 2]?.amount || 0)
  const curr = Number(cashflow[cashflow.length - 1]?.amount || 0)
  if (prev === 0) return curr > 0 ? 1 : 0
  return ((curr - prev) / Math.abs(prev)) * 100
}

const tooltipStyle = (isDark) => ({
  backgroundColor: isDark ? '#0f172a' : '#ffffff',
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(148,163,184,0.35)'}`,
  borderRadius: 8,
  color: isDark ? '#f8fafc' : '#0f172a'
})

const CompanyTooltip = ({ active, payload, label, isDark }) => {
  if (!active || !payload || !payload.length) return null
  const value = payload[0]?.value || 0
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.4)'}`,
        boxShadow: '0 10px 28px rgba(15,23,42,0.18)'
      }}
    >
      <div className="text-sm font-semibold text-[color:var(--text-primary)]">{label}</div>
      <div className="text-sm text-[color:var(--text-secondary)] mt-1">Investment: {formatCurrency(value)}</div>
    </div>
  )
}

export default DashboardPage
