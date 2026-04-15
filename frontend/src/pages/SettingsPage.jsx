import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import api from '../utils/api.js'
import { updateCompany } from '../store/slices/companySlice.js'

const NAV_ITEMS = [
  { key: 'profile', label: 'Profile Settings', icon: '👤', description: 'Update personal details and password.', roles: ['admin', 'manager', 'viewer'] },
  { key: 'users', label: 'User Management', icon: '👥', description: 'Invite users, assign roles, and review access.', roles: ['admin'] },
  { key: 'company', label: 'Company Preferences', icon: '🏢', description: 'Set legal identity and reporting controls.', roles: ['admin'] },
  { key: 'approvals', label: 'Approval Workflow', icon: '✅', description: 'Tune thresholds and approval routing.', roles: ['admin', 'manager'] },
  { key: 'notifications', label: 'Notification Settings', icon: '🔔', description: 'Control email, in-app, and SMS notifications.', roles: ['admin', 'manager'] },
  { key: 'security', label: 'Security Settings', icon: '🔒', description: 'Password policy, sessions, and login alerts.', roles: ['admin'] },
  { key: 'backup', label: 'Backup & Data', icon: '💾', description: 'Backups, retention, and export formats.', roles: ['admin'] },
  { key: 'system', label: 'System Preferences', icon: '🖥️', description: 'Page defaults for approvals and reports.', roles: ['admin', 'manager'] },
  { key: 'audit', label: 'Audit Settings', icon: '📜', description: 'Log retention and tracking controls.', roles: ['admin'] }
]

const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Manager',
  viewer: 'Viewer'
}

const SETTINGS_STORAGE_PREFIX = 'ifts.settings.'

const getSettingsStorageKey = (companyId) => `${SETTINGS_STORAGE_PREFIX}${companyId || 'global'}`

const safeParse = (value, fallback) => {
  try {
    const parsed = JSON.parse(value)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

const loadPersistedSettings = (companyId) => {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(getSettingsStorageKey(companyId))
  if (!raw) return null
  return safeParse(raw, null)
}

const persistSettings = (companyId, payload) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(getSettingsStorageKey(companyId), JSON.stringify(payload))
}

const parseReportingPreferences = (rawValue) => {
  if (!rawValue) return null
  return safeParse(rawValue, null)
}

const formatDateTime = (value) => {
  if (!value) return 'Just now'
  return new Intl.DateTimeFormat('en-ET', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

const createDefaultProfile = (user) => ({
  name: user?.name || '',
  email: user?.email || '',
  jobTitle: 'Investment Analyst',
  phone: '',
  timezone: 'Africa/Addis_Ababa',
  newPassword: '',
  confirmPassword: ''
})

const DEFAULT_APPROVAL_RULES = { threshold: 100000, autoApprove: false, twoStep: false, twoStepThreshold: 500000 }
const DEFAULT_NOTIFICATIONS = { maturity: true, approvals: true, system: true, email: true, sms: false, push: true, dailyDigest: true, daysBeforeMaturity: 7 }
const DEFAULT_SECURITY = { minLength: 8, sessionTimeout: 30, maxAttempts: 5, loginAlerts: true, deviceTrust: false }
const DEFAULT_SYSTEM = {
  approvalsDefaultTab: 'pending',
  approvalsDefaultRange: 'last30',
  approvalsPageSize: 4,
  reportsDefaultPeriod: 'current'
}
const DEFAULT_BACKUP = { schedule: 'daily', encrypt: true, retainDays: 30, exportFormat: 'csv', autoExport: true }
const DEFAULT_COMPANY_PREFS = { legalName: '', shortName: '', reportingBasis: 'accrual', fiscalYearStart: '07', lockDay: 5 }

const buildCompanyDefaults = (company) => {
  const companyName = String(company?.name || '').trim()
  if (!companyName) return DEFAULT_COMPANY_PREFS

  const initials = companyName
    .split(' ')
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')

  return {
    ...DEFAULT_COMPANY_PREFS,
    legalName: companyName,
    shortName: initials || companyName.slice(0, 12)
  }
}

const SettingsPage = () => {
  const dispatch = useDispatch()
  const { list, active } = useSelector((s) => s.company)
  const { user } = useSelector((s) => s.auth)
  const role = list.find((c) => c.id === active)?.role || 'viewer'
  const activeCompany = list.find((c) => c.id === active)
  const allowedNav = useMemo(() => NAV_ITEMS.filter((n) => n.roles.includes(role)), [role])
  const [activeTab, setActiveTab] = useState(allowedNav[0]?.key || 'profile')
  const [users, setUsers] = useState([])
  const [userLoading, setUserLoading] = useState(false)
  const [userError, setUserError] = useState('')
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'manager', password: '' })
  const [assignForm, setAssignForm] = useState({ email: '', role: 'viewer' })

  // Shared state for toggles/forms (local only for now)
  const [profile, setProfile] = useState(createDefaultProfile(user))
  const [approvalRules, setApprovalRules] = useState(DEFAULT_APPROVAL_RULES)
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS)
  const [security, setSecurity] = useState(DEFAULT_SECURITY)
  const [system, setSystem] = useState(DEFAULT_SYSTEM)
  const [backup, setBackup] = useState(DEFAULT_BACKUP)
  const [companyPrefs, setCompanyPrefs] = useState(buildCompanyDefaults(activeCompany))
  const [statusMsg, setStatusMsg] = useState('')
  const [dirty, setDirty] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(new Date().toISOString())

  const isManager = role === 'manager'
  const isViewer = role === 'viewer'

  useEffect(() => {
    setProfile(createDefaultProfile(user))
  }, [user])

  useEffect(() => {
    if (!allowedNav.some((item) => item.key === activeTab)) {
      setActiveTab(allowedNav[0]?.key || 'profile')
    }
  }, [activeTab, allowedNav])

  useEffect(() => {
    const remotePrefs = parseReportingPreferences(activeCompany?.reportingPreferences)
    const localPrefs = loadPersistedSettings(active)
    const source = localPrefs || remotePrefs || {}

    setProfile({ ...createDefaultProfile(user), ...(source.profile || {}) })
    setApprovalRules({ ...DEFAULT_APPROVAL_RULES, ...(source.approvalRules || {}) })
    setNotifications({ ...DEFAULT_NOTIFICATIONS, ...(source.notifications || {}) })
    setSecurity({ ...DEFAULT_SECURITY, ...(source.security || {}) })
    setSystem({ ...DEFAULT_SYSTEM, ...(source.system || {}) })
    setBackup({ ...DEFAULT_BACKUP, ...(source.backup || {}) })
    setCompanyPrefs({ ...buildCompanyDefaults(activeCompany), ...(source.companyPrefs || {}) })
    setLastSavedAt(source.lastSavedAt || new Date().toISOString())
    setDirty(false)
    setStatusMsg('')
    setUserError('')
  }, [active, activeCompany, user])

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  const markDirty = () => {
    setDirty(true)
    setStatusMsg('')
  }

  const updateProfile = (patch) => { markDirty(); setProfile((p) => ({ ...p, ...patch })) }
  const updateApprovalRules = (patch) => { markDirty(); setApprovalRules((p) => ({ ...p, ...patch })) }
  const updateNotifications = (patch) => { markDirty(); setNotifications((p) => ({ ...p, ...patch })) }
  const updateSecurity = (patch) => { markDirty(); setSecurity((p) => ({ ...p, ...patch })) }
  const updateSystem = (patch) => { markDirty(); setSystem((p) => ({ ...p, ...patch })) }
  const updateBackup = (patch) => { markDirty(); setBackup((p) => ({ ...p, ...patch })) }
  const updateCompanyPrefs = (patch) => { markDirty(); setCompanyPrefs((p) => ({ ...p, ...patch })) }

  const badge = useMemo(() => {
    if (role === 'admin') return 'Admin: full settings access'
    if (role === 'manager') return 'Manager: limited operational settings'
    return 'Viewer: read-only'
  }, [role])

  const enabledNotifications = useMemo(
    () => ['maturity', 'approvals', 'system', 'email', 'sms', 'push', 'dailyDigest'].filter((key) => Boolean(notifications[key])).length,
    [notifications]
  )

  const roleCounts = useMemo(
    () =>
      users.reduce(
        (accumulator, item) => {
          const normalizedRole = String(item.role || 'viewer').toLowerCase()
          accumulator.total += 1
          if (normalizedRole === 'admin') accumulator.admin += 1
          if (normalizedRole === 'manager') accumulator.manager += 1
          if (normalizedRole === 'viewer') accumulator.viewer += 1
          return accumulator
        },
        { total: 0, admin: 0, manager: 0, viewer: 0 }
      ),
    [users]
  )

  const stats = useMemo(
    () => [
      {
        label: 'Company users',
        value: roleCounts.total,
        hint: `${roleCounts.admin} admin${roleCounts.admin === 1 ? '' : 's'}, ${roleCounts.manager} manager${roleCounts.manager === 1 ? '' : 's'}, ${roleCounts.viewer} viewer${roleCounts.viewer === 1 ? '' : 's'}`,
        icon: '👥'
      },
      {
        label: 'Available settings',
        value: allowedNav.length,
        hint: 'Categories available to your role',
        icon: '⚙️'
      },
      {
        label: 'Enabled alerts',
        value: enabledNotifications,
        hint: 'Notifications currently active',
        icon: '🔔'
      },
      {
        label: 'Current role',
        value: ROLE_LABELS[role] || role,
        hint: 'Controls are filtered by role',
        icon: '🛡️'
      }
    ],
    [allowedNav.length, enabledNotifications, role, roleCounts]
  )

  const selectedTabMeta = NAV_ITEMS.find((item) => item.key === activeTab) || NAV_ITEMS[0]

  const handleSave = async () => {
    const normalizedLegalName = String(companyPrefs.legalName || '').trim()
    if (!normalizedLegalName) {
      setUserError('Company legal name is required before saving.')
      return
    }

    const nextSavedAt = new Date().toISOString()
    const payload = {
      profile,
      approvalRules,
      notifications,
      security,
      system,
      backup,
      companyPrefs,
      lastSavedAt: nextSavedAt
    }

    let savedRemotely = false

    if (active && role === 'admin') {
      try {
        await dispatch(
          updateCompany({
            id: active,
            updates: {
              name: normalizedLegalName,
              approvalThreshold: Number(approvalRules.threshold || 0),
              reportingPreferences: JSON.stringify(payload)
            }
          })
        ).unwrap()
        savedRemotely = true
      } catch (error) {
        setUserError(error?.message || 'Could not sync settings to server. Saved locally instead.')
      }
    }

    persistSettings(active, payload)
    setStatusMsg(savedRemotely ? 'Settings saved and applied' : 'Settings saved locally')
    setDirty(false)
    setLastSavedAt(nextSavedAt)
  }

  const handleReset = () => {
    setProfile(createDefaultProfile(user))
    setApprovalRules(DEFAULT_APPROVAL_RULES)
    setNotifications(DEFAULT_NOTIFICATIONS)
    setSecurity(DEFAULT_SECURITY)
    setSystem(DEFAULT_SYSTEM)
    setBackup(DEFAULT_BACKUP)
    setCompanyPrefs(DEFAULT_COMPANY_PREFS)
    setStatusMsg('Reverted to defaults')
    setDirty(false)
    setUserError('')
  }

  const fetchUsers = async () => {
    if (!active || role === 'viewer') return
    setUserLoading(true)
    setUserError('')
    try {
      const { data } = await api.get('/users', { params: { companyId: active } })
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      setUserError('Unable to load users for this company right now. Please refresh and try again.')
    } finally {
      setUserLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [active, role])

  const upsertUser = (payload) => {
    setUsers((prev) => {
      const idx = prev.findIndex((u) => u.email === payload.user.email)
      const next = {
        id: payload.user.id,
        name: payload.user.name,
        email: payload.user.email,
        role: payload.role,
        companyId: payload.companyId,
        status: payload.status || 'Active'
      }
      if (idx >= 0) {
        const clone = [...prev]
        clone[idx] = next
        return clone
      }
      return [next, ...prev]
    })
  }

  const handleInvite = async () => {
    if (!active) return
    setUserError('')
    setStatusMsg('')
    try {
      const { data } = await api.post('/users/invite', { ...inviteForm, companyId: active })
      upsertUser({ ...data, status: 'Active' })
      setInviteForm({ name: '', email: '', role: 'manager', password: '' })
      setStatusMsg(data.tempPassword ? `User invited. Temp password: ${data.tempPassword}` : 'User invited')
    } catch (err) {
      setUserError(err.response?.data?.message || 'Failed to invite user')
    }
  }

  const handleAssign = async () => {
    if (!active) return
    setUserError('')
    setStatusMsg('')
    try {
      const { data } = await api.post('/users/assign-role', { ...assignForm, companyId: active })
      upsertUser({ ...data, status: 'Active' })
      setAssignForm({ email: '', role: 'viewer' })
      setStatusMsg('Role assigned')
    } catch (err) {
      setUserError(err.response?.data?.message || 'Failed to assign role')
    }
  }

  return (
    <div className="relative isolate overflow-hidden rounded-[32px] border border-slate-200/90 bg-[linear-gradient(130deg,#eef4ff_0%,#ffffff_48%,#edf7f4_100%)] p-4 text-slate-800 shadow-[0_24px_70px_rgba(15,23,42,0.08)] dark:border-slate-700/60 dark:bg-[linear-gradient(135deg,#020617_0%,#0f172a_46%,#052e2b_100%)] dark:text-slate-100 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_8%,rgba(56,189,248,0.16),transparent_34%),radial-gradient(circle_at_88%_14%,rgba(59,130,246,0.13),transparent_32%),radial-gradient(circle_at_22%_90%,rgba(16,185,129,0.14),transparent_35%)]" />

      <div className="relative space-y-6">
        <section className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-[0_24px_80px_rgba(15,23,42,0.25)] dark:border-slate-800/70">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.14),transparent_26%)]" />
            <div className="relative flex flex-col gap-6">
              <div className="max-w-3xl space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.24em] text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Settings</span>
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Operational controls</span>
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Configuration & Governance</h1>
                  <p className="max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
                    Role-aware controls for profile, access, compliance, notifications, and system behavior in one focused workspace.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-200/90">
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">{badge}</span>
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">{activeCompany?.name || 'No company selected'}</span>
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">{ROLE_LABELS[role] || role}</span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <HeroMetric icon="🧩" label="Available categories" value={allowedNav.length} hint="Role-scoped settings" />
                <HeroMetric icon="👥" label="Users in scope" value={roleCounts.total} hint="Visible company members" />
                <HeroMetric icon="🔔" label="Active alerts" value={enabledNotifications} hint="Notification rules on" />
                <HeroMetric icon="💾" label="Save status" value={dirty ? 'Pending' : 'Synced'} hint={dirty ? 'Unsaved changes detected' : 'No pending changes'} />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-600 shadow-[0_10px_30px_rgba(15,23,42,0.05)] dark:border-slate-800/70 dark:bg-slate-900 dark:text-slate-300 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Last saved: {formatDateTime(lastSavedAt)}</span>
            {dirty ? <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">You have unsaved changes</span> : null}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((metric) => (
            <StatCard key={metric.label} metric={metric} />
          ))}
        </section>

        <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] dark:border-slate-700/70 dark:bg-slate-900/95 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 dark:border-slate-800 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Settings categories</div>
              <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">Card-based navigation</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                Choose a settings area to edit. The active section appears below in a focused workspace.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {allowedNav.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`group rounded-[24px] border p-5 text-left shadow-[0_16px_40px_-30px_rgba(15,23,42,0.35)] transition ${activeTab === item.key ? 'border-sky-400 bg-sky-50/80 dark:bg-sky-500/10' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-800/60'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-xl text-white shadow-[0_12px_26px_rgba(15,23,42,0.2)] dark:bg-slate-100 dark:text-slate-950">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{item.label}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.description}</p>
                    </div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${activeTab === item.key ? 'border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-200' : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'}`}>
                    {activeTab === item.key ? '✓ Configure (Active)' : 'Configure'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-[color:var(--panel-border)] bg-[var(--panel-bg)] p-5 text-[color:var(--text-primary)] shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:p-6">
          <div className="flex flex-col gap-4 border-b border-[color:var(--panel-border)] pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--text-secondary)]">Active section</div>
              <h2 className="mt-1 text-2xl font-semibold text-[color:var(--text-primary)]">ACTIVE: {selectedTabMeta?.label}</h2>
              <p className="mt-1 max-w-2xl text-sm text-[color:var(--text-secondary)]">{selectedTabMeta?.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-300"
                onClick={handleSave}
                disabled={!dirty}
                type="button"
              >
                Save changes
              </button>
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={handleReset}
                type="button"
              >
                Reset to defaults
              </button>
            </div>
          </div>

          {((activeTab === 'users' && userError) || statusMsg) && (
            <div className="mt-5 flex flex-wrap gap-3">
              {activeTab === 'users' && userError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                  {userError}
                </div>
              ) : null}
              {statusMsg ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                  {statusMsg}
                </div>
              ) : null}
            </div>
          )}

          <div className="mt-6">
            {activeTab === 'profile' && <ProfilePanel profile={profile} onChange={updateProfile} onSave={handleSave} />}
            {activeTab === 'users' && !isViewer && (
              <UserManagementPanel
                users={users}
                loading={userLoading}
                error={userError}
                inviteForm={inviteForm}
                setInviteForm={setInviteForm}
                assignForm={assignForm}
                setAssignForm={setAssignForm}
                onInvite={handleInvite}
                onAssign={handleAssign}
              />
            )}
            {activeTab === 'company' && !isViewer && <CompanyPreferencesPanel companyPrefs={companyPrefs} onChange={updateCompanyPrefs} />}
            {activeTab === 'approvals' && !isViewer && <ApprovalWorkflowPanel approvalRules={approvalRules} onChange={updateApprovalRules} />}
            {activeTab === 'notifications' && !isViewer && <NotificationPanel notifications={notifications} onChange={updateNotifications} />}
            {activeTab === 'security' && role === 'admin' && <SecurityPanel security={security} onChange={updateSecurity} />}
            {activeTab === 'backup' && role === 'admin' && <BackupPanel backup={backup} onChange={updateBackup} />}
            {activeTab === 'system' && <SystemPanel system={system} onChange={updateSystem} />}
            {activeTab === 'audit' && role === 'admin' && <AuditPanel />}
          </div>
        </section>

      </div>
    </div>
  )
}

const HeroMetric = ({ icon, label, value, hint }) => (
  <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 shadow-[0_12px_26px_-20px_rgba(2,6,23,0.55)] backdrop-blur">
    <div className="flex items-center justify-between gap-2">
      <span className="text-lg" aria-hidden>{icon}</span>
      <span className="text-[11px] uppercase tracking-[0.16em] text-slate-300">{label}</span>
    </div>
    <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    <div className="mt-1 text-xs text-slate-200/90">{hint}</div>
  </div>
)

const ProfilePanel = ({ profile, onChange, onSave }) => (
  <div className="space-y-6">
    <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--text-secondary)]">Profile settings</div>
        <h3 className="mt-1 text-xl font-semibold text-[color:var(--text-primary)]">Personal and account details</h3>
      </div>
      <button
        type="button"
        onClick={onSave}
        className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-300"
      >
        Update Profile
      </button>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <PanelCard title="Personal Information" description="Editable identity and contact details.">
        <div className="grid gap-4 md:grid-cols-2">
          <LabeledInput label="Full name" value={profile.name} onChange={(v) => onChange({ name: v })} />
          <LabeledInput label="Job title" value={profile.jobTitle} onChange={(v) => onChange({ jobTitle: v })} />
          <LabeledInput label="Phone number" value={profile.phone} onChange={(v) => onChange({ phone: v })} />
          <LabeledSelect
            label="Timezone"
            value={profile.timezone}
            onChange={(v) => onChange({ timezone: v })}
            options={[
              ['Africa/Addis_Ababa', 'Africa/Addis_Ababa'],
              ['UTC', 'UTC'],
              ['Europe/London', 'Europe/London']
            ]}
          />
        </div>
      </PanelCard>

      <PanelCard title="Account Information" description="Login and recovery settings.">
        <div className="grid gap-4 md:grid-cols-2">
          <LabeledInput label="Email address" value={profile.email} readOnly onChange={(v) => onChange({ email: v })} />
          <LabeledInput label="Display name" value={profile.name} onChange={(v) => onChange({ name: v })} />
        </div>
        <div className="mt-4 rounded-2xl border border-[color:var(--panel-border)] bg-[var(--bg-hover)] p-4 text-sm text-[color:var(--text-secondary)]">
          Password changes are applied immediately. Use a strong password that matches your security policy.
        </div>
      </PanelCard>
    </div>

    <PanelCard title="Security" description="Protect the account with a new password when needed.">
      <div className="grid gap-4 md:grid-cols-2">
        <LabeledInput label="New password" type="password" value={profile.newPassword} onChange={(v) => onChange({ newPassword: v })} />
        <LabeledInput label="Confirm new password" type="password" value={profile.confirmPassword} onChange={(v) => onChange({ confirmPassword: v })} />
      </div>
      <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--panel-border)] bg-[var(--bg-hover)] px-4 py-3 text-sm text-[color:var(--text-secondary)]">
        Minimum 8 characters, 1 number, 1 uppercase letter, and 1 symbol.
      </div>
    </PanelCard>
  </div>
)

const UserManagementPanel = ({ users, loading, error, inviteForm, setInviteForm, assignForm, setAssignForm, onInvite, onAssign }) => {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
        <PanelCard title="Existing Users" description="Review current company access and statuses.">
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {users.map((user) => (
                  <tr key={user.email} className="bg-white dark:bg-slate-900">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{user.name}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{user.email}</td>
                    <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">{user.role}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        {user.status || 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
                {!loading && users.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400" colSpan={4}>
                      No users yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {loading ? <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading users...</div> : null}
          {error ? <div className="mt-4 text-sm text-rose-600 dark:text-rose-300">{error}</div> : null}
        </PanelCard>

        <div className="space-y-4">
          <PanelCard title="Invite User" description="Create a new company account." accent>
            <div className="grid gap-4">
              <LabeledInput label="Name" value={inviteForm.name} onChange={(v) => setInviteForm((current) => ({ ...current, name: v }))} />
              <LabeledInput label="Email" value={inviteForm.email} onChange={(v) => setInviteForm((current) => ({ ...current, email: v }))} />
              <LabeledSelect
                label="Role"
                value={inviteForm.role}
                onChange={(v) => setInviteForm((current) => ({ ...current, role: v }))}
                options={[
                  ['admin', 'Admin'],
                  ['manager', 'Manager'],
                  ['viewer', 'Viewer']
                ]}
              />
              <LabeledInput label="Temp password" type="password" value={inviteForm.password} onChange={(v) => setInviteForm((current) => ({ ...current, password: v }))} />
              <button type="button" onClick={onInvite} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-sky-400 dark:text-slate-950">
                Invite user
              </button>
            </div>
          </PanelCard>

          <PanelCard title="Assign Role" description="Update an existing user quickly.">
            <div className="grid gap-4">
              <LabeledInput label="Email" value={assignForm.email} onChange={(v) => setAssignForm((current) => ({ ...current, email: v }))} />
              <LabeledSelect
                label="Role"
                value={assignForm.role}
                onChange={(v) => setAssignForm((current) => ({ ...current, role: v }))}
                options={[
                  ['admin', 'Admin'],
                  ['manager', 'Manager'],
                  ['viewer', 'Viewer']
                ]}
              />
              <button type="button" onClick={onAssign} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                Assign role
              </button>
            </div>
          </PanelCard>
        </div>
      </div>
    </div>
  )
}

const CompanyPreferencesPanel = ({ companyPrefs, onChange }) => (
  <PanelCard title="Company Preferences" description="Company identity and operational accounting defaults.">
    <div className="grid gap-4 md:grid-cols-2">
      <LabeledInput label="Legal name" value={companyPrefs.legalName} onChange={(v) => onChange({ legalName: v })} />
      <LabeledInput label="Short name" value={companyPrefs.shortName} onChange={(v) => onChange({ shortName: v })} />
      <LabeledSelect
        label="Reporting basis"
        value={companyPrefs.reportingBasis}
        onChange={(v) => onChange({ reportingBasis: v })}
        options={[
          ['cash', 'Cash'],
          ['accrual', 'Accrual']
        ]}
      />
      <LabeledSelect
        label="Fiscal year start"
        value={companyPrefs.fiscalYearStart}
        onChange={(v) => onChange({ fiscalYearStart: v })}
        options={[
          ['01', 'January'],
          ['04', 'April'],
          ['07', 'July'],
          ['09', 'September']
        ]}
      />
      <LabeledInput label="Month-end lock day" type="number" value={companyPrefs.lockDay} onChange={(v) => onChange({ lockDay: Number(v) })} />
    </div>
    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
      Saving this section updates company identity and reporting controls for the selected company context.
    </div>
  </PanelCard>
)

const ApprovalWorkflowPanel = ({ approvalRules, onChange }) => (
  <PanelCard title="Approval Workflow" description="Define the threshold rules that govern approvals.">
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="space-y-4">
        <LabeledInput label="Approval threshold (ETB)" type="number" value={approvalRules.threshold} onChange={(v) => onChange({ threshold: Number(v) })} />
        <LabeledInput label="Secondary threshold (ETB)" type="number" value={approvalRules.twoStepThreshold} onChange={(v) => onChange({ twoStepThreshold: Number(v) })} />
        <div className="grid gap-3 md:grid-cols-2">
          <Toggle label="Auto-approve below threshold" checked={approvalRules.autoApprove} onChange={(v) => onChange({ autoApprove: v })} />
          <Toggle label="Require two approvals" checked={approvalRules.twoStep} onChange={(v) => onChange({ twoStep: v })} />
        </div>
      </div>
      <div className="rounded-[24px] border border-[color:var(--panel-border)] bg-[var(--bg-hover)] p-5">
        <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--text-secondary)]">Approval chain preview</div>
        <div className="mt-4 rounded-2xl border border-[color:var(--panel-border)] bg-[var(--bg-card)] px-4 py-4 text-sm text-[color:var(--text-primary)]">
          Level 1: Manager → Level 2: Admin → Level 3: Finance Director
        </div>
        <button type="button" className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-sky-400 dark:text-slate-950">
          Save approval rules
        </button>
      </div>
    </div>
  </PanelCard>
)

const NotificationPanel = ({ notifications, onChange }) => (
  <PanelCard title="Notification Settings" description="Shape how the platform reaches users.">
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-3">
        <SectionLabel>Notification channels</SectionLabel>
        <div className="grid gap-3">
          <Toggle label="Approval requests" checked={notifications.approvals} onChange={(v) => onChange({ approvals: v })} />
          <Toggle label="Approval decisions" checked={notifications.system} onChange={(v) => onChange({ system: v })} />
          <Toggle label="Transaction confirmations" checked={notifications.email} onChange={(v) => onChange({ email: v })} />
          <Toggle label="Investment maturity alerts" checked={notifications.maturity} onChange={(v) => onChange({ maturity: v })} />
        </div>
      </div>
      <div className="space-y-3">
        <SectionLabel>Delivery preferences</SectionLabel>
        <div className="grid gap-3">
          <Toggle label="Daily summary" checked={notifications.dailyDigest} onChange={(v) => onChange({ dailyDigest: v })} />
          <Toggle label="Weekly portfolio report" checked={notifications.push} onChange={(v) => onChange({ push: v })} />
          <Toggle label="SMS fallback" checked={notifications.sms} onChange={(v) => onChange({ sms: v })} />
          <LabeledInput label="Days before maturity" type="number" value={notifications.daysBeforeMaturity} onChange={(v) => onChange({ daysBeforeMaturity: Number(v) })} />
        </div>
      </div>
    </div>

    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
        Send test email
      </button>
      <button type="button" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
        Send test push
      </button>
      <span className="text-xs text-[color:var(--text-secondary)]">Use tests to confirm deliverability before rollout.</span>
    </div>
  </PanelCard>
)

const SecurityPanel = ({ security, onChange }) => (
  <PanelCard title="Security Settings" description="Password policy and session controls.">
    <div className="grid gap-4 md:grid-cols-2">
      <LabeledInput label="Minimum password length" type="number" value={security.minLength} onChange={(v) => onChange({ minLength: Number(v) })} />
      <LabeledInput label="Session timeout (minutes)" type="number" value={security.sessionTimeout} onChange={(v) => onChange({ sessionTimeout: Number(v) })} />
      <LabeledInput label="Max login attempts" type="number" value={security.maxAttempts} onChange={(v) => onChange({ maxAttempts: Number(v) })} />
      <Toggle label="Send login alerts" checked={security.loginAlerts} onChange={(v) => onChange({ loginAlerts: v })} />
      <Toggle label="Trust this device for 30 days" checked={security.deviceTrust} onChange={(v) => onChange({ deviceTrust: v })} />
    </div>
  </PanelCard>
)

const BackupPanel = ({ backup, onChange }) => (
  <PanelCard title="Backup & Data Management" description="Schedule exports and keep restore points fresh.">
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="space-y-3">
        <SectionLabel>Backup schedule</SectionLabel>
        <div className="grid gap-3">
          {['manual', 'daily', 'weekly', 'monthly'].map((option) => (
            <label key={option} className="flex items-center justify-between rounded-2xl border border-[color:var(--panel-border)] bg-[var(--bg-hover)] px-4 py-3 text-sm text-[color:var(--text-primary)]">
              <span className="capitalize">{option}</span>
              <input type="radio" name="backup" value={option} checked={backup.schedule === option} onChange={(event) => onChange({ schedule: event.target.value })} />
            </label>
          ))}
          <Toggle label="Encrypt backups" checked={backup.encrypt} onChange={(v) => onChange({ encrypt: v })} />
          <Toggle label="Auto-export" checked={backup.autoExport} onChange={(v) => onChange({ autoExport: v })} />
        </div>
      </div>
      <div className="space-y-3">
        <SectionLabel>Retention and export</SectionLabel>
        <div className="grid gap-4 md:grid-cols-2">
          <LabeledInput label="Retention (days)" type="number" value={backup.retainDays} onChange={(v) => onChange({ retainDays: Number(v) })} />
          <LabeledSelect label="Export format" value={backup.exportFormat} onChange={(v) => onChange({ exportFormat: v })} options={[[ 'csv', 'CSV' ], [ 'pdf', 'PDF' ], [ 'xlsx', 'Excel' ]]} />
        </div>
        <div className="rounded-2xl border border-dashed border-[color:var(--panel-border)] bg-[var(--bg-hover)] p-4 text-sm text-[color:var(--text-secondary)]">
          Backups are currently simulated locally. Connect your storage provider before enabling auto-export in production.
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-sky-400 dark:text-slate-950">
            Download backup
          </button>
          <button type="button" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            Export Excel
          </button>
        </div>
      </div>
    </div>
  </PanelCard>
)

const SystemPanel = ({ system, onChange }) => (
  <PanelCard title="System Preferences" description="Operational defaults that are currently applied in Approvals and Reports.">
    <div className="space-y-5">
      <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[var(--bg-hover)] p-4">
        <SectionLabel>Reports defaults</SectionLabel>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <LabeledSelect
            label="Reports default period"
            value={system.reportsDefaultPeriod}
            onChange={(v) => onChange({ reportsDefaultPeriod: v })}
            options={[[ 'current', 'Current Month' ], [ 'last', 'Last Month' ], [ 'quarter', 'Quarter to Date' ], [ 'year', 'Year to Date' ]]}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[var(--bg-hover)] p-4">
        <SectionLabel>Approvals defaults</SectionLabel>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <LabeledSelect
            label="Default approvals tab"
            value={system.approvalsDefaultTab}
            onChange={(v) => onChange({ approvalsDefaultTab: v })}
            options={[[ 'pending', 'Pending' ], [ 'history', 'History' ]]}
          />
          <LabeledSelect
            label="Default approvals date range"
            value={system.approvalsDefaultRange}
            onChange={(v) => onChange({ approvalsDefaultRange: v })}
            options={[[ 'last30', 'Last 30 days' ], [ 'last90', 'Last 90 days' ], [ 'ytd', 'Year to date' ], [ 'all', 'All time' ]]}
          />
          <LabeledSelect
            label="Approvals cards per page"
            value={String(system.approvalsPageSize)}
            onChange={(v) => onChange({ approvalsPageSize: Number(v) })}
            options={[[ '4', '4 cards' ], [ '6', '6 cards' ], [ '8', '8 cards' ], [ '10', '10 cards' ]]}
          />
        </div>
      </div>
    </div>
  </PanelCard>
)

const AuditPanel = () => (
  <PanelCard title="Audit Settings" description="Retain evidence and keep an inspection-ready trail.">
    <div className="grid gap-4 md:grid-cols-2">
      <LabeledSelect label="Log retention" value="12" onChange={() => {}} options={[[ '6', '6 months' ], [ '12', '1 year' ], [ '24', '2 years' ]]} />
      <LabeledSelect label="Activity tracking" value="full" onChange={() => {}} options={[[ 'minimal', 'Minimal' ], [ 'standard', 'Standard' ], [ 'full', 'Full' ]]} />
    </div>
    <div className="mt-4 rounded-2xl border border-[color:var(--panel-border)] bg-[var(--bg-hover)] p-4 text-sm text-[color:var(--text-secondary)]">
      Export logs for investigations and keep audit evidence for compliance.
    </div>
  </PanelCard>
)

const PanelCard = ({ title, description, children, accent = false }) => (
  <div className={`rounded-[24px] border p-5 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.45)] ${accent ? 'border-sky-300/60 bg-sky-50/70 dark:bg-sky-500/20' : 'border-[color:var(--panel-border)] bg-[var(--bg-card)]'}`}>
    <div className="mb-5 flex flex-col gap-1">
      <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">{title}</h3>
      {description ? <p className="text-sm text-[color:var(--text-secondary)]">{description}</p> : null}
    </div>
    {children}
  </div>
)

const SectionLabel = ({ children }) => (
  <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--text-secondary)]">{children}</div>
)

const LabeledInput = ({ label, value, onChange, type = 'text', readOnly = false }) => (
  <label className="flex flex-col gap-2 text-sm text-[color:var(--text-primary)]">
    <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">{label}</span>
    <input
      type={type}
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange && onChange(event.target.value)}
      className="w-full rounded-2xl border border-[color:var(--panel-border)] bg-[var(--bg-card)] px-4 py-3 text-sm font-medium text-[color:var(--text-primary)] outline-none transition placeholder:text-[color:var(--text-muted)] focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
    />
  </label>
)

const LabeledSelect = ({ label, value, onChange, options }) => (
  <label className="flex flex-col gap-2 text-sm text-[color:var(--text-primary)]">
    <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange && onChange(event.target.value)}
      className="w-full appearance-none rounded-2xl border border-[color:var(--panel-border)] bg-[var(--bg-card)] px-4 py-3 text-sm font-medium text-[color:var(--text-primary)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
    >
      {options.map(([valueKey, labelText]) => (
        <option key={valueKey} value={valueKey}>
          {labelText}
        </option>
      ))}
    </select>
  </label>
)

const Toggle = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--panel-border)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[color:var(--text-primary)]">
    <span>{label}</span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
  </label>
)

const StatCard = ({ metric }) => (
  <div className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_50px_-35px_rgba(0,0,0,0.65)] dark:border-slate-800 dark:bg-slate-900">
    <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 via-transparent to-transparent opacity-80" />
    <div className="relative flex items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-xl text-white dark:bg-slate-100 dark:text-slate-950">{metric.icon}</div>
        <div className="mt-3 text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{metric.label}</div>
        <div className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{metric.value}</div>
        <p className="min-h-[40px] text-sm text-slate-500 dark:text-slate-400">{metric.hint}</p>
      </div>
    </div>
  </div>
)

const StatPill = ({ label, value, icon }) => (
  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
    <span aria-hidden className="text-lg">{icon}</span>
    <div className="min-w-0 flex-1">
      <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</div>
      <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{value}</div>
    </div>
  </div>
)

export default SettingsPage
