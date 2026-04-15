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

const LoginPage = () => {
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
      className="min-h-screen relative flex items-center justify-center px-4"
      style={{
        backgroundImage: bgImage,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#0a1f3a'
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#0d2544]/78 via-[#0e3564]/62 to-[#0a1f3a]/80" />
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

      <div className="relative w-full max-w-lg bg-[rgba(255,255,255,0.08)] backdrop-blur-[25px] border border-[rgba(255,255,255,0.18)] rounded-[18px] shadow-[0_26px_70px_rgba(0,0,0,0.4)] px-8 py-10 space-y-6 text-white transition hover:-translate-y-[2px] animate-fade-scale">
        <div className="flex justify-start">
          <Link to="/" className="flex items-center gap-3 text-white/90 hover:text-white font-semibold">
            <span className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#22c55e] to-[#06b6d4] border border-white/20 flex items-center justify-center text-lg font-extrabold tracking-tight shadow-[0_0_18px_rgba(34,197,94,0.35)]">EV</span>
            <span className="text-lg tracking-tight font-bold">Ethio Vest</span>
          </Link>
        </div>
        <div className="text-center space-y-2">
          <div className="text-2xl font-bold">Ethio Vest</div>
          <p className="text-sm text-white/80">Secure login to your dashboard.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <label className="block">
            <div className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-[10px] px-4 py-[12px] text-base transition focus-within:border-[#22c55e] focus-within:shadow-[0_0_0_3px_rgba(34,197,94,0.25)]">
              <IconMail />
              <input
                className="bg-transparent w-full outline-none placeholder-white/65 text-white text-base"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
              />
            </div>
          </label>
          <label className="block">
            <div className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-[10px] px-4 py-[12px] text-base transition focus-within:border-[#22c55e] focus-within:shadow-[0_0_0_3px_rgba(34,197,94,0.25)]">
              <IconLock />
              <input
                className="bg-transparent w-full outline-none placeholder-white/65 text-white text-base"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
              />
            </div>
          </label>

          <div className="flex items-center justify-between text-sm text-white/80">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>Remember me</span>
            </label>
            <a href="/forgot" className="font-semibold text-white/85 hover:text-white">Forgot Password?</a>
          </div>

          {error && <p className="text-base text-rose-200 bg-rose-900/40 border border-rose-500/40 rounded px-3 py-3">{error}</p>}

          <button
            type="submit"
            className="w-full py-[14px] rounded-[10px] text-base font-semibold text-white shadow-[0_12px_30px_rgba(34,197,94,0.35)] transition hover:-translate-y-[2px]"
            style={{ background: 'linear-gradient(90deg,#22c55e,#06b6d4)' }}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="text-center text-xs text-white/70 flex items-center gap-2 justify-center">
            <span aria-hidden>🔒</span>
            <span>Your data is encrypted and secure.</span>
          </div>

          <p className="text-center text-sm text-white/85">
            New to Ethio Vest? <a href="/register" className="font-semibold text-[#22c55e] hover:text-[#38bdf8]">Create an account</a>
          </p>
        </form>
        <div className="text-center text-[12px] text-white/70">© 2026 Ethio Vest — Secure Investment Platform</div>
      </div>
    </div>
  )
}

export default LoginPage
