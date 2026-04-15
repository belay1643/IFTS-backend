const sections = [
  {
    icon: '📊',
    title: 'Investment Management',
    bullets: ['Add investments', 'Track interest', 'Track dividends']
  },
  {
    icon: '🏢',
    title: 'Company Management',
    bullets: ['Multi-company portfolio tracking', 'Company switching', 'Role-aware access']
  },
  {
    icon: '📈',
    title: 'Financial Reports',
    bullets: ['Profit and loss reports', 'Portfolio analytics', 'Export to PDF/Excel']
  },
  {
    icon: '🔔',
    title: 'Notifications',
    bullets: ['Approval reminders', 'Maturity alerts', 'System updates']
  },
  {
    icon: '🛡️',
    title: 'Security',
    bullets: ['JWT authentication', 'Role-based access', 'Audit logs']
  },
  {
    icon: '⚙️',
    title: 'Workflow Controls',
    bullets: ['Approval thresholds', 'Reviewer decisions', 'Status tracking']
  }
]

const highlights = [
  { value: '6', label: 'Core modules' },
  { value: '3', label: 'User roles' },
  { value: '24/7', label: 'Accessible dashboard' }
]

const FeaturesPage = () => (
  <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
    <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 14% 12%, rgba(59,130,246,0.18), transparent 34%), radial-gradient(circle at 84% 18%, rgba(16,185,129,0.14), transparent 36%), linear-gradient(180deg, rgba(15,23,42,0.95), rgba(2,6,23,1))' }} />
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12 lg:py-16 space-y-10 sm:space-y-12">
      <header className="grid lg:grid-cols-[1.2fr,0.8fr] gap-6 items-stretch">
        <div className="space-y-5 rounded-[28px] border border-white/10 bg-white/5 backdrop-blur p-7 lg:p-10 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">Features</p>
          <h1 className="text-[clamp(2.4rem,5vw,4.4rem)] leading-[1.02] font-extrabold">What Ethio Vest delivers</h1>
          <p className="text-slate-300 max-w-3xl leading-[1.7] text-base lg:text-lg">
            Ethio Vest covers the full lifecycle: investing, tracking, approvals, reporting, and security for multi-company portfolios.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="/login" className="px-5 py-3 rounded-[14px] bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/25 hover:scale-[1.02] transition">Launch Dashboard</a>
            <a href="/register" className="px-5 py-3 rounded-[14px] border border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40 transition font-semibold">Create Account</a>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 lg:grid-cols-1 gap-4">
          {highlights.map((item) => (
            <div key={item.label} className="rounded-[22px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
              <div className="text-3xl font-bold text-white">{item.value}</div>
              <div className="text-sm uppercase tracking-[0.18em] text-slate-300 mt-1">{item.label}</div>
            </div>
          ))}
        </div>
      </header>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">Product scope</p>
            <h2 className="text-3xl lg:text-4xl font-semibold">A full platform, not a static brochure</h2>
          </div>
          <a href="/" className="text-sm px-4 py-2 rounded-[14px] border border-white/15 bg-white/5 hover:bg-white/10 transition">Back to home</a>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {sections.map((section) => (
            <div key={section.title} className="group rounded-[22px] border border-white/10 bg-white/5 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.24)] hover:-translate-y-1 hover:border-emerald-400/30 hover:bg-white/[0.07] transition duration-300">
              <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-xl mb-4 shadow-[0_0_18px_rgba(34,197,94,0.28)]">{section.icon}</div>
              <h3 className="text-lg font-semibold mb-3">{section.title}</h3>
              <ul className="space-y-2 text-slate-200 text-sm leading-[1.6]">
                {section.bullets.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-gradient-to-r from-emerald-500/20 via-cyan-500/10 to-white/5 p-7 lg:p-8 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <p className="text-sm uppercase tracking-[0.25em] text-emerald-200">Need the whole flow?</p>
            <h2 className="text-2xl lg:text-3xl font-semibold">See the dashboard, approvals, reports, and notifications working together.</h2>
          </div>
          <a href="/register" className="px-6 py-3 rounded-[14px] bg-white text-slate-950 font-semibold hover:scale-[1.02] transition">Start now</a>
        </div>
      </section>
    </div>
  </div>
)

export default FeaturesPage
