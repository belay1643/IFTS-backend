import { useState, useRef, useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { setDashboardMode, fetchSummary } from '../store/slices/dashboardSlice.js'
import { toggleTheme } from '../store/slices/uiSlice.js'
import { logout } from '../store/slices/authSlice.js'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../store/slices/notificationSlice.js'
import { loadCompanyNotificationSettings, loadCompanyProfileSettings } from '../utils/companySettings.js'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['admin', 'manager', 'viewer'] },
  { to: '/companies', label: 'Companies', icon: '🏢', roles: ['admin', 'manager', 'viewer'] },
  { to: '/investments', label: 'Investments', icon: '💰', roles: ['admin', 'manager', 'viewer'] },
  { to: '/transactions', label: 'Transactions', icon: '🔁', roles: ['admin', 'manager', 'viewer'] },
  { to: '/approvals', label: 'Approvals', icon: '✅', roles: ['admin', 'manager'] },
  { to: '/notifications', label: 'Notifications', icon: '🔔', roles: ['admin', 'manager', 'viewer'] },
  { to: '/reports', label: 'Reports', icon: '📑', roles: ['admin', 'manager', 'viewer'] },
  { to: '/managers', label: 'Managers', icon: '🧑‍💼', roles: ['admin', 'manager'] },
  { to: '/audit', label: 'Audit Logs', icon: '🧾', roles: ['admin'] },
  { to: '/settings', label: 'Settings', icon: '⚙️', roles: ['admin', 'manager'] }
]

const Topbar = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useSelector((s) => s.auth)
  const { mode, summary } = useSelector((s) => s.dashboard)
  const { list, active } = useSelector((s) => s.company)
  const { theme } = useSelector((s) => s.ui)
  const { items: notifItems } = useSelector((s) => s.notifications)
  const activeCompany = useMemo(() => list.find((company) => company.id === active), [list, active])
  const profileSettings = useMemo(
    () => loadCompanyProfileSettings(active, activeCompany?.reportingPreferences),
    [active, activeCompany?.reportingPreferences]
  )
  const notificationSettings = useMemo(
    () => loadCompanyNotificationSettings(active, activeCompany?.reportingPreferences),
    [active, activeCompany?.reportingPreferences]
  )

  const displayName = profileSettings?.name || user?.name || 'User'
  const displayEmail = profileSettings?.email || user?.email || ''
  const isDark = theme === 'dark'
  const initials = displayName ? displayName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() : 'U'
  const canConsolidate = list.length > 0
  const activeRole = list.find((c) => c.id === active)?.role || 'viewer'
  const mobileLinks = useMemo(() => NAV_LINKS.filter((link) => link.roles.includes(activeRole)), [activeRole])

  const pageMeta = useMemo(() => {
    const pathname = location.pathname

    if (pathname === '/dashboard') {
      return { title: 'Dashboard', subtitle: 'Portfolio overview and analytics', showViewSelector: true }
    }
    if (pathname === '/companies') {
      return { title: 'Company Directory', subtitle: 'Manage entities, roles, approvals, and reporting in one place', showViewSelector: false }
    }
    if (pathname === '/companies/new') {
      return { title: 'Create Company', subtitle: 'Add a new company record', showViewSelector: false }
    }
    if (/^\/companies\/[^/]+\/edit$/.test(pathname)) {
      return { title: 'Edit Company', subtitle: 'Update company details and settings', showViewSelector: false }
    }
    if (/^\/companies\/[^/]+$/.test(pathname)) {
      return { title: 'Company Profile', subtitle: 'Live profile, metrics, and activity', showViewSelector: false }
    }
    if (pathname === '/investments') {
      return { title: 'Investments', subtitle: 'Investment portfolio and returns', showViewSelector: false }
    }
    if (pathname === '/transactions') {
      return { title: 'Transactions', subtitle: 'Transaction ledger and approvals', showViewSelector: false }
    }
    if (pathname === '/approvals') {
      return { title: 'Approvals', subtitle: 'Review and decide pending requests', showViewSelector: false }
    }
    if (/^\/approvals\//.test(pathname)) {
      return { title: 'Approval Detail', subtitle: 'Review a specific approval request', showViewSelector: false }
    }
    if (pathname === '/reports') {
      return { title: 'Reports', subtitle: 'Generate statements and compliance exports', showViewSelector: false }
    }
    if (pathname === '/managers') {
      return { title: 'Managers', subtitle: 'Invite and assign manager access', showViewSelector: false }
    }
    if (pathname === '/audit') {
      return { title: 'Audit Logs', subtitle: 'Trace activity and system changes', showViewSelector: false }
    }
    if (pathname === '/settings') {
      return { title: 'Settings', subtitle: 'Configure company and system preferences', showViewSelector: false }
    }
    if (pathname === '/notifications') {
      return { title: 'Notifications', subtitle: 'Alerts and updates', showViewSelector: false }
    }

    return { title: 'Ethio Vest', subtitle: 'Investment platform dashboard', showViewSelector: false }
  }, [location.pathname])

  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const profileRef = useRef(null)
  const notifRef = useRef(null)

  const onDashboard = pageMeta.showViewSelector

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    dispatch(fetchNotifications({ limit: 20 }))
  }, [dispatch])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  const notifications = useMemo(() => {
    if (Array.isArray(notifItems) && notifItems.length > 0) return notifItems
    if (Array.isArray(summary?.notifications) && summary.notifications.length > 0) return summary.notifications
    const toTitle = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : 'Asset'
    return (summary?.holdings || []).slice(0, 5).map((h, idx) => ({
      id: h.id || idx,
      message: `${toTitle(h.assetType || h.name || 'Asset')} maturing soon`
    }))
  }, [notifItems, summary])

  const filteredNotifications = useMemo(() => {
    const mapType = (value) => {
      const key = String(value || '').toLowerCase()
      if (key.includes('approval')) return 'approval'
      if (key.includes('invest')) return 'investment'
      return 'system'
    }

    return notifications.filter((notification) => {
      const type = mapType(notification.type)
      if (type === 'approval') return notificationSettings.approvals
      if (type === 'investment') return notificationSettings.maturity
      return notificationSettings.system
    })
  }, [notifications, notificationSettings])

  const formatTime = (date) => {
    if (!date) return ''
    const d = new Date(date)
    const diff = (Date.now() - d.getTime()) / 1000
    if (diff < 60) return `${Math.max(1, Math.floor(diff))}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  const unreadBadge = filteredNotifications.filter((n) => (n.status || (n.isRead ? 'read' : 'unread')) === 'unread').length

  const resolveNotificationLink = (notification) => {
    const raw = String(notification?.link || '').trim()
    const idFromLink = raw.startsWith('/transactions/') ? raw.split('/').filter(Boolean)[1] : ''
    const messageIdMatch = String(notification?.message || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
    const transactionId = notification?.transactionId || idFromLink || (messageIdMatch ? messageIdMatch[0] : '')

    if (!raw && transactionId) return `/transactions?transactionId=${encodeURIComponent(transactionId)}`
    if (!raw) return '/notifications'
    if (raw.startsWith('/transactions/')) {
      return transactionId ? `/transactions?transactionId=${encodeURIComponent(transactionId)}` : '/transactions'
    }
    if (raw === '/transactions' && transactionId) {
      return `/transactions?transactionId=${encodeURIComponent(transactionId)}`
    }
    return raw
  }

  const notificationTone = (notification) => {
    const message = String(notification?.message || '').toLowerCase()
    if (message.includes('rejected')) {
      return { icon: '⛔', badge: 'Rejected', badgeCls: 'bg-rose-500/14 text-rose-300 border border-rose-500/35' }
    }
    if (message.includes('approved')) {
      return { icon: '✅', badge: 'Approved', badgeCls: 'bg-emerald-500/14 text-emerald-300 border border-emerald-500/35' }
    }
    if (String(notification?.type || '').toLowerCase().includes('approval')) {
      return { icon: '📝', badge: 'Needs Review', badgeCls: 'bg-amber-500/14 text-amber-300 border border-amber-500/35' }
    }
    return { icon: '🔔', badge: 'Update', badgeCls: 'bg-sky-500/14 text-sky-300 border border-sky-500/35' }
  }

  const handleNotificationClick = (n) => {
    if (n.id && (n.status === 'unread' || (!n.status && !n.isRead))) {
      dispatch(markNotificationRead(n.id))
    }
    const nextPath = resolveNotificationLink(n)
    if (nextPath) navigate(nextPath)
    setNotifOpen(false)
  }

  const handleModeChange = (nextMode) => {
    dispatch(setDashboardMode(nextMode))
    if (nextMode === 'consolidated' && list.length) {
      dispatch(fetchSummary({ mode: 'consolidated', companyIds: list.map((c) => c.id) }))
    }
    if (nextMode === 'single' && active) {
      dispatch(fetchSummary({ mode: 'single', companyIds: [active] }))
    }
  }

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  return (
    <header className="navbar-glass sticky top-0 z-50 w-full border-b border-[color:var(--panel-border)]/60 text-[color:var(--text-primary)] backdrop-blur-xl">
      <div className="w-full px-3 py-2.5 sm:px-6 lg:px-8 xl:px-10 flex items-center justify-between gap-3 sm:gap-5">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
          <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--panel-border)] bg-[var(--bg-card)] px-3 py-2 shadow-sm">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500/18 to-cyan-500/14 border border-emerald-400/30 flex items-center justify-center text-[18px] font-extrabold tracking-tight shadow-[0_12px_24px_-18px_rgba(16,185,129,0.45)] text-[color:var(--text-primary)]">
              EV
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="text-[14px] font-extrabold tracking-tight text-[color:var(--text-primary)]">Ethio Vest</div>
              <div className="text-[11px] text-[color:var(--text-muted)]">Investment platform dashboard</div>
            </div>
          </div>
          {onDashboard && (
            <div className="hidden md:flex items-center gap-2 rounded-full border border-[color:var(--panel-border)] bg-[var(--bg-card)] px-2 py-1 shadow-sm">
              <span className="px-3 text-[11px] font-semibold tracking-[0.16em] text-[color:var(--text-muted)] uppercase">View</span>
              <select
                value={mode}
                onChange={(e) => handleModeChange(e.target.value)}
                className="h-9 rounded-full border border-[color:var(--panel-border)] bg-[var(--bg-card)] px-4 text-[11px] font-semibold text-[color:var(--text-primary)] shadow-sm outline-none transition hover:bg-[var(--bg-hover)]"
              >
                <option value="single">Single Company</option>
                {canConsolidate && <option value="consolidated">All Companies (Consolidated)</option>}
              </select>
            </div>
          )}
          <div className="min-w-0 leading-tight">
            <div className="text-[18px] sm:text-[22px] lg:text-[24px] font-bold tracking-tight text-[color:var(--text-primary)] truncate">{pageMeta.title}</div>
            <div className="hidden sm:block text-[12px] lg:text-[13px] text-[color:var(--text-muted)] truncate">{pageMeta.subtitle}</div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2.5 text-[color:var(--text-primary)]">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="lg:hidden h-10 w-10 rounded-full border border-[color:var(--panel-border)] bg-[var(--bg-card)] flex items-center justify-center text-base shadow-sm transition-all hover:bg-[var(--bg-hover)]"
            title="Open navigation"
          >
            ☰
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => dispatch(toggleTheme())}
            className="h-10 w-10 rounded-full border border-[color:var(--panel-border)] bg-[var(--bg-card)] flex items-center justify-center text-base shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--bg-hover)] hover:shadow-md"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setNotifOpen((v) => !v); setProfileOpen(false) }}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--panel-border)] bg-[var(--bg-card)] text-base shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--bg-hover)] hover:shadow-md"
              title="Notifications"
            >
              🔔
              {unreadBadge > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadBadge > 9 ? '9+' : unreadBadge}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-[color:var(--panel-border)] bg-[var(--bg-card)] shadow-[0_24px_60px_-28px_rgba(15,23,42,0.45)]">
                <div className="flex items-center justify-between gap-2 border-b border-[color:var(--panel-border)] bg-gradient-to-r from-emerald-500/8 via-cyan-500/6 to-transparent px-4 py-3.5">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold tracking-tight text-[color:var(--text-primary)]">Notifications</span>
                    <span className="text-[11px] text-[color:var(--text-muted)]">{filteredNotifications.length} items • {unreadBadge} unread</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => dispatch(markAllNotificationsRead())}
                      className="rounded-full border border-[color:var(--panel-border)] bg-[var(--bg-card)] px-2.5 py-1 text-[10px] font-semibold transition-colors hover:bg-[var(--bg-hover)]"
                    >
                      Mark all read
                    </button>
                    <button
                      onClick={() => { setNotifOpen(false); navigate('/notifications') }}
                      className="rounded-full border border-[color:var(--panel-border)] bg-[var(--bg-card)] px-2.5 py-1 text-[10px] font-semibold transition-colors hover:bg-[var(--bg-hover)]"
                    >
                      View all
                    </button>
                  </div>
                </div>
                <div className="max-h-[70vh] overflow-y-auto p-2">
                  {filteredNotifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-[color:var(--text-muted)]">No notifications</div>
                  ) : (
                    filteredNotifications.map((n) => {
                      const tone = notificationTone(n)
                      const unread = n.status === 'unread' || (!n.status && !n.isRead)
                      return (
                        <button
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className="mb-2 w-full rounded-xl border border-[color:var(--panel-border)]/80 bg-[var(--panel)] px-3.5 py-3 text-left transition-all hover:border-emerald-400/35 hover:bg-[var(--bg-hover)] last:mb-0"
                        >
                          <div className="flex items-start gap-3.5">
                            <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--panel-border)] bg-[var(--bg-card)] text-sm">
                              {tone.icon}
                            </span>
                            <div className="flex-1">
                              <div className="mb-1 flex items-center gap-2">
                                <span className="text-[12px] font-semibold leading-tight text-[color:var(--text-primary)]">{n.title || 'Notification'}</span>
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${tone.badgeCls}`}>{tone.badge}</span>
                              </div>
                              <div className="text-[12px] leading-snug text-[color:var(--text-secondary)]">{n.message}</div>
                              <div className="mt-1.5 flex items-center justify-between text-[10px] text-[color:var(--text-muted)]">
                                <span>{formatTime(n.createdAt)}</span>
                                {unread ? <span className="text-emerald-300">Unread</span> : <span>Read</span>}
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => { setProfileOpen((v) => !v); setNotifOpen(false) }}
              className="flex h-10 items-center gap-2 rounded-full border border-[color:var(--panel-border)] bg-[var(--bg-card)] px-3 text-xs font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--bg-hover)] hover:shadow-md"
            >
              <span className="h-6 w-6 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-[10px] font-semibold">{initials}</span>
              <span className="hidden sm:inline">{displayName}</span>
              <span className="text-[10px]">▼</span>
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-[color:var(--panel-border)] bg-[var(--bg-card)] shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-[color:var(--panel-border)]">
                  <div className="text-sm font-semibold">{displayName}</div>
                  <div className="text-[11px] text-[color:var(--text-muted)]">{displayEmail}</div>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => { setProfileOpen(false); navigate('/settings') }}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2"
                  >
                    ⚙️ Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2"
                  >
                    🚪 Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[86vw] max-w-[340px] overflow-y-auto border-l border-[color:var(--panel-border)] bg-[var(--bg-card)] p-4 shadow-[0_24px_70px_-30px_rgba(0,0,0,0.7)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-extrabold tracking-tight text-[color:var(--text-primary)]">Ethio Vest</div>
                <div className="text-[11px] text-[color:var(--text-muted)]">Navigation</div>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="h-9 w-9 rounded-full border border-[color:var(--panel-border)] bg-[var(--bg-card)] text-sm"
              >
                ✕
              </button>
            </div>

            {onDashboard && (
              <div className="mb-4 rounded-2xl border border-[color:var(--panel-border)] bg-[var(--panel)] p-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Dashboard view</div>
                <select
                  value={mode}
                  onChange={(e) => handleModeChange(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[color:var(--panel-border)] bg-[var(--bg-card)] px-3 text-[12px] font-semibold text-[color:var(--text-primary)]"
                >
                  <option value="single">Single Company</option>
                  {canConsolidate && <option value="consolidated">All Companies (Consolidated)</option>}
                </select>
              </div>
            )}

            <nav className="space-y-2">
              {mobileLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium transition-all ${isActive
                      ? 'border-[var(--brand-primary)]/40 bg-[var(--brand-primary)]/12 text-[var(--text-primary)]'
                      : 'border-[color:var(--panel-border)] bg-[var(--panel)] text-[color:var(--text-secondary)]'}`
                  }
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--panel-border)] bg-[var(--bg-card)] text-base">
                    {link.icon}
                  </span>
                  <span>{link.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  )
}

export default Topbar
