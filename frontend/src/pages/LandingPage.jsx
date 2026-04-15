import { useEffect, useMemo } from 'react'

const heroBg = '/new.jpg'
const dashboardShot = '/Dashboard.png'

const trustPills = ['Investment Firms', 'Finance Teams', 'Portfolio Managers', 'Auditors']
const heroLogos = ['DashFinance', 'BlueRiver Capital', 'EthioGrowth', 'Summit Auditors']

const featureCards = [
  { icon: '📊', title: 'Portfolio Dashboard', desc: 'Real-time company and consolidated KPIs.' },
  { icon: '🧮', title: 'Automated Calculations', desc: 'Interest, dividends, and gains computed instantly.' },
  { icon: '✅', title: 'Approval Workflow', desc: 'Guardrails and audit trails for sensitive actions.' },
  { icon: '📑', title: 'Reports & Export', desc: 'Exportable financial reports with filters.' },
  { icon: '🏢', title: 'Multi-Company Views', desc: 'Switch companies or consolidate portfolios in one place.' },
  { icon: '🔔', title: 'Smart Notifications', desc: 'Approval, maturity, and system alerts that stay actionable.' }
]

const workflowSteps = [
  { title: 'Add Companies', icon: '🏢', desc: 'Register portfolios and set approval thresholds.' },
  { title: 'Record Investments', icon: '🧾', desc: 'Capture contributions, returns, and transaction details.' },
  { title: 'Automatic Calculations', icon: '🧮', desc: 'The system computes interest, dividends, and gains.' },
  { title: 'Manager Approval', icon: '✅', desc: 'Review pending actions with full audit context.' },
  { title: 'Generate Reports', icon: '📊', desc: 'Export performance summaries for decision makers.' }
]

const quickStats = [
  { icon: '⚡', value: '5+', label: 'Workflow stages' },
  { icon: '📈', value: '24/7', label: 'Access and visibility' },
  { icon: '👥', value: '3 roles', label: 'Admin, Manager, Viewer' }
]

const roleCards = [
  {
    title: 'Admin',
    icon: '🛡️',
    color: 'from-purple-500/20',
    points: ['Manage companies & users', 'Configure roles & guards', 'Approve investments', 'View audit logs']
  },
  {
    title: 'Manager',
    icon: '💼',
    color: 'from-sky-500/20',
    points: ['Record investments', 'View dashboards', 'Request approvals', 'Generate reports']
  },
  {
    title: 'Viewer',
    icon: '👁️',
    color: 'from-emerald-500/20',
    points: ['View dashboards', 'Track performance', 'Download reports', 'Stay notified']
  }
]

const securityItems = [
  { icon: '🛡️', title: 'JWT Authentication', desc: 'Secure token-based sessions for every user.' },
  { icon: '🔒', title: 'Role Based Access', desc: 'Fine-grained permissions for admins, managers, viewers.' },
  { icon: '📋', title: 'Audit Logs', desc: 'Immutable trails for approvals and key changes.' },
  { icon: '✅', title: 'Secure Approvals', desc: 'Workflow gating with oversight and notifications.' }
]

const LandingPage = () => {
  useEffect(() => {
    const targets = document.querySelectorAll('.reveal-on-scroll')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible')
        })
      },
      { threshold: 0.16 }
    )

    targets.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  const bgStyle = useMemo(() => ({
    backgroundColor: '#020617',
    backgroundImage: `radial-gradient(circle at 20% 40%, rgba(34,197,94,0.18), transparent 38%),
      radial-gradient(circle at 80% 10%, rgba(59,130,246,0.18), transparent 34%),
      linear-gradient(180deg, #0f172a 0%, #0b1324 100%),
      linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px),
      linear-gradient(0deg, rgba(255,255,255,0.02) 1px, transparent 1px),
      url(${heroBg})`,
    backgroundSize: 'cover, cover, cover, 120px 120px, 120px 120px, cover',
    backgroundPosition: 'center'
  }), [])

  const darkCard = 'bg-slate-900/70 text-white border border-white/10 shadow-[0_18px_40px_rgba(0,0,0,0.35)]'
  const sectionDark = 'relative bg-[linear-gradient(180deg,#0f172a_0%,#0b1324_100%)]'
  const sectionLight = 'relative bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] text-slate-900'

  const floatStyle = { animation: 'float 6s ease-in-out infinite' }

  return (
    <div className="relative min-h-screen text-white scroll-smooth overflow-x-hidden" style={bgStyle}>
      <style>{`
        .reveal-on-scroll {
          opacity: 0;
          transform: translateY(18px);
          transition: opacity 600ms ease, transform 600ms ease;
        }
        .reveal-on-scroll.is-visible {
          opacity: 1;
          transform: translateY(0);
        }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
          100% { transform: translateY(0px); }
        }
      `}</style>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '28px 28px' }} />

      <header className="sticky top-0 z-30 backdrop-blur-[12px] bg-[rgba(10,20,40,0.7)] text-white border-b border-white/10">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-[14px] sm:py-[18px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold text-lg">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#22c55e] to-[#06b6d4] text-slate-900 font-extrabold flex items-center justify-center shadow-[0_0_18px_rgba(34,197,94,0.35)]">EV</span>
            <span className="tracking-tight">Ethio Vest</span>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm">
            <a href="/#features" className="hover:text-emerald-300 transition">Features</a>
            <a href="/#workflow" className="hover:text-emerald-300 transition">How it works</a>
            <a href="/#about" className="hover:text-emerald-300 transition">About</a>
          </nav>
          <div className="hidden md:flex items-center gap-3 text-sm">
            <a href="/login" className="px-4 py-2 rounded-md border border-white/20 bg-transparent hover:border-white/40 transition">Login</a>
            <a href="/register" className="px-4 py-2 rounded-md text-white font-semibold bg-gradient-to-r from-[#22c55e] to-[#06b6d4] shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:scale-[1.03] transition">Register</a>
          </div>
          <div className="md:hidden flex items-center gap-2 text-xs">
            <a href="/login" className="px-3 py-1.5 rounded-md border border-white/20 bg-transparent">Login</a>
            <a href="/register" className="px-3 py-1.5 rounded-md text-white font-semibold bg-gradient-to-r from-[#22c55e] to-[#06b6d4]">Register</a>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="min-h-[90vh] max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-10 sm:pb-14 grid lg:grid-cols-[48%_52%] gap-8 sm:gap-10 items-center">
          <div className="space-y-7 max-w-[600px] reveal-on-scroll">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/5 text-xs tracking-[0.2em] uppercase text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Ethio Vest
            </div>
            <h1 className="text-[clamp(2.7rem,6vw,4.8rem)] leading-[0.98] font-extrabold text-white tracking-tight drop-shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
              Bring <span className="bg-gradient-to-r from-[#22c55e] to-[#38bdf8] bg-clip-text text-transparent">clarity</span> to multi-company investing.
            </h1>
            <p className="text-[1.08rem] lg:text-[1.18rem] text-slate-200 leading-[1.7] max-w-[56ch]">
              Track investments, automate calculations, manage approvals, and generate financial reports across companies with a workflow your team can actually use.
            </p>
            <p className="text-sm lg:text-base text-slate-300 leading-[1.7] max-w-[58ch]">
              Built for finance teams, auditors, and portfolio managers who need visibility without clutter.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <a href="/register" className="px-8 py-4 rounded-[14px] text-white font-semibold bg-gradient-to-r from-[#22c55e] to-[#06b6d4] shadow-[0_14px_35px_rgba(34,197,94,0.28)] hover:-translate-y-0.5 hover:scale-[1.01] transition">Get Started</a>
              <a href="/login" className="px-8 py-4 rounded-[14px] border border-white/20 text-white/90 bg-white/5 hover:bg-white/10 hover:border-white/40 transition font-semibold">View Demo</a>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2 max-w-[520px]">
              {quickStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <div className="text-sm mb-1 text-emerald-200">{stat.icon}</div>
                  <div className="text-xl font-bold text-white">{stat.value}</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">{stat.label}</div>
                </div>
              ))}
            </div>
            <div className="space-y-3 pt-1">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Trusted by teams like</p>
              <div className="flex flex-wrap gap-2">
                {trustPills.map((item) => (
                  <span key={item} className="px-3 py-1.5 rounded-full bg-white/6 border border-white/10 text-xs text-slate-200">{item}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="relative lg:max-w-[680px] lg:ml-auto lg:pl-4 reveal-on-scroll">
            <div className="absolute -inset-8 rounded-[32px] bg-gradient-to-r from-emerald-500/15 via-blue-500/10 to-transparent blur-3xl" />
            <div className="relative rounded-[28px] overflow-hidden border border-white/10 bg-[rgba(15,23,42,0.55)] shadow-[0_50px_110px_rgba(0,0,0,0.22),0_0_70px_rgba(16,185,129,0.2)] animate-float">
              <div className="p-4 border-b border-white/10 flex items-center justify-between text-xs text-slate-300">
                <span>Live portfolio snapshot</span>
                <span className="px-2 py-1 rounded-full bg-emerald-400/15 text-emerald-200 border border-emerald-400/20">Active</span>
              </div>
              <img src={dashboardShot} alt="Dashboard" className="w-full h-full object-cover" />
            </div>
          </div>
        </section>

        <section id="about" className={`${sectionDark} py-[72px] sm:py-[96px] px-4 sm:px-6 lg:px-8`}>
          <div className="max-w-[980px] mx-auto text-center space-y-5 reveal-on-scroll">
            <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">About</p>
            <h2 className="text-3xl lg:text-[40px] font-semibold text-white">Built for investment teams that need structure</h2>
              <p className="text-base lg:text-lg text-slate-200 max-w-[60ch] mx-auto leading-[1.7]">Ethio Vest unifies allocations, approvals, audit trails, and reporting so admins, managers, and viewers stay aligned without switching tools or losing context.</p>
          </div>
        </section>

        <section id="features" className={`${sectionLight} py-[72px] sm:py-[96px] px-4 sm:px-6 lg:px-8`}>
          <div className="max-w-[1320px] mx-auto space-y-10 reveal-on-scroll">
            <div className="max-w-[1200px] mx-auto space-y-3 text-center lg:text-left">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">Features</p>
                <h2 className="text-3xl lg:text-[40px] font-semibold text-slate-950">Everything you need to manage multi-company portfolios</h2>
                <p className="text-slate-600 text-base lg:text-lg leading-[1.65] max-w-[70ch] mx-auto lg:mx-0 mt-2">From operations to reporting, every module is designed to reduce friction and make team decisions faster.</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featureCards.map(card => (
                <div key={card.title} className="card-glass rounded-[18px] p-7 bg-white text-slate-900 hover:border-emerald-400/40 hover:shadow-[0_18px_38px_rgba(16,185,129,0.14)]">
                  <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-[#22c55e] to-[#06b6d4] flex items-center justify-center text-xl mb-4 shadow-[0_0_18px_rgba(34,197,94,0.28)]">{card.icon}</div>
                  <div className="text-lg font-semibold mb-2">{card.title}</div>
                  <div className="text-sm text-slate-600 leading-[1.65]">{card.desc}</div>
                </div>
              ))}
            </div>
            <div className="flex justify-center pt-2">
              <a href="/features" className="px-6 py-3 rounded-[14px] bg-slate-950 text-white font-semibold shadow-[0_14px_32px_rgba(15,23,42,0.12)] hover:scale-[1.02] hover:bg-slate-800 transition">Explore all features</a>
            </div>
          </div>
        </section>

        <section id="workflow" className={`${sectionDark} py-[72px] sm:py-[96px] px-4 sm:px-6 lg:px-8`}>
          <div className="max-w-[1320px] mx-auto space-y-10 reveal-on-scroll">
            <div className="text-center space-y-3 max-w-[760px] mx-auto">
              <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">How It Works</p>
              <h2 className="text-3xl lg:text-[40px] font-semibold text-white">From setup to reporting in five steps</h2>
              <p className="text-slate-300 text-base lg:text-lg leading-[1.7]">A linear flow with clear milestones so users can understand the system without reading a wall of text.</p>
            </div>
            <div className="relative">
              <div className="hidden lg:block absolute top-[34px] left-0 right-0 h-px bg-white/10" />
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-5 relative z-10">
                {workflowSteps.map((step, idx) => (
                  <div key={step.title} className={`rounded-[18px] p-5 text-center ${darkCard} hover:-translate-y-1 transition duration-150 relative`}>
                    <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-[#10b981] text-white text-lg font-semibold flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.5)]">{idx + 1}</div>
                    <div className="text-2xl mb-2">{step.icon}</div>
                    <div className="text-base font-semibold text-white mb-2">{step.title}</div>
                    <div className="text-sm text-slate-200 leading-[1.6]">{step.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="roles" className={`${sectionLight} py-[72px] sm:py-[96px] px-4 sm:px-6 lg:px-8`}>
          <div className="max-w-[1320px] mx-auto space-y-8 reveal-on-scroll">
            <div className="text-center space-y-3 max-w-[760px] mx-auto">
              <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">Role Based Access</p>
              <h2 className="text-3xl lg:text-[40px] font-semibold text-slate-950">Built for role-based financial teams</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {roleCards.map(card => (
                <div key={card.title} className={`rounded-2xl p-6 bg-gradient-to-b ${card.color} to-[#020617] border border-white/10 text-white hover:-translate-y-1.5 hover:border-[#10b981] transition duration-300 shadow-[0_15px_35px_rgba(0,0,0,0.25)]`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-[12px] bg-white/10 flex items-center justify-center text-lg">{card.icon}</div>
                    <div className="text-lg font-semibold text-white">{card.title}</div>
                  </div>
                  <ul className="space-y-2 text-sm text-slate-200">
                    {card.points.map(point => (
                      <li key={point}>• {point}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex justify-center pt-2">
              <a href="/login" className="px-6 py-3 rounded-[14px] border border-white/20 bg-white/5 text-white font-semibold hover:bg-white/10 hover:border-white/40 transition">See role-based workflow</a>
            </div>
          </div>
        </section>

        <section id="security" className={`${sectionDark} py-[72px] sm:py-[96px] px-4 sm:px-6 lg:px-10`}>
          <div className="max-w-7xl mx-auto space-y-8 reveal-on-scroll">
            <div className="text-center space-y-3 max-w-[760px] mx-auto">
              <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">Security</p>
              <h2 className="text-3xl lg:text-[40px] font-semibold text-white">Secure financial infrastructure</h2>
              <div className="flex justify-center gap-2 flex-wrap text-xs text-white/80">
                {['Secure Authentication', 'Audit Logs', 'Role Permissions'].map(badge => (
                  <span key={badge} className="px-3 py-1 rounded-full bg-white/5 border border-white/10">{badge}</span>
                ))}
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {securityItems.map(item => (
                <div key={item.title} className={`rounded-2xl p-6 ${darkCard} hover:-translate-y-1 transition duration-150`}>
                  <div className="text-2xl mb-3 w-[42px] h-[42px] rounded-[10px] bg-[rgba(16,185,129,0.15)] flex items-center justify-center">{item.icon}</div>
                  <div className="text-lg font-semibold mb-1 text-white">{item.title}</div>
                  <div className="text-sm text-slate-200">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="cta" className={`${sectionLight} py-[72px] sm:py-[96px] px-4 sm:px-6 lg:px-10`}>
          <div className="max-w-6xl mx-auto text-center space-y-6 rounded-[28px] p-12 lg:p-16 bg-gradient-to-r from-[#0f172a] via-[#0b1a2f] to-[#064e3b] shadow-[0_0_80px_rgba(34,197,94,0.2)] border border-white/10 reveal-on-scroll">
            <h2 className="text-3xl lg:text-[36px] font-semibold text-white">Ready to manage investments smarter?</h2>
            <p className="text-lg text-white/90">Create an account or log in to explore the dashboard.</p>
            <div className="flex justify-center gap-4 flex-wrap">
              <a href="/register" className="px-8 py-4 rounded-[14px] bg-white text-slate-900 font-semibold shadow-[0_10px_24px_rgba(0,0,0,0.15)] hover:scale-[1.03] transition text-[16px]">Create Account</a>
              <a href="/login" className="px-8 py-4 rounded-[14px] border border-white/30 text-white bg-white/10 hover:bg-white/20 transition text-[16px] font-semibold">Login</a>
            </div>
          </div>
        </section>

      </main>

      <footer className="bg-[#07111f] text-[#cbd5f5] pt-20 pb-[60px] px-6 border-t border-white/10">
        <div className="max-w-7xl mx-auto grid md:grid-cols-5 gap-8 text-sm">
          <div className="space-y-2">
            <div className="text-xl font-semibold text-white">Ethio Vest</div>
            <p>Ethio Vest helps teams manage multi-company investment portfolios across Ethiopia.</p>
            <form className="pt-3 flex gap-2 max-w-md">
              <input aria-label="Email for newsletter" type="email" placeholder="Email for updates" className="flex-1 min-w-0 rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-white placeholder:text-slate-400 outline-none focus:border-emerald-400" />
              <button type="button" className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-semibold hover:brightness-110 transition">Join</button>
            </form>
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-white">Product</div>
            <a href="/#features" className="block hover:text-white">Features</a>
            <a href="/#workflow" className="block hover:text-white">How it works</a>
            <a href="/login" className="block hover:text-white">Login</a>
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-white">Company</div>
            <a href="/#about" className="block hover:text-white">About</a>
            <a href="/register" className="block hover:text-white">Register</a>
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-white">Legal</div>
            <a href="/privacy" className="block hover:text-white">Privacy Policy</a>
            <a href="/terms" className="block hover:text-white">Terms</a>
          </div>
          <div className="space-y-2">
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-white/10 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} Ethio Vest</span>
          <span>Built for finance teams, auditors, and portfolio managers</span>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
