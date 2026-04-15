const pillars = [
  { icon: '🎯', title: 'Purpose', text: 'Give investment teams a clean way to manage portfolios, approvals, and reporting in one place.' },
  { icon: '🧭', title: 'Workflow', text: 'Reduce friction with role-based views that guide users to the next right action.' },
  { icon: '🔍', title: 'Visibility', text: 'Surface the metrics and audit trail needed to keep financial decisions traceable.' }
]

const values = [
  { icon: '🛡️', title: 'Trust', text: 'Clear approvals, secure access, and audit-friendly actions.' },
  { icon: '⚙️', title: 'Operational clarity', text: 'A UI that helps users understand what to do without guessing.' },
  { icon: '📈', title: 'Decision support', text: 'Reports and summaries that help teams act quickly.' }
]

const AboutPage = () => (
  <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
    <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 12% 10%, rgba(16,185,129,0.16), transparent 30%), radial-gradient(circle at 86% 14%, rgba(59,130,246,0.16), transparent 34%), linear-gradient(180deg, rgba(15,23,42,0.94), rgba(2,6,23,1))' }} />
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12 lg:py-16 space-y-8 sm:space-y-10">
      <header className="grid lg:grid-cols-[1.15fr,0.85fr] gap-6 items-stretch">
        <div className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 backdrop-blur p-7 lg:p-10 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">About Ethio Vest</p>
          <h1 className="text-[clamp(2.5rem,5vw,4.3rem)] leading-[1.02] font-extrabold">Ethio Vest</h1>
          <p className="text-slate-300 max-w-3xl leading-[1.75] text-base lg:text-lg">
            Ethio Vest helps investors and financial managers track portfolios, manage investments, and generate financial insights across multiple companies.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {pillars.map((item) => (
            <div key={item.title} className="rounded-[22px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)] hover:border-emerald-400/30 transition">
              <div className="text-2xl mb-3">{item.icon}</div>
              <div className="text-lg font-semibold mb-2">{item.title}</div>
              <div className="text-sm text-slate-300 leading-[1.65]">{item.text}</div>
            </div>
          ))}
        </div>
      </header>

      <section className="grid lg:grid-cols-[0.9fr,1.1fr] gap-6">
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-7 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-emerald-300 mb-3">System Purpose</p>
          <h2 className="text-2xl lg:text-3xl font-semibold mb-5">Built for clarity, control, and confidence</h2>
          <ul className="space-y-3 text-slate-200 leading-[1.65]">
            <li className="flex gap-3"><span className="text-emerald-400">•</span><span>Simplify investment management with a focused interface</span></li>
            <li className="flex gap-3"><span className="text-emerald-400">•</span><span>Provide financial transparency through approvals and audit logs</span></li>
            <li className="flex gap-3"><span className="text-emerald-400">•</span><span>Support multi-company portfolios without clutter</span></li>
          </ul>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-emerald-500/15 via-cyan-500/10 to-white/5 p-7 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
          <p className="text-sm uppercase tracking-[0.25em] text-emerald-200 mb-3">Design principles</p>
          <div className="grid sm:grid-cols-3 gap-4">
            {values.map((item) => (
              <div key={item.title} className="rounded-[20px] border border-white/10 bg-slate-950/40 p-4">
                <div className="text-2xl mb-2">{item.icon}</div>
                <div className="font-semibold mb-2">{item.title}</div>
                <div className="text-sm text-slate-300 leading-[1.6]">{item.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/5 p-7 lg:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
        <div className="space-y-2 max-w-2xl">
          <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">Get started</p>
          <h2 className="text-2xl lg:text-3xl font-semibold">Use Ethio Vest as a real operating layer for your investment workflow.</h2>
          <p className="text-slate-300 leading-[1.7]">The interface is designed to feel operational, not promotional, so your team can move from overview to action quickly.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <a href="/register" className="px-5 py-3 rounded-[14px] bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/25 hover:scale-[1.02] transition">Create Account</a>
          <a href="/login" className="px-5 py-3 rounded-[14px] border border-white/20 bg-white/5 hover:bg-white/10 transition font-semibold">Login</a>
        </div>
      </section>
    </div>
  </div>
)

export default AboutPage
