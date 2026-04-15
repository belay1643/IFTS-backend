import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { loadCompanyNotificationSettings } from '../utils/companySettings.js'
import {
  archiveNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread
} from '../store/slices/notificationSlice.js'

const TYPE_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'approval', label: 'Approvals' },
  { key: 'investment', label: 'Investments' },
  { key: 'system', label: 'System' }
]

const STATUS_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
  { key: 'archived', label: 'Archived' }
]

const DEFAULT_RANGE = '30d'

const NotificationsPage = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { items, loading, error } = useSelector((s) => s.notifications)
  const { active, list: companies } = useSelector((s) => s.company)
  const activeCompany = useMemo(() => companies.find((company) => company.id === active), [companies, active])

  const notificationPrefs = useMemo(
    () => loadCompanyNotificationSettings(active, activeCompany?.reportingPreferences),
    [active, activeCompany?.reportingPreferences]
  )

  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateRange, setDateRange] = useState(DEFAULT_RANGE)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    dispatch(fetchNotifications())
  }, [dispatch])

  const normalized = useMemo(() => {
    return items.map((raw) => {
      const meta = raw.metadata || {}
      const createdAt = raw.createdAt || raw.created_at || raw.updatedAt || raw.updated_at
      const status = String(raw.status || (raw.isRead ? 'read' : 'unread')).toLowerCase()
      const type = String(raw.type || meta.type || 'system').toLowerCase()
      const detectedTxnId =
        raw.transactionId ||
        raw.reference ||
        meta.transactionId ||
        meta.reference ||
        extractTransactionId(raw.message || '')
      const actor =
        meta.decisionBy ||
        meta.requestedBy ||
        raw.requestedBy ||
        raw.requester ||
        meta.requester ||
        extractActor(raw.message || '') ||
        null

      return {
        ...raw,
        meta,
        status,
        type,
        createdAt,
        transactionId: detectedTxnId,
        companyName: raw.company || raw.companyName || meta.company || meta.companyName || null,
        actor,
        amount: meta.amount ?? raw.amount,
        transactionType: meta.transactionType || raw.transactionType,
        message: String(raw.message || ''),
        title: String(raw.title || ''),
        comments: meta.rationale || meta.comment || raw.rationale || '',
        threshold: Number(meta.threshold || 10000),
        supportingDocuments: Array.isArray(meta.attachments) ? meta.attachments : [],
        link: normalizeTransactionLink(raw.link, detectedTxnId)
      }
    })
  }, [items])

  const counts = useMemo(() => {
    const unread = normalized.filter((n) => n.status === 'unread').length
    const total = normalized.length
    const today = normalized.filter((n) => isToday(n.createdAt)).length
    const week = normalized.filter((n) => isWithinDays(n.createdAt, 7)).length
    return { unread, total, today, week }
  }, [normalized])

  const countBase = useMemo(() => {
    let list = normalized.filter((notification) => isNotificationEnabled(notification, notificationPrefs))
    if (dateRange === '30d') list = list.filter((n) => isWithinDays(n.createdAt, 30))
    if (dateRange === '7d') list = list.filter((n) => isWithinDays(n.createdAt, 7))

    if (search.trim()) {
      const term = search.toLowerCase()
      list = list.filter((n) =>
        [n.title, n.message, n.transactionId, n.companyName, n.actor]
          .map((value) => String(value || '').toLowerCase())
          .some((value) => value.includes(term))
      )
    }

    return list
  }, [normalized, dateRange, search, notificationPrefs])

  const typeCounts = useMemo(() => {
    const map = {
      all: countBase.length,
      approval: countBase.filter((n) => mapType(n.type) === 'approval').length,
      investment: countBase.filter((n) => mapType(n.type) === 'investment').length,
      system: countBase.filter((n) => mapType(n.type) === 'system').length
    }
    return map
  }, [countBase])

  const statusCounts = useMemo(() => {
    const map = {
      all: countBase.length,
      unread: countBase.filter((n) => n.status === 'unread').length,
      read: countBase.filter((n) => n.status === 'read').length,
      archived: countBase.filter((n) => n.status === 'archived').length
    }
    return map
  }, [countBase])

  const filtered = useMemo(() => {
    let list = countBase
    if (typeFilter !== 'all') list = list.filter((n) => mapType(n.type) === typeFilter)
    if (statusFilter !== 'all') list = list.filter((n) => n.status === statusFilter)
    return list.sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf())
  }, [countBase, typeFilter, statusFilter])

  useEffect(() => {
    setPage(1)
  }, [typeFilter, statusFilter, dateRange, search, pageSize])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const start = (page - 1) * pageSize
  const paged = filtered.slice(start, start + pageSize)

  const pagedGroups = useMemo(() => {
    const today = []
    const yesterday = []
    const week = []
    const last30 = []
    const earlier = []

    paged.forEach((n) => {
      if (isToday(n.createdAt)) today.push(n)
      else if (isYesterday(n.createdAt)) yesterday.push(n)
      else if (isWithinDays(n.createdAt, 7)) week.push(n)
      else if (isWithinDays(n.createdAt, 30)) last30.push(n)
      else earlier.push(n)
    })

    return { today, yesterday, week, last30, earlier }
  }, [paged])

  const handleArchiveAllRead = () => {
    filtered
      .filter((n) => n.status === 'read')
      .forEach((n) => dispatch(archiveNotification(n.id)))
  }

  const handleViewDetails = (n) => {
    if (n.status === 'unread') dispatch(markNotificationRead(n.id))
    setSelected(n)
  }

  const renderGroup = (title, list) => {
    if (!list.length) return null
    return (
      <section className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] shadow-[0_16px_42px_-34px_rgba(15,23,42,0.34)] overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--card-border)] bg-[var(--panel)]">
          <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">{title}</h3>
          <span className="text-xs text-[var(--muted-foreground)]">({list.length} notification{list.length === 1 ? '' : 's'})</span>
        </div>
        <div className="divide-y divide-[var(--card-border)]">
          {list.map((n) => (
            <NotificationCard
              key={n.id}
              notification={n}
              onViewDetails={() => handleViewDetails(n)}
              onMarkRead={() => dispatch(markNotificationRead(n.id))}
              onMarkUnread={() => dispatch(markNotificationUnread(n.id))}
              onArchive={() => dispatch(archiveNotification(n.id))}
              onGoToLink={() => {
                if (n.link) navigate(n.link)
              }}
            />
          ))}
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-5 text-[var(--text-primary)]">
      <div className="relative overflow-hidden rounded-[24px] border border-[var(--card-border)]/70 bg-gradient-to-r from-[var(--brand-primary)]/12 via-[var(--panel)] to-[var(--panel-strong)]/70 p-5 shadow-[0_18px_60px_-38px_rgba(15,23,42,0.55)]">
        <div className="absolute inset-0 opacity-35" style={{ background: 'radial-gradient(circle at 20% 20%, rgba(104,210,232,0.16), transparent 38%), radial-gradient(circle at 80% 12%, rgba(52,211,153,0.16), transparent 30%)' }} />
        <div className="relative space-y-1.5">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">Notifications</p>
          <h1 className="text-3xl font-semibold tracking-tight">{counts.total} notifications • {counts.unread} unread</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Stay updated on approvals, investments, and reminders</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatsCard icon="🔔" title="Unread Notifications" value={counts.unread} subtitle={counts.unread ? 'Items need attention' : 'Nothing needs attention'} tone="amber" loading={loading} />
        <StatsCard icon="📬" title="Total Notifications" value={counts.total} subtitle="Last 30 days" tone="blue" loading={loading} />
        <StatsCard icon="📅" title="Today New" value={counts.today} subtitle={counts.today ? 'Since midnight' : 'No new today'} tone="emerald" loading={loading} />
        <StatsCard icon="📆" title="This Week Pending" value={counts.week} subtitle={counts.week ? `${counts.week} items pending your review` : 'No items this week'} tone="slate" loading={loading} />
      </div>

      <div className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-3 shadow-[0_14px_38px_-30px_rgba(15,23,42,0.32)]">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="px-4 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] text-sm hover:bg-[var(--panel-strong)]" onClick={() => dispatch(markAllNotificationsRead())}>
            Mark All Read
          </button>
          <button type="button" className="px-4 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] text-sm hover:bg-[var(--panel-strong)]" onClick={() => dispatch(fetchNotifications())}>
            Refresh
          </button>
          <button type="button" className="px-4 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] text-sm hover:bg-[var(--panel-strong)]" onClick={handleArchiveAllRead}>
            Archive all read
          </button>
        </div>
      </div>

      <div className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4 shadow-[0_14px_38px_-30px_rgba(15,23,42,0.32)] space-y-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notifications by transaction ID, company, or user..."
          className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--panel)] px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)]"
        />

        <ChipRow
          label="Type"
          selected={typeFilter}
          onSelect={setTypeFilter}
          options={TYPE_OPTIONS.map((option) => ({ value: option.key, label: `${option.label} (${typeCounts[option.key] || 0})` }))}
        />

        <ChipRow
          label="Status"
          selected={statusFilter}
          onSelect={setStatusFilter}
          options={STATUS_OPTIONS.map((option) => ({ value: option.key, label: `${option.label} (${statusCounts[option.key] || 0})` }))}
        />

        <div className="flex flex-wrap items-center gap-2">
          <select className="rounded-xl border border-[var(--card-border)] bg-[var(--panel)] px-3 py-2 text-sm" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>
          <button
            type="button"
            className="px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] text-sm hover:bg-[var(--panel-strong)]"
            onClick={() => {
              setTypeFilter('all')
              setStatusFilter('all')
              setDateRange(DEFAULT_RANGE)
              setSearch('')
              setPage(1)
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-rose-500">{String(error)}</div>}

      {loading && !normalized.length ? (
        <div className="space-y-3">
          <NotificationSkeleton />
          <NotificationSkeleton />
          <NotificationSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mx-auto max-w-xl rounded-[24px] border border-dashed border-[var(--card-border)] bg-[var(--bg-card)] px-6 py-10 text-center space-y-3 shadow-[0_16px_48px_-34px_rgba(15,23,42,0.3)]">
          <div className="text-4xl">🔔</div>
          <div>
            <h4 className="text-lg font-semibold text-[var(--text-primary)]">All Caught Up</h4>
            <p className="text-sm text-[var(--muted-foreground)]">No notifications in the selected range.</p>
          </div>
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--brand-primary)] to-cyan-500 text-white text-sm"
            onClick={() => {
              setStatusFilter('archived')
              setDateRange('all')
              setTypeFilter('all')
              setSearch('')
              setPage(1)
            }}
          >
            View Archived
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {renderGroup('Today', pagedGroups.today)}
          {renderGroup('Yesterday', pagedGroups.yesterday)}
          {renderGroup('This Week', pagedGroups.week)}
          {renderGroup('Last 30 Days', pagedGroups.last30)}
          {dateRange === 'all' && renderGroup('Earlier', pagedGroups.earlier)}

          <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--card-border)] bg-[var(--bg-card)] rounded-[16px] px-4 py-3 text-xs text-[var(--muted-foreground)]">
            <span>Showing {start + 1}-{Math.min(start + pageSize, filtered.length)} of {filtered.length} notifications</span>
            <div className="flex items-center gap-2">
              <button type="button" className="px-3 py-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--panel)] text-[var(--text-primary)] disabled:opacity-50" onClick={() => setPage((v) => Math.max(1, v - 1))} disabled={page === 1}>← Prev</button>
              <span>Page {page} of {totalPages}</span>
              <button type="button" className="px-3 py-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--panel)] text-[var(--text-primary)] disabled:opacity-50" onClick={() => setPage((v) => Math.min(totalPages, v + 1))} disabled={page === totalPages}>Next →</button>
              <span>Rows per page:</span>
              <select className="rounded-xl border border-[var(--card-border)] bg-[var(--panel)] px-2 py-1 text-xs text-[var(--text-primary)]" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value) || 12); setPage(1) }}>
                {[8, 12, 16, 20].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <NotificationDetailModal
          notification={selected}
          onClose={() => setSelected(null)}
          onArchive={() => {
            dispatch(archiveNotification(selected.id))
            setSelected(null)
          }}
          onGoToTransaction={() => {
            if (selected.link) {
              navigate(selected.link)
              setSelected(null)
            }
          }}
        />
      )}
    </div>
  )
}

const NotificationCard = ({ notification, onViewDetails, onMarkRead, onMarkUnread, onArchive, onGoToLink }) => {
  const isUnread = notification.status === 'unread'
  const statusMeta = statusForNotification(notification)
  const actionLabel = isUnread && mapType(notification.type) === 'approval' ? '✅ Review Now' : '👁 View Details'

  return (
    <article className={`p-4 ${isUnread ? 'bg-amber-400/8 border-l-4 border-l-amber-500' : 'bg-[var(--bg-card)]'} transition-all`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm ${statusMeta.iconCls}`}>{statusMeta.icon}</span>
            <span className={`text-xs font-semibold uppercase tracking-[0.16em] ${statusMeta.labelCls}`}>{statusMeta.label}</span>
            <StatusPill status={notification.status} unread={isUnread} />
          </div>

          <div className="text-sm text-[var(--text-primary)] leading-relaxed">{statusMeta.title}</div>
          <div className="text-sm text-[var(--muted-foreground)]">{notification.message || 'No message provided.'}</div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-[var(--muted-foreground)]">
            <div>📋 Transaction ID: {notification.transactionId || 'N/A'}</div>
            <div>👤 {statusMeta.actorLabel}: {notification.actor || (mapType(notification.type) === 'system' ? 'System' : 'N/A')}</div>
            <div>📅 {formatDateTime(notification.createdAt)}</div>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-[var(--card-border)] flex flex-wrap items-center gap-2">
        <button type="button" className="px-3 py-1.5 rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] text-xs hover:bg-[var(--panel-strong)]" onClick={notification.link && isUnread && mapType(notification.type) === 'approval' ? onGoToLink : onViewDetails}>
          {actionLabel}
        </button>
        {isUnread ? (
          <button type="button" className="px-3 py-1.5 rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] text-xs hover:bg-[var(--panel-strong)]" onClick={onMarkRead}>🔖 Mark Read</button>
        ) : (
          <button type="button" className="px-3 py-1.5 rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] text-xs hover:bg-[var(--panel-strong)]" onClick={onMarkUnread}>🔖 Mark Unread</button>
        )}
        <button type="button" className="px-3 py-1.5 rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] text-xs hover:bg-[var(--panel-strong)]" onClick={onArchive}>📦 Archive</button>
      </div>
    </article>
  )
}

const NotificationDetailModal = ({ notification, onClose, onArchive, onGoToTransaction }) => {
  const related = {
    id: notification.transactionId || notification.meta?.transactionId || 'N/A',
    amount: notification.amount != null ? formatCurrency(notification.amount) : '—',
    company: notification.companyName || notification.meta?.companyName || '—',
    type: notification.transactionType ? toTitle(notification.transactionType) : '—',
    requestedBy: notification.meta?.requestedBy || notification.actor || 'System',
    threshold: formatCurrency(notification.threshold || 10000)
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[24px] border border-[var(--card-border)] bg-[var(--panel)] shadow-[0_30px_100px_-50px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--card-border)] px-5 py-4">
          <h3 className="text-xl font-semibold tracking-tight">Notification Details</h3>
          <button type="button" className="rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--panel-strong)]" onClick={onClose}>✕</button>
        </div>

        <div className="space-y-4 p-5 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <InfoTile label="Notification Type" value={toTitle(mapType(notification.type))} />
            <InfoTile label="Status" value={toTitle(notification.status)} />
            <InfoTile label="Received" value={formatDateTime(notification.createdAt)} />
          </div>

          <section className="rounded-[18px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4">
            <h4 className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Message</h4>
            <p className="mt-2 text-sm text-[var(--text-primary)] whitespace-pre-wrap">{notification.message || 'No message provided.'}</p>
          </section>

          <section className="rounded-[18px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4">
            <h4 className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Related Transaction</h4>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-[var(--text-primary)]">
              <div>Transaction ID: {related.id}</div>
              <div>Amount: {related.amount}</div>
              <div>Company: {related.company}</div>
              <div>Type: {related.type}</div>
              <div>Requested By: {related.requestedBy}</div>
              <div>Threshold: {related.threshold} ▲ Approval required</div>
            </div>
          </section>

          <section className="rounded-[18px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4">
            <h4 className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Approval Comments</h4>
            <p className="mt-2 text-sm text-[var(--text-primary)]">{notification.comments || 'No comments provided.'}</p>
          </section>

          <section className="rounded-[18px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4">
            <h4 className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Supporting Documents</h4>
            <div className="mt-2 text-sm text-[var(--text-primary)]">
              {notification.supportingDocuments.length
                ? notification.supportingDocuments.map((doc, index) => <div key={`${doc}-${index}`}>📎 {String(doc)}</div>)
                : <div>No attachments</div>}
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" className="px-4 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] text-sm hover:bg-[var(--panel-strong)]" onClick={onArchive}>Archive</button>
            <button type="button" className="px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--brand-primary)] to-cyan-500 text-white text-sm disabled:opacity-50" onClick={onGoToTransaction} disabled={!notification.link}>Go to Transaction</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const StatsCard = ({ icon, title, value, subtitle, tone = 'blue', loading }) => {
  const toneMap = {
    blue: 'border-sky-500/20 bg-sky-500/5',
    emerald: 'border-emerald-500/20 bg-emerald-500/5',
    amber: 'border-amber-500/20 bg-amber-500/5',
    slate: 'border-slate-500/20 bg-slate-500/5'
  }

  return (
    <div className={`relative overflow-hidden rounded-[20px] border bg-[var(--bg-card)] p-4 min-h-[150px] shadow-[0_16px_50px_-35px_rgba(0,0,0,0.65)] ${toneMap[tone] || toneMap.blue}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-60" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            <span className="text-base leading-none">{icon}</span>
            <span>{title}</span>
          </div>
          <p className="text-[26px] font-semibold tracking-tight text-[var(--text-primary)]">{loading ? '...' : value}</p>
          <p className="text-xs text-[var(--muted-foreground)] min-h-[32px]">{subtitle}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--panel)] text-lg">{icon}</div>
      </div>
    </div>
  )
}

const ChipRow = ({ label, options, selected, onSelect }) => (
  <div className="flex flex-wrap items-center gap-2 text-xs">
    <span className="w-16 text-[var(--muted-foreground)]">{label}:</span>
    {options.map((option) => (
      <button
        key={`${label}-${option.value}`}
        type="button"
        onClick={() => onSelect(option.value)}
        className={`px-3 py-1.5 rounded-full border transition-all ${selected === option.value ? 'bg-[var(--brand-primary)]/12 text-[var(--brand-primary)] border-[var(--brand-primary)]/30' : 'bg-[var(--bg-card)] border-[var(--card-border)] text-[var(--muted-foreground)] hover:text-[var(--text-primary)]'}`}
      >
        {option.label}
      </button>
    ))}
  </div>
)

const StatusPill = ({ status, unread }) => {
  if (unread) {
    return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">🔵 UNREAD</span>
  }

  const map = {
    read: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30',
    archived: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border border-zinc-500/30'
  }

  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${map[status] || map.read}`}>{toTitle(status || 'read')}</span>
}

const InfoTile = ({ label, value }) => (
  <div className="rounded-[14px] border border-[var(--card-border)] bg-[var(--bg-card)] p-3">
    <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">{label}</p>
    <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{value || '—'}</p>
  </div>
)

const NotificationSkeleton = () => (
  <div className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4 animate-pulse space-y-3">
    <div className="h-4 w-52 rounded bg-[var(--panel-strong)]" />
    <div className="h-4 w-full rounded bg-[var(--panel-strong)]" />
    <div className="h-4 w-3/4 rounded bg-[var(--panel-strong)]" />
    <div className="h-9 w-80 rounded bg-[var(--panel-strong)]" />
  </div>
)

const mapType = (type = '') => {
  const key = String(type).toLowerCase()
  if (key.includes('approval')) return 'approval'
  if (key.includes('invest')) return 'investment'
  return 'system'
}

const isNotificationEnabled = (notification, prefs) => {
  const type = mapType(notification.type)
  if (type === 'approval') return prefs.approvals
  if (type === 'investment') return prefs.maturity
  return prefs.system
}

const statusForNotification = (notification) => {
  const type = mapType(notification.type)
  const message = String(notification.message || '').toLowerCase()
  const txId = shortId(notification.transactionId)

  if (type === 'approval') {
    if (message.includes('approved')) {
      return { icon: '✅', iconCls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30', label: 'Approved', labelCls: 'text-emerald-700 dark:text-emerald-300', title: `Transaction ${txId} was approved`, actorLabel: 'Approved by' }
    }
    if (message.includes('rejected')) {
      return { icon: '❌', iconCls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30', label: 'Rejected', labelCls: 'text-rose-700 dark:text-rose-300', title: `Transaction ${txId} was rejected`, actorLabel: 'Rejected by' }
    }
    return { icon: '⚠️', iconCls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30', label: 'Requires Approval', labelCls: 'text-amber-700 dark:text-amber-300', title: `Transaction ${txId} requires approval`, actorLabel: 'Requested by' }
  }

  if (type === 'investment') {
    return { icon: '📈', iconCls: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30', label: 'Investment', labelCls: 'text-cyan-700 dark:text-cyan-300', title: notification.title || 'Investment update', actorLabel: 'Triggered by' }
  }

  return { icon: '🔔', iconCls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30', label: 'System Alert', labelCls: 'text-blue-700 dark:text-blue-300', title: notification.title || 'System notification', actorLabel: 'Triggered by' }
}

const shortId = (value) => {
  const text = String(value || '')
  if (!text) return '—'
  if (text.length <= 12) return text
  return `${text.slice(0, 8)}...`
}

const toTitle = (value = '') => String(value).replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
const formatDateTime = (value) => (value ? dayjs(value).format('MMM D, YYYY [at] h:mm A') : '—')
const formatCurrency = (value) => `Br ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value || 0))}`
const isToday = (value) => value ? dayjs(value).isSame(dayjs(), 'day') : false
const isYesterday = (value) => value ? dayjs(value).isSame(dayjs().subtract(1, 'day'), 'day') : false
const isWithinDays = (value, days) => {
  if (!value) return false
  const date = dayjs(value)
  return date.isAfter(dayjs().subtract(days, 'day')) || date.isSame(dayjs().subtract(days, 'day'), 'day')
}

const extractTransactionId = (message = '') => {
  const match = String(message).match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
  return match ? match[0] : null
}

const extractActor = (message = '') => {
  const approvedMatch = String(message).match(/approved by\s+([^.,]+)/i)
  if (approvedMatch) return approvedMatch[1].trim()
  const rejectedMatch = String(message).match(/rejected by\s+([^.,]+)/i)
  if (rejectedMatch) return rejectedMatch[1].trim()
  const requestedMatch = String(message).match(/requested by\s+([^.,]+)/i)
  if (requestedMatch) return requestedMatch[1].trim()
  return null
}

const normalizeTransactionLink = (link, transactionId) => {
  const raw = String(link || '').trim()
  if (!raw && transactionId) return `/transactions?transactionId=${encodeURIComponent(transactionId)}`
  if (!raw) return ''
  if (raw.startsWith('/transactions/')) {
    const id = transactionId || raw.split('/').filter(Boolean)[1] || ''
    return id ? `/transactions?transactionId=${encodeURIComponent(id)}` : '/transactions'
  }
  if (raw === '/transactions' && transactionId) return `/transactions?transactionId=${encodeURIComponent(transactionId)}`
  return raw
}

export default NotificationsPage
