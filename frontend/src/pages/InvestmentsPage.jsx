import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import dayjs from 'dayjs'
import { fetchInvestments, fetchInvestmentMetrics, createInvestment, updateInvestment, deleteInvestment } from '../store/slices/investmentSlice'
import { setActiveCompany } from '../store/slices/companySlice'

const createDefaultForm = () => ({
  startDate: dayjs().format('YYYY-MM-DD'),
  assetType: 'savings',
  principal: '',
  interestRate: '',
  duration: '12',
  sellingPrice: '',
  buyingPrice: '',
  shares: '',
  dividendRate: '',
  notes: '',
  notifyStakeholders: false,
  sendToApproval: false,
  status: 'active'
})

const assetMeta = {
  savings: { label: 'Savings', icon: '💰', accent: 'blue' },
  bonds: { label: 'Bonds', icon: '📈', accent: 'emerald' },
  shares: { label: 'Shares', icon: '📊', accent: 'purple' },
  't-bills': { label: 'T-Bills', icon: '🟣', accent: 'amber' },
  other: { label: 'Other', icon: '🪙', accent: 'slate' }
}

const formatCurrency = (value) => `Br ${formatNumber(value)}`

const formatShortDate = (value) => (value ? dayjs(value).format('MMM D, YYYY') : '—')

const compactId = (value) => {
  const text = String(value || '').trim()
  if (!text) return '—'
  if (text.length <= 12) return text
  return `${text.slice(0, 4)}...${text.slice(-4)}`
}

const getStatusMeta = (status) => {
  const key = String(status || '').toLowerCase()
  if (key === 'active') return { label: 'Active', dot: 'bg-emerald-500', cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25' }
  if (key === 'pending') return { label: 'Pending', dot: 'bg-amber-500', cls: 'bg-amber-500/15 text-amber-700 border-amber-500/25' }
  if (key === 'matured') return { label: 'Matured', dot: 'bg-slate-400', cls: 'bg-slate-500/10 text-slate-700 border-slate-200/70' }
  return { label: status || 'Active', dot: 'bg-slate-400', cls: 'bg-[var(--panel-strong)] text-[var(--text-secondary)] border-[var(--card-border)]' }
}

const getDurationProgress = (startDate, maturityDate) => {
  if (!startDate || !maturityDate) return 0
  const start = dayjs(startDate)
  const end = dayjs(maturityDate)
  if (!start.isValid() || !end.isValid() || end.isSame(start)) return 0
  const total = end.diff(start, 'day')
  const elapsed = dayjs().diff(start, 'day')
  return Math.max(0, Math.min(100, (elapsed / total) * 100))
}

const getMaturityCountdown = (maturityDate) => {
  if (!maturityDate) return '—'
  const end = dayjs(maturityDate)
  if (!end.isValid()) return '—'
  const days = end.startOf('day').diff(dayjs().startOf('day'), 'day')
  if (days < 0) return `${Math.abs(days)} days overdue`
  if (days === 0) return 'Matures today'
  if (days === 1) return '1 day left'
  if (days < 30) return `${days} days left`
  const months = Math.floor(days / 30)
  return months === 1 ? '1 month left' : `${months} months left`
}

const InvestmentsPage = () => {
  const dispatch = useDispatch()
  const { active, list: companies } = useSelector((s) => s.company)
  const { items, metrics, status, metricsStatus, createStatus, updateStatus, deleteStatus, error } = useSelector((s) => s.investments)

  const [form, setForm] = useState(createDefaultForm)
  const [editId, setEditId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateRange, setDateRange] = useState('last30')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const importRef = useRef(null)
  const [formError, setFormError] = useState('')
  const [showOptionalFields, setShowOptionalFields] = useState(false)

  const activeCompany = useMemo(() => companies.find((c) => c.id === active), [companies, active])

  useEffect(() => {
    const companyId = active || companies[0]?.id
    if (!companyId) return
    if (!active && companyId) dispatch(setActiveCompany(companyId))
    dispatch(fetchInvestments(companyId))
    dispatch(fetchInvestmentMetrics(companyId))
  }, [active, companies, dispatch])

  const resetForm = () => {
    setForm(createDefaultForm())
    setEditId(null)
    setShowOptionalFields(false)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const companyId = active || companies[0]?.id
    if (!companyId) return
    if (!form.principal || Number(form.principal) <= 0) return setFormError('Principal must be greater than 0')
    if (!form.interestRate || Number(form.interestRate) <= 0) return setFormError('Interest rate must be greater than 0')
    if (!form.duration || Number(form.duration) <= 0) return setFormError('Duration must be greater than 0')
    setFormError('')
    const payload = {
      ...form,
      companyId,
      principal: Number(form.principal) || 0,
      interestRate: Number(form.interestRate) || 0,
      duration: Number(form.duration) || 12,
      startDate: form.startDate || dayjs().format('YYYY-MM-DD')
    }

    // Backend validators reject empty strings for optional numeric fields.
    ;['sellingPrice', 'buyingPrice', 'shares', 'dividendRate', 'notes'].forEach((key) => {
      if (payload[key] === '' || payload[key] === null || typeof payload[key] === 'undefined') {
        delete payload[key]
      }
    })

    const refresh = () => {
      dispatch(fetchInvestmentMetrics(companyId))
      dispatch(fetchInvestments(companyId))
      resetForm()
      setShowModal(false)
    }

    const handleSubmitError = (err) => {
      const firstValidation = err?.errors?.[0]?.msg
      const message = firstValidation || err?.message || 'Could not save investment. Please check the form values.'
      setFormError(message)
    }

    if (editId) {
      dispatch(updateInvestment({ id: editId, updates: payload })).unwrap().then(refresh).catch(handleSubmitError)
    } else {
      dispatch(createInvestment(payload)).unwrap().then(refresh).catch(handleSubmitError)
    }
  }

  const handleEdit = (inv) => {
    setEditId(inv.id)
    setShowOptionalFields(Boolean(inv.sellingPrice || inv.buyingPrice || inv.shares || inv.dividendRate || inv.notes))
    setForm({
      assetType: inv.assetType,
      principal: inv.principal,
      interestRate: inv.interestRate,
      duration: inv.duration,
      startDate: inv.startDate ? dayjs(inv.startDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      status: inv.status,
      sellingPrice: inv.sellingPrice || '',
      buyingPrice: inv.buyingPrice || '',
      shares: inv.shares || '',
      dividendRate: inv.dividendRate || '',
      notes: inv.notes || '',
      notifyStakeholders: !!inv.notifyStakeholders,
      sendToApproval: !!inv.sendToApproval
    })
    setShowModal(true)
  }

  const handleDelete = (id) => {
    if (!active) return
    dispatch(deleteInvestment(id))
      .unwrap()
      .then(() => dispatch(fetchInvestmentMetrics(active)))
      .then(() => dispatch(fetchInvestments(active)))
  }

  const filteredRows = useMemo(() => {
    let rows = items.map((inv) => ({
      ...inv,
      maturityDate: inv.maturityDate ? dayjs(inv.maturityDate).format('YYYY-MM-DD') : '-',
      startDate: inv.startDate ? dayjs(inv.startDate).format('YYYY-MM-DD') : '-',
      companyName: companies.find((c) => c.id === inv.companyId)?.name || '-'
    }))
    if (typeFilter) rows = rows.filter((r) => r.assetType === typeFilter)
    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter)
    if (dateRange && dateRange !== 'all') {
      const now = dayjs()
      rows = rows.filter((r) => {
        if (!r.startDate || r.startDate === '-') return true
        const start = dayjs(r.startDate)
        if (dateRange === 'last30') return start.isAfter(now.subtract(30, 'day'))
        if (dateRange === 'last90') return start.isAfter(now.subtract(90, 'day'))
        if (dateRange === 'ytd') return start.isAfter(now.startOf('year'))
        return true
      })
    }
    return rows
  }, [items, companies, typeFilter, statusFilter, dateRange])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const paged = filteredRows.slice((page - 1) * pageSize, page * pageSize)

  const durationYears = Number(form.duration || 0) / 12
  const interestRateFraction = Number(form.interestRate || 0) / 100
  const simpleInterest = Number(form.principal || 0) * interestRateFraction * durationYears
  const capitalGain = form.sellingPrice && form.buyingPrice ? Number(form.sellingPrice) - Number(form.buyingPrice) : 0
  const dividend = form.shares && form.dividendRate ? Number(form.shares) * Number(form.dividendRate) : 0
  const maturityDatePreview = form.startDate ? dayjs(form.startDate).add(Number(form.duration || 0), 'month').format('YYYY-MM-DD') : '-'
  const totalReturn = Number(form.principal || 0) + simpleInterest
  const activeCount = metrics?.activeCount ?? filteredRows.filter((inv) => inv.status === 'active').length
  const maturedCount = metrics?.maturedCount ?? filteredRows.filter((inv) => inv.status === 'matured').length
  const pendingCount = metrics?.pendingCount ?? filteredRows.filter((inv) => inv.status === 'pending').length
  const averageRate = metrics?.averageRate ?? (filteredRows.length ? filteredRows.reduce((sum, inv) => sum + Number(inv.interestRate || 0), 0) / filteredRows.length : 0)
  const pageSummary = filteredRows.length === 1 ? '1 investment' : `${filteredRows.length} investments`
  const approvalThreshold = Number(activeCompany?.approvalThreshold || 10000)

  const handleExport = () => {
    if (!filteredRows.length) return
    const header = ['Asset', 'Principal', 'Rate', 'Duration', 'Interest', 'Start', 'Maturity', 'Status', 'Company']
    const csv = [header.join(',')]
    filteredRows.forEach((r) => {
      csv.push([
        r.assetType,
        r.principal,
        r.interestRate,
        r.duration,
        r.calculatedInterest || 0,
        r.startDate,
        r.maturityDate,
        r.status,
        r.companyName
      ].join(','))
    })
    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'investments.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleBulkUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const text = evt.target?.result || ''
      const lines = String(text).split(/\r?\n/).filter(Boolean)
      if (lines.length <= 1) return
      const companyId = active || companies[0]?.id
      if (!companyId) return
      const parsed = lines.slice(1).map((line) => line.split(','))
      const tasks = parsed.map((cols) => {
        const [date, assetType, principal, rate, duration] = cols
        return dispatch(createInvestment({
          companyId,
          startDate: date || dayjs().format('YYYY-MM-DD'),
          assetType: (assetType || 'savings').toLowerCase(),
          principal: Number(principal) || 0,
          interestRate: Number(rate) || 0,
          duration: Number(duration) || 12,
          status: 'active'
        })).unwrap()
      })
      await Promise.allSettled(tasks)
      dispatch(fetchInvestments(companyId))
      dispatch(fetchInvestmentMetrics(companyId))
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="space-y-5 text-[var(--text-primary)]">
      <div className="bg-gradient-to-r from-[var(--brand-primary)]/12 via-[var(--brand-primary)]/6 to-transparent border border-[var(--card-border)]/60 rounded-[24px] px-5 py-5 shadow-[0_10px_45px_-25px_rgba(0,0,0,0.45)] relative overflow-hidden">
        <div className="absolute inset-0 opacity-35" style={{ background: 'radial-gradient(circle at 15% 20%, rgba(104,210,232,0.18), transparent 35%), radial-gradient(circle at 85% 15%, rgba(52,211,153,0.16), transparent 35%)' }} />
        <div className="relative flex flex-wrap items-start gap-4 justify-between">
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">Investments</p>
            <h1 className="text-3xl font-semibold tracking-tight">Investment Portfolio</h1>
            <p className="text-sm text-[var(--muted-foreground)]">Track positions, returns, and maturity risk in one clean workspace.</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <span className="px-2.5 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--card-border)]">{pageSummary}</span>
              <span className="px-2.5 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--card-border)]">Avg rate {formatNumber(averageRate)}%</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <select
              className="bg-[var(--panel)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] shadow-[0_10px_30px_-24px_rgba(15,23,42,0.28)]"
              value={active || ''}
              onChange={(e) => dispatch(setActiveCompany(e.target.value))}
            >
              <option value="" disabled>Select company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="text-sm text-rose-500">{error}</div>}

      <div className="bg-[var(--panel)] border border-[var(--card-border)]/70 rounded-[24px] p-4 shadow-[0_20px_70px_-45px_rgba(0,0,0,0.6)] flex flex-wrap items-center gap-3">
        <button className="px-4 py-2 bg-gradient-to-r from-[var(--brand-primary)] to-cyan-500 text-white rounded-xl text-sm shadow-[0_14px_32px_-18px_rgba(59,130,246,0.55)] hover:shadow-[0_16px_36px_-18px_rgba(59,130,246,0.6)] transition-all" type="button" onClick={() => { resetForm(); setShowModal(true) }}>+ Add Investment</button>
        <button className="px-4 py-2 border border-[var(--card-border)] rounded-xl text-sm shadow-[0_10px_35px_-20px_rgba(0,0,0,0.55)] bg-[var(--bg-card)] hover:bg-[var(--panel-strong)] transition-all" type="button" onClick={() => importRef.current?.click()}>Bulk Upload</button>
        <button className="px-4 py-2 border border-[var(--card-border)] rounded-xl text-sm shadow-[0_10px_35px_-20px_rgba(0,0,0,0.55)] bg-[var(--bg-card)] hover:bg-[var(--panel-strong)] transition-all" type="button" onClick={handleExport}>Export</button>
        <input type="file" accept=".csv" ref={importRef} className="hidden" onChange={handleBulkUpload} />
      </div>

      <div className="bg-[var(--panel)] border border-[var(--card-border)]/70 rounded-[24px] p-4 shadow-[0_20px_70px_-45px_rgba(0,0,0,0.6)] flex flex-wrap items-center gap-3 text-sm">
        <span className="text-[var(--muted-foreground)] font-medium">Quick filters</span>
        <select className="border border-[var(--card-border)] rounded-xl px-3 py-2 shadow-sm bg-[var(--bg-card)]" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}>
          <option value="">All Types</option>
          {['savings', 'bonds', 'shares', 't-bills', 'other'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="border border-[var(--card-border)] rounded-xl px-3 py-2 shadow-sm bg-[var(--bg-card)]" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="matured">Matured</option>
        </select>
        <select className="border border-[var(--card-border)] rounded-xl px-3 py-2 shadow-sm bg-[var(--bg-card)]" value={dateRange} onChange={(e) => { setDateRange(e.target.value); setPage(1) }}>
          <option value="all">All Dates</option>
          <option value="last30">Last 30 days</option>
          <option value="last90">Last 90 days</option>
          <option value="ytd">Year to date</option>
        </select>
        <div className="flex items-center gap-2">
          <span className="text-[var(--muted-foreground)]">Page size</span>
          <select className="border border-[var(--card-border)] rounded-xl px-3 py-2 shadow-sm bg-[var(--bg-card)]" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard icon="💰" title="Total Principal" value={formatCurrency(metrics?.totalPrincipal || 0)} loading={metricsStatus === 'loading'} trend="Up 12% YoY" accent="blue" caption="Capital currently deployed" />
        <MetricCard icon="📈" title="Total Interest" value={formatCurrency(metrics?.totalInterest || 0)} loading={metricsStatus === 'loading'} trend="Up 8% YoY" accent="emerald" caption="Estimated earnings" />
        <MetricCard icon="📊" title="Avg Rate" value={`${formatNumber(metrics?.averageRate || averageRate || 0)}%`} loading={metricsStatus === 'loading'} trend="Up 0.5% from last quarter" accent="purple" caption="Weighted portfolio yield" />
        <MetricCard icon="🟢" title="Active" value={activeCount} loading={metricsStatus === 'loading'} trend={`${maturedCount} matured · ${pendingCount} pending`} accent="emerald" caption="Currently live investments" />
      </div>

      <div className="bg-[var(--panel)] rounded-[24px] border border-[var(--card-border)]/70 shadow-[0_20px_70px_-45px_rgba(0,0,0,0.6)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--card-border)]/70 bg-[var(--bg-card)]/75 backdrop-blur-sm">
          <div className="space-y-0.5">
            <h3 className="font-semibold text-[var(--text-primary)]">Investment Ledger</h3>
            <p className="text-xs text-[var(--muted-foreground)]">{pageSummary} visible in the current filter set</p>
          </div>
          {status === 'loading' && <span className="text-xs text-[var(--muted-foreground)]">Loading...</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)] bg-[var(--panel-strong)]/55">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="px-4">Investment</th>
                <th className="px-4">Principal</th>
                <th className="px-4">Rate</th>
                <th className="px-4">Duration</th>
                <th className="px-4">Expected</th>
                <th className="px-4">Status</th>
                <th className="px-4">Company</th>
                <th className="px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && (
                <tr>
                  <td colSpan="9" className="py-8 px-4">
                    <div className="mx-auto max-w-md rounded-[24px] border border-dashed border-[var(--card-border)] bg-[var(--bg-card)] px-6 py-10 text-center space-y-3 shadow-[0_16px_48px_-34px_rgba(15,23,42,0.3)]">
                      <div className="text-4xl">📊</div>
                      <div>
                        <h4 className="text-lg font-semibold text-[var(--text-primary)]">No Investments Yet</h4>
                        <p className="text-sm text-[var(--muted-foreground)]">Click Add Investment to get started.</p>
                      </div>
                      <button type="button" className="px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--brand-primary)] to-cyan-500 text-white text-sm shadow-[0_14px_32px_-18px_rgba(59,130,246,0.55)] hover:shadow-[0_16px_36px_-18px_rgba(59,130,246,0.6)] transition-all" onClick={() => { resetForm(); setShowModal(true) }}>
                        + Add Investment
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {paged.map((inv, idx) => {
                const meta = assetMeta[inv.assetType] || assetMeta.other
                const progress = getDurationProgress(inv.startDate, inv.maturityDate)
                const statusMeta = getStatusMeta(inv.status)
                const expectedReturn = Number(inv.principal || 0) + Number(inv.calculatedInterest || 0)
                return (
                  <tr key={inv.id} className="border-b border-[var(--card-border)]/45 last:border-b-0 bg-[var(--bg-card)]/60 hover:bg-[var(--panel-strong)]/55 transition-colors">
                    <td className="py-4 px-4 align-top text-[var(--muted-foreground)]">{(page - 1) * pageSize + idx + 1}</td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-[var(--panel-strong)] border border-[var(--card-border)]/70 flex items-center justify-center text-lg shadow-[0_10px_25px_-18px_rgba(15,23,42,0.35)]">
                          {meta.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-[var(--text-primary)] capitalize">{meta.label}</div>
                          <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-2 flex-wrap">
                            <span>ID: {compactId(inv.id)}</span>
                            <span>•</span>
                            <span>Started: {formatShortDate(inv.startDate)}</span>
                            <span>•</span>
                            <span>{getMaturityCountdown(inv.maturityDate)}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-[var(--text-primary)] font-medium">{formatCurrency(inv.principal)}</td>
                    <td className="px-4 py-4 align-top text-[var(--text-primary)]">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/12 text-purple-700 border border-purple-500/20">
                        {formatNumber(inv.interestRate)}%
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top text-[var(--text-primary)]">
                      <div className="space-y-2 min-w-[180px]">
                        <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                          <span>{inv.duration} mos</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--panel-strong)] overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-[var(--brand-primary)] to-cyan-500" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-[var(--text-primary)] font-medium">
                      <div className="space-y-1">
                        <div>{formatCurrency(expectedReturn)}</div>
                        <div className="text-xs text-[var(--muted-foreground)]">Interest {formatCurrency(inv.calculatedInterest || 0)}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${statusMeta.cls}`}>
                        <span className={`h-2 w-2 rounded-full ${statusMeta.dot}`} />
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top text-[var(--text-primary)]">{inv.companyName}</td>
                    <td className="px-4 py-4 align-top text-right space-x-2">
                      <button className="text-xs px-3 py-1.5 rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] hover:bg-[var(--panel-strong)] transition-all" onClick={() => handleEdit(inv)} type="button">Edit</button>
                      <button className="text-xs px-3 py-1.5 rounded-full border border-rose-400/30 text-rose-600 hover:bg-rose-500/10 transition-all" onClick={() => handleDelete(inv.id)} disabled={deleteStatus === 'loading'} type="button">
                        {deleteStatus === 'loading' ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between text-xs text-[var(--muted-foreground)] px-4 py-3 border-t border-[var(--card-border)]/70 bg-[var(--panel-strong)]/50 gap-3">
          <div className="flex items-center gap-2">
            <button className="border border-[var(--card-border)] rounded-xl px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--panel-strong)] transition-all" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} type="button">Prev</button>
            <span>Page {page} of {totalPages}</span>
            <button className="border border-[var(--card-border)] rounded-xl px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--panel-strong)] transition-all" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} type="button">Next</button>
          </div>
          <div className="flex items-center gap-2">
            <span>Showing</span>
            <select className="border border-[var(--card-border)] rounded-xl px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)]" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value) || 10); setPage(1) }}>
              {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>per page</span>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-30 p-4">
          <form className="bg-[var(--panel)] border border-[var(--card-border)]/70 rounded-[24px] shadow-[0_25px_80px_-40px_rgba(0,0,0,0.65)] w-full max-w-5xl p-6 relative max-h-[90vh] overflow-y-auto" onSubmit={handleSubmit}>
            <button className="absolute top-3 right-3 text-[var(--muted-foreground)] hover:text-[var(--text-primary)]" onClick={() => { setShowModal(false); resetForm(); setEditId(null) }} type="button">Close</button>
            <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">Investments</p>
                <h3 className="font-semibold text-[var(--text-primary)] text-xl">{editId ? 'Edit Investment' : 'Add New Investment'}</h3>
                <p className="text-sm text-[var(--muted-foreground)]">Create or update an investment with a live return preview.</p>
              </div>
              <div className="rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1 text-xs text-[var(--muted-foreground)]">
                Threshold: {formatCurrency(approvalThreshold)}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="space-y-5">
                <section className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Basic Information</h4>
                    <span className="text-xs text-[var(--muted-foreground)]">Required fields first</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Investment Date">
                      <div className="flex items-center border border-[var(--card-border)] rounded-xl px-3 py-2 bg-[var(--panel)]">
                        <input
                          type="date"
                          className="w-full outline-none bg-transparent"
                          value={form.startDate}
                          onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                          required
                        />
                      </div>
                    </Field>
                    <Field label="Company">
                      <div className="border border-[var(--card-border)] rounded-xl px-3 py-2 bg-[var(--panel)]">
                        <select
                          className="w-full outline-none bg-transparent"
                          value={active || ''}
                          onChange={(e) => dispatch(setActiveCompany(e.target.value))}
                        >
                          <option value="" disabled>Select company</option>
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </Field>
                    <Field label="Asset Type">
                      <div className="border border-[var(--card-border)] rounded-xl px-3 py-2 bg-[var(--panel)]">
                        <select
                          className="w-full outline-none bg-transparent"
                          value={form.assetType}
                          onChange={(e) => setForm((f) => ({ ...f, assetType: e.target.value }))}
                        >
                          {['savings', 'bonds', 'shares', 't-bills', 'other'].map((type) => (
                            <option key={type} value={type}>{assetMeta[type]?.label || type}</option>
                          ))}
                        </select>
                      </div>
                    </Field>
                    <Field label="Principal Amount (ETB)">
                      <div className="flex items-center border border-[var(--card-border)] rounded-xl px-3 py-2 bg-[var(--panel)]">
                        <input
                          type="number"
                          step="0.01"
                          className="w-full outline-none bg-transparent"
                          value={form.principal}
                          onChange={(e) => setForm((f) => ({ ...f, principal: e.target.value }))}
                          required
                        />
                        <span className="text-xs text-[var(--muted-foreground)] ml-2">Br</span>
                      </div>
                    </Field>
                    <Field label="Interest Rate (%)">
                      <div className="flex items-center border border-[var(--card-border)] rounded-xl px-3 py-2 bg-[var(--panel)]">
                        <input
                          type="number"
                          step="0.01"
                          className="w-full outline-none bg-transparent"
                          value={form.interestRate}
                          onChange={(e) => setForm((f) => ({ ...f, interestRate: e.target.value }))}
                          required
                        />
                        <span className="text-xs text-[var(--muted-foreground)] ml-2">%</span>
                      </div>
                    </Field>
                    <Field label="Duration">
                      <div className="flex items-center gap-2 border border-[var(--card-border)] rounded-xl px-3 py-2 bg-[var(--panel)]">
                        <input
                          type="number"
                          className="w-full outline-none bg-transparent"
                          value={form.duration}
                          onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                        />
                        <span className="text-xs text-[var(--muted-foreground)]">months</span>
                      </div>
                    </Field>
                  </div>
                </section>

                <section className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4 space-y-4">
                  <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setShowOptionalFields((v) => !v)}>
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Optional Fields</h4>
                      <p className="text-xs text-[var(--muted-foreground)]">Collapsible extra details for advanced investment types</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full border border-[var(--card-border)] bg-[var(--panel)]">{showOptionalFields ? 'Hide' : 'Show'}</span>
                  </button>
                  {showOptionalFields && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Selling Price (optional)">
                        <input
                          type="number"
                          step="0.01"
                          className="w-full border border-[var(--card-border)] rounded-xl px-3 py-2 bg-[var(--panel)]"
                          value={form.sellingPrice}
                          onChange={(e) => setForm((f) => ({ ...f, sellingPrice: e.target.value }))}
                        />
                      </Field>
                      <Field label="Buying Price (optional)">
                        <input
                          type="number"
                          step="0.01"
                          className="w-full border border-[var(--card-border)] rounded-xl px-3 py-2 bg-[var(--panel)]"
                          value={form.buyingPrice}
                          onChange={(e) => setForm((f) => ({ ...f, buyingPrice: e.target.value }))}
                        />
                      </Field>
                      <Field label="Shares (optional)">
                        <input
                          type="number"
                          step="0.01"
                          className="w-full border border-[var(--card-border)] rounded-xl px-3 py-2 bg-[var(--panel)]"
                          value={form.shares}
                          onChange={(e) => setForm((f) => ({ ...f, shares: e.target.value }))}
                        />
                      </Field>
                      <Field label="Dividend Rate (per share)">
                        <input
                          type="number"
                          step="0.01"
                          className="w-full border border-[var(--card-border)] rounded-xl px-3 py-2 bg-[var(--panel)]"
                          value={form.dividendRate}
                          onChange={(e) => setForm((f) => ({ ...f, dividendRate: e.target.value }))}
                        />
                      </Field>
                      <Field label="Additional Notes" className="md:col-span-2">
                        <textarea
                          className="w-full border border-[var(--card-border)] rounded-xl px-3 py-2 bg-[var(--panel)] text-[var(--text-primary)]"
                          rows={3}
                          placeholder="Annual government bond - fixed rate"
                          value={form.notes}
                          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                        />
                      </Field>
                    </div>
                  )}
                </section>
              </div>

              <div className="space-y-5">
                <section className="rounded-[20px] border border-[var(--card-border)] bg-gradient-to-b from-[var(--bg-card)] to-[var(--panel-strong)]/60 p-4 space-y-4 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.45)]">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Calculation Preview</h4>
                    <span className="text-xs text-[var(--muted-foreground)]">updates as you type</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <PreviewMetric icon="💰" label="Principal" value={formatCurrency(form.principal || 0)} tone="blue" />
                    <PreviewMetric icon="📈" label="Interest Rate" value={`${formatNumber(form.interestRate || 0)}%`} tone="purple" />
                    <PreviewMetric icon="⏱️" label="Duration" value={`${form.duration || 0} months`} tone="amber" />
                    <PreviewMetric icon="🗓️" label="Maturity Date" value={maturityDatePreview} tone="slate" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ResultTile icon="💵" label="Total Interest" value={formatCurrency(simpleInterest)} />
                    <ResultTile icon="💳" label="Total Return" value={formatCurrency(totalReturn)} />
                  </div>
                </section>

                <section className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Delivery Options</h4>
                    <span className="text-xs text-[var(--muted-foreground)]">workflow controls</span>
                  </div>
                  <div className="flex flex-col gap-3 text-sm text-[var(--text-primary)]">
                    <label className="flex items-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--panel)] px-3 py-2">
                      <input
                        type="checkbox"
                        checked={form.notifyStakeholders}
                        onChange={(e) => setForm((f) => ({ ...f, notifyStakeholders: e.target.checked }))}
                      />
                      <span>Send notification to stakeholders</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--panel)] px-3 py-2">
                      <input
                        type="checkbox"
                        checked={form.sendToApproval}
                        onChange={(e) => setForm((f) => ({ ...f, sendToApproval: e.target.checked }))}
                      />
                      <span>Require approval for investments over {formatCurrency(approvalThreshold)}</span>
                    </label>
                  </div>
                </section>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end mt-5">
              {formError && <span className="text-xs text-rose-500 mr-auto">{formError}</span>}
              <button type="button" className="px-4 py-2 border border-[var(--card-border)] text-[var(--text-primary)] rounded-xl text-sm bg-[var(--bg-card)] hover:bg-[var(--panel-strong)] transition-all" onClick={() => { setShowModal(false); resetForm(); setEditId(null) }}>Cancel</button>
              <button type="submit" className="px-4 py-2 bg-gradient-to-r from-[var(--brand-primary)] to-cyan-500 text-white rounded-xl text-sm disabled:opacity-60 shadow-[0_14px_40px_-20px_rgba(59,130,246,0.6)] hover:shadow-[0_16px_42px_-20px_rgba(59,130,246,0.64)] transition-all" disabled={(createStatus === 'loading' || updateStatus === 'loading') || !active}>
                {createStatus === 'loading' || updateStatus === 'loading' ? 'Saving...' : editId ? 'Update Investment' : 'Add Investment'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

const MetricCard = ({ icon, title, value, loading, trend, accent = 'blue', caption }) => {
  const accentMap = {
    blue: 'border-sky-500/20 bg-sky-500/5',
    emerald: 'border-emerald-500/20 bg-emerald-500/5',
    purple: 'border-violet-500/20 bg-violet-500/5',
    amber: 'border-amber-500/20 bg-amber-500/5',
    slate: 'border-slate-200/80 bg-slate-500/5'
  }
  const meta = accentMap[accent] || accentMap.blue
  return (
    <div className={`relative overflow-hidden rounded-[20px] border bg-[var(--bg-card)] p-4 shadow-[0_16px_50px_-35px_rgba(0,0,0,0.65)] hover:-translate-y-0.5 hover:shadow-[0_20px_60px_-34px_rgba(0,0,0,0.68)] transition-all ${meta}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-60" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            <span className="text-base leading-none">{icon}</span>
            <span>{title}</span>
          </div>
          <p className="text-[26px] font-semibold tracking-tight text-[var(--text-primary)]">{loading ? '...' : value}</p>
          {caption && <p className="text-xs text-[var(--muted-foreground)]">{caption}</p>}
          {trend && <p className="text-xs font-medium text-emerald-600 dark:text-emerald-300 mt-1">{trend}</p>}
        </div>
        <div className="h-11 w-11 rounded-2xl bg-[var(--panel)] border border-[var(--card-border)]/80 flex items-center justify-center text-lg shadow-[0_12px_28px_-18px_rgba(15,23,42,0.35)]">
          {icon}
        </div>
      </div>
    </div>
  )
}

const Field = ({ label, children, className = '' }) => (
  <div className={`space-y-1 ${className}`}>
    <label className="text-xs text-[var(--muted-foreground)] font-medium">{label}</label>
    {children}
  </div>
)

const PreviewMetric = ({ icon, label, value, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-sky-500/10 text-sky-700 border-sky-500/20',
    purple: 'bg-violet-500/10 text-violet-700 border-violet-500/20',
    amber: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
    slate: 'bg-slate-500/10 text-slate-700 border-slate-200/80'
  }
  return (
    <div className={`rounded-2xl border p-3 ${tones[tone] || tones.blue}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] opacity-80">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{value}</div>
    </div>
  )
}

const ResultTile = ({ icon, label, value }) => (
  <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-3 shadow-[0_12px_32px_-22px_rgba(15,23,42,0.28)]">
    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
      <span>{icon}</span>
      <span>{label}</span>
    </div>
    <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{value}</div>
  </div>
)

const StatusPill = ({ status }) => {
  const meta = getStatusMeta(status)
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 text-xs rounded-full font-medium border ${meta.cls}`}>
      <span className={`inline-block w-2 h-2 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  )
}

const formatNumber = (val) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(val || 0)

export default InvestmentsPage
