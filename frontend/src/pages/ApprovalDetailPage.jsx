import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { fetchApprovals, decideApproval } from '../store/slices/approvalSlice.js'

const PENDING_THRESHOLD_FALLBACK = 10000

const ApprovalDetailPage = () => {
  const { transactionId } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { items, status, decideStatus, error } = useSelector((s) => s.approvals)
  const { list: companies } = useSelector((s) => s.company)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!items.length) dispatch(fetchApprovals())
  }, [items.length, dispatch])

  const approval = useMemo(
    () => items.find((item) => item.transactionId === transactionId || item.Transaction?.id === transactionId),
    [items, transactionId]
  )

  const txn = approval?.Transaction || {}
  const company = approval ? resolveCompany(txn.companyId, companies, txn.Company) : null
  const threshold = Number(company?.approvalThreshold || PENDING_THRESHOLD_FALLBACK)
  const statusMeta = getStatusMeta(approval?.status || txn.status)

  useEffect(() => {
    if (approval?.rationale) setNotes(approval.rationale)
  }, [approval])

  const handleDecision = async (decision) => {
    if (!approval) return
    const id = approval.Transaction?.id || approval.transactionId
    const rationale = notes?.trim() || `${toTitle(decision)} via approval detail`
    setBusy(true)
    try {
      await dispatch(decideApproval({ transactionId: id, decision, rationale })).unwrap()
      navigate('/approvals')
    } finally {
      setBusy(false)
    }
  }

  const requesterName = approval?.requester?.name || approval?.requester?.email || 'System'
  const requesterEmail = approval?.requester?.name && approval?.requester?.email ? approval.requester.email : ''
  const approverName = approval?.approver?.name || approval?.approver?.email || approval?.Transaction?.approver?.name || approval?.Transaction?.approver?.email || '—'
  const attachments = Array.isArray(approval?.attachments) ? approval.attachments : []

  if (status === 'loading' && !approval) {
    return <div className="text-sm text-[var(--muted-foreground)]">Loading approval...</div>
  }

  if (!approval && status !== 'loading') {
    return <div className="text-sm text-rose-500">Approval not found.</div>
  }

  return (
    <div className="space-y-5 text-[var(--text-primary)]">
      <div className="relative overflow-hidden rounded-[24px] border border-[var(--card-border)]/70 bg-gradient-to-r from-[var(--brand-primary)]/12 via-[var(--panel)] to-[var(--panel-strong)]/70 p-5 shadow-[0_18px_60px_-38px_rgba(15,23,42,0.55)]">
        <div className="absolute inset-0 opacity-35" style={{ background: 'radial-gradient(circle at 20% 20%, rgba(104,210,232,0.16), transparent 38%), radial-gradient(circle at 80% 12%, rgba(52,211,153,0.16), transparent 30%)' }} />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">Approvals</p>
            <h1 className="text-3xl font-semibold tracking-tight">Transaction Details</h1>
            <p className="text-sm text-[var(--muted-foreground)]">Review the transaction, notes, attachments, and decision history.</p>
          </div>
          <button type="button" className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--panel-strong)]" onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">{String(error)}</div>}

      <div className="rounded-[24px] border border-[var(--card-border)] bg-[var(--panel)] p-4 shadow-[0_20px_70px_-45px_rgba(0,0,0,0.6)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--card-border)] pb-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted-foreground)]">TXN-{compactId(txn.id || approval.transactionId).toUpperCase()}</p>
            <h2 className="text-xl font-semibold tracking-tight">{toTitle(txn.transactionType || approval.transactionType)} • {formatCurrency(txn.amount)}</h2>
            <p className="text-sm text-[var(--muted-foreground)]">{company?.name || 'Unknown company'} • Requested {formatDateTime(approval.requestedAt || txn.createdAt)}</p>
          </div>
          <StatusBadge status={approval.status || txn.status} />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <InfoTile label="Transaction Type" value={toTitle(txn.transactionType || approval.transactionType)} />
          <InfoTile label="Amount" value={formatCurrency(txn.amount)} />
          <InfoTile label="Company" value={company?.name || 'Unknown company'} />
          <InfoTile label="Requested Date" value={formatDateTime(approval.requestedAt || txn.createdAt)} />
          <InfoTile label="Requested By" value={requesterName} secondary={requesterEmail || 'System'} />
          <InfoTile label="Threshold" value={formatCurrency(threshold)} secondary={Number(txn.amount || 0) >= threshold ? 'Approval required ⚠️' : 'Below threshold'} />
          <InfoTile label="Decision By" value={approverName} secondary={approval?.decisionAt ? formatDateTime(approval.decisionAt) : 'Not decided yet'} />
          <InfoTile label="Approval Status" value={toTitle(approval?.status || txn.status || 'pending')} />
        </div>

        <section className="mt-4 rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Description</h3>
          <p className="mt-2 text-sm text-[var(--text-primary)]">{fixCommonTypos(txn.description || approval?.rationale || 'No description provided.')}</p>
        </section>

        <section className="mt-4 rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Supporting Documents</h3>
          <div className="mt-3 space-y-2 text-sm text-[var(--text-primary)]">
            {attachments.length ? attachments.map((item, index) => <div key={`${item}-${index}`}>📎 {String(item)}</div>) : <div className="text-[var(--muted-foreground)]">No attachments.</div>}
          </div>
        </section>

        <section className="mt-4 rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Approval Comments</h3>
            <p className="text-xs text-[var(--muted-foreground)]">Use a short reason when approving or rejecting.</p>
          </div>
          <textarea
            className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--muted-foreground)]"
            rows={4}
            placeholder="Add approval notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--panel-strong)]" onClick={() => navigate('/approvals')}>
              Cancel
            </button>
            <button type="button" className="rounded-xl bg-rose-600 px-4 py-2 text-sm text-white disabled:opacity-50" onClick={() => handleDecision('rejected')} disabled={busy || decideStatus === 'loading' || approval?.status !== 'pending'}>
              ❌ Reject
            </button>
            <button type="button" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50" onClick={() => handleDecision('approved')} disabled={busy || decideStatus === 'loading' || approval?.status !== 'pending'}>
              ✅ Approve
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

const InfoTile = ({ label, value, secondary }) => (
  <div className="rounded-[16px] border border-[var(--card-border)] bg-[var(--bg-card)] p-3">
    <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</p>
    <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{value || '—'}</p>
    {secondary && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{secondary}</p>}
  </div>
)

const StatusBadge = ({ status }) => {
  const meta = getStatusMeta(status)
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${meta.cls}`}><span>{meta.icon}</span><span>{meta.label}</span></span>
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

const resolveCompany = (companyId, companies, includedCompany) => {
  if (includedCompany) return includedCompany
  return companies.find((company) => company.id === companyId) || null
}

const fixCommonTypos = (value = '') => String(value).replace(/\bpurshasing\b/gi, 'Purchasing')
const toTitle = (value = '') => String(value).replace(/[-_]/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())
const formatNumber = (value) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value || 0))
const formatCurrency = (value) => `Br ${formatNumber(value)}`
const formatDateTime = (value) => (value ? dayjs(value).format('MMM D, YYYY [at] h:mm A') : '—')

export default ApprovalDetailPage
