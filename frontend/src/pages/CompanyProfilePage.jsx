import { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { fetchCompanies, setActiveCompany } from '../store/slices/companySlice.js'
import { fetchInvestmentMetrics } from '../store/slices/investmentSlice.js'
import { fetchTransactions, fetchTransactionMetrics } from '../store/slices/transactionSlice.js'

const CompanyProfilePage = () => {
  const { companyId } = useParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const { list, status, error } = useSelector((s) => s.company)
  const { metrics: investmentMetrics, metricsStatus: investmentMetricsStatus } = useSelector((s) => s.investments)
  const { items: transactions, metrics: transactionMetrics, metricsStatus: transactionMetricsStatus } = useSelector((s) => s.transactions)

  const company = useMemo(() => list.find((c) => c.id === companyId), [list, companyId])
  const friendlyError = useMemo(() => {
    const msg = String(error || '')
    return /jwt expired|token expired/i.test(msg) ? 'Session expired. Please sign in again.' : msg
  }, [error])

  useEffect(() => {
    if (!list.length) dispatch(fetchCompanies())
  }, [dispatch, list.length])

  useEffect(() => {
    if (!companyId) return
    dispatch(fetchInvestmentMetrics(companyId))
    dispatch(fetchTransactions(companyId))
    dispatch(fetchTransactionMetrics(companyId))
  }, [dispatch, companyId])

  useEffect(() => {
    if (company?.id) dispatch(setActiveCompany(company.id))
  }, [company, dispatch])

  const contacts = useMemo(() => {
    if (!Array.isArray(company?.contacts)) return []
    return company.contacts.filter(Boolean)
  }, [company])

  const activity = useMemo(() => {
    if (!Array.isArray(transactions)) return []
    return [...transactions]
      .filter((t) => !t.companyId || t.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime())
      .slice(0, 6)
  }, [transactions, companyId])

  const isMetricsLoading = investmentMetricsStatus === 'loading' || transactionMetricsStatus === 'loading'
  const showNotFound = status === 'succeeded' && !company && !friendlyError

  if (status === 'loading' && !company) {
    return <ProfileLoadingState />
  }

  if (friendlyError) {
    return (
      <InlineAlert
        tone="danger"
        message={friendlyError}
        actionLabel="Back to Companies"
        onAction={() => navigate('/companies')}
      />
    )
  }

  if (showNotFound) {
    return (
      <div className="space-y-3 text-[var(--text-primary)]">
        <InlineAlert tone="warning" message="Company not found or no longer available." />
        <div className="flex gap-2 text-sm">
          <button className="px-3 py-1.5 bg-[var(--brand-primary)] text-white rounded" onClick={() => navigate('/companies')}>Back to list</button>
          <button className="px-3 py-1.5 border border-[var(--card-border)] rounded" onClick={() => navigate('/companies/new')}>Create new</button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative space-y-5 text-[var(--text-primary)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 -left-8 h-56 w-56 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="absolute top-20 -right-8 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <section className="overflow-hidden rounded-[30px] border border-[var(--card-border)]/75 bg-gradient-to-br from-[var(--brand-primary)]/14 via-[var(--panel)] to-[var(--panel-strong)]/82 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.58)]">
        <div className="relative p-6 sm:p-7 lg:p-8">
          <div className="absolute inset-0 opacity-35" style={{ background: 'radial-gradient(circle at 18% 22%, rgba(104,210,232,0.18), transparent 38%), radial-gradient(circle at 82% 12%, rgba(52,211,153,0.16), transparent 34%)' }} />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                <span className="rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1">Company Profile</span>
                <span className="rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1">Live company context</span>
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{displayCompanyName(company?.name)}</h1>
                <p className="max-w-2xl text-sm leading-6 text-[var(--muted-foreground)] sm:text-base">
                  Detailed profile, live metrics, and latest operational activity in one focused workspace.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <span className="rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1">ID: {compactId(company?.id)}</span>
                <StatusPill status={company?.status} />
                <RolePill role={company?.role} />
                <span className="rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1">Currency: Ethiopian Birr (ETB)</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              <button className="rounded-xl border border-[var(--card-border)] bg-gradient-to-r from-[var(--brand-primary)] to-cyan-500 px-4 py-2 text-white shadow-[0_14px_30px_-18px_rgba(59,130,246,0.55)] transition-all hover:shadow-[0_16px_34px_-18px_rgba(59,130,246,0.6)]" onClick={() => navigate(`/companies/${companyId}/edit`)}>Edit Company</button>
              <button className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-4 py-2 transition-all hover:bg-[var(--panel-strong)] hover:shadow-[0_12px_28px_-20px_rgba(15,23,42,0.28)]" onClick={() => navigate('/transactions')}>View Transactions</button>
              <button className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-4 py-2 transition-all hover:bg-[var(--panel-strong)] hover:shadow-[0_12px_28px_-20px_rgba(15,23,42,0.28)]" onClick={() => navigate('/companies')}>Back to List</button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {isMetricsLoading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              label="Total Principal"
              value={toCurrency(investmentMetrics?.totalPrincipal)}
              hint="From investment metrics"
            />
            <MetricCard
              label="Total Interest"
              value={toCurrency(investmentMetrics?.totalInterest)}
              hint="From investment metrics"
            />
            <MetricCard
              label="Pending Approvals"
              value={toNumber(transactionMetrics?.pending)}
              hint="From transaction metrics"
            />
          </>
        )}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="Overview" className="xl:col-span-1">
          {!company ? (
            <ProfileFieldSkeleton rows={6} />
          ) : (
            <>
              <ProfileField label="Description" value={company?.description} multiline />
              <ProfileField label="Registration Number" value={company?.registrationNumber} />
              <ProfileField label="Tax ID" value={company?.taxId} />
              <ProfileField label="Approval Threshold" value={toCurrency(company?.approvalThreshold)} />
              <ProfileField label="Currency" value="Ethiopian Birr (ETB)" />
              <ProfileField label="Fiscal Year Start" value={company?.fiscalYearStart} />
            </>
          )}
        </Panel>

        <Panel title="Timeline" className="xl:col-span-2">
          {!company ? (
            <TimelineSkeleton />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <TimelineCard label="Created" value={toDateTime(company?.createdAt)} />
              <TimelineCard label="Last Updated" value={toDateTime(company?.updatedAt)} />
              <TimelineCard label="Created By" value={company?.createdBy} />
            </div>
          )}
        </Panel>
      </section>

      <Panel title="Key Contacts" action={
        <button
          className="px-3 py-1.5 border border-[var(--card-border)] bg-[var(--bg-card)] rounded-lg text-xs hover:bg-[var(--panel-strong)]"
          onClick={() => navigate(`/companies/${companyId}/edit`)}
        >
          Manage Contacts
        </button>
      }>
        {!company ? (
          <ContactsSkeleton />
        ) : contacts.length === 0 ? (
          <EmptyRow text="No contact data available for this company." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--panel-strong)]/65 text-left text-[var(--muted-foreground)] uppercase text-[11px] tracking-[0.1em]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Name</th>
                  <th className="px-3 font-semibold">Role</th>
                  <th className="px-3 font-semibold">Email</th>
                  <th className="px-3 font-semibold">Phone</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c, idx) => (
                  <tr key={`${c.email || c.phone || 'contact'}-${idx}`} className="border-t border-[var(--card-border)]/70 hover:bg-[var(--bg-card)]/70 transition-colors">
                    <td className="py-2.5 px-3 text-[var(--text-primary)]">{renderVal(c.name)}</td>
                    <td className="px-3 text-[var(--text-secondary)]">{renderVal(c.role)}</td>
                    <td className="px-3 text-[var(--muted-foreground)]">{renderVal(c.email)}</td>
                    <td className="px-3 text-[var(--muted-foreground)]">{renderVal(c.phone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Recent Activity" action={
        <button
          className="px-3 py-1.5 border border-[var(--card-border)] bg-[var(--bg-card)] rounded-lg text-xs hover:bg-[var(--panel-strong)]"
          onClick={() => navigate('/transactions')}
        >
          Open Transactions
        </button>
      }>
        {transactionMetricsStatus === 'loading' ? (
          <ActivitySkeleton />
        ) : activity.length === 0 ? (
          <EmptyRow text="No recent transaction activity for this company." />
        ) : (
          <ul className="space-y-2 text-sm">
            {activity.map((tx) => (
              <li key={tx.id} className="rounded-xl border border-[var(--card-border)]/70 bg-[var(--bg-card)]/60 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--text-primary)]">{toTitle(tx.type || tx.transactionType || 'Transaction')}</span>
                  <span className="mx-2 text-[var(--muted-foreground)]">•</span>
                  <span>{toCurrency(tx.amount)}</span>
                  <span className="mx-2 text-[var(--muted-foreground)]">•</span>
                  <span>{renderVal(tx.status)}</span>
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">{toRelativeTime(tx.createdAt || tx.date)}</div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

const Panel = ({ title, children, action, className = '' }) => (
  <section className={`rounded-[24px] border border-[var(--card-border)]/75 bg-[var(--panel)] p-4 shadow-[0_20px_70px_-45px_rgba(0,0,0,0.6)] ${className}`}>
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{title}</h3>
      {action}
    </div>
    {children}
  </section>
)

const MetricCard = ({ label, value, loading, hint }) => (
  <div className="relative overflow-hidden rounded-[24px] border border-[var(--card-border)]/75 bg-[var(--panel)] px-4 py-4 shadow-[0_20px_60px_-42px_rgba(0,0,0,0.55)]">
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-70" />
    <div className="relative">
    <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</div>
    <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{loading ? 'Loading...' : value}</div>
    <div className="text-xs text-[var(--muted-foreground)] mt-1">{hint}</div>
    </div>
  </div>
)

const MetricCardSkeleton = () => (
  <div className="rounded-[24px] border border-[var(--card-border)]/75 bg-[var(--panel)] px-4 py-4 shadow-[0_20px_60px_-42px_rgba(0,0,0,0.55)] animate-pulse">
    <div className="h-3 w-28 rounded bg-[var(--panel-strong)]/80" />
    <div className="mt-3 h-8 w-36 rounded bg-[var(--panel-strong)]/80" />
    <div className="mt-3 h-3 w-24 rounded bg-[var(--panel-strong)]/80" />
  </div>
)

const TimelineCard = ({ label, value }) => (
  <div className="rounded-2xl border border-[var(--card-border)]/75 bg-[var(--bg-card)] px-3 py-3 shadow-[0_12px_30px_-22px_rgba(0,0,0,0.28)]">
    <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</div>
    <div className="mt-1 text-sm text-[var(--text-primary)]">{renderVal(value)}</div>
  </div>
)

const ProfileField = ({ label, value, multiline }) => (
  <div className="space-y-1.5">
    <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">{label}</div>
    <div className={`rounded-xl border border-[var(--card-border)]/75 bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-[0_10px_24px_-20px_rgba(0,0,0,0.3)] ${multiline ? 'min-h-[84px]' : ''}`}>
      {renderVal(value)}
    </div>
  </div>
)

const ProfileFieldSkeleton = ({ rows = 4 }) => (
  <div className="space-y-3 animate-pulse">
    {Array.from({ length: rows }).map((_, idx) => (
      <div key={idx} className="space-y-1.5">
        <div className="h-3 w-28 rounded bg-[var(--panel-strong)]/80" />
        <div className={`rounded-lg border border-[var(--card-border)]/70 bg-[var(--bg-card)] px-3 py-2 ${idx === 0 ? 'h-20' : 'h-10'}`} />
      </div>
    ))}
  </div>
)

const TimelineSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-pulse">
    {Array.from({ length: 3 }).map((_, idx) => (
      <div key={idx} className="rounded-xl border border-[var(--card-border)]/70 bg-[var(--bg-card)] px-3 py-3 h-20">
        <div className="h-3 w-20 rounded bg-[var(--panel-strong)]/80" />
        <div className="mt-3 h-4 w-32 rounded bg-[var(--panel-strong)]/80" />
      </div>
    ))}
  </div>
)

const ContactsSkeleton = () => (
  <div className="overflow-hidden rounded-xl border border-[var(--card-border)]/70 bg-[var(--bg-card)] animate-pulse">
    <div className="h-10 bg-[var(--panel-strong)]/70" />
    {Array.from({ length: 3 }).map((_, idx) => (
      <div key={idx} className="h-12 border-t border-[var(--card-border)]/70 bg-[var(--bg-card)]" />
    ))}
  </div>
)

const ActivitySkeleton = () => (
  <ul className="space-y-2 animate-pulse">
    {Array.from({ length: 4 }).map((_, idx) => (
      <li key={idx} className="rounded-xl border border-[var(--card-border)]/70 bg-[var(--bg-card)]/60 px-3 py-3 h-14" />
    ))}
  </ul>
)

const EmptyRow = ({ text }) => (
  <div className="rounded-xl border border-dashed border-[var(--card-border)]/80 bg-[var(--bg-card)]/70 px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
    {text}
  </div>
)

const ProfileLoadingState = () => (
  <div className="space-y-4">
    <div className="h-28 rounded-2xl border border-[var(--card-border)] bg-[var(--panel-strong)]/55 animate-pulse" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="h-24 rounded-2xl border border-[var(--card-border)] bg-[var(--panel-strong)]/55 animate-pulse" />
      <div className="h-24 rounded-2xl border border-[var(--card-border)] bg-[var(--panel-strong)]/55 animate-pulse" />
      <div className="h-24 rounded-2xl border border-[var(--card-border)] bg-[var(--panel-strong)]/55 animate-pulse" />
    </div>
  </div>
)

const InlineAlert = ({ tone = 'info', message, actionLabel, onAction }) => {
  const map = {
    info: { bg: 'bg-sky-500/10 border-sky-500/25 text-sky-700 dark:text-sky-100', dot: 'bg-sky-400' },
    danger: { bg: 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-100', dot: 'bg-rose-400' },
    warning: { bg: 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-100', dot: 'bg-amber-400' }
  }
  const meta = map[tone] || map.info
  return (
    <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${meta.bg}`}>
      <span className={`inline-block w-2 h-2 rounded-full ${meta.dot}`} />
      <span className="flex-1">{message}</span>
      {actionLabel && onAction && (
        <button className="px-2 py-1 text-xs bg-[var(--bg-card)] rounded border border-[var(--card-border)]" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  )
}

const StatusPill = ({ status }) => {
  const key = String(status || '').toLowerCase()
  const map = {
    active: 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/25',
    pending: 'bg-amber-500/15 text-amber-600 border border-amber-500/25',
    archived: 'bg-rose-500/15 text-rose-600 border border-rose-500/25'
  }
  return <span className={`px-2 py-1 rounded-full text-xs capitalize ${map[key] || 'bg-[var(--panel-strong)] text-[var(--muted-foreground)] border border-[var(--card-border)]'}`}>{renderVal(status)}</span>
}

const RolePill = ({ role }) => (
  <span className="px-2 py-1 rounded-full text-xs capitalize bg-[var(--panel-strong)] border border-[var(--card-border)] text-[var(--text-secondary)]">{renderVal(role)}</span>
)

const displayCompanyName = (name) => {
  const val = String(name || '').trim()
  if (!val) return 'Unnamed Company'
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return 'Unnamed Company'
  return val
}

const compactId = (id) => {
  const value = String(id || '')
  if (!value) return '-'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

const renderVal = (value) => {
  if (value === null || typeof value === 'undefined') return '—'
  const text = String(value).trim()
  return text ? text : '—'
}

const toDateTime = (value) => {
  if (!value) return '—'
  const d = dayjs(value)
  return d.isValid() ? d.format('MMM D, YYYY HH:mm') : '—'
}

const toRelativeTime = (value) => {
  if (!value) return '—'
  const ts = new Date(value).getTime()
  if (Number.isNaN(ts)) return '—'
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} mins ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hours ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return dayjs(value).format('MMM D, YYYY')
}

const toCurrency = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return `ETB ${num.toLocaleString()}`
}

const toNumber = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return num.toLocaleString()
}

const toTitle = (value) => {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return '—'
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export default CompanyProfilePage
