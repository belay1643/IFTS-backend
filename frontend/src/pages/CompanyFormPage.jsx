import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import { createCompany, fetchCompanies, updateCompany } from '../store/slices/companySlice.js'

const createDefaultForm = () => ({
  name: '',
  description: '',
  registrationNumber: '',
  taxId: '',
  approvalThreshold: 1,
  fiscalYearStart: 'January',
  status: 'active'
})

const CompanyFormPage = ({ companyIdProp, onClose, layout = 'page' }) => {
  const { companyId: routeCompanyId } = useParams()
  const companyId = companyIdProp ?? routeCompanyId
  const isEdit = Boolean(companyId)
  const isOverlay = layout === 'overlay' || Boolean(onClose)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { list, createStatus, updateStatus, error } = useSelector((s) => s.company)
  const { user } = useSelector((s) => s.auth)
  const hasAdminAccess = useMemo(() => list.some((c) => c.role === 'admin') || user?.role === 'admin', [list, user])
  const target = useMemo(() => list.find((c) => c.id === companyId), [list, companyId])
  const friendlyError = useMemo(() => {
    const msg = String(error || '')
    return /jwt expired|token expired/i.test(msg) ? 'Session expired. Please sign in again.' : msg
  }, [error])

  const [form, setForm] = useState(createDefaultForm)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!list.length) dispatch(fetchCompanies())
  }, [dispatch, list.length])

  useEffect(() => {
    if (isEdit && target) {
      setForm((prev) => ({
        ...prev,
        name: target.name || '',
        description: target.description || '',
        registrationNumber: target.registrationNumber || '',
        taxId: target.taxId || '',
        approvalThreshold: target.approvalThreshold || 1,
        fiscalYearStart: target.fiscalYearStart || 'January',
        status: target.status || 'active'
      }))
    }
  }, [isEdit, target])

  const validate = () => {
    if (!form.name.trim()) return 'Company name is required'
    if (isDateLikeName(form.name)) return 'Company name cannot be a date string'
    if (form.description && form.description.length > 500) return 'Description must be 500 characters or less'
    if (Number(form.approvalThreshold) <= 0) return 'Approval threshold must be greater than 0'
    if (!hasAdminAccess) return 'Admin role required to create or edit companies'
    return ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setFormError(validationError)
      return
    }

    const payload = {
      name: form.name.trim(),
      description: form.description?.trim() || '',
      approvalThreshold: Number(form.approvalThreshold) || 1,
      status: form.status,
      registrationNumber: form.registrationNumber?.trim() || '',
      taxId: form.taxId?.trim() || '',
      currency: 'ETB',
      fiscalYearStart: form.fiscalYearStart,
      autoGenerateReports: false,
      emailReports: false
    }

    setFormError('')
    try {
      if (isEdit) {
        await dispatch(updateCompany({ id: companyId, updates: payload })).unwrap()
      } else {
        await dispatch(createCompany(payload)).unwrap()
      }
      if (onClose) {
        onClose({ saved: true })
      } else {
        navigate('/companies')
      }
    } catch (err) {
      setFormError(err?.message || 'Save failed')
    }
  }

  const handleCancel = () => {
    if (onClose) {
      onClose({ saved: false })
    } else {
      navigate('/companies')
    }
  }

  return (
    <div className={`space-y-5 text-[color:var(--text-primary)] ${isOverlay ? 'max-h-[90vh] overflow-y-auto pr-1' : ''}`}>
      <div className="relative overflow-hidden rounded-[20px] border border-[color:var(--panel-border)] bg-gradient-to-r from-[var(--brand-primary)]/10 via-[var(--panel)] to-[var(--panel-strong)]/65 p-5 shadow-[0_16px_60px_-38px_rgba(0,0,0,0.55)]">
        <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 18% 22%, rgba(104,210,232,0.14), transparent 42%), radial-gradient(circle at 82% 12%, rgba(52,211,153,0.12), transparent 36%)' }} />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs tracking-[0.25em] text-[color:var(--text-muted)] uppercase">Companies</p>
            <h1 className="text-2xl font-semibold">{isEdit ? 'Edit Company' : 'Create New Company'}</h1>
            <p className="text-sm text-[color:var(--text-muted)]">Admin-only changes; ensure details are correct</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full border ${isEdit ? 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/35' : 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/35'}`}>
              {isEdit ? 'Edit mode' : 'Create mode'}
            </span>
            <div className="text-sm text-[color:var(--text-muted)]">{isEdit ? `Editing #${companyId?.slice(0, 8) || ''}` : 'New record'}</div>
          </div>
        </div>
      </div>

      {friendlyError && <div className="text-sm text-rose-700 dark:text-rose-300">{friendlyError}</div>}
      {formError && <div className="text-sm text-rose-700 dark:text-rose-300">{formError}</div>}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <Section title="Basic Information">
          <div className="space-y-4">
            <FloatingInput
              label="Company Name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />

            <FloatingTextarea
              label="Company Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <div className="text-xs text-[color:var(--text-muted)] text-right">{form.description.length}/500</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FloatingInput
                label="Registration/License Number"
                value={form.registrationNumber}
                onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))}
              />
              <FloatingInput
                label="Tax ID / VAT Number"
                value={form.taxId}
                onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
              />
            </div>
          </div>
        </Section>

        <Section title="Financial Settings">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Approval Threshold" helper={`Transactions above this require approval (currently: > ${form.approvalThreshold || 0} ETB)`} required>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <FloatingInput
                    label="Approval Threshold"
                    type="number"
                    min="1"
                    value={form.approvalThreshold}
                    onChange={(e) => setForm((f) => ({ ...f, approvalThreshold: e.target.value }))}
                    required
                  />
                </div>
                <span className="text-sm text-[color:var(--text-muted)]">ETB</span>
              </div>
            </Field>
            <Field label="Default Currency" helper="Fixed across the platform.">
              <div className="w-full rounded-xl border border-[color:var(--panel-border)] bg-[var(--bg-card)] px-3 py-3 text-sm text-[color:var(--text-primary)]">
                Ethiopian Birr (ETB)
              </div>
            </Field>
            <Field label="Fiscal Year Start">
              <select
                className="w-full border border-[color:var(--panel-border)] rounded-xl px-3 py-3 text-sm bg-[var(--bg-card)]"
                value={form.fiscalYearStart}
                onChange={(e) => setForm((f) => ({ ...f, fiscalYearStart: e.target.value }))}
              >
                {MONTHS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
          </div>
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            Currency selection is disabled. All company operations use Ethiopian Birr (ETB).
          </div>
        </Section>

        <Section title="Status">
          <div className="flex flex-wrap gap-2 text-sm">
            {['active', 'pending', 'archived'].map((statusOpt) => (
              <button
                key={statusOpt}
                type="button"
                onClick={() => setForm((f) => ({ ...f, status: statusOpt }))}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border capitalize ${form.status === statusOpt ? statusTone(statusOpt).active : statusTone(statusOpt).idle}`}
              >
                <span className={`h-2 w-2 rounded-full ${statusTone(statusOpt).dot}`} />
                {statusOpt}
              </button>
            ))}
          </div>
        </Section>

        <div className="flex items-center gap-3 justify-end">
            <button
              type="button"
              className="px-4 py-2 border border-[color:var(--panel-border)] text-[color:var(--text-primary)] rounded-xl text-sm bg-[var(--bg-card)] hover:bg-[var(--panel-strong)] transition-all"
              onClick={handleCancel}
            >
            Cancel
          </button>
          <button
            type="submit"
              className="px-4 py-2 bg-gradient-to-r from-[var(--brand-primary)] to-cyan-500 text-white border border-[color:var(--panel-border)] rounded-xl text-sm shadow-[0_14px_30px_-18px_rgba(59,130,246,0.55)] hover:shadow-[0_16px_34px_-18px_rgba(59,130,246,0.6)] transition-all disabled:opacity-60"
            disabled={!hasAdminAccess || createStatus === 'loading' || updateStatus === 'loading'}
          >
            {isEdit ? 'Update Company' : 'Create Company'}
          </button>
        </div>
      </form>
    </div>
  )
}

const Section = ({ title, children }) => (
  <div className="rounded-[20px] border border-[color:var(--panel-border)] bg-[var(--panel)] shadow-[0_20px_60px_-40px_rgba(0,0,0,0.55)] p-4 space-y-3">
    <div className="font-semibold text-sm uppercase tracking-[0.12em] text-[color:var(--text-muted)]">{title}</div>
    <div>{children}</div>
  </div>
)

const Field = ({ label, children, helper, required }) => (
  <div className="space-y-1">
    <div className="flex items-center gap-1 text-xs text-[color:var(--text-muted)]">
      <span>{label}</span>
      {required && <span className="text-rose-500">*</span>}
    </div>
    {children}
    {helper && <div className="text-[11px] text-[color:var(--text-muted)]">{helper}</div>}
  </div>
)

const FloatingInput = ({ label, required, type = 'text', ...props }) => (
  <label className="relative block">
    <input
      type={type}
      placeholder=" "
      className="peer w-full border border-[color:var(--panel-border)] rounded-xl px-3 pt-5 pb-2 text-sm bg-[var(--bg-card)] outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
      {...props}
    />
    <span className="absolute left-3 top-2 text-[11px] text-[color:var(--text-muted)] transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:text-[11px]">
      {label}{required ? ' *' : ''}
    </span>
  </label>
)

const FloatingTextarea = ({ label, ...props }) => (
  <label className="relative block">
    <textarea
      rows="3"
      maxLength={500}
      placeholder=" "
      className="peer w-full border border-[color:var(--panel-border)] rounded-xl px-3 pt-6 pb-2 text-sm bg-[var(--bg-card)] outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
      {...props}
    />
    <span className="absolute left-3 top-2 text-[11px] text-[color:var(--text-muted)]">{label}</span>
  </label>
)

const statusTone = (status) => {
  if (status === 'active') {
    return {
      active: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35',
      idle: 'border-[color:var(--panel-border)] text-[color:var(--text-muted)]',
      dot: 'bg-emerald-500'
    }
  }
  if (status === 'pending') {
    return {
      active: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35',
      idle: 'border-[color:var(--panel-border)] text-[color:var(--text-muted)]',
      dot: 'bg-amber-500'
    }
  }
  return {
    active: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35',
    idle: 'border-[color:var(--panel-border)] text-[color:var(--text-muted)]',
    dot: 'bg-rose-500'
  }
}

const isDateLikeName = (name) => {
  const value = String(name || '').trim()
  if (!value) return false
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return true
  const parsed = Date.parse(value)
  return !Number.isNaN(parsed) && value.replace(/[^a-zA-Z]/g, '').length < 3
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'
]

export default CompanyFormPage
