import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import api from '../utils/api.js'

const EMPTY_FORM = { name: '', email: '', phone: '' }

const initials = (name) =>
  String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')

const ManagersPage = () => {
  const { list, active } = useSelector((s) => s.company)
  const role = list.find((c) => c.id === active)?.role || 'viewer'
  const activeCompany = list.find((c) => c.id === active)

  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('invite')
  const [form, setForm] = useState(EMPTY_FORM)
  const [assignEmail, setAssignEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState({ type: '', message: '' })

  const canInvite = role === 'admin' && Boolean(active)

  const showNotice = (type, message) => {
    setNotice({ type, message })
  }

  const fetchManagers = async () => {
    if (!active) return
    setLoading(true)
    try {
      const { data } = await api.get('/users', { params: { companyId: active } })
      const rows = Array.isArray(data) ? data : []
      setManagers(rows.filter((u) => String(u.role || '').toLowerCase() === 'manager'))
    } catch {
      showNotice('error', 'Unable to load managers right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchManagers()
  }, [active])

  const isFormValid = useMemo(() => {
    const nameOk = form.name.trim().length >= 2
    const emailOk = /.+@.+\..+/.test(form.email.trim())
    const phoneRaw = form.phone.trim()
    const phoneOk = !phoneRaw || phoneRaw.length >= 7
    return nameOk && emailOk && phoneOk
  }, [form])

  const upsertManager = (incoming) => {
    setManagers((prev) => {
      const idx = prev.findIndex((m) => m.email === incoming.email)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], ...incoming }
        return copy
      }
      return [incoming, ...prev]
    })
  }

  const handleInvite = async () => {
    if (!canInvite || !isFormValid) return
    setSubmitting(true)
    setNotice({ type: '', message: '' })

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: 'manager',
        companyId: active,
      }
      if (form.phone.trim()) payload.phone = form.phone.trim()

      const { data } = await api.post('/users/invite', payload)
      upsertManager({
        id: data?.user?.id,
        name: data?.user?.name || payload.name,
        email: data?.user?.email || payload.email,
        phone: data?.user?.phone || payload.phone || '',
        role: 'manager',
      })

      setForm(EMPTY_FORM)
      const sent = data?.inviteEmailStatus?.status === 'sent'
      if (sent) {
        showNotice('success', 'Manager invited successfully. Invitation email was sent to the registered email.')
      } else {
        showNotice('error', 'Manager was added, but email was not sent because email provider is not configured.')
      }
    } catch (err) {
      showNotice('error', err?.response?.data?.message || 'Failed to invite manager.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAssign = async () => {
    if (!canInvite || !/.+@.+\..+/.test(assignEmail.trim())) return
    setSubmitting(true)
    setNotice({ type: '', message: '' })

    try {
      const payload = { email: assignEmail.trim(), role: 'manager', companyId: active }
      const { data } = await api.post('/users/assign-role', payload)

      upsertManager({
        id: data?.user?.id,
        name: data?.user?.name || 'Manager',
        email: data?.user?.email || payload.email,
        phone: data?.user?.phone || '',
        role: 'manager',
      })

      setAssignEmail('')
      showNotice('success', 'Existing user role updated to manager.')
    } catch (err) {
      showNotice('error', err?.response?.data?.message || 'Failed to assign manager role.')
    } finally {
      setSubmitting(false)
    }
  }

  if (role !== 'admin') {
    return (
      <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[var(--bg-card)] p-8 text-center shadow-[var(--shadow-soft)]">
        <div className="text-lg font-semibold text-[color:var(--text-primary)]">Admin access required</div>
        <div className="mt-1 text-sm text-[color:var(--text-muted)]">Only admins can invite and assign managers.</div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[var(--bg-card)] px-6 py-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[color:var(--text-primary)]">Manager Access</h1>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Invite managers with name and email. Invitation email is sent automatically.
            </p>
          </div>
          <div className="rounded-full border border-[color:var(--panel-border)] bg-[var(--bg-hover)] px-3 py-1 text-xs font-semibold text-[color:var(--text-muted)]">
            {activeCompany?.name || 'No company selected'}
          </div>
        </div>
      </div>

      {notice.message ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.type === 'success'
              ? 'border-emerald-400/40 bg-emerald-500/10 text-[color:var(--text-primary)]'
              : 'border-rose-400/40 bg-rose-500/10 text-[color:var(--text-primary)]'
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[var(--bg-card)] shadow-[var(--shadow-surface)]">
          <div className="flex border-b border-[color:var(--panel-border)] bg-[var(--bg-hover)]">
            {[
              { id: 'invite', label: 'Invite New' },
              { id: 'assign', label: 'Assign Existing' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="flex-1 px-4 py-3 text-sm font-semibold"
                style={
                  tab === t.id
                    ? { borderBottom: '2px solid #7c3aed', color: '#7c3aed', background: 'var(--bg-card)' }
                    : { color: 'var(--text-muted)' }
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'invite' ? (
            <div className="space-y-4 p-6">
              <Field
                label="Full name"
                value={form.name}
                onChange={(v) => setForm((c) => ({ ...c, name: v }))}
                placeholder="e.g. Abebe Bekele"
              />
              <Field
                label="Email address"
                type="email"
                value={form.email}
                onChange={(v) => setForm((c) => ({ ...c, email: v }))}
                placeholder="manager@company.com"
              />
              <Field
                label="Phone (optional)"
                value={form.phone}
                onChange={(v) => setForm((c) => ({ ...c, phone: v }))}
                placeholder="+251 9xx xxx xxxx"
              />

              <button
                type="button"
                onClick={handleInvite}
                disabled={!canInvite || !isFormValid || submitting}
                className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Sending invitation...' : 'Invite Manager and Send Email'}
              </button>
            </div>
          ) : (
            <div className="space-y-4 p-6">
              <Field
                label="Registered email"
                type="email"
                value={assignEmail}
                onChange={setAssignEmail}
                placeholder="existing@user.com"
              />
              <button
                type="button"
                onClick={handleAssign}
                disabled={!canInvite || !/.+@.+\..+/.test(assignEmail.trim()) || submitting}
                className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-5 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Assigning...' : 'Assign as Manager'}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[var(--bg-card)] shadow-[var(--shadow-surface)]">
          <div className="border-b border-[color:var(--panel-border)] px-5 py-4">
            <div className="text-sm font-bold text-[color:var(--text-primary)]">Current Managers</div>
            <div className="text-xs text-[color:var(--text-muted)]">{activeCompany?.name || 'Active company'}</div>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="text-sm text-[color:var(--text-muted)]">Loading managers...</div>
            ) : managers.length === 0 ? (
              <div className="text-sm text-[color:var(--text-muted)]">No managers found yet.</div>
            ) : (
              <div className="space-y-2.5">
                {managers.map((manager, idx) => (
                  <div
                    key={manager.id || manager.email}
                    className="flex items-center gap-3 rounded-xl border border-[color:var(--panel-border)] bg-[var(--bg-hover)] px-4 py-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-sm font-bold text-white">
                      {initials(manager.name) || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{manager.name || 'Unnamed'}</div>
                      <div className="truncate text-xs text-[color:var(--text-muted)]">{manager.email}</div>
                      {manager.phone ? <div className="text-xs text-[color:var(--text-muted)]">{manager.phone}</div> : null}
                    </div>
                    <span className="text-[11px] font-semibold text-[color:var(--text-muted)]">#{idx + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const Field = ({ label, value, onChange, type = 'text', placeholder = '' }) => (
  <label className="grid gap-1.5 text-sm">
    <span className="font-semibold text-[color:var(--text-primary)]">{label}</span>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-xl border border-[color:var(--panel-border)] bg-[var(--bg-hover)] px-3.5 text-sm text-[color:var(--text-primary)] outline-none transition placeholder:text-[color:var(--text-muted)]/50 focus:border-violet-400 focus:bg-[var(--bg-card)] focus:ring-2 focus:ring-violet-400/15"
    />
  </label>
)

export default ManagersPage
