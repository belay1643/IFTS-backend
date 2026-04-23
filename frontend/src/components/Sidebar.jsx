import { NavLink } from 'react-router-dom'
import { useSelector } from 'react-redux'

const MAIN_LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['admin', 'manager', 'viewer'] },
  { to: '/companies', label: 'Companies', icon: '🏢', roles: ['admin', 'manager', 'viewer'] },
  { to: '/investments', label: 'Investments', icon: '💰', roles: ['admin', 'manager', 'viewer'] },
  { to: '/transactions', label: 'Transactions', icon: '🔁', roles: ['admin', 'manager', 'viewer'] },
  { to: '/approvals', label: 'Approvals', icon: '✅', roles: ['admin', 'manager'] },
  { to: '/notifications', label: 'Notifications', icon: '🔔', roles: ['admin', 'manager', 'viewer'] },
  { to: '/reports', label: 'Reports', icon: '📑', roles: ['admin', 'manager', 'viewer'] },
]

const ADMIN_LINKS = [
  { to: '/managers', label: 'Managers', icon: '🧑‍💼', roles: ['admin', 'manager'] },
  { to: '/audit', label: 'Audit Logs', icon: '🧾', roles: ['admin'] },
  { to: '/settings', label: 'Settings', icon: '⚙️', roles: ['admin', 'manager'] },
]

const NavItem = ({ link, isLight, isAdmin }) => (
  <NavLink
    to={link.to}
    className={({ isActive }) =>
      `group px-3.5 py-2.5 rounded-xl text-sm flex items-center justify-between border transition-all duration-150 hover:-translate-y-0.5 ${
        isActive
          ? isAdmin
            ? isLight
              ? 'bg-violet-50 text-violet-700 border-violet-200 shadow-[0_10px_24px_-14px_rgba(124,58,237,0.35)]'
              : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-transparent shadow-[0_14px_32px_-16px_rgba(124,58,237,0.65)]'
            : isLight
              ? 'bg-[var(--bg-active)] text-[color:var(--color-primary-700)] border-[color:var(--panel-border)] shadow-[0_12px_26px_-16px_rgba(79,70,229,0.45)]'
              : 'bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white border-transparent shadow-[0_16px_36px_-18px_rgba(79,70,229,0.75)]'
          : isAdmin
            ? `text-[color:var(--text-muted)] border-[color:var(--panel-border)]/20 hover:border-violet-300/40 hover:text-[color:var(--text-primary)] ${isLight ? 'hover:bg-violet-50/70' : 'hover:bg-violet-500/8'}`
            : 'text-[color:var(--text-muted)] border-[color:var(--panel-border)]/20 hover:border-[color:var(--panel-border)] hover:bg-[rgba(99,102,241,0.07)] hover:text-[color:var(--text-primary)]'
      }`
    }
  >
    <span className="flex items-center gap-3">
      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-[15px] transition-colors ${
        isAdmin
          ? isLight ? 'bg-violet-50 border-violet-100/80' : 'bg-violet-500/10 border-violet-500/20'
          : 'bg-[color:var(--bg-card)]/70 border-[color:var(--panel-border)]/50'
      }`}>
        {link.icon}
      </span>
      <span className="font-medium leading-none">{link.label}</span>
    </span>
    <span className="text-[10px] opacity-40 group-hover:opacity-80 transition-opacity">›</span>
  </NavLink>
)

const Sidebar = () => {
  const { list, active } = useSelector((s) => s.company)
  const { theme } = useSelector((s) => s.ui)
  const activeRole = list.find((c) => c.id === active)?.role || 'viewer'
  const isLight = theme === 'light'

  const mainLinks = MAIN_LINKS.filter((l) => l.roles.includes(activeRole))
  const adminLinks = ADMIN_LINKS.filter((l) => l.roles.includes(activeRole))

  return (
    <aside className="w-[260px] flex-shrink-0 sidebar-glass rounded-3xl p-5 flex flex-col gap-3 text-[color:var(--text-primary)] border border-[color:var(--panel-border)]/60 shadow-[0_18px_60px_-40px_rgba(0,0,0,0.55)]">

      {/* Brand */}
      <div className="px-1 space-y-1 pb-1">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/15 border border-emerald-400/25 flex items-center justify-center text-[13px] font-extrabold text-[color:var(--text-primary)]">
            EV
          </div>
          <div>
            <div className="text-[13px] font-bold tracking-tight text-[color:var(--text-primary)]">Ethio Vest</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Navigation</div>
          </div>
        </div>
        <div className="highlight-bar mt-2" />
      </div>

      {/* Main links */}
      <nav className="flex flex-col gap-1">
        {mainLinks.map((link) => (
          <NavItem key={link.to} link={link} isLight={isLight} isAdmin={false} />
        ))}
      </nav>

      {/* Admin section */}
      {adminLinks.length > 0 && (
        <div className="space-y-0.5">
          <div className="h-px bg-[color:var(--panel-border)]/60 mx-1 my-0.5" />
          <nav className="flex flex-col gap-1">
            {adminLinks.map((link) => (
              <NavItem key={link.to} link={link} isLight={isLight} isAdmin />
            ))}
          </nav>
        </div>
      )}

    </aside>
  )
}

export default Sidebar
