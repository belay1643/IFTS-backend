import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import dayjs from 'dayjs'
import { useSearchParams } from 'react-router-dom'
import { setActiveCompany } from '../store/slices/companySlice'
import {
  fetchTransactions,
  fetchTransactionMetrics,
  createTransaction,
  updateTransaction,
  deleteTransaction
} from '../store/slices/transactionSlice'
import { fetchInvestments } from '../store/slices/investmentSlice'

const TRANSACTION_TYPES = ['buy', 'sell', 'dividend', 'interest', 'transfer', 'expense']
const STATUS_OPTIONS = ['pending', 'approved', 'posted', 'rejected']
const FORM_STATUS_OPTIONS = ['pending', 'approved', 'rejected']

const createDefaultForm = () => ({
  transactionType: 'buy',
  amount: '',
  date: dayjs().format('YYYY-MM-DD'),
  description: '',
  status: 'pending',
  investmentId: '',
  reference: '',
  notes: ''
})

const TransactionsPage = () => {
  const dispatch = useDispatch()
  const { active, list: companies } = useSelector((s) => s.company)
  const { items, metrics, status, metricsStatus, createStatus, updateStatus, deleteStatus, error } = useSelector((s) => s.transactions)
  const { items: investments } = useSelector((s) => s.investments)

  const [form, setForm] = useState(createDefaultForm())
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [formError, setFormError] = useState('')
  const [attachmentName, setAttachmentName] = useState('')

  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateRange, setDateRange] = useState('last30')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const uploadRef = useRef(null)
  const searchInputRef = useRef(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const activeCompany = useMemo(() => companies.find((c) => c.id === active), [companies, active])
  const approvalThreshold = Number(activeCompany?.approvalThreshold || 10000)

  useEffect(() => {
    const companyId = active || companies[0]?.id
    if (!companyId) return
    if (!active && companyId) dispatch(setActiveCompany(companyId))
    dispatch(fetchTransactions(companyId))
    dispatch(fetchTransactionMetrics(companyId))
    dispatch(fetchInvestments(companyId))
  }, [active, companies, dispatch])

  useEffect(() => {
    const targetTransactionId = (searchParams.get('transactionId') || '').trim()
    if (!targetTransactionId) return

    setSearch(targetTransactionId)
    setPage(1)

    const raf = requestAnimationFrame(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus()
        searchInputRef.current.select()
      }
    })

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('transactionId')
    setSearchParams(nextParams, { replace: true })

    return () => cancelAnimationFrame(raf)
  }, [searchParams, setSearchParams])

  const rows = useMemo(() => {
    return items.map((tx, idx) => {
      const inv = investments.find((i) => i.id === tx.investmentId)
      return {
        ...tx,
        txCode: `TXN-${String(idx + 1).padStart(4, '0')}`,
        displayDate: tx.date ? dayjs(tx.date).format('MMM D, YYYY') : '—',
        companyName: companies.find((c) => c.id === tx.companyId)?.name || '—',
        investmentName: inv ? `${toTitle(inv.assetType)} • ${compactId(inv.id)}` : '—',
        assetType: inv?.assetType || '—'
      }
    })
  }, [items, investments, companies])

  const filtered = useMemo(() => {
    let list = rows

    if (companyFilter) list = list.filter((r) => r.companyId === companyFilter)
    if (typeFilter) list = list.filter((r) => r.transactionType === typeFilter)
    if (statusFilter) list = list.filter((r) => r.status === statusFilter)

    if (dateRange && dateRange !== 'all') {
      const now = dayjs()
      list = list.filter((r) => {
        if (!r.date) return true
        const date = dayjs(r.date)
        if (dateRange === 'last30') return date.isAfter(now.subtract(30, 'day'))
        if (dateRange === 'last90') return date.isAfter(now.subtract(90, 'day'))
        if (dateRange === 'ytd') return date.isAfter(now.startOf('year'))
        return true
      })
    }

    if (minAmount) list = list.filter((r) => Number(r.amount || 0) >= Number(minAmount))
    if (maxAmount) list = list.filter((r) => Number(r.amount || 0) <= Number(maxAmount))

    if (search.trim()) {
      const term = search.toLowerCase()
      list = list.filter((r) =>
        String(r.id || '').toLowerCase().includes(term) ||
        String(r.txCode || '').toLowerCase().includes(term) ||
        String(r.description || '').toLowerCase().includes(term) ||
        String(r.companyName || '').toLowerCase().includes(term) ||
        String(r.investmentName || '').toLowerCase().includes(term) ||
        String(r.notes || '').toLowerCase().includes(term)
      )
    }

    return list
  }, [rows, companyFilter, typeFilter, statusFilter, dateRange, minAmount, maxAmount, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const totalValue = useMemo(() => filtered.reduce((sum, t) => sum + Number(t.amount || 0), 0), [filtered])
  const pendingCount = useMemo(() => filtered.filter((t) => t.status === 'pending').length, [filtered])
  const headerSummary = `${filtered.length} ${filtered.length === 1 ? 'transaction' : 'transactions'} • ${formatCurrency(totalValue)} total value`

  const companyChipCounts = useMemo(() => {
    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      count: rows.filter((r) => r.companyId === c.id).length
    }))
  }, [companies, rows])

  const typeChipCounts = useMemo(() => {
    return TRANSACTION_TYPES.map((type) => ({
      type,
      count: rows.filter((r) => r.transactionType === type).length
    }))
  }, [rows])

  const statusChipCounts = useMemo(() => {
    return STATUS_OPTIONS.map((st) => ({
      status: st,
      count: rows.filter((r) => r.status === st).length
    }))
  }, [rows])

  const resetForm = () => {
    setForm(createDefaultForm())
    setEditId(null)
    setShowAdvanced(false)
    setFormError('')
    setAttachmentName('')
  }

  const closeForm = () => {
    setShowForm(false)
    resetForm()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const companyId = active || companies[0]?.id
    if (!companyId) return setFormError('Select a company first.')

    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) return setFormError('Amount must be greater than 0.')

    const payload = {
      ...form,
      companyId,
      amount,
      investmentId: form.investmentId || undefined
    }

    ;['reference', 'notes'].forEach((key) => {
      if (!payload[key]) delete payload[key]
    })

    const refresh = () => {
      dispatch(fetchTransactions(companyId))
      dispatch(fetchTransactionMetrics(companyId))
      closeForm()
    }

    const onError = (err) => {
      const firstValidation = err?.errors?.[0]?.msg
      setFormError(firstValidation || err?.message || 'Could not save transaction.')
    }

    if (editId) {
      dispatch(updateTransaction({ id: editId, updates: payload })).unwrap().then(refresh).catch(onError)
    } else {
      dispatch(createTransaction(payload)).unwrap().then(refresh).catch(onError)
    }
  }

  const handleEdit = (tx) => {
    setEditId(tx.id)
    setShowAdvanced(Boolean(tx.reference || tx.notes))
    setForm({
      transactionType: tx.transactionType || 'buy',
      amount: tx.amount || '',
      date: tx.date ? dayjs(tx.date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      description: tx.description || '',
      status: tx.status || 'pending',
      investmentId: tx.investmentId || '',
      reference: tx.reference || '',
      notes: tx.notes || ''
    })
    setShowForm(true)
  }

  const handleDelete = (id) => {
    const companyId = active || companies[0]?.id
    if (!companyId) return
    dispatch(deleteTransaction(id))
      .unwrap()
      .then(() => dispatch(fetchTransactions(companyId)))
      .then(() => dispatch(fetchTransactionMetrics(companyId)))
  }

  const handleExport = () => {
    if (!filtered.length) return
    const header = ['Code', 'Company', 'Type', 'Asset Type', 'Amount', 'Date', 'Status', 'Description']
    const csv = [header.join(',')]
    filtered.forEach((r) => {
      csv.push([
        r.txCode,
        cleanCsv(r.companyName),
        r.transactionType,
        cleanCsv(r.assetType),
        r.amount,
        r.date,
        r.status,
        cleanCsv(r.description || '')
      ].join(','))
    })
    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'transactions.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleBulkUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (evt) => {
      const text = String(evt.target?.result || '')
      const lines = text.split(/\r?\n/).filter(Boolean)
      if (lines.length <= 1) return

      const companyId = active || companies[0]?.id
      if (!companyId) return

      const parsed = lines.slice(1).map((line) => line.split(','))
      const tasks = parsed.map((cols) => {
        const [date, type, description, amount, statusValue] = cols
        return dispatch(createTransaction({
          companyId,
          date: date || dayjs().format('YYYY-MM-DD'),
          transactionType: (type || 'buy').toLowerCase(),
          description: description || '',
          amount: Math.max(0.01, Number(amount) || 0.01),
          status: statusValue || 'pending'
        })).unwrap()
      })

      await Promise.allSettled(tasks)
      dispatch(fetchTransactions(companyId))
      dispatch(fetchTransactionMetrics(companyId))
    }

    reader.readAsText(file)
    e.target.value = ''
  }

  const resetFilters = () => {
    setSearch('')
    setCompanyFilter('')
    setTypeFilter('')
    setStatusFilter('')
    setDateRange('last30')
    setMinAmount('')
    setMaxAmount('')
    setPage(1)
  }

  return (
    <div className="space-y-5 text-[var(--text-primary)]">
      <div className="bg-gradient-to-r from-[var(--brand-primary)]/12 via-[var(--brand-primary)]/6 to-transparent border border-[var(--card-border)]/60 rounded-[24px] px-5 py-5 shadow-[0_10px_45px_-25px_rgba(0,0,0,0.45)] relative overflow-hidden">
        <div className="absolute inset-0 opacity-35" style={{ background: 'radial-gradient(circle at 15% 20%, rgba(104,210,232,0.18), transparent 35%), radial-gradient(circle at 85% 15%, rgba(52,211,153,0.16), transparent 35%)' }} />
        <div className="relative flex flex-wrap items-start gap-4 justify-between">
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">Transactions</p>
            <h1 className="text-3xl font-semibold tracking-tight">Transaction Flow</h1>
            <p className="text-sm text-[var(--muted-foreground)]">{headerSummary}</p>
            <p className="text-sm text-[var(--muted-foreground)]">Track, filter, and manage every flow across companies.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button type="button" className="px-4 py-2 bg-gradient-to-r from-[var(--brand-primary)] to-cyan-500 text-white rounded-xl text-sm shadow-[0_14px_32px_-18px_rgba(59,130,246,0.55)] hover:shadow-[0_16px_36px_-18px_rgba(59,130,246,0.6)] transition-all" onClick={() => { resetForm(); setShowForm(true) }}>
              + Add Transaction
            </button>
            <button type="button" className="px-4 py-2 border border-[var(--card-border)] rounded-xl text-sm bg-[var(--bg-card)] hover:bg-[var(--panel-strong)] transition-all" onClick={handleExport}>
              Export
            </button>
            <button type="button" className="px-4 py-2 border border-[var(--card-border)] rounded-xl text-sm bg-[var(--bg-card)] hover:bg-[var(--panel-strong)] transition-all" onClick={() => uploadRef.current?.click()}>
              Bulk Upload
            </button>
            <select className="bg-[var(--panel)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] shadow-[0_10px_30px_-24px_rgba(15,23,42,0.28)]" value={active || ''} onChange={(e) => dispatch(setActiveCompany(e.target.value))}>
              <option value="" disabled>Select company</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="text-sm text-rose-600">{String(error)}</div>}

      <input type="file" accept=".csv" ref={uploadRef} className="hidden" onChange={handleBulkUpload} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <StatsCard icon="📋" title="Total Transactions" value={filtered.length} subtitle="Across current filters" trend="Up 12% from last month" tone="blue" loading={metricsStatus === 'loading'} />
        <StatsCard icon="💰" title="Total Value" value={formatCurrency(totalValue)} subtitle="Combined transaction amount" trend="Up 8% from last month" tone="emerald" loading={metricsStatus === 'loading'} />
        <StatsCard icon="⏳" title="Pending Approvals" value={pendingCount} subtitle={pendingCount ? 'Requires review' : 'No pending approvals'} trend={pendingCount ? `${pendingCount} pending` : 'No pending approvals'} tone="amber" loading={metricsStatus === 'loading'} />
      </div>

      <div className="bg-[var(--panel)] border border-[var(--card-border)]/70 rounded-[24px] p-4 shadow-[0_20px_70px_-45px_rgba(0,0,0,0.6)] space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={searchInputRef}
            className="flex-1 min-w-[220px] border border-[var(--card-border)] rounded-xl px-3 py-2 bg-[var(--bg-card)] text-sm placeholder:text-[var(--muted-foreground)]"
            placeholder="Search transactions by code, company, notes..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
          <select className="border border-[var(--card-border)] rounded-xl px-3 py-2 bg-[var(--bg-card)] text-sm" value={dateRange} onChange={(e) => { setDateRange(e.target.value); setPage(1) }}>
            <option value="last30">Last 30 days</option>
            <option value="last90">Last 90 days</option>
            <option value="ytd">Year to date</option>
            <option value="all">All time</option>
          </select>
          <input type="number" min="0.01" step="0.01" className="w-28 border border-[var(--card-border)] rounded-xl px-3 py-2 bg-[var(--bg-card)] text-sm" placeholder="Min" value={minAmount} onChange={(e) => { setMinAmount(e.target.value); setPage(1) }} />
          <input type="number" min="0.01" step="0.01" className="w-28 border border-[var(--card-border)] rounded-xl px-3 py-2 bg-[var(--bg-card)] text-sm" placeholder="Max" value={maxAmount} onChange={(e) => { setMaxAmount(e.target.value); setPage(1) }} />
          <button type="button" className="px-3 py-2 border border-[var(--card-border)] rounded-xl text-sm bg-[var(--bg-card)] hover:bg-[var(--panel-strong)]" onClick={resetFilters}>Reset</button>
        </div>

        <div className="space-y-2">
          <ChipRow
            label="Companies"
            options={[{ value: '', label: `All (${rows.length})` }, ...companyChipCounts.map((c) => ({ value: c.id, label: `${c.name} (${c.count})` }))]}
            selected={companyFilter}
            onSelect={(value) => { setCompanyFilter(value); setPage(1) }}
          />
          <ChipRow
            label="Types"
            options={[{ value: '', label: `All (${rows.length})` }, ...typeChipCounts.map((t) => ({ value: t.type, label: `${toTitle(t.type)} (${t.count})` }))]}
            selected={typeFilter}
            onSelect={(value) => { setTypeFilter(value); setPage(1) }}
          />
          <ChipRow
            label="Status"
            options={[{ value: '', label: `All (${rows.length})` }, ...statusChipCounts.map((s) => ({ value: s.status, label: `${toTitle(s.status)} (${s.count})` }))]}
            selected={statusFilter}
            onSelect={(value) => { setStatusFilter(value); setPage(1) }}
          />
        </div>
      </div>

      <div className="bg-[var(--panel)] rounded-[24px] border border-[var(--card-border)]/70 shadow-[0_20px_70px_-45px_rgba(0,0,0,0.6)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--card-border)]/70 bg-[var(--bg-card)]/75 backdrop-blur-sm">
          <div className="space-y-0.5">
            <h3 className="font-semibold text-[var(--text-primary)]">Transaction Ledger</h3>
            <p className="text-xs text-[var(--muted-foreground)]">{filtered.length} transactions visible in current filter set</p>
          </div>
          {status === 'loading' && <span className="text-xs text-[var(--muted-foreground)]">Loading...</span>}
        </div>

        <div className="p-4 space-y-3">
          {status === 'loading' && !rows.length ? (
            <>
              <LedgerSkeleton />
              <LedgerSkeleton />
              <LedgerSkeleton />
            </>
          ) : paged.length === 0 ? (
            <EmptyTransactions onCreate={() => { resetForm(); setShowForm(true) }} />
          ) : (
            paged.map((tx) => (
              <TransactionCard
                key={tx.id}
                tx={tx}
                onView={() => handleEdit(tx)}
                onEdit={() => handleEdit(tx)}
                onDelete={() => handleDelete(tx.id)}
                deleting={deleteStatus === 'loading'}
              />
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between text-xs text-[var(--muted-foreground)] px-4 py-3 border-t border-[var(--card-border)]/70 bg-[var(--panel-strong)]/50 gap-3">
          <div className="flex items-center gap-2">
            <button type="button" className="border border-[var(--card-border)] rounded-xl px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] disabled:opacity-50" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" className="border border-[var(--card-border)] rounded-xl px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] disabled:opacity-50" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
          </div>
          <div className="flex items-center gap-2">
            <span>Per page</span>
            <select className="border border-[var(--card-border)] rounded-xl px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)]" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value) || 10); setPage(1) }}>
              {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-20 p-4">
          <form className="bg-[var(--panel)] border border-[var(--card-border)]/70 rounded-[24px] shadow-[0_25px_80px_-40px_rgba(0,0,0,0.65)] w-full max-w-5xl p-6 relative max-h-[90vh] overflow-y-auto" onSubmit={handleSubmit}>
            <button className="absolute top-3 right-3 text-[var(--muted-foreground)] hover:text-[var(--text-primary)]" onClick={closeForm} type="button">Close</button>

            <div className="space-y-1 mb-5">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">Transactions</p>
              <h3 className="font-semibold text-[var(--text-primary)] text-xl">{editId ? 'Edit Transaction' : 'Add New Transaction'}</h3>
              <p className="text-sm text-[var(--muted-foreground)]">Record a buy, sell, dividend, or expense across any company.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <section className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4 space-y-4">
                <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Transaction Details</h4>

                <Field label="Transaction Type">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {TRANSACTION_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={`px-3 py-2 rounded-xl text-sm border transition-all ${form.transactionType === type ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--text-primary)]' : 'border-[var(--card-border)] bg-[var(--panel)] text-[var(--muted-foreground)] hover:text-[var(--text-primary)]'}`}
                        onClick={() => setForm((f) => ({ ...f, transactionType: type }))}
                      >
                        {toTitle(type)}
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Date">
                    <input type="date" className="w-full border border-[var(--card-border)] bg-[var(--panel)] rounded-xl px-3 py-2" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />
                  </Field>
                  <Field label="Company">
                    <select className="w-full border border-[var(--card-border)] bg-[var(--panel)] rounded-xl px-3 py-2" value={active || ''} onChange={(e) => dispatch(setActiveCompany(e.target.value))}>
                      <option value="" disabled>Select company</option>
                      {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Investment (optional)">
                    <select className="w-full border border-[var(--card-border)] bg-[var(--panel)] rounded-xl px-3 py-2" value={form.investmentId} onChange={(e) => setForm((f) => ({ ...f, investmentId: e.target.value }))}>
                      <option value="">Select Investment</option>
                      {investments.map((inv) => <option key={inv.id} value={inv.id}>{toTitle(inv.assetType)} • {compactId(inv.id)}</option>)}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select className="w-full border border-[var(--card-border)] bg-[var(--panel)] rounded-xl px-3 py-2" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                      {FORM_STATUS_OPTIONS.map((st) => <option key={st} value={st}>{toTitle(st)}</option>)}
                    </select>
                  </Field>
                  <Field label="Amount (ETB)">
                    <div className="flex items-center border border-[var(--card-border)] bg-[var(--panel)] rounded-xl px-3 py-2">
                      <span className="text-sm text-[var(--muted-foreground)] mr-2">Br</span>
                      <input type="number" min="0.01" step="0.01" placeholder="e.g., 1000000" className="w-full bg-transparent outline-none" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} required />
                    </div>
                  </Field>
                  <Field label="Description">
                    <input className="w-full border border-[var(--card-border)] bg-[var(--panel)] rounded-xl px-3 py-2" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g., Bond purchase" required />
                  </Field>
                </div>
              </section>

              <div className="space-y-5">
                <section className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4 space-y-4">
                  <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setShowAdvanced((v) => !v)}>
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Additional Information</h4>
                      <p className="text-xs text-[var(--muted-foreground)]">Optional fields for references and notes</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full border border-[var(--card-border)] bg-[var(--panel)]">{showAdvanced ? 'Hide' : 'Show'}</span>
                  </button>
                  {showAdvanced && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Reference Number">
                          <input className="w-full border border-[var(--card-border)] bg-[var(--panel)] rounded-xl px-3 py-2" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
                        </Field>
                        <Field label="Attachment">
                          <label className="flex items-center justify-between w-full border border-[var(--card-border)] bg-[var(--panel)] rounded-xl px-3 py-2 cursor-pointer hover:bg-[var(--panel-strong)] transition-all">
                            <span className="text-sm text-[var(--muted-foreground)] truncate">{attachmentName || 'Upload file'}</span>
                            <span aria-hidden="true">📎</span>
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => setAttachmentName(e.target.files?.[0]?.name || '')}
                            />
                          </label>
                        </Field>
                        <Field label="Notes" className="md:col-span-2">
                          <textarea rows={3} className="w-full border border-[var(--card-border)] bg-[var(--panel)] rounded-xl px-3 py-2" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                        </Field>
                      </div>
                    </div>
                  )}
                </section>

                <section className="rounded-[20px] border border-amber-400/35 bg-amber-500/10 p-4 space-y-1">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Approval</h4>
                  <p className="text-sm text-amber-800 dark:text-amber-300">Transactions above {formatCurrency(approvalThreshold)} require approval.</p>
                  {Number(form.amount || 0) > 0 ? (
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      Current amount: {formatCurrency(form.amount || 0)} {Number(form.amount || 0) >= approvalThreshold ? '→ Approval required' : '→ Approval not required'}
                    </p>
                  ) : (
                    <p className="text-sm text-amber-800 dark:text-amber-300">Enter amount to check approval requirement.</p>
                  )}
                </section>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end mt-5">
              {formError && <span className="text-xs text-rose-500 mr-auto">{formError}</span>}
              <button type="button" className="px-4 py-2 border border-[var(--card-border)] text-[var(--text-primary)] rounded-xl text-sm bg-[var(--bg-card)] hover:bg-[var(--panel-strong)] transition-all" onClick={closeForm}>Cancel</button>
              <button type="submit" className="px-4 py-2 bg-gradient-to-r from-[var(--brand-primary)] to-cyan-500 text-white rounded-xl text-sm disabled:opacity-60 shadow-[0_14px_40px_-20px_rgba(59,130,246,0.6)] hover:shadow-[0_16px_42px_-20px_rgba(59,130,246,0.64)] transition-all" disabled={(createStatus === 'loading' || updateStatus === 'loading') || !active}>
                {createStatus === 'loading' || updateStatus === 'loading' ? 'Saving...' : 'Save Transaction'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

const StatsCard = ({ icon, title, value, subtitle, trend, tone = 'blue', loading }) => {
  const toneMap = {
    blue: 'border-sky-500/20 bg-sky-500/5',
    emerald: 'border-emerald-500/20 bg-emerald-500/5',
    amber: 'border-amber-500/20 bg-amber-500/5'
  }
  return (
    <div className={`relative overflow-hidden rounded-[20px] border bg-[var(--bg-card)] p-4 shadow-[0_16px_50px_-35px_rgba(0,0,0,0.65)] transition-all ${toneMap[tone] || toneMap.blue}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-60" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            <span className="text-base leading-none">{icon}</span>
            <span>{title}</span>
          </div>
          <p className="text-[26px] font-semibold tracking-tight text-[var(--text-primary)]">{loading ? '...' : value}</p>
          <p className="text-xs text-[var(--muted-foreground)]">{subtitle}</p>
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-300">{trend}</p>
        </div>
        <div className="h-11 w-11 rounded-2xl bg-[var(--panel)] border border-[var(--card-border)]/80 flex items-center justify-center text-lg">
          {icon}
        </div>
      </div>
    </div>
  )
}

const ChipRow = ({ label, options, selected, onSelect }) => (
  <div className="flex flex-wrap items-center gap-2 text-xs">
    <span className="text-[var(--muted-foreground)] w-20">{label}</span>
    {options.map((opt) => (
      <button
        key={`${label}-${opt.value || 'all'}`}
        type="button"
        onClick={() => onSelect(opt.value)}
        className={`px-3 py-1.5 rounded-full border transition-all ${selected === opt.value ? 'bg-[var(--brand-primary)]/12 text-[var(--brand-primary)] border-[var(--brand-primary)]/30' : 'bg-[var(--bg-card)] border-[var(--card-border)] text-[var(--muted-foreground)] hover:text-[var(--text-primary)]'}`}
      >
        {opt.label}
      </button>
    ))}
  </div>
)

const TransactionCard = ({ tx, onView, onEdit, onDelete, deleting }) => (
  <div className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.3)] hover:shadow-[0_20px_50px_-30px_rgba(15,23,42,0.34)] transition-all">
    <div className="flex items-center justify-between gap-3">
      <h4 className="font-semibold text-[var(--text-primary)]">{tx.txCode}</h4>
      <StatusPill status={tx.status} />
    </div>
    <div className="my-2 h-px bg-[var(--card-border)]/70" />
    <div className="mt-2 text-sm text-[var(--muted-foreground)]">
      {tx.companyName} • {toTitle(tx.transactionType)} • {tx.displayDate}
    </div>
    <div className="mt-3 space-y-1.5 text-sm">
      <p><span className="text-[var(--muted-foreground)]">Amount:</span> <span className="font-semibold text-[var(--text-primary)]">{formatCurrency(tx.amount)}</span></p>
      <p><span className="text-[var(--muted-foreground)]">Description:</span> <span className="text-[var(--text-primary)]">{fixCommonTypos(tx.description) || 'No description'}</span></p>
      <p>
        <span className="text-[var(--muted-foreground)]">Investment:</span> <span className="text-[var(--text-primary)]">{tx.investmentName}</span>
        <span className="text-[var(--muted-foreground)]"> • Asset:</span> <span className="text-[var(--text-primary)]">{tx.assetType === '—' ? '—' : toTitle(tx.assetType)}</span>
      </p>
    </div>
    <div className="mt-4 flex items-center gap-2">
      <button type="button" className="text-xs px-3 py-1.5 rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] hover:bg-[var(--panel-strong)] transition-all" onClick={onView}>View</button>
      <button type="button" className="text-xs px-3 py-1.5 rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] hover:bg-[var(--panel-strong)] transition-all" onClick={onEdit}>Edit</button>
      <button type="button" className="text-xs px-3 py-1.5 rounded-full border border-rose-400/30 text-rose-600 hover:bg-rose-500/10 transition-all" onClick={onDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</button>
    </div>
  </div>
)

const EmptyTransactions = ({ onCreate }) => (
  <div className="mx-auto max-w-md rounded-[24px] border border-dashed border-[var(--card-border)] bg-[var(--bg-card)] px-6 py-10 text-center space-y-3 shadow-[0_16px_48px_-34px_rgba(15,23,42,0.3)]">
    <div className="text-4xl">🧾</div>
    <div>
      <h4 className="text-lg font-semibold text-[var(--text-primary)]">No Transactions Yet</h4>
      <p className="text-sm text-[var(--muted-foreground)]">Record your first transaction to start tracking flows.</p>
    </div>
    <button type="button" className="px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--brand-primary)] to-cyan-500 text-white text-sm shadow-[0_14px_32px_-18px_rgba(59,130,246,0.55)] hover:shadow-[0_16px_36px_-18px_rgba(59,130,246,0.6)] transition-all" onClick={onCreate}>
      + Add Transaction
    </button>
  </div>
)

const LedgerSkeleton = () => (
  <div className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4 animate-pulse space-y-3">
    <div className="h-4 w-32 bg-[var(--panel-strong)] rounded" />
    <div className="h-3 w-64 bg-[var(--panel-strong)] rounded" />
    <div className="grid grid-cols-3 gap-3">
      <div className="h-10 bg-[var(--panel-strong)] rounded" />
      <div className="h-10 bg-[var(--panel-strong)] rounded" />
      <div className="h-10 bg-[var(--panel-strong)] rounded" />
    </div>
  </div>
)

const Field = ({ label, children, className = '' }) => (
  <div className={`space-y-1 ${className}`}>
    <label className="text-xs text-[var(--muted-foreground)] font-medium">{label}</label>
    {children}
  </div>
)

const StatusPill = ({ status }) => {
  const key = String(status || '').toLowerCase()
  const map = {
    approved: { icon: '🟢', label: 'Approved', cls: 'bg-emerald-500/20 text-emerald-700 border border-emerald-500/40' },
    posted: { icon: '⚪', label: 'Posted', cls: 'bg-slate-500/15 text-slate-700 border border-slate-500/35' },
    pending: { icon: '🟡', label: 'Pending', cls: 'bg-amber-400/25 text-amber-800 border border-amber-500/50' },
    rejected: { icon: '🔴', label: 'Rejected', cls: 'bg-rose-500/20 text-rose-700 border border-rose-500/40' }
  }
  const meta = map[key] || { icon: '⚪', label: toTitle(status || 'pending'), cls: 'bg-[var(--panel-strong)] text-[var(--text-secondary)] border border-[var(--card-border)]' }
  return <span className={`px-3 py-1 text-xs rounded-full font-semibold inline-flex items-center gap-1.5 ${meta.cls}`}><span>{meta.icon}</span><span>{meta.label}</span></span>
}

const compactId = (value) => {
  const text = String(value || '')
  if (!text) return '—'
  if (text.length <= 10) return text
  return `${text.slice(0, 4)}...${text.slice(-4)}`
}

const cleanCsv = (value) => String(value || '').replace(/,/g, ' ')
const fixCommonTypos = (value = '') => String(value).replace(/\bpurshasing\b/gi, 'Purchasing')
const toTitle = (value = '') => String(value).replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
const formatNumber = (value) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value || 0))
const formatCurrency = (value) => `Br ${formatNumber(value)}`

export default TransactionsPage
