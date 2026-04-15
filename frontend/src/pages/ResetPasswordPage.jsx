import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../utils/api.js'

const ResetPasswordPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!token) {
      setMessage('Invalid reset link. Please request a new one.')
      return
    }
    if (password !== confirm) {
      setMessage('Passwords do not match.')
      return
    }
    setStatus('loading')
    setMessage('')
    try {
      const { data } = await api.post('/auth/reset', { token, password })
      setMessage(data?.message || 'Password reset successful.')
      setTimeout(() => navigate('/login', { replace: true }), 900)
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not reset password. The link may be expired.')
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4" style={{ backgroundColor: '#0f172a' }}>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)' }} />
      <div className="absolute inset-0 opacity-35" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '28px 28px' }} />

      <form onSubmit={onSubmit} className="relative w-full max-w-lg bg-white/6 backdrop-blur-xl border border-white/15 rounded-2xl shadow-[0_16px_46px_rgba(0,0,0,0.38)] px-5 sm:px-10 py-8 sm:py-10 space-y-5 text-white">
        <h1 className="text-[22px] sm:text-2xl font-semibold text-center">Set a new password</h1>
        <p className="text-sm text-white/80 text-center">Enter a strong password. This link expires after one use.</p>

        <label className="block">
          <span className="sr-only">New password</span>
          <div className="flex items-center gap-3 bg-white/8 border border-white/15 rounded-lg px-4 py-3 text-base">
            <span>🔒</span>
            <input
              className="bg-transparent w-full outline-none placeholder-white/70 text-white text-base"
              placeholder="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </label>

        <label className="block">
          <span className="sr-only">Confirm password</span>
          <div className="flex items-center gap-3 bg-white/8 border border-white/15 rounded-lg px-4 py-3 text-base">
            <span>✅</span>
            <input
              className="bg-transparent w-full outline-none placeholder-white/70 text-white text-base"
              placeholder="Confirm password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
        </label>

        {message && <p className="text-base text-emerald-200 bg-emerald-900/30 border border-emerald-500/30 rounded px-3 py-3">{message}</p>}

        <button type="submit" className="w-full py-3 rounded-lg text-base font-semibold text-white shadow-lg hover:shadow-xl transition" style={{ background: 'linear-gradient(90deg, #2563eb, #1d4ed8)' }} disabled={status === 'loading'}>
          {status === 'loading' ? 'Updating...' : 'Reset password'}
        </button>
        <p className="text-sm text-center text-white/85">
          Back to <a href="/login" className="underline font-semibold">Login</a>
        </p>
      </form>
    </div>
  )
}

export default ResetPasswordPage
