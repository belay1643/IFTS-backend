import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../utils/api.js'

const IconMail = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16c.55 0 1 .45 1 1v10c0 .55-.45 1-1 1H4a1 1 0 0 1-1-1V7c0-.55.45-1 1-1Zm0 0 8 6 8-6" />
  </svg>
)

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [feedback, setFeedback] = useState({ text: '', tone: 'neutral' })

  const onSubmit = async (e) => {
    e.preventDefault()
    setStatus('loading')
    setFeedback({ text: '', tone: 'neutral' })
    try {
      const { data } = await api.post('/auth/forgot', { email })
      setFeedback({ text: data?.message || 'If the email exists, reset instructions have been queued.', tone: 'success' })
    } catch (err) {
      setFeedback({ text: err.response?.data?.message || 'Could not process request', tone: 'error' })
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4" style={{ backgroundImage: 'radial-gradient(circle at center, rgba(59,130,246,0.15), transparent 60%), linear-gradient(135deg, #020617, #0f172a, #020617)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

      <form onSubmit={onSubmit} className="relative w-full max-w-lg bg-[rgba(255,255,255,0.08)] backdrop-blur-[25px] border border-[rgba(255,255,255,0.18)] rounded-[20px] shadow-[0_30px_70px_rgba(0,0,0,0.5)] px-10 py-12 space-y-6 text-white animate-fade-scale">
        <div className="flex justify-start">
          <Link to="/" className="flex items-center gap-3 text-white/90 hover:text-white font-semibold" style={{ fontSize: 16, fontWeight: 600, opacity: 0.9 }}>
            <span className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#22c55e] to-[#06b6d4] border border-white/20 flex items-center justify-center text-lg font-extrabold tracking-tight shadow-[0_0_18px_rgba(34,197,94,0.35)]">EV</span>
            <span>Ethio Vest</span>
          </Link>
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-[26px] font-bold">Reset your password</h1>
          <p className="text-[14px] text-white/70">We’ll email you a secure link to reset your password.</p>
        </div>

        <label className="block space-y-2">
          <div className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-[10px] px-4 py-[12px] text-base transition focus-within:border-[#22c55e] focus-within:shadow-[0_0_0_3px_rgba(34,197,94,0.25)]">
            <IconMail />
            <input
              className="bg-transparent w-full outline-none placeholder-white/70 text-white text-base"
              placeholder="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <p className="text-xs text-white/65">Enter the email address you used to create your account.</p>
        </label>

        {feedback.text && (
          <p
            className={`text-sm rounded-[10px] px-3 py-3 border ${
              feedback.tone === 'success'
                ? 'text-emerald-200 bg-emerald-900/30 border-emerald-500/30'
                : 'text-rose-200 bg-rose-900/35 border-rose-500/35'
            }`}
          >
            {feedback.text}
          </p>
        )}

        <button
          type="submit"
          className="w-full h-[46px] rounded-[10px] text-base font-semibold text-white shadow-[0_10px_30px_rgba(59,130,246,0.35)] transition transform hover:-translate-y-[2px]"
          style={{ background: 'linear-gradient(90deg, #3b82f6, #2563eb)' }}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Sending reset link...' : 'Send reset link'}
        </button>

        <div className="text-center text-xs text-white/70 flex items-center gap-2 justify-center">
          <span aria-hidden>🔒</span>
          <span>We use secure encryption to protect your account.</span>
        </div>

        <p className="text-sm text-center text-white/70 hover:text-white transition flex items-center justify-center gap-2">
          <span aria-hidden className="text-white/80">←</span>
          <Link to="/login" className="font-medium">Back to login</Link>
        </p>
      </form>
    </div>
  )
}

export default ForgotPasswordPage
