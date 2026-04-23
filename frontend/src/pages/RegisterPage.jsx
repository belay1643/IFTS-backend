import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../utils/api.js'

const bgImage = "linear-gradient(rgba(10,20,40,0.7), rgba(10,20,40,0.9)), url('https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80')"

const IconUser = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4Z" />
  </svg>
)

const IconMail = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16c.55 0 1 .45 1 1v10c0 .55-.45 1-1 1H4a1 1 0 0 1-1-1V7c0-.55.45-1 1-1Zm0 0 8 6 8-6" />
  </svg>
)

const IconEye = ({ open }) => open ? (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
) : (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.73 10.73A3 3 0 0 0 12 15a3 3 0 0 0 2.83-2.01M9.88 9.88A3 3 0 0 1 12 9a3 3 0 0 1 2.12.88M21 21L3 3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-7 11-7c2.5 0 4.77.7 6.74 1.87M21 21s-4 7-11 7c-2.5 0-4.77-.7-6.74-1.87" />
  </svg>
)

const bodyFont = '"Plus Jakarta Sans", "Inter", "Segoe UI", Tahoma, sans-serif'
const brandFont = '"Fraunces", Georgia, "Times New Roman", serif'

const RegisterPage = () => {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const passwordStrength = useMemo(() => {
    const lengthScore = password.length >= 12 ? 2 : password.length >= 8 ? 1 : 0
    const varietyScore = [/[^a-zA-Z0-9]/, /[0-9]/, /[A-Z]/].reduce((acc, regex) => (regex.test(password) ? acc + 1 : acc), 0)
    const score = Math.min(4, lengthScore + varietyScore)
    const levels = ['Weak', 'Weak', 'Medium', 'Strong', 'Strong']
    const colors = ['bg-rose-500', 'bg-rose-500', 'bg-amber-400', 'bg-emerald-500', 'bg-emerald-500']
    const widths = ['25%', '25%', '55%', '85%', '100%']
    return {
      label: levels[score],
      barClass: colors[score],
      width: widths[score]
    }
  }, [password])

  const onSubmit = async (e) => {
    e.preventDefault()
    const cleanName = name.trim()
    const cleanEmail = email.trim().toLowerCase()

    if (!cleanName || !cleanEmail) {
      setError('Name and email are required')
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setStatus('loading')
    setError('')
    setSuccess('')
    try {
      await api.post('/auth/register', { name: cleanName, email: cleanEmail, password })
      setSuccess('Account created. Redirecting to sign in...')
      setTimeout(() => navigate('/login', { replace: true }), 900)
    } catch (err) {
      const responseMessage = err.response?.data?.message
      const validationErrors = err.response?.data?.errors

      if (!err.response) {
        setError('Cannot reach the server. Start backend API (and database), then try again.')
      } else if (Array.isArray(validationErrors) && validationErrors.length > 0) {
        setError(validationErrors[0].msg || responseMessage || 'Registration failed')
      } else {
        setError(responseMessage || 'Registration failed')
      }
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div
      className="min-h-screen relative flex items-center justify-center px-4"
      style={{
        backgroundImage: bgImage,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#073541'
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b3a4c]/74 via-[#0b5663]/60 to-[#073541]/78" />
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

      <div className="relative w-full max-w-lg bg-[rgba(255,255,255,0.08)] backdrop-blur-[22px] border border-[rgba(255,255,255,0.18)] rounded-[16px] shadow-[0_22px_60px_rgba(0,0,0,0.38)] px-7 py-8 space-y-5 text-white transition hover:-translate-y-[2px] animate-fade-scale">
        <div className="flex justify-start">
          <Link to="/" className="flex items-center gap-4 text-white/90 hover:text-white font-semibold" style={{ fontFamily: bodyFont }}>
            <span className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#22c55e] to-[#06b6d4] border border-white/20 flex items-center justify-center text-lg font-extrabold tracking-tight shadow-[0_0_18px_rgba(34,197,94,0.35)]">EV</span>
            <span className="text-[1.06rem] tracking-[0.01em] font-semibold">Ethio Vest</span>
          </Link>
        </div>
        <div className="text-center space-y-1.5">
          <div className="text-[2rem] leading-tight text-white/95" style={{ fontFamily: brandFont, fontWeight: 600 }}>Ethio Vest</div>
          <p className="text-[1.05rem] text-white/80" style={{ fontFamily: bodyFont }}>Create your account</p>
          <p className="text-[0.95rem] text-white/70" style={{ fontFamily: bodyFont }}>Start managing your investments with confidence.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3.5" style={{ fontFamily: bodyFont }}>
          <div className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-[10px] px-4 py-[10px] text-base transition focus-within:border-[#22c55e] focus-within:shadow-[0_0_0_3px_rgba(34,197,94,0.25)]">
            <IconUser />
            <input
              className="bg-transparent w-full outline-none placeholder-white/70 text-white text-[1.02rem] leading-6 font-medium"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-[10px] px-4 py-[10px] text-base transition focus-within:border-[#22c55e] focus-within:shadow-[0_0_0_3px_rgba(34,197,94,0.25)]">
            <IconMail />
            <input
              className="bg-transparent w-full outline-none placeholder-white/70 text-white text-[1.02rem] leading-6 font-medium"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-[10px] px-4 py-[10px] text-base transition focus-within:border-[#22c55e] focus-within:shadow-[0_0_0_3px_rgba(34,197,94,0.25)]">
            <button type="button" tabIndex={-1} aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((v) => !v)} className="focus:outline-none text-white/80 hover:text-white">
              <IconEye open={showPassword} />
            </button>
            <input
              className="bg-transparent w-full outline-none placeholder-white/70 text-white text-[1.02rem] leading-6 font-medium"
              placeholder="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-[10px] px-4 py-[10px] text-base transition focus-within:border-[#22c55e] focus-within:shadow-[0_0_0_3px_rgba(34,197,94,0.25)]">
            <button type="button" tabIndex={-1} aria-label={showConfirm ? 'Hide password' : 'Show password'} onClick={() => setShowConfirm((v) => !v)} className="focus:outline-none text-white/80 hover:text-white">
              <IconEye open={showConfirm} />
            </button>
            <input
              className="bg-transparent w-full outline-none placeholder-white/70 text-white text-[1.02rem] leading-6 font-medium"
              placeholder="Confirm password"
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1 text-[0.96rem] text-white/80">
            <div className="flex items-center justify-between">
              <span>Password strength</span>
              <span className="text-[0.84rem] text-white/70">{passwordStrength.label}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className={`h-full ${passwordStrength.barClass}`} style={{ width: passwordStrength.width }} />
            </div>
          </div>

          {error && <p className="text-[1.03rem] leading-6 text-rose-200 bg-rose-900/40 border border-rose-500/40 rounded px-3 py-3">{error}</p>}
          {success && <p className="text-[1.03rem] leading-6 text-emerald-200 bg-emerald-900/30 border border-emerald-500/30 rounded px-3 py-3">{success}</p>}

          <button
            type="submit"
            className="w-full py-3 rounded-[10px] text-[1.08rem] font-semibold text-white shadow-[0_10px_24px_rgba(34,197,94,0.3)] transition hover:-translate-y-[2px]"
            style={{ background: 'linear-gradient(90deg,#22c55e,#06b6d4)' }}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Creating...' : 'Create Account'}
          </button>

          <div className="text-center text-[0.95rem] text-white/70 flex items-center gap-2 justify-center">
            <span aria-hidden>🔒</span>
            <span>Your data is encrypted and secure.</span>
          </div>

          <p className="text-center text-[1.01rem] text-white/85">
            Already have an account? <a href="/login" className="font-semibold text-[#22c55e] hover:text-[#38bdf8]">Sign in</a>
          </p>
        </form>
        <div className="text-center text-[0.9rem] text-white/70" style={{ fontFamily: bodyFont }}>© 2026 Ethio Vest - Secure Investment Platform</div>
      </div>
    </div>
  )
}

export default RegisterPage
