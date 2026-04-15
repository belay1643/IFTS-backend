import { NavLink } from 'react-router-dom'
import { useSelector } from 'react-redux'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['admin', 'manager', 'viewer'] },
  { to: '/companies', label: 'Companies', icon: '🏢', roles: ['admin', 'manager', 'viewer'] },
  { to: '/investments', label: 'Investments', icon: '💰', roles: ['admin', 'manager', 'viewer'] },
  { to: '/transactions', label: 'Transactions', icon: '🔁', roles: ['admin', 'manager', 'viewer'] },
  { to: '/approvals', label: 'Approvals', icon: '✅', roles: ['admin', 'manager'] },
  { to: '/notifications', label: 'Notifications', icon: '🔔', roles: ['admin', 'manager', 'viewer'] },
  { to: '/reports', label: 'Reports', icon: '📑', roles: ['admin', 'manager', 'viewer'] },
  { to: '/audit', label: 'Audit Logs', icon: '🧾', roles: ['admin'] },
  { to: '/settings', label: 'Settings', icon: '⚙', roles: ['admin'] }
]

const Sidebar = () => {
  const { list, active } = useSelector((s) => s.company)
  const { theme } = useSelector((s) => s.ui)
  const activeRole = list.find((c) => c.id === active)?.role || 'viewer'
  const allowedLinks = links.filter((l) => l.roles.includes(activeRole))
  const isLight = theme === 'light'

  return (
    <aside className="w-[260px] flex-shrink-0 sidebar-glass rounded-3xl p-5 flex flex-col gap-5 text-[color:var(--text-primary)] border border-[color:var(--panel-border)]/60 shadow-[0_18px_60px_-40px_rgba(0,0,0,0.55)]">
      <div className="px-2 space-y-1">
        <div className="text-sm font-semibold tracking-[0.18em] text-[color:var(--text-primary)]">Ethio Vest</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Navigation</div>
        <div className="highlight-bar mt-1" />
      </div>
      <nav className="flex flex-col gap-2.5">
        {allowedLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `group px-3.5 py-3 rounded-xl text-sm flex items-center justify-between border transition-all hover:-translate-y-0.5 ${
                isActive
                  ? isLight
                    ? 'bg-[var(--bg-active)] text-[color:var(--color-primary-700)] border-[color:var(--panel-border)] shadow-[0_12px_26px_-16px_rgba(79,70,229,0.45)]'
                    : 'bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white border-transparent shadow-[0_16px_36px_-18px_rgba(79,70,229,0.75)]'
                  : 'text-[color:var(--text-muted)] border-[color:var(--panel-border)]/30 hover:border-[color:var(--panel-border)] hover:bg-[rgba(99,102,241,0.08)] hover:text-[color:var(--text-primary)]'
              }`
            }
          >
            <span className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--bg-card)]/70 border border-[color:var(--panel-border)]/60 text-base">
                {link.icon}
              </span>
              <span className="font-medium">{link.label}</span>
            </span>
            <span className="text-[10px] opacity-60 group-hover:opacity-90">→</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
