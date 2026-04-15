const PrivacyPage = () => (
  <div className="min-h-screen bg-slate-950 text-white px-4 sm:px-6 py-10 sm:py-16">
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href="/" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10">
          ← Home
        </a>
        <a href="/login" className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/15">
          Sign in
        </a>
      </div>
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">Legal</p>
        <h1 className="text-3xl sm:text-4xl font-bold">Privacy Policy</h1>
        <p className="text-slate-300 leading-7">
          Ethio Vest collects only the data needed to operate account access, portfolio tracking, approvals, and reporting.
        </p>
      </header>
      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/20">
        <h2 className="text-2xl font-semibold">What we store</h2>
        <p className="text-slate-300 leading-7">
          Account details, company access, transaction records, and audit activity are stored to provide the service and maintain compliance.
        </p>
      </section>
      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/20">
        <h2 className="text-2xl font-semibold">How we use it</h2>
        <p className="text-slate-300 leading-7">
          Data is used for authentication, authorization, analytics, approvals, notifications, and report generation.
        </p>
      </section>
    </div>
  </div>
)

export default PrivacyPage
