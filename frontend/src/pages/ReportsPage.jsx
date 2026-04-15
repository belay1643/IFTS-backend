import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import api from '../utils/api.js'
import { loadCompanySystemSettings } from '../utils/companySettings.js'

const LOCAL_STORAGE_KEY = 'ifts.reports.generated'

const REPORT_GROUPS = [
  {
    title: 'Financial Statements',
    items: [
      { id: 'pl-single', label: 'Profit & Loss Statement', icon: '📈' },
      { id: 'pl-consolidated', label: 'Consolidated P&L', icon: '📊' },
      { id: 'balance-sheet', label: 'Balance Sheet', icon: '🧾' },
      { id: 'cash-flow', label: 'Cash Flow Statement', icon: '💧' }
    ]
  },
  {
    title: 'Investment Reports',
    items: [
      { id: 'inv-performance', label: 'Investment Performance Summary', icon: '📊' },
      { id: 'portfolio-allocation', label: 'Portfolio Allocation Report', icon: '🧭' },
      { id: 'maturity-schedule', label: 'Maturity Schedule', icon: '🕒' },
      { id: 'roi-by-asset', label: 'ROI Analysis by Asset Type', icon: '📈' }
    ]
  },
  {
    title: 'Transaction Reports',
    items: [
      { id: 'txn-history', label: 'Transaction History', icon: '📜' },
      { id: 'monthly-activity', label: 'Monthly Activity Summary', icon: '🗓️' },
      { id: 'dividend-schedule', label: 'Dividend/Interest Schedule', icon: '💰' }
    ]
  },
  {
    title: 'Compliance Reports',
    items: [
      { id: 'audit-trail', label: 'Audit Trail Report', icon: '🔍' },
      { id: 'approval-history', label: 'Approval History', icon: '✅' },
      { id: 'user-activity', label: 'User Activity Log', icon: '👥' }
    ]
  }
]

const REPORT_META = {
  'pl-single': { description: 'Company-level P&L with live transaction totals and margin highlights.', scope: 'single', category: 'Financial Statements' },
  'pl-consolidated': { description: 'Cross-company P&L rollup using the current live summary payload.', scope: 'all', category: 'Financial Statements' },
  'balance-sheet': { description: 'Assets, liabilities, and equity snapshot derived from the live data set.', scope: 'both', category: 'Financial Statements' },
  'cash-flow': { description: 'Operating, investing, and financing cash movements based on recent activity.', scope: 'both', category: 'Financial Statements' },
  'inv-performance': { description: 'IRR, MOIC, and top-performing holdings from real holdings data.', scope: 'both', category: 'Investment Reports' },
  'portfolio-allocation': { description: 'Allocation by asset class and risk band using the live portfolio mix.', scope: 'both', category: 'Investment Reports' },
  'maturity-schedule': { description: 'Upcoming maturities and reinvestment candidates from the current portfolio.', scope: 'both', category: 'Investment Reports' },
  'roi-by-asset': { description: 'ROI and payback analysis grouped by asset type.', scope: 'both', category: 'Investment Reports' },
  'txn-history': { description: 'Completed transactions with approval traceability.', scope: 'both', category: 'Transaction Reports' },
  'monthly-activity': { description: 'Month-over-month trend of inflows and outflows.', scope: 'both', category: 'Transaction Reports' },
  'dividend-schedule': { description: 'Dividend and coupon calendar with statuses.', scope: 'both', category: 'Transaction Reports' },
  'audit-trail': { description: 'Audit trail report ready for review and export.', scope: 'both', category: 'Compliance Reports' },
  'approval-history': { description: 'Approvals, rejections, and escalations by period.', scope: 'both', category: 'Compliance Reports' },
  'user-activity': { description: 'User actions, devices, and company-scoped activity.', scope: 'both', category: 'Compliance Reports' }
}

const REPORT_PERIODS = [
  { value: 'current', label: 'Current Month' },
  { value: 'last', label: 'Last Month' },
  { value: 'quarter', label: 'Quarter to Date' },
  { value: 'year', label: 'Year to Date' }
]

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    maximumFractionDigits: 0
  }).format(Number(amount || 0))

const formatDate = (value) => dayjs(value).format('MMM D, YYYY')

const formatDateTime = (value) => dayjs(value).format('MMM D, YYYY h:mm A')

const safeJson = (value) => {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return '{}'
  }
}

const loadGeneratedReports = () => {
  if (typeof localStorage === 'undefined') return []
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const buildCompanyParams = (selectedCompanyId, companies, activeCompanyId) => {
  if (selectedCompanyId === 'all') {
    const ids = companies.map((company) => company.id).filter(Boolean)
    return ids.length > 0 ? { companyIds: ids.join(',') } : {}
  }

  const fallback = selectedCompanyId || activeCompanyId || companies[0]?.id
  return fallback ? { companyId: fallback } : {}
}

const buildReportDownload = (payload, filename) => {
  const blob = new Blob([safeJson(payload)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const buildReportLink = (report, selectedCompanyId, selectedPeriod, dateFrom, dateTo) => {
  const url = new URL(window.location.href)

  if (report.id === 'pl-single') {
    url.pathname = '/reports/profit-loss'
    url.searchParams.set('companyId', selectedCompanyId)
    url.searchParams.set('period', selectedPeriod)
    return url.toString()
  }

  url.pathname = '/reports'
  url.searchParams.set('reportId', report.id)
  url.searchParams.set('companyId', selectedCompanyId)
  url.searchParams.set('period', selectedPeriod)
  url.searchParams.set('dateFrom', dateFrom)
  url.searchParams.set('dateTo', dateTo)
  return url.toString()
}

export default function ReportsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { list: companies, active } = useSelector((state) => state.company)
  const activeCompany = useMemo(() => companies.find((company) => company.id === active), [companies, active])
  const [selectedReport, setSelectedReport] = useState('pl-single')
  const [selectedCompanyId, setSelectedCompanyId] = useState(active || 'all')
  const [selectedPeriod, setSelectedPeriod] = useState('current')
  const [dateFrom, setDateFrom] = useState(dayjs().startOf('year').format('YYYY-MM-DD'))
  const [dateTo, setDateTo] = useState(dayjs().format('YYYY-MM-DD'))
  const [format, setFormat] = useState('pdf')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState('')
  const [showArchive, setShowArchive] = useState(false)
  const [showAllReports, setShowAllReports] = useState(false)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [generatedReports, setGeneratedReports] = useState(loadGeneratedReports)

  useEffect(() => {
    if (active && selectedCompanyId === 'all') {
      setSelectedCompanyId(active)
    }
  }, [active, selectedCompanyId])

  useEffect(() => {
    const companyId = selectedCompanyId === 'all' ? active : selectedCompanyId
    const selectedCompany = companies.find((company) => company.id === companyId)
    const saved = loadCompanySystemSettings(companyId, selectedCompany?.reportingPreferences || activeCompany?.reportingPreferences)
    if (!saved?.reportsDefaultPeriod) return
    setSelectedPeriod(saved.reportsDefaultPeriod)
  }, [active, selectedCompanyId, companies, activeCompany?.reportingPreferences])

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(generatedReports.slice(0, 12)))
    }
  }, [generatedReports])

  useEffect(() => {
    const controller = new AbortController()

    const fetchSummary = async () => {
      const params = buildCompanyParams(selectedCompanyId, companies, active)
      if (Object.keys(params).length === 0) {
        setSummary(null)
        return
      }

      setLoading(true)
      setError('')
      try {
        const { data } = await api.get('/reports/summary', { params, signal: controller.signal })
        setSummary(data)
      } catch (requestError) {
        if (requestError.name === 'CanceledError' || requestError.code === 'ERR_CANCELED') return
        setError(requestError.response?.data?.message || requestError.message || 'Failed to load report summary')
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()

    return () => controller.abort()
  }, [active, companies, selectedCompanyId])

  const reportOptions = useMemo(
    () => REPORT_GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, group: group.title, ...REPORT_META[item.id] }))),
    []
  )

  const selectedReportMeta = REPORT_META[selectedReport] || REPORT_META['pl-single']
  const selectedLabel = reportOptions.find((item) => item.id === selectedReport)?.label || 'Select a report'
  const selectedCompanyName = selectedCompanyId === 'all' ? 'All Companies' : companies.find((company) => company.id === selectedCompanyId)?.name || 'Selected company'

  const filteredReports = useMemo(() => {
    return reportOptions
      .filter((report) => (category === 'all' ? true : report.group === category))
      .filter((report) => {
        if (!search.trim()) return true
        const term = search.toLowerCase()
        return [report.label, report.description, report.group].some((value) => String(value || '').toLowerCase().includes(term))
      })
  }, [category, reportOptions, search])

  const visibleReports = useMemo(
    () => (showAllReports ? filteredReports : filteredReports.slice(0, 5)),
    [filteredReports, showAllReports]
  )

  useEffect(() => {
    const reportId = searchParams.get('reportId')
    const companyId = searchParams.get('companyId')
    const periodParam = searchParams.get('period')
    const fromParam = searchParams.get('dateFrom')
    const toParam = searchParams.get('dateTo')

    if (reportId && reportOptions.some((report) => report.id === reportId) && reportId !== selectedReport) {
      setSelectedReport(reportId)
    }
    if (companyId && companyId !== selectedCompanyId) {
      setSelectedCompanyId(companyId)
    }
    if (periodParam && periodParam !== selectedPeriod) {
      setSelectedPeriod(periodParam)
    }
    if (fromParam && fromParam !== dateFrom) {
      setDateFrom(fromParam)
    }
    if (toParam && toParam !== dateTo) {
      setDateTo(toParam)
    }
  }, [dateFrom, dateTo, reportOptions, searchParams, selectedCompanyId, selectedPeriod, selectedReport])

  const summaryCards = useMemo(() => {
    const recentTransactions = Array.isArray(summary?.recentTransactions) ? summary.recentTransactions : []
    const pendingApprovals = Array.isArray(summary?.pendingApprovals) ? summary.pendingApprovals : []
    const holdings = Array.isArray(summary?.holdings) ? summary.holdings : []
    const assetMix = Array.isArray(summary?.perAsset) ? summary.perAsset : []

    return [
      { label: 'Portfolio Value', value: formatCurrency(summary?.totalPortfolioValue || 0), hint: `${holdings.length} holdings in view` },
      { label: 'Total Profit', value: formatCurrency(summary?.totalProfit || 0), hint: `${assetMix.length} asset groups` },
      { label: 'Active Assets', value: Number(summary?.activeAssets || 0), hint: `${recentTransactions.length} recent transactions` },
      { label: 'Pending Approvals', value: Number(summary?.pendingApprovalsCount || pendingApprovals.length || 0), hint: 'Live approval queue' }
    ]
  }, [summary])

  const liveArchive = useMemo(() => {
    const recentTransactions = Array.isArray(summary?.recentTransactions) ? summary.recentTransactions : []
    const pendingApprovals = Array.isArray(summary?.pendingApprovals) ? summary.pendingApprovals : []
    const holdings = Array.isArray(summary?.holdings) ? summary.holdings : []

    return [
      {
        id: 'live-pl',
        title: `${selectedCompanyName} P&L Snapshot`,
        generatedAt: recentTransactions[0]?.transactionDate || pendingApprovals[0]?.requestedAt || new Date().toISOString(),
        by: selectedCompanyName,
        size: `${recentTransactions.length} transactions`,
        format: 'LIVE',
        reportId: 'pl-single'
      },
      {
        id: 'live-assets',
        title: `${selectedCompanyName} Portfolio Snapshot`,
        generatedAt: holdings[0]?.maturityDate || recentTransactions[0]?.transactionDate || new Date().toISOString(),
        by: selectedCompanyName,
        size: `${holdings.length} holdings`,
        format: 'LIVE',
        reportId: 'portfolio-allocation'
      },
      {
        id: 'live-compliance',
        title: `${selectedCompanyName} Compliance Snapshot`,
        generatedAt: pendingApprovals[0]?.requestedAt || new Date().toISOString(),
        by: selectedCompanyName,
        size: `${pendingApprovals.length} approvals`,
        format: 'LIVE',
        reportId: 'audit-trail'
      }
    ]
  }, [selectedCompanyName, summary])

  const archiveReports = generatedReports.length > 0 ? generatedReports : liveArchive

  const isRangeValid = dayjs(dateFrom).valueOf() <= dayjs(dateTo).valueOf()

  const recordGeneratedReport = (record) => {
    setGeneratedReports((current) => [record, ...current].slice(0, 12))
  }

  const openProfitLoss = () => {
    const targetCompanyId = selectedCompanyId === 'all' ? active || companies[0]?.id : selectedCompanyId
    if (!targetCompanyId) {
      setError('Select a company first.')
      return
    }

    navigate(`/reports/profit-loss?companyId=${targetCompanyId}&period=${selectedPeriod}`, {
      state: {
        companyId: targetCompanyId,
        companyName: selectedCompanyName,
        period: selectedPeriod,
        summary
      }
    })
  }

  const handleGenerate = () => {
    setError('')
    if (!isRangeValid) {
      setError('Date range is invalid. End date must be after start date.')
      return
    }

    if (!summary && selectedReport === 'pl-single') {
      setError('Load company data before generating the statement.')
      return
    }

    const generatedAt = new Date().toISOString()
    const record = {
      id: `${selectedReport}-${Date.now()}`,
      title: `${selectedLabel} - ${selectedCompanyName}`,
      generatedAt,
      by: 'Current session',
      size: `${Array.isArray(summary?.recentTransactions) ? summary.recentTransactions.length : 0} live rows`,
      format: format.toUpperCase(),
      reportId: selectedReport,
      companyId: selectedCompanyId,
      companyName: selectedCompanyName,
      dateFrom,
      dateTo,
      period: selectedPeriod
    }

    if (selectedReport === 'pl-single') {
      recordGeneratedReport(record)
      openProfitLoss()
      setStatusMsg('Opened the live Profit and Loss report.')
      return
    }

    const payload = {
      ...record,
      summary,
      reportMeta: selectedReportMeta,
      generatedAt,
      dateRange: { dateFrom, dateTo }
    }

    buildReportDownload(payload, `${selectedReport}-${dayjs().format('YYYYMMDD-HHmmss')}.json`)
    recordGeneratedReport(record)
    setStatusMsg(`Generated ${selectedLabel} from live data.`)
  }

  const handlePreview = async () => {
    if (selectedReport === 'pl-single') {
      openProfitLoss()
      return
    }

    const payload = {
      reportId: selectedReport,
      label: selectedLabel,
      companyName: selectedCompanyName,
      summary,
      generatedAt: new Date().toISOString(),
      dateRange: { dateFrom, dateTo }
    }

    try {
      await navigator.clipboard.writeText(safeJson(payload))
      setStatusMsg(`Preview payload copied for ${selectedLabel}.`)
    } catch {
      setStatusMsg(`Preview ready for ${selectedLabel}.`)
    }
  }

  const handleShare = async () => {
    const shareText = `${selectedLabel} for ${selectedCompanyName} between ${formatDate(dateFrom)} and ${formatDate(dateTo)}`
    try {
      await navigator.clipboard.writeText(shareText)
      setStatusMsg(`Share text copied for ${selectedLabel}.`)
    } catch {
      setStatusMsg(`Share prepared for ${selectedLabel}.`)
    }
  }

  const handleArchiveOpen = () => {
    setShowArchive(true)
    setStatusMsg('Archive opened.')
  }

  const handleCopyLink = async (report) => {
    const link = buildReportLink(report, selectedCompanyId, selectedPeriod, dateFrom, dateTo)
    try {
      await navigator.clipboard.writeText(link)
      setStatusMsg(`Copied link for ${report.label}.`)
    } catch {
      setStatusMsg(`Copy failed for ${report.label}.`)
    }
  }

  const handleOpenArchivedReport = (report) => {
    if (report.reportId === 'pl-single') {
      openProfitLoss()
      return
    }

    setSelectedReport(report.reportId)
    setSelectedCompanyId(report.companyId === 'all' ? selectedCompanyId : report.companyId || selectedCompanyId)
    setStatusMsg(`Loaded archived report ${report.title}.`)
    setShowArchive(false)
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-8 sm:pb-10 text-slate-800 transition-colors duration-300 dark:text-slate-100">
      <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-[0_24px_70px_rgba(15,23,42,0.28)] dark:border-slate-800/70">
        <div className="relative px-4 py-6 sm:px-8 lg:px-10 lg:py-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.14),transparent_26%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
                Financial Reports
              </span>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">
                  {reportOptions.length} available reports • {generatedReports.length} generated in session
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  Generate, preview, share, and archive live reports based on the current summary payload.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-200/90">
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Company: {selectedCompanyName}</span>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Period: {REPORT_PERIODS.find((period) => period.value === selectedPeriod)?.label}</span>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Range: {formatDate(dateFrom)} → {formatDate(dateTo)}</span>
              </div>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:w-auto lg:min-w-[36rem]">
              <button type="button" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-left backdrop-blur transition hover:bg-white/15" onClick={handleGenerate}>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Generate</div>
                <div className="mt-1 text-sm font-semibold">Live export</div>
              </button>
              <button type="button" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-left backdrop-blur transition hover:bg-white/15" onClick={handlePreview}>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Preview</div>
                <div className="mt-1 text-sm font-semibold">Open or copy</div>
              </button>
              <button type="button" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-left backdrop-blur transition hover:bg-white/15" onClick={handleShare}>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Share</div>
                <div className="mt-1 text-sm font-semibold">Copy summary</div>
              </button>
              <button type="button" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-left backdrop-blur transition hover:bg-white/15" onClick={handleArchiveOpen}>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Archive</div>
                <div className="mt-1 text-sm font-semibold">Saved runs</div>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((metric) => (
          <MetricCard key={metric.label} icon={metric.icon || '📄'} title={metric.label} value={metric.value} subtitle={metric.hint} tone="blue" />
        ))}
      </section>

      <section className="rounded-[24px] sm:rounded-[28px] border border-slate-200/80 bg-white p-4 sm:p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)] dark:border-slate-800/70 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Live report controls</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Choose the company, date range, and report type before generating the export.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedPeriod('current')}
              className="rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Compare period
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              className="rounded-full bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
            >
              Download report
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 xl:col-span-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Company</span>
            <select
              value={selectedCompanyId}
              onChange={(event) => setSelectedCompanyId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition [color-scheme:light] focus:border-sky-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark] dark:focus:bg-slate-900"
            >
              <option value="all">All Companies</option>
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
              value={selectedPeriod}
              onChange={(event) => setSelectedPeriod(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition [color-scheme:light] focus:border-sky-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark] dark:focus:bg-slate-900"
            >
              {REPORT_PERIODS.map((period) => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Format</span>
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition [color-scheme:light] focus:border-sky-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark] dark:focus:bg-slate-900"
            >
              <option value="pdf">PDF</option>
              <option value="xlsx">Excel</option>
              <option value="json">JSON</option>
            </select>
          </label>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Date from</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition [color-scheme:light] focus:border-sky-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark] dark:focus:bg-slate-900"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Date to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition [color-scheme:light] focus:border-sky-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark] dark:focus:bg-slate-900"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Search templates</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter by title, description, or category"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-900"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition [color-scheme:light] focus:border-sky-400 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark] dark:focus:bg-slate-900"
            >
              <option value="all">All</option>
              {REPORT_GROUPS.map((group) => (
                <option key={group.title} value={group.title}>
                  {group.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">{error}</div> : null}
      {statusMsg && !error ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">{statusMsg}</div> : null}

      {loading ? (
        <div className="rounded-[24px] sm:rounded-[28px] border border-dashed border-slate-300 bg-white p-6 sm:p-10 text-center text-slate-500 shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          Loading live summary data...
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Showing {visibleReports.length} of {filteredReports.length} report templates
          </div>
          {filteredReports.length > 5 ? (
            <button
              type="button"
              className="rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => setShowAllReports((value) => !value)}
            >
              {showAllReports ? 'Show fewer' : 'View all reports'}
            </button>
          ) : null}
        </div>
        {visibleReports.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            selected={selectedReport === report.id}
            onSelect={() => setSelectedReport(report.id)}
            onGenerate={handleGenerate}
            onPreview={handlePreview}
            onCopy={() => handleCopyLink(report)}
          />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <article className="rounded-[24px] sm:rounded-[28px] border border-slate-200/80 bg-white p-4 sm:p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] dark:border-slate-800/70 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Latest live snapshots</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Derived directly from the summary payload returned by the API.</p>
            </div>
            <button type="button" className="text-sm text-sky-600 dark:text-sky-400" onClick={handleArchiveOpen}>
              View archive
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {liveArchive.map((report) => (
              <RecentReportCard key={report.id} report={report} onOpen={() => handleOpenArchivedReport(report)} />
            ))}
          </div>
        </article>

        <aside className="rounded-[24px] sm:rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4 sm:p-5 text-white shadow-[0_16px_40px_rgba(15,23,42,0.16)] dark:border-slate-800/70">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-slate-200 dark:text-slate-300">Selected report</div>
          <div className="mt-3 text-lg font-semibold text-white dark:text-slate-100">{selectedLabel}</div>
          <p className="mt-2 text-sm leading-6 text-slate-200 dark:text-slate-300">{selectedReportMeta.description}</p>
          <div className="mt-5 space-y-3 text-sm text-slate-100 dark:text-slate-200">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Scope: {selectedReportMeta.scope}</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Company: {selectedCompanyName}</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Date range: {formatDate(dateFrom)} → {formatDate(dateTo)}</div>
          </div>
          <div className="mt-5 grid gap-2">
            <button type="button" className="rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-300" onClick={handleGenerate}>
              Generate now
            </button>
            <button type="button" className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-slate-50 transition hover:bg-white/10" onClick={handlePreview}>
              Preview selected report
            </button>
          </div>
        </aside>
      </section>

      {showArchive ? (
        <section className="rounded-[24px] sm:rounded-[28px] border border-slate-200/80 bg-white p-4 sm:p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] dark:border-slate-800/70 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Archive</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Saved exports from this browser session and live snapshot fallbacks.</p>
            </div>
            <button type="button" className="text-xs text-slate-500 dark:text-slate-400" onClick={() => setShowArchive(false)}>
              Close
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {archiveReports.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => handleOpenArchivedReport(report)}
                className="rounded-[18px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800"
              >
                <div className="text-sm font-semibold text-slate-900 dark:text-white">{report.title}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Generated {formatDateTime(report.generatedAt)}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">By: {report.by} • {report.size} • {report.format}</div>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

const ReportCard = ({ report, selected, onSelect, onGenerate, onPreview, onCopy }) => (
  <div
    className={`rounded-[20px] border p-4 shadow-[0_16px_42px_-34px_rgba(15,23,42,0.34)] transition-all ${selected ? 'border-sky-400 bg-sky-50/60 dark:bg-sky-500/10' : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60'}`}
  >
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{report.icon}</span>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{report.label}</h3>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{report.description}</p>
        <p className="text-xs uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Category: {report.category}</p>
      </div>
      <button
        type="button"
        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={onSelect}
      >
        {selected ? 'Selected' : 'Select'}
      </button>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" className="rounded-full bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-sky-400 dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-300" onClick={onGenerate}>
        Generate
      </button>
      <button type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800" onClick={onPreview}>
        Preview
      </button>
      <button type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800" onClick={onCopy}>
        Copy link
      </button>
    </div>
  </div>
)

const RecentReportCard = ({ report, onOpen }) => (
  <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.3)] dark:border-slate-800 dark:bg-slate-950">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
          <span>📄</span>
          <h3 className="text-sm font-semibold">{report.title}</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Generated: {formatDate(report.generatedAt)} • By: {report.by}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Size: {report.size} • Format: {report.format}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800" onClick={onOpen}>
          Open
        </button>
      </div>
    </div>
  </div>
)

const MetricCard = ({ title, value, subtitle }) => (
  <div className="relative overflow-hidden rounded-[20px] border border-slate-200 bg-white p-4 min-h-[150px] shadow-[0_16px_50px_-35px_rgba(0,0,0,0.65)] dark:border-slate-800 dark:bg-slate-900">
    <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 via-transparent to-transparent opacity-70" />
    <div className="relative flex items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{title}</div>
        <p className="text-[26px] font-semibold tracking-tight text-slate-900 dark:text-white">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 min-h-[32px]">{subtitle}</p>
      </div>
    </div>
  </div>
)
