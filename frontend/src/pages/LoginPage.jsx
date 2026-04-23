import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { login } from '../store/slices/authSlice.js'

const bgImage = "linear-gradient(rgba(10,20,40,0.75), rgba(10,20,40,0.9)), url('https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1600&q=80')"

const IconMail = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16c.55 0 1 .45 1 1v10c0 .55-.45 1-1 1H4a1 1 0 0 1-1-1V7c0-.55.45-1 1-1zm0 0 8 6 8-6" />
  </svg>
)

const IconLock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 10V8a5 5 0 0 1 10 0v2" />
    <rect x="5" y="10" width="14" height="10" rx="2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14v3" />
  </svg>
)

const bodyFont = '"Plus Jakarta Sans", "Inter", "Segoe UI", Tahoma, sans-serif'
const brandFont = '"Fraunces", Georgia, "Times New Roman", serif'

const LoginPage = () => {
  // Ensure custom fonts are loaded (add to index.html or main CSS if not already)
  // Example: <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&family=Fraunces:wght@700&display=swap" rel="stylesheet">
  const dispatch = useDispatch()
  const { status, error } = useSelector((s) => s.auth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)

  const onSubmit = (e) => {
    e.preventDefault()
    dispatch(login({ email, password, remember }))
  }

  return (
    <div
      className="min-h-screen relative flex items-center justify-center px-2 sm:px-4 py-8 bg-[#0a1f3a]"
      style={{
        backgroundImage: bgImage,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#0a1f3a',
        fontFamily: bodyFont
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#0d2544]/80 via-[#0e3564]/60 to-[#0a1f3a]/90 z-0" />
      <div className="absolute inset-0 pointer-events-none z-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

      <div className="relative w-full max-w-lg bg-[rgba(255,255,255,0.10)] backdrop-blur-[22px] border border-[rgba(255,255,255,0.18)] rounded-2xl shadow-2xl px-6 sm:px-10 py-8 sm:py-12 space-y-7 text-white transition-transform duration-200 hover:-translate-y-1 animate-fade-in z-10">
        <div className="flex justify-start">
          <Link to="/" className="flex items-center gap-3 text-white/90 hover:text-white font-semibold group" style={{ fontFamily: bodyFont }}>
            <span className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#22c55e] to-[#06b6d4] border border-white/20 flex items-center justify-center text-xl font-extrabold tracking-tight shadow-[0_0_18px_rgba(34,197,94,0.35)] group-hover:scale-105 transition-transform">EV</span>
            <span className="text-[1.13rem] tracking-[0.01em] font-bold drop-shadow-sm">Ethio Vest</span>
          </Link>
        </div>
        <div className="text-center space-y-2">
          <div className="text-[2.2rem] leading-tight text-white/95 drop-shadow-lg" style={{ fontFamily: brandFont, fontWeight: 700 }}>Ethio Vest</div>
          <p className="text-[1.13rem] text-white/80" style={{ fontFamily: bodyFont }}>Secure login to your dashboard.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5" style={{ fontFamily: bodyFont }} autoComplete="on">
          <label className="block">
            <div className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-xl px-4 py-[13px] text-base transition focus-within:border-[#22c55e] focus-within:shadow-[0_0_0_3px_rgba(34,197,94,0.22)]">
              <IconMail />
              <input
                className="bg-transparent w-full outline-none placeholder-white/65 text-white text-[1.07rem] leading-6 font-medium tracking-wide"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoComplete="email"
                spellCheck={false}
                aria-label="Email"
              />
            </div>
          </label>
          <label className="block">
            <div className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-xl px-4 py-[13px] text-base transition focus-within:border-[#22c55e] focus-within:shadow-[0_0_0_3px_rgba(34,197,94,0.22)]">
              <IconLock />
              <input
                className="bg-transparent w-full outline-none placeholder-white/65 text-white text-[1.07rem] leading-6 font-medium tracking-wide"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                autoComplete="current-password"
                aria-label="Password"
              />
            </div>
          </label>

          <div className="flex items-center justify-between text-[1rem] text-white/80">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-[#22c55e] w-4 h-4 rounded focus:ring-2 focus:ring-[#22c55e]" />
              <span>Remember me</span>
            </label>
            <a href="/forgot" className="font-semibold text-white/85 hover:text-[#22c55e] transition-colors">Forgot Password?</a>
          </div>

          {error && <p className="text-[1.05rem] leading-6 text-rose-200 bg-rose-900/40 border border-rose-500/40 rounded px-3 py-3 animate-shake">{error}</p>}

          <button
            type="submit"
            className="w-full py-[15px] rounded-xl text-[1.13rem] font-bold text-white shadow-[0_12px_30px_rgba(34,197,94,0.35)] bg-gradient-to-r from-[#22c55e] to-[#06b6d4] transition-transform duration-150 hover:-translate-y-1 hover:scale-[1.025] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/60 focus:ring-offset-2 focus:ring-offset-[#0a1f3a] disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={status === 'loading'}
            aria-busy={status === 'loading'}
          >
            {status === 'loading' ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="text-center text-[0.97rem] text-white/70 flex items-center gap-2 justify-center mt-2">
            <span aria-hidden>🔒</span>
            <span>Your data is encrypted and secure.</span>
          </div>

          <p className="text-center text-[1.04rem] text-white/85">
            New to Ethio Vest? <a href="/register" className="font-semibold text-[#22c55e] hover:text-[#38bdf8] underline underline-offset-2">Create an account</a>
          </p>
        </form>
        <div className="text-center text-[0.92rem] text-white/70 mt-2" style={{ fontFamily: bodyFont }}>© 2026 Ethio Vest - Secure Investment Platform</div>
      </div>
    </div>
  )
}

export default LoginPage
