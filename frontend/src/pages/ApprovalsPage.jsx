import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import dayjs from 'dayjs'
import { fetchApprovals, decideApproval } from '../store/slices/approvalSlice.js'
import { fetchTransactions, fetchTransactionMetrics } from '../store/slices/transactionSlice.js'
import { loadCompanySystemSettings } from '../utils/companySettings.js'

const TAB_OPTIONS = [
  { key: 'pending', label: 'Pending', icon: '⏳' },
  { key: 'history', label: 'History', icon: '📜' }
]

const DATE_RANGE_OPTIONS = [
  { label: 'Last 30 days', key: 'last30', days: 30 },
  { label: 'Last 90 days', key: 'last90', days: 90 },
  { label: 'Year to date', key: 'ytd' },
  { label: 'All time', key: 'all' }
]

const AMOUNT_RANGE_OPTIONS = [
  { label: 'Any amount', key: 'any' },
  { label: '0 - 500k', key: '0-500k', min: 0, max: 500000 },
  { label: '500k - 2M', key: '500k-2m', min: 500000, max: 2000000 },
  { label: '2M+', key: '2m+', min: 2000000 }
]

const PENDING_THRESHOLD_FALLBACK = 10000

const ApprovalsPage = () => {
  const dispatch = useDispatch()
  const { items, status, decideStatus, error } = useSelector((s) => s.approvals)
  const { active, list: companies } = useSelector((s) => s.company)
  const activeCompany = useMemo(() => companies.find((company) => company.id === active), [companies, active])

  const [activeTab, setActiveTab] = useState('pending')
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [dateFilter, setDateFilter] = useState('last30')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState([])
  const [selectedApproval, setSelectedApproval] = useState(null)
  const [decisionNotes, setDecisionNotes] = useState('')
  const [modalBusy, setModalBusy] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)

  const [pageSize, setPageSize] = useState(4)

  useEffect(() => {
    const saved = loadCompanySystemSettings(active, activeCompany?.reportingPreferences)
    if (!saved) return
    if (saved.approvalsDefaultTab) setActiveTab(saved.approvalsDefaultTab)
    if (saved.approvalsDefaultRange) setDateFilter(saved.approvalsDefaultRange)
    if (saved.approvalsPageSize) setPageSize(Number(saved.approvalsPageSize) || 4)
  }, [active, activeCompany?.reportingPreferences])

  useEffect(() => {
    dispatch(fetchApprovals())
  }, [dispatch])

  const rows = useMemo(() => {
    return items.map((approval) => {
      const txn = approval.Transaction || {}
      const company = txn.Company || companies.find((c) => c.id === txn.companyId)
      const requestedByName = approval.requester?.name || approval.requester?.email || 'System'
      const requestedByEmail = approval.requester?.name && approval.requester?.email ? approval.requester.email : ''
      const approverName = approval.approver?.name || approval.approver?.email || txn.approver?.name || txn.approver?.email || '—'
      const statusValue = String(approval.status || txn.status || 'pending').toLowerCase()
      const amount = Number(txn.amount || 0)
      const threshold = Number(company?.approvalThreshold || PENDING_THRESHOLD_FALLBACK)

      return {
        ...approval,
        txn,
        companyName: company?.name || 'Unknown company',
        companyId: txn.companyId,
        requestedByName,
        requestedByEmail,
        approverName,
        amount,
        threshold,
        status: statusValue,
        txCode: `TXN-${compactId(txn.id || approval.transactionId).toUpperCase()}`,
        transactionType: toTitle(txn.transactionType || 'transaction'),
        requestedDate: approval.requestedAt || txn.createdAt,
        decisionDate: approval.decisionAt || txn.approvedAt,
        description: txn.description || '',
        attachments: approval.attachments || txn.attachments || approval.metadata?.attachments || txn.metadata?.attachments || []
      }
    })
  }, [items, companies])

  const companyChipCounts = useMemo(() => {
    return companies.map((company) => ({
      id: company.id,
      label: company.name,
      count: rows.filter((row) => row.companyId === company.id).length
    }))
  }, [companies, rows])

  const statusChipCounts = useMemo(() => {
    const statuses = ['pending', 'approved', 'rejected']
    return statuses.map((statusKey) => ({
      key: statusKey,
      label: toTitle(statusKey),
      count: rows.filter((row) => row.status === statusKey).length
    }))
  }, [rows])

  const filteredRows = useMemo(() => {
    let list = rows

    if (activeTab === 'pending') list = list.filter((row) => row.status === 'pending')
    if (activeTab === 'history') list = list.filter((row) => row.status !== 'pending')

    if (statusFilter) list = list.filter((row) => row.status === statusFilter)

    if (companyFilter) list = list.filter((row) => row.companyId === companyFilter)

    if (dateFilter && dateFilter !== 'all') {
      const now = dayjs()
      list = list.filter((row) => {
        const date = row.requestedDate ? dayjs(row.requestedDate) : null
        if (!date) return true
        if (dateFilter === 'last30') return date.isAfter(now.subtract(30, 'day'))
        if (dateFilter === 'last90') return date.isAfter(now.subtract(90, 'day'))
        if (dateFilter === 'ytd') return date.isAfter(now.startOf('year'))
        return true
      })
    }

    if (minAmount) list = list.filter((row) => row.amount >= Number(minAmount))
    if (maxAmount) list = list.filter((row) => row.amount <= Number(maxAmount))

    if (search.trim()) {
      const term = search.toLowerCase()
      list = list.filter((row) => {
        return [
          row.txCode,
          row.transactionType,
          row.companyName,
          row.requestedByName,
          row.requestedByEmail,
          row.approverName,
          row.description,
          row.txn?.id,
          row.txn?.rationale
        ]
          .map((value) => String(value || '').toLowerCase())
          .some((value) => value.includes(term))
      })
    }

    return list
  }, [rows, activeTab, companyFilter, active, dateFilter, minAmount, maxAmount, search, statusFilter])

  const pendingRows = useMemo(() => filteredRows.filter((row) => row.status === 'pending'), [filteredRows])
  const historyRows = useMemo(() => filteredRows.filter((row) => row.status !== 'pending'), [filteredRows])

  const pendingCount = useMemo(() => rows.filter((row) => row.status === 'pending').length, [rows])
  const approvedThisMonth = useMemo(() => {
    const now = dayjs()
    return rows.filter((row) => row.status === 'approved' && row.decisionDate && dayjs(row.decisionDate).isSame(now, 'month')).length
  }, [rows])
  const rejectedThisMonth = useMemo(() => {
    const now = dayjs()
    return rows.filter((row) => row.status === 'rejected' && row.decisionDate && dayjs(row.decisionDate).isSame(now, 'month')).length
  }, [rows])
  const pendingValue = useMemo(() => rows.filter((row) => row.status === 'pending').reduce((sum, row) => sum + Number(row.amount || 0), 0), [rows])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const pagedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize)
  const selectedCount = selectedIds.length
  const allPendingSelected = pendingRows.length > 0 && pendingRows.every((row) => selectedIds.includes(row.txn.id || row.transactionId))

  useEffect(() => {
    setPage(1)
  }, [activeTab, companyFilter, dateFilter, minAmount, maxAmount, search, statusFilter])

  useEffect(() => {
    setSelectedIds([])
  }, [activeTab, companyFilter, dateFilter, minAmount, maxAmount, search, statusFilter])

  useEffect(() => {
    setStatusFilter(activeTab === 'pending' ? 'pending' : '')
  }, [activeTab])

  useEffect(() => {
    if (selectedApproval) {
      const fresh = rows.find((row) => row.transactionId === selectedApproval.transactionId)
      if (!fresh) setSelectedApproval(null)
      else setSelectedApproval(fresh)
    }
  }, [rows, selectedApproval])

  const refreshAfterDecision = (companyId) => {
    dispatch(fetchApprovals())
    if (companyId) {
      dispatch(fetchTransactions(companyId))
      dispatch(fetchTransactionMetrics(companyId))
    }
  }

  const handleDecision = async (approval, decision, rationaleOverride) => {
    const transactionId = approval.txn.id || approval.transactionId
    const companyId = approval.companyId || active || companyFilter || approval.txn.companyId
    const rationale = String(rationaleOverride ?? decisionNotes).trim() || `${toTitle(decision)} via approval queue`

    setModalBusy(true)
    try {
      await dispatch(decideApproval({
        transactionId,
        decision,
        rationale: rationale || `${toTitle(decision)} via approval queue`
      })).unwrap()
      refreshAfterDecision(companyId)
      setDecisionNotes('')
      setSelectedApproval(null)
      setSelectedIds((current) => current.filter((id) => id !== transactionId))
    } finally {
      setModalBusy(false)
    }
  }

  const handleBulkDecision = async (decision) => {
    const approvalsToProcess = pendingRows.filter((row) => selectedIds.includes(row.txn.id || row.transactionId))
    if (!approvalsToProcess.length) return

    setBulkBusy(true)
    try {
      await Promise.allSettled(
        approvalsToProcess.map((approval) => {
          const transactionId = approval.txn.id || approval.transactionId
          return dispatch(decideApproval({
            transactionId,
            decision,
            rationale: `${toTitle(decision)} selected approvals from queue`
          })).unwrap()
        })
      )
      const companyId = active || companyFilter || approvalsToProcess[0]?.companyId
      refreshAfterDecision(companyId)
      setSelectedIds([])
    } finally {
      setBulkBusy(false)
    }
  }

  const handleViewDetails = (approval) => {
    setSelectedApproval(approval)
    setDecisionNotes(approval.txn.rationale || approval.txn.description || '')
  }

  const toggleSelectAll = () => {
    if (allPendingSelected) {
      const pendingIds = new Set(pendingRows.map((row) => row.txn.id || row.transactionId))
      setSelectedIds((current) => current.filter((id) => !pendingIds.has(id)))
      return
    }
    setSelectedIds(pendingRows.map((row) => row.txn.id || row.transactionId))
  }

  const toggleSelection = (approval) => {
    const id = approval.txn.id || approval.transactionId
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  const selectedModalId = selectedApproval ? selectedApproval.txn.id || selectedApproval.transactionId : ''

  return (
    <div className="space-y-5 text-[var(--text-primary)]">
      <div className="relative overflow-hidden rounded-[24px] border border-[var(--card-border)]/70 bg-gradient-to-r from-[var(--brand-primary)]/12 via-[var(--panel)] to-[var(--panel-strong)]/70 p-5 shadow-[0_18px_60px_-38px_rgba(15,23,42,0.55)]">
        <div className="absolute inset-0 opacity-35" style={{ background: 'radial-gradient(circle at 20% 20%, rgba(104,210,232,0.16), transparent 38%), radial-gradient(circle at 80% 12%, rgba(52,211,153,0.16), transparent 30%)' }} />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">Approvals</p>
            <h1 className="text-3xl font-semibold tracking-tight">Approval Queue</h1>
            <p className="text-sm text-[var(--muted-foreground)]">Review, decide, and audit transactions</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end text-xs text-[var(--muted-foreground)]">
            {status === 'loading' && <span>Loading...</span>}
            {error && <span className="text-rose-500">{String(error)}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard icon="⏳" title="Pending Approvals" value={pendingCount} subtitle="Awaiting your review" tone="amber" loading={status === 'loading'} />
        <StatCard icon="✅" title="Approved This Month" value={approvedThisMonth} subtitle={approvedThisMonth ? 'Up from prior month' : 'No approvals this month'} tone="emerald" loading={status === 'loading'} />
        <StatCard icon="❌" title="Rejected This Month" value={rejectedThisMonth} subtitle={rejectedThisMonth ? 'Needs attention' : 'No rejections this month'} tone="rose" loading={status === 'loading'} />
        <StatCard icon="💰" title="Total Pending Value" value={formatCurrency(pendingValue)} subtitle={`Across ${pendingCount} items`} tone="blue" loading={status === 'loading'} />
      </div>

      <div className="bg-[var(--panel)] border border-[var(--card-border)]/70 rounded-[24px] p-4 shadow-[0_20px_70px_-45px_rgba(0,0,0,0.6)] space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">Approval Queue</p>
            <h2 className="text-xl font-semibold tracking-tight">Review, decide, and audit transactions</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {TAB_OPTIONS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all ${activeTab === tab.key ? 'border-[var(--brand-primary)]/40 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]' : 'border-[var(--card-border)] bg-[var(--bg-card)] text-[var(--muted-foreground)] hover:text-[var(--text-primary)] hover:bg-[var(--panel-strong)]'}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span className="rounded-full border border-[var(--card-border)] bg-[var(--panel)] px-2 py-0.5 text-[11px] text-[var(--text-primary)]">
                  {tab.key === 'pending' ? pendingCount : rows.length - pendingCount}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4">
          <input
            className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--panel)] px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)]"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ChipRow
            label="Companies"
            options={[{ value: '', label: `All (${rows.length})` }, ...companyChipCounts.map((company) => ({ value: company.id, label: `${company.label} (${company.count})` }))]}
            selected={companyFilter}
            onSelect={(value) => setCompanyFilter(value)}
          />
          <ChipRow
            label="Status"
            options={[{ value: '', label: `All (${rows.length})` }, ...statusChipCounts.map((statusItem) => ({ value: statusItem.key, label: `${statusItem.label} (${statusItem.count})` }))]}
            selected={statusFilter}
            onSelect={(value) => setStatusFilter(value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select className="rounded-xl border border-[var(--card-border)] bg-[var(--panel)] px-3 py-2 text-sm" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
              {DATE_RANGE_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
            <input type="number" min="0.01" step="0.01" className="w-32 rounded-xl border border-[var(--card-border)] bg-[var(--panel)] px-3 py-2 text-sm" placeholder="Min" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
            <input type="number" min="0.01" step="0.01" className="w-32 rounded-xl border border-[var(--card-border)] bg-[var(--panel)] px-3 py-2 text-sm" placeholder="Max" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
            <button
              type="button"
              className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2 text-sm hover:bg-[var(--panel-strong)]"
              onClick={() => {
                setSearch('')
                setCompanyFilter('')
                setStatusFilter('pending')
                setDateFilter('last30')
                setMinAmount('')
                setMaxAmount('')
                setActiveTab('pending')
                setPage(1)
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'pending' && pendingRows.length > 0 && (
        <div className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] px-4 py-3 shadow-[0_16px_44px_-34px_rgba(15,23,42,0.32)] flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input type="checkbox" checked={allPendingSelected} onChange={toggleSelectAll} />
            Select all
          </label>
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <span>{selectedCount} selected</span>
            <button
              type="button"
              className="rounded-xl bg-emerald-600 px-3 py-2 text-white disabled:opacity-50"
              disabled={!selectedCount || bulkBusy}
              onClick={() => handleBulkDecision('approved')}
            >
              Approve Selected
            </button>
            <button
              type="button"
              className="rounded-xl bg-rose-600 px-3 py-2 text-white disabled:opacity-50"
              disabled={!selectedCount || bulkBusy}
              onClick={() => handleBulkDecision('rejected')}
            >
              Reject Selected
            </button>
          </div>
        </div>
      )}

      <div className="bg-[var(--panel)] rounded-[24px] border border-[var(--card-border)]/70 shadow-[0_20px_70px_-45px_rgba(0,0,0,0.6)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--card-border)]/70 bg-[var(--bg-card)]/75 backdrop-blur-sm">
          <div className="space-y-0.5">
            <h3 className="font-semibold text-[var(--text-primary)]">{activeTab === 'pending' ? 'Pending Approvals' : 'Approval History'}</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              {activeTab === 'pending'
                ? `${filteredRows.length} approvals awaiting your review`
                : `${filteredRows.length} decided approvals with timestamps and reviewer details`}
            </p>
          </div>
          {status === 'loading' && <span className="text-xs text-[var(--muted-foreground)]">Loading...</span>}
        </div>

        <div className="p-4 space-y-3">
          {status === 'loading' && !rows.length ? (
            <>
              <ApprovalSkeleton />
              <ApprovalSkeleton />
              <ApprovalSkeleton />
            </>
          ) : pagedRows.length === 0 ? (
            <EmptyApprovalState activeTab={activeTab} onGoHistory={() => setActiveTab('history')} onGoPending={() => setActiveTab('pending')} />
          ) : activeTab === 'pending' ? (
            pagedRows.map((approval) => (
              <PendingApprovalCard
                key={approval.id}
                approval={approval}
                selected={selectedIds.includes(approval.txn.id || approval.transactionId)}
                onToggle={() => toggleSelection(approval)}
                onApprove={() => handleDecision(approval, 'approved')}
                onReject={() => handleDecision(approval, 'rejected')}
                onView={() => handleViewDetails(approval)}
                disabled={modalBusy || bulkBusy || decideStatus === 'loading'}
              />
            ))
          ) : (
            pagedRows.map((approval) => (
              <HistoryCard key={approval.id} approval={approval} onView={() => handleViewDetails(approval)} />
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--card-border)]/70 bg-[var(--panel-strong)]/50 px-4 py-3 text-xs text-[var(--muted-foreground)]">
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1.5 text-[var(--text-primary)] disabled:opacity-50" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
              Prev
            </button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1.5 text-[var(--text-primary)] disabled:opacity-50" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
              Next
            </button>
          </div>
          <span>{filteredRows.length} total</span>
        </div>
      </div>

      {selectedApproval && (
        <ApprovalModal
          approval={selectedApproval}
          notes={decisionNotes}
          setNotes={setDecisionNotes}
          onClose={() => {
            setSelectedApproval(null)
            setDecisionNotes('')
          }}
          onApprove={() => handleDecision(selectedApproval, 'approved')}
          onReject={() => handleDecision(selectedApproval, 'rejected')}
          busy={modalBusy || decideStatus === 'loading'}
        />
      )}
    </div>
  )
}

const PendingApprovalCard = ({ approval, selected, onToggle, onApprove, onReject, onView, disabled }) => {
  const statusMeta = getStatusMeta(approval.status)
  const txn = approval.txn || {}
  const thresholdLabel = approval.threshold > PENDING_THRESHOLD_FALLBACK ? formatCurrency(approval.threshold) : formatCurrency(PENDING_THRESHOLD_FALLBACK)
  const description = approval.description || 'No description provided'

  return (
    <article className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.3)] transition-all hover:shadow-[0_20px_50px_-30px_rgba(15,23,42,0.34)]">
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={selected} onChange={onToggle} className="mt-1 h-4 w-4 rounded border-[var(--card-border)]" />
        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted-foreground)]">Transaction {approval.txCode}</p>
              <h4 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                {txn.transactionType || approval.transactionType} <span className="text-[var(--muted-foreground)]">•</span> {formatCurrency(approval.amount)}
              </h4>
              <p className="text-sm text-[var(--muted-foreground)]">
                {approval.companyName} • Requested {formatDate(approval.requestedDate)}
              </p>
            </div>
            <StatusBadge status={approval.status} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InfoTile label="Transaction Type" value={toTitle(txn.transactionType || approval.transactionType)} />
            <InfoTile label="Amount" value={formatCurrency(approval.amount)} />
            <InfoTile label="Company" value={approval.companyName} />
            <InfoTile label="Requested Date" value={formatDate(approval.requestedDate)} />
            <InfoTile label="Requested By" value={approval.requestedByName} secondary={approval.requestedByEmail || 'System'} />
            <InfoTile label="Threshold" value={thresholdLabel} secondary={approval.amount >= approval.threshold ? 'Approval required ⚠️' : 'Below threshold'} />
          </div>

          <div className="rounded-[16px] border border-[var(--card-border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--text-primary)]">
            <span className="text-[var(--muted-foreground)]">Description:</span> {fixCommonTypos(description)}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-500/15 disabled:opacity-50" onClick={onApprove} disabled={disabled}>
              ✅ Approve
            </button>
            <button type="button" className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-500/15 disabled:opacity-50" onClick={onReject} disabled={disabled}>
              ❌ Reject
            </button>
            <button type="button" className="rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--panel-strong)]" onClick={onView}>
              👁 View Details
            </button>
          </div>
        </div>
      </div>
      <div className="mt-3 h-px bg-[var(--card-border)]/70" />
      <div className="mt-3 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
        <span>Approval required for amounts at or above {formatCurrency(approval.threshold)}</span>
      </div>
    </article>
  )
}

const HistoryCard = ({ approval, onView }) => {
  const statusMeta = getStatusMeta(approval.status)
  const decisionBy = approval.approverName || '—'
  const decisionDate = approval.decisionDate ? formatDateTime(approval.decisionDate) : 'Not decided'

  return (
    <article className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.3)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted-foreground)]">{statusMeta.icon} {toTitle(approval.status)} · {timeAgo(approval.decisionDate || approval.requestedDate)}</p>
          <h4 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{approval.txCode}</h4>
          <p className="text-sm text-[var(--muted-foreground)]">{formatCurrency(approval.amount)} • {toTitle(approval.txn.transactionType || approval.transactionType)} • {approval.companyName}</p>
        </div>
        <StatusBadge status={approval.status} />
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <InfoTile label="Decision By" value={decisionBy} secondary={decisionDate} />
        <InfoTile label="Requested By" value={approval.requestedByName} secondary={approval.requestedByEmail || 'System'} />
      </div>

      <div className="mt-3 rounded-[16px] border border-[var(--card-border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--text-primary)]">
        <span className="text-[var(--muted-foreground)]">Comment:</span> {fixCommonTypos(approval.txn.rationale || approval.rationale || 'No comment recorded.')}
      </div>

      <div className="mt-4 flex justify-end">
        <button type="button" className="rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--panel-strong)]" onClick={onView}>
          👁 View Details
        </button>
      </div>
    </article>
  )
}

const ApprovalModal = ({ approval, notes, setNotes, onClose, onApprove, onReject, busy }) => {
  const txn = approval.txn || {}
  const statusMeta = getStatusMeta(approval.status)
  const attachments = Array.isArray(approval.attachments) ? approval.attachments : []

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-[24px] border border-[var(--card-border)] bg-[var(--panel)] shadow-[0_30px_100px_-50px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--card-border)] px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">Transaction Details</p>
            <h3 className="text-xl font-semibold tracking-tight">{approval.txCode}</h3>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={approval.status} />
            <button type="button" className="rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--panel-strong)]" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <InfoTile label="Transaction ID" value={txn.id || approval.transactionId} />
            <InfoTile label="Type" value={toTitle(txn.transactionType || approval.transactionType)} />
            <InfoTile label="Amount" value={formatCurrency(approval.amount)} />
            <InfoTile label="Company" value={approval.companyName} />
            <InfoTile label="Requested By" value={approval.requestedByName} secondary={approval.requestedByEmail || 'System'} />
            <InfoTile label="Requested Date" value={formatDateTime(approval.requestedDate)} />
            <InfoTile label="Decision Date" value={approval.decisionDate ? formatDateTime(approval.decisionDate) : 'Not decided yet'} />
            <InfoTile label="Threshold" value={formatCurrency(approval.threshold)} secondary={approval.amount >= approval.threshold ? 'Approval required ⚠️' : 'Below threshold'} />
          </div>

          <section className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4">
            <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Description</h4>
            <p className="mt-2 text-sm text-[var(--text-primary)]">{fixCommonTypos(approval.description || txn.description || 'No description provided')}</p>
          </section>

          <section className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4">
            <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Supporting Documents</h4>
            <div className="mt-3 space-y-2 text-sm text-[var(--text-primary)]">
              {attachments.length ? attachments.map((item, index) => <div key={`${item}-${index}`}>📎 {String(item)}</div>) : <div className="text-[var(--muted-foreground)]">No supporting documents attached.</div>}
            </div>
          </section>

          <section className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4 space-y-3">
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Approval Comments</h4>
              <p className="text-xs text-[var(--muted-foreground)]">Use this field to explain your decision, especially when rejecting.</p>
            </div>
            <textarea
              rows={4}
              className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--muted-foreground)]"
              placeholder="Add approval notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </section>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--panel-strong)]" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="rounded-xl bg-rose-600 px-4 py-2 text-sm text-white disabled:opacity-50" onClick={onReject} disabled={busy || approval.status !== 'pending'}>
              ❌ Reject
            </button>
            <button type="button" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50" onClick={onApprove} disabled={busy || approval.status !== 'pending'}>
              ✅ Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const EmptyApprovalState = ({ activeTab, onGoHistory, onGoPending }) => {
  if (activeTab === 'history') {
    return (
      <div className="mx-auto max-w-xl rounded-[24px] border border-dashed border-[var(--card-border)] bg-[var(--bg-card)] px-6 py-10 text-center space-y-3 shadow-[0_16px_48px_-34px_rgba(15,23,42,0.3)]">
        <div className="text-4xl">📜</div>
        <div>
          <h4 className="text-lg font-semibold text-[var(--text-primary)]">No Approval History Yet</h4>
          <p className="text-sm text-[var(--muted-foreground)]">Decisions will appear here once transactions are reviewed.</p>
        </div>
        <button type="button" className="rounded-xl bg-gradient-to-r from-[var(--brand-primary)] to-cyan-500 px-4 py-2 text-sm text-white" onClick={onGoPending}>
          View Pending Approvals
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl rounded-[24px] border border-dashed border-[var(--card-border)] bg-[var(--bg-card)] px-6 py-10 text-center space-y-3 shadow-[0_16px_48px_-34px_rgba(15,23,42,0.3)]">
      <div className="text-4xl">✅</div>
      <div>
        <h4 className="text-lg font-semibold text-[var(--text-primary)]">All Caught Up</h4>
        <p className="text-sm text-[var(--muted-foreground)]">No pending approvals awaiting your review.</p>
      </div>
      <button type="button" className="rounded-xl bg-gradient-to-r from-[var(--brand-primary)] to-cyan-500 px-4 py-2 text-sm text-white" onClick={onGoHistory}>
        View Approval History
      </button>
    </div>
  )
}

const ApprovalSkeleton = () => (
  <div className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4 animate-pulse space-y-3">
    <div className="flex items-center justify-between">
      <div className="h-4 w-40 rounded bg-[var(--panel-strong)]" />
      <div className="h-7 w-24 rounded-full bg-[var(--panel-strong)]" />
    </div>
    <div className="h-4 w-72 rounded bg-[var(--panel-strong)]" />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="h-14 rounded-xl bg-[var(--panel-strong)]" />
      <div className="h-14 rounded-xl bg-[var(--panel-strong)]" />
      <div className="h-14 rounded-xl bg-[var(--panel-strong)]" />
      <div className="h-14 rounded-xl bg-[var(--panel-strong)]" />
    </div>
    <div className="h-14 rounded-xl bg-[var(--panel-strong)]" />
  </div>
)

const StatCard = ({ icon, title, value, subtitle, tone, loading }) => {
  const toneMap = {
    blue: 'border-sky-500/20 bg-sky-500/5',
    emerald: 'border-emerald-500/20 bg-emerald-500/5',
    amber: 'border-amber-500/20 bg-amber-500/5',
    rose: 'border-rose-500/20 bg-rose-500/5'
  }

  return (
    <div className={`relative overflow-hidden rounded-[20px] border bg-[var(--bg-card)] p-4 shadow-[0_16px_50px_-35px_rgba(0,0,0,0.65)] ${toneMap[tone] || toneMap.blue}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-60" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            <span className="text-base leading-none">{icon}</span>
            <span>{title}</span>
          </div>
          <p className="text-[26px] font-semibold tracking-tight text-[var(--text-primary)]">{loading ? '...' : value}</p>
          <p className="text-xs text-[var(--muted-foreground)]">{subtitle}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--panel)] text-lg">{icon}</div>
      </div>
    </div>
  )
}

const ChipRow = ({ label, options, selected, onSelect, lockSelection = false }) => (
  <div className="flex flex-wrap items-center gap-2 text-xs">
    <span className="w-20 text-[var(--muted-foreground)]">{label}</span>
    {options.map((option) => (
      <button
        key={`${label}-${option.value || 'all'}`}
        type="button"
        onClick={() => !lockSelection && onSelect(option.value)}
        className={`rounded-full border px-3 py-1.5 transition-all ${selected === option.value ? 'border-[var(--brand-primary)]/30 bg-[var(--brand-primary)]/12 text-[var(--brand-primary)]' : 'border-[var(--card-border)] bg-[var(--bg-card)] text-[var(--muted-foreground)] hover:text-[var(--text-primary)]'}`}
      >
        {option.label}
      </button>
    ))}
  </div>
)

const InfoTile = ({ label, value, secondary }) => (
  <div className="rounded-[16px] border border-[var(--card-border)] bg-[var(--bg-card)] p-3">
    <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</p>
    <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{value || '—'}</p>
    {secondary && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{secondary}</p>}
  </div>
)

const StatusBadge = ({ status }) => {
  const meta = getStatusMeta(status)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${meta.cls}`}>
      <span>{meta.icon}</span>
      <span>{meta.label}</span>
    </span>
  )
}

const getStatusMeta = (status = '') => {
  const key = String(status).toLowerCase()
  const map = {
    pending: { icon: '🟡', label: 'Pending', cls: 'bg-amber-400/25 text-amber-800 border border-amber-500/40' },
    approved: { icon: '🟢', label: 'Approved', cls: 'bg-emerald-500/20 text-emerald-700 border border-emerald-500/40' },
    rejected: { icon: '🔴', label: 'Rejected', cls: 'bg-rose-500/20 text-rose-700 border border-rose-500/40' },
    posted: { icon: '⚪', label: 'Posted', cls: 'bg-slate-500/15 text-slate-700 border border-slate-500/35' }
  }
  return map[key] || { icon: '⚪', label: toTitle(status || 'pending'), cls: 'bg-[var(--panel-strong)] text-[var(--text-secondary)] border border-[var(--card-border)]' }
}

const compactId = (value) => {
  const text = String(value || '')
  if (!text) return '—'
  if (text.length <= 10) return text
  return `${text.slice(0, 6)}...${text.slice(-4)}`
}

const fixCommonTypos = (value = '') => String(value).replace(/\bpurshasing\b/gi, 'Purchasing')
const toTitle = (value = '') => String(value).replace(/[-_]/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())
const formatNumber = (value) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value || 0))
const formatCurrency = (value) => `Br ${formatNumber(value)}`
const formatDate = (value) => (value ? dayjs(value).format('MMM D, YYYY') : '—')
const formatDateTime = (value) => (value ? dayjs(value).format('MMM D, YYYY [at] h:mm A') : '—')
const timeAgo = (value) => {
  if (!value) return 'just now'
  const date = dayjs(value)
  const diffDays = dayjs().startOf('day').diff(date.startOf('day'), 'day')
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.format('MMM D, YYYY')
}

export default ApprovalsPage
