import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import dayjs from 'dayjs'
import api from '../utils/api.js'

const PERIODS = [
  { value: 'current', label: 'Current Month' },
  { value: 'last', label: 'Last Month' },
  { value: 'quarter', label: 'Quarter to Date' },
  { value: 'year', label: 'Year to Date' }
]

const INCOME_TYPES = new Set(['interest', 'dividend', 'sell', 'gain'])
const EXPENSE_TYPES = new Set(['buy', 'expense'])

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    maximumFractionDigits: 0
  }).format(Number(amount || 0))

const formatDate = (value) => dayjs(value).format('D MMM YYYY')

const periodUnit = (period) => {
  if (period === 'quarter') return 'quarter'
  if (period === 'year') return 'year'
  return 'month'
}

const periodStartEnd = (period, comparison = false) => {
  const shift = comparison ? 1 : 0
  const base = dayjs()

  if (period === 'current' || period === 'last') {
    const offset = period === 'current' ? shift : shift + 1
    const date = base.subtract(offset, 'month')
    return { start: date.startOf('month'), end: date.endOf('month') }
  }

  const unit = periodUnit(period)
  const date = base.subtract(shift, unit)
  return { start: date.startOf(unit), end: date.endOf(unit) }
}

const inRange = (value, range) => {
  if (!value) return false
  const date = dayjs(value)
  return date.isAfter(range.start.subtract(1, 'millisecond')) && date.isBefore(range.end.add(1, 'millisecond'))
}

const toTitle = (value) =>
  String(value || '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())

const buildRows = (transactions) => {
  const buckets = new Map()

  transactions.forEach((transaction) => {
    const type = String(transaction.transactionType || '').toLowerCase()
    const amount = Number(transaction.amount || 0)
    const section = INCOME_TYPES.has(type) ? 'income' : EXPENSE_TYPES.has(type) ? 'expense' : 'other'
    const key = `${section}:${type || 'other'}`
    const current = buckets.get(key) || {
      id: key,
      section,
      type: type || 'other',
      label: toTitle(type || 'Other'),
      amount: 0,
      count: 0,
      latestDate: transaction.date || transaction.createdAt,
      examples: []
    }

    current.amount += amount
    current.count += 1
    current.latestDate = current.latestDate && dayjs(current.latestDate).isAfter(dayjs(transaction.date || transaction.createdAt)) ? current.latestDate : (transaction.date || transaction.createdAt)
    if (current.examples.length < 3 && transaction.description) current.examples.push(transaction.description)
    buckets.set(key, current)
  })

  const rows = [...buckets.values()]
    .filter((row) => row.section !== 'other')
    .sort((a, b) => b.amount - a.amount)

  const incomeRows = rows.filter((row) => row.section === 'income')
  const expenseRows = rows.filter((row) => row.section === 'expense')

  const incomeTotal = incomeRows.reduce((sum, row) => sum + row.amount, 0)
  const expenseTotal = expenseRows.reduce((sum, row) => sum + row.amount, 0)
  const netProfit = incomeTotal - expenseTotal

  return { incomeRows, expenseRows, incomeTotal, expenseTotal, netProfit }
}

const exportCsv = (rows, totals, companyName, periodLabel) => {
  const header = ['Section', 'Type', 'Amount', 'Count', 'Latest Date', 'Notes']
  const csv = [header.join(',')]

  rows.forEach((row) => {
    csv.push([
      row.section,
      row.label,
      row.amount,
      row.count,
      row.latestDate ? dayjs(row.latestDate).format('YYYY-MM-DD') : '',
      String(row.examples.join(' | ')).replace(/"/g, '""')
    ].join(','))
  })

  csv.push(['Totals', 'Revenue', totals.incomeTotal, '', '', ''].join(','))
  csv.push(['Totals', 'Expenses', totals.expenseTotal, '', '', ''].join(','))
  csv.push(['Totals', 'Net Profit', totals.netProfit, '', '', ''].join(','))

  const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${companyName || 'pnl'}-${periodLabel.toLowerCase().replace(/\s+/g, '-')}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function ProfitLossReportPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { list: companies, active } = useSelector((state) => state.company)

  const initialCompanyId = searchParams.get('companyId') || location.state?.companyId || active || companies[0]?.id || ''
  const initialPeriod = searchParams.get('period') || location.state?.period || 'current'

  const [companyId, setCompanyId] = useState(initialCompanyId)
  const [period, setPeriod] = useState(initialPeriod)
  const [compareEnabled, setCompareEnabled] = useState(true)
  const [summary, setSummary] = useState(location.state?.summary || null)
  const [transactions, setTransactions] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    const nextCompanyId = searchParams.get('companyId') || location.state?.companyId || active || companies[0]?.id || ''
    if (nextCompanyId && nextCompanyId !== companyId) setCompanyId(nextCompanyId)
  }, [active, companyId, companies, location.state, searchParams])

  useEffect(() => {
    const nextPeriod = searchParams.get('period') || location.state?.period || 'current'
    if (nextPeriod !== period) setPeriod(nextPeriod)
  }, [location.state, period, searchParams])

  useEffect(() => {
    if (!companyId) return

    let cancelled = false
    const loadData = async () => {
      setLoading(true)
      setError('')

      const params = { companyId }
      const requests = await Promise.allSettled([
        api.get('/reports/summary', { params }),
        api.get('/transactions', { params }),
        api.get('/transactions/metrics', { params })
      ])

      if (cancelled) return

      const [summaryResult, transactionsResult, metricsResult] = requests

      if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value.data)
      if (transactionsResult.status === 'fulfilled') {
        setTransactions(Array.isArray(transactionsResult.value.data) ? transactionsResult.value.data : [])
      }
      if (metricsResult.status === 'fulfilled') setMetrics(metricsResult.value.data)

      const failureMessage = [summaryResult, transactionsResult, metricsResult]
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason?.response?.data?.message || result.reason?.message)
        .filter(Boolean)
        .join(' • ')

      if (transactionsResult.status === 'rejected') {
        setError(failureMessage || 'Failed to load profit and loss data')
      }

      setLoading(false)
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [companyId])

  const companyName = companies.find((company) => company.id === companyId)?.name || location.state?.companyName || 'Selected company'
  const periodLabel = PERIODS.find((item) => item.value === period)?.label || 'Current Month'

  const currentRange = useMemo(() => periodStartEnd(period, false), [period])
  const comparisonRange = useMemo(() => periodStartEnd(period, true), [period])

  const currentTransactions = useMemo(
    () => transactions.filter((transaction) => inRange(transaction.date || transaction.createdAt, currentRange)),
    [currentRange, transactions]
  )

  const comparisonTransactions = useMemo(
    () => transactions.filter((transaction) => inRange(transaction.date || transaction.createdAt, comparisonRange)),
    [comparisonRange, transactions]
  )

  const statement = useMemo(() => buildRows(currentTransactions), [currentTransactions])
  const comparisonStatement = useMemo(() => buildRows(comparisonTransactions), [comparisonTransactions])

  const recentTransactions = useMemo(
    () => [...currentTransactions]
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
      .slice(0, 10),
    [currentTransactions]
  )

  const netMargin = statement.incomeTotal > 0 ? (statement.netProfit / statement.incomeTotal) * 100 : 0
  const revenueToExpense = statement.expenseTotal > 0 ? statement.incomeTotal / statement.expenseTotal : 0

  const compareCards = compareEnabled
    ? [
        {
          label: 'Current revenue',
          value: formatCurrency(statement.incomeTotal),
          hint: `${statement.incomeRows.length} live income lines`
        },
        {
          label: 'Previous revenue',
          value: formatCurrency(comparisonStatement.incomeTotal),
          hint: `${comparisonStatement.incomeRows.length} lines in the comparison period`
        },
        {
          label: 'Current net profit',
          value: formatCurrency(statement.netProfit),
          hint: `${netMargin.toFixed(1)}% net margin`
        },
        {
          label: 'Previous net profit',
          value: formatCurrency(comparisonStatement.netProfit),
          hint: `${comparisonStatement.expenseRows.length} expense lines previously`
        }
      ]
    : []

  const handleCopySummary = async () => {
    const message = `${companyName} ${periodLabel} P&L: revenue ${formatCurrency(statement.incomeTotal)}, expenses ${formatCurrency(statement.expenseTotal)}, net ${formatCurrency(statement.netProfit)}.`
    try {
      await navigator.clipboard.writeText(message)
      setStatusMsg('Summary copied to clipboard.')
    } catch {
      setStatusMsg(message)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleBackToReports = () => {
    navigate('/reports')
  }

  const handleDownload = () => {
    const rows = [
      ...statement.incomeRows.map((row) => ({ ...row, section: 'Income' })),
      ...statement.expenseRows.map((row) => ({ ...row, section: 'Expense' }))
    ]
    exportCsv(rows, statement, companyName, periodLabel)
    setStatusMsg('CSV export generated from live transactions.')
  }

  if (!companyId) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        Select a company to load the live Profit and Loss statement.
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10 text-slate-800 transition-colors duration-300 dark:text-slate-100">
      <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-[0_24px_70px_rgba(15,23,42,0.28)] dark:border-slate-800/70">
        <div className="relative px-6 py-7 sm:px-8 lg:px-10 lg:py-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.14),transparent_26%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
                Live Financial Statement
              </span>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Profit and Loss</h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  This statement is built from actual transaction rows, not placeholder data.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-200/90">
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Company: {companyName}</span>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Period: {periodLabel}</span>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Updated {dayjs().format('D MMM YYYY')}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[28rem]">
              <button type="button" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-left backdrop-blur transition hover:bg-white/15" onClick={handleBackToReports}>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Back</div>
                <div className="mt-1 text-sm font-semibold">To reports</div>
              </button>
              <button type="button" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-left backdrop-blur transition hover:bg-white/15" onClick={handleDownload}>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Export</div>
                <div className="mt-1 text-sm font-semibold">CSV download</div>
              </button>
              <button type="button" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-left backdrop-blur transition hover:bg-white/15" onClick={handlePrint}>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Print</div>
                <div className="mt-1 text-sm font-semibold">Statement view</div>
              </button>
              <button type="button" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-left backdrop-blur transition hover:bg-white/15" onClick={handleCopySummary}>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Share</div>
                <div className="mt-1 text-sm font-semibold">Copy summary</div>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Revenue" value={formatCurrency(statement.incomeTotal)} subtitle="Income from live transactions" />
        <MetricCard title="Expenses" value={formatCurrency(statement.expenseTotal)} subtitle="Expense rows in the selected period" />
        <MetricCard title="Net Profit" value={formatCurrency(statement.netProfit)} subtitle={`Net margin ${netMargin.toFixed(1)}%`} />
        <MetricCard title="Revenue / Expense" value={revenueToExpense ? revenueToExpense.toFixed(2) : '0.00'} subtitle="Coverage ratio from actual rows" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
        <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] dark:border-slate-800/70 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Statement controls</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Change the company or reporting period and the statement will refresh from live rows.</p>
            </div>
            <button
              type="button"
              onClick={() => setCompareEnabled((value) => !value)}
              className="rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {compareEnabled ? 'Comparison on' : 'Comparison off'}
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Company</span>
              <select
                value={companyId}
                onChange={(event) => setCompanyId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:bg-slate-900"
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Period</span>
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:bg-slate-900"
              >
                {PERIODS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/60">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Selected window</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                {formatDate(currentRange.start)} - {formatDate(currentRange.end)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Derived from live transaction dates</div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.8fr)]">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Income rows</h3>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {statement.incomeRows.length} categories
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {statement.incomeRows.length > 0 ? statement.incomeRows.map((row) => (
                  <StatementRow key={row.id} row={row} tone="income" />
                )) : (
                  <EmptyRow message="No income rows were found in the selected window." />
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950/50">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Comparison</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <KeyValue label="Current revenue" value={formatCurrency(statement.incomeTotal)} />
                <KeyValue label="Previous revenue" value={formatCurrency(comparisonStatement.incomeTotal)} />
                <KeyValue label="Current expenses" value={formatCurrency(statement.expenseTotal)} />
                <KeyValue label="Previous expenses" value={formatCurrency(comparisonStatement.expenseTotal)} />
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-500/20 dark:bg-sky-500/10">
                  <dt className="text-sky-700 dark:text-sky-300">Net profit</dt>
                  <dd className="font-semibold text-sky-800 dark:text-sky-200">{formatCurrency(statement.netProfit)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <article className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] dark:border-slate-800/70 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Expense rows</h2>
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Live costs</span>
            </div>
            <div className="mt-4 space-y-3">
              {statement.expenseRows.length > 0 ? statement.expenseRows.map((row) => (
                <StatementRow key={row.id} row={row} tone="expense" />
              )) : (
                <EmptyRow message="No expense rows were found in the selected window." />
              )}
            </div>
          </article>

          <article className="rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-[0_16px_40px_rgba(15,23,42,0.16)] dark:border-slate-800/70">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-slate-300">Metrics from API</div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Total amount: {formatCurrency(metrics?.totalAmount || 0)}</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Inflow: {formatCurrency(metrics?.inflow || 0)}</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Outflow: {formatCurrency(metrics?.outflow || 0)}</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Pending approvals: {metrics?.pending || 0}</div>
            </div>
          </article>
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.85fr)]">
        <article className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] dark:border-slate-800/70 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent transaction evidence</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">These rows power the statement above.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {recentTransactions.length} shown
            </span>
          </div>
          <div className="mt-4 overflow-hidden rounded-[20px] border border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-5 gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              <span>Date</span>
              <span>Type</span>
              <span>Status</span>
              <span>Description</span>
              <span className="text-right">Amount</span>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {recentTransactions.length > 0 ? recentTransactions.map((transaction) => (
                <div key={transaction.id} className="grid grid-cols-5 gap-3 px-4 py-3 text-sm">
                  <span className="text-slate-600 dark:text-slate-400">{formatDate(transaction.date || transaction.createdAt)}</span>
                  <span className="font-medium text-slate-900 dark:text-white">{toTitle(transaction.transactionType)}</span>
                  <span className="text-slate-600 dark:text-slate-400">{toTitle(transaction.status)}</span>
                  <span className="truncate text-slate-600 dark:text-slate-400">{transaction.description || 'No description provided'}</span>
                  <span className="text-right font-semibold text-slate-900 dark:text-white">{formatCurrency(transaction.amount)}</span>
                </div>
              )) : (
                <div className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">No transactions fall inside the selected period.</div>
              )}
            </div>
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] dark:border-slate-800/70 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Comparison metrics</h2>
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Current vs previous</span>
          </div>
          <div className="mt-4 space-y-3">
            {compareCards.length > 0 ? compareCards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{card.label}</div>
                <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{card.value}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{card.hint}</div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Turn comparison on to see the previous period alongside the current statement.
              </div>
            )}
          </div>
        </article>
      </section>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">{error}</div> : null}
      {statusMsg ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">{statusMsg}</div> : null}
      {loading ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">Refreshing live transaction data...</div> : null}
    </div>
  )
}

const StatementRow = ({ row, tone }) => (
  <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0 dark:border-slate-800">
    <div>
      <div className="font-medium text-slate-900 dark:text-white">{row.label}</div>
      <div className="text-sm text-slate-500 dark:text-slate-400">{row.count} transactions</div>
      {row.examples.length > 0 ? <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">{row.examples[0]}</div> : null}
    </div>
    <div className="text-right">
      <div className={`font-semibold ${tone === 'income' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>{formatCurrency(row.amount)}</div>
      <div className="text-xs text-slate-400 dark:text-slate-500">{row.latestDate ? formatDate(row.latestDate) : '—'}</div>
    </div>
  </div>
)

const EmptyRow = ({ message }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
    {message}
  </div>
)

const KeyValue = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900">
    <dt className="text-slate-600 dark:text-slate-400">{label}</dt>
    <dd className="font-semibold text-slate-900 dark:text-white">{value}</dd>
  </div>
)

const MetricCard = ({ title, value, subtitle }) => (
  <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(15,23,42,0.09)] dark:border-slate-800/70 dark:bg-slate-900">
    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</div>
    <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{value}</div>
    <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{subtitle}</div>
  </article>
)
