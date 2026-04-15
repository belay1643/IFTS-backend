import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import dayjs from 'dayjs'
import jsPDF from 'jspdf'
import { useNavigate } from 'react-router-dom'
import { createCompany, fetchCompanies, setActiveCompany, updateCompany } from '../store/slices/companySlice'
import CompanyFormPage from './CompanyFormPage'

const defaultColumns = {
  company: true,
  status: true,
  role: true,
  lastActive: true,
  actions: true
}

const CompaniesPage = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { list, status, error, active } = useSelector((s) => s.company)
  const { user } = useSelector((s) => s.auth)
  const activeCompany = useMemo(() => list.find((c) => c.id === active), [list, active])
  const hasAdminAccess = useMemo(() => list.some((c) => c.role === 'admin') || user?.role === 'admin', [list, user])
  const friendlyError = /jwt expired|token expired/i.test(String(error || ''))
    ? 'Session expired. Please sign in again.'
    : String(error || '')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [dateRange, setDateRange] = useState('last30')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [viewMode, setViewMode] = useState('table')
  const [isMobile, setIsMobile] = useState(false)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [openColumnsMenu, setOpenColumnsMenu] = useState(false)
  const [columns, setColumns] = useState(defaultColumns)
  const [selectedIds, setSelectedIds] = useState([])
  const [toasts, setToasts] = useState([])

  const importRef = useRef(null)
  const searchRef = useRef(null)

  const pushToast = (message, tone = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setToasts((prev) => [...prev, { id, message, tone }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2600)
  }

  useEffect(() => {
    dispatch(fetchCompanies())
  }, [dispatch])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsMobile(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!openMenuId && !openColumnsMenu) return undefined
    const closeMenu = () => {
      setOpenMenuId(null)
      setOpenColumnsMenu(false)
    }
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [openMenuId, openColumnsMenu])

  const filtered = useMemo(() => {
    let rows = [...list]
    if (search) {
      const term = search.toLowerCase()
      rows = rows.filter((c) => {
        const name = String(c.name || '').toLowerCase()
        const description = String(c.description || '').toLowerCase()
        const id = String(c.id || '').toLowerCase()
        return name.includes(term) || description.includes(term) || id.includes(term)
      })
    }
    if (statusFilter) rows = rows.filter((c) => c.status === statusFilter)
    if (roleFilter) rows = rows.filter((c) => c.role === roleFilter)
    if (dateRange && dateRange !== 'all') {
      const now = dayjs()
      rows = rows.filter((c) => {
        if (!c.createdAt) return true
        const created = dayjs(c.createdAt)
        if (dateRange === 'last30') return created.isAfter(now.subtract(30, 'day'))
        if (dateRange === 'last90') return created.isAfter(now.subtract(90, 'day'))
        if (dateRange === 'ytd') return created.isAfter(now.startOf('year'))
        return true
      })
    }
    return rows
  }, [list, search, statusFilter, roleFilter, dateRange])

  const countBase = useMemo(() => {
    let rows = [...list]
    if (search) {
      const term = search.toLowerCase()
      rows = rows.filter((c) => {
        const name = String(c.name || '').toLowerCase()
        const description = String(c.description || '').toLowerCase()
        const id = String(c.id || '').toLowerCase()
        return name.includes(term) || description.includes(term) || id.includes(term)
      })
    }
    if (roleFilter) rows = rows.filter((c) => c.role === roleFilter)
    if (dateRange && dateRange !== 'all') {
      const now = dayjs()
      rows = rows.filter((c) => {
        if (!c.createdAt) return true
        const created = dayjs(c.createdAt)
        if (dateRange === 'last30') return created.isAfter(now.subtract(30, 'day'))
        if (dateRange === 'last90') return created.isAfter(now.subtract(90, 'day'))
        if (dateRange === 'ytd') return created.isAfter(now.startOf('year'))
        return true
      })
    }
    return rows
  }, [list, search, roleFilter, dateRange])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)
  const effectiveView = isMobile ? 'cards' : viewMode
  const stats = useMemo(() => ({
    total: countBase.length,
    active: countBase.filter((c) => c.status === 'active').length,
    pending: countBase.filter((c) => c.status === 'pending').length,
    archived: countBase.filter((c) => c.status === 'archived').length
  }), [countBase])

  const totalCompanies = list.length
  const filterSummary = filtered.length === totalCompanies
    ? `Showing ${filtered.length} companies`
    : `Showing ${filtered.length} of ${totalCompanies} companies`

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => filtered.some((c) => c.id === id)))
  }, [filtered])

  const allPageSelected = paged.length > 0 && paged.every((c) => selectedIds.includes(c.id))

  const handleView = (id) => {
    dispatch(setActiveCompany(id))
    pushToast('Active company switched', 'success')
  }

  const openCompanyProfile = (id) => {
    dispatch(setActiveCompany(id))
    navigate(`/companies/${id}`)
  }

  const handleArchive = async (id, currentStatus) => {
    setArchiveBusy(true)
    const next = currentStatus === 'archived' ? 'active' : 'archived'
    try {
      await dispatch(updateCompany({ id, updates: { status: next } })).unwrap()
      pushToast(next === 'archived' ? 'Company archived' : 'Company activated', 'success')
    } catch {
      pushToast('Action failed. Please retry.', 'danger')
    }
    setArchiveBusy(false)
  }

  const handleBulkArchive = async (nextStatus) => {
    if (!selectedIds.length) return
    setArchiveBusy(true)
    const tasks = selectedIds.map((id) => dispatch(updateCompany({ id, updates: { status: nextStatus } })).unwrap())
    const results = await Promise.allSettled(tasks)
    const successCount = results.filter((r) => r.status === 'fulfilled').length
    pushToast(`${successCount} companies updated`, successCount ? 'success' : 'danger')
    setSelectedIds([])
    setArchiveBusy(false)
  }

  const openForm = (id = null) => {
    setEditingId(id)
    setShowForm(true)
  }

  const closeForm = (result) => {
    setShowForm(false)
    setEditingId(null)
    if (result?.saved) {
      dispatch(fetchCompanies())
      pushToast(editingId ? 'Company updated' : 'Company created', 'success')
    }
  }

  const handleImportClick = () => importRef.current?.click()

  const handleImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const text = evt.target?.result || ''
      const lines = String(text).split(/\r?\n/).filter(Boolean)
      if (lines.length <= 1) {
        pushToast('CSV has no data rows', 'warning')
        return
      }
      const validRows = lines.slice(1).map((line) => {
        const [name, description, statusVal, role] = line.split(',')
        const normalizedName = normalizeCompanyName(name)
        if (!normalizedName) return null
        return { normalizedName, description, statusVal, role }
      }).filter(Boolean)
      if (!validRows.length) {
        pushToast('CSV rows were skipped because names were invalid', 'warning')
        return
      }
      const tasks = validRows.map((row) => {
        return dispatch(createCompany({
          name: row.normalizedName,
          description: row.description || '',
          status: row.statusVal || 'active',
          role: row.role || 'viewer',
          approvalThreshold: 0,
          reportingPreferences: 'summary'
        })).unwrap()
      })
      const results = await Promise.allSettled(tasks)
      const successCount = results.filter((r) => r.status === 'fulfilled').length
      pushToast(`${successCount} companies imported`, successCount ? 'success' : 'danger')
      dispatch(fetchCompanies())
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleExportCsv = () => {
    if (!filtered.length) {
      pushToast('No data to export', 'warning')
      return
    }
    const header = ['Name', 'Description', 'Status', 'Role', 'Id', 'LastActive']
    const csv = [header.join(',')]
    filtered.forEach((c) => {
      csv.push([
        resolveCompanyName(c).replace(/,/g, ' '),
        (c.description || '').replace(/,/g, ' '),
        c.status,
        c.role,
        c.id,
        formatLastActive(c)
      ].join(','))
    })
    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'companies-filtered.csv'
    link.click()
    URL.revokeObjectURL(url)
    pushToast('CSV exported', 'success')
  }

  const handleExportPdf = () => {
    if (!filtered.length) {
      pushToast('No data to export', 'warning')
      return
    }
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    doc.setFontSize(16)
    doc.text('Company Directory Export', 40, 40)
    doc.setFontSize(10)
    doc.text(`Generated: ${dayjs().format('YYYY-MM-DD HH:mm')}`, 40, 58)
    doc.text(`Rows: ${filtered.length}`, pageWidth - 120, 58)

    let y = 84
    filtered.forEach((c, idx) => {
      if (y > 760) {
        doc.addPage()
        y = 40
      }
      const line = `${idx + 1}. ${resolveCompanyName(c)} | ${toTitle(c.status)} | ${toTitle(c.role)} | ${compactId(c.id)}`
      doc.text(line, 40, y)
      y += 14
      const desc = `   ${truncate(c.description || 'No description', 95)}`
      doc.setTextColor(95, 95, 95)
      doc.text(desc, 40, y)
      doc.setTextColor(20, 20, 20)
      y += 16
    })

    doc.save('companies-filtered.pdf')
    pushToast('PDF exported', 'success')
  }

  const toggleSelectAllPage = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !paged.some((c) => c.id === id)))
      return
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...paged.map((c) => c.id)])))
  }

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  return (
    <div className="relative space-y-6 text-[var(--text-primary)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 -left-8 h-56 w-56 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="absolute top-20 -right-8 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <ToastStack toasts={toasts} onClose={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      <div className="relative bg-gradient-to-r from-[var(--brand-primary)]/14 via-[var(--panel)] to-[var(--panel-strong)]/80 border border-[var(--card-border)]/70 rounded-[24px] px-4 sm:px-6 py-4 sm:py-5 shadow-[0_14px_55px_-28px_rgba(0,0,0,0.45)] overflow-hidden">
        <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(circle at 18% 22%, rgba(104,210,232,0.18), transparent 38%), radial-gradient(circle at 82% 12%, rgba(52,211,153,0.16), transparent 32%)' }} />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-2">
            <p className="text-[11px] tracking-[0.28em] text-[var(--muted-foreground)] uppercase">Companies</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold">Company Directory</h1>
              <span className="text-xs px-2 py-1 rounded-full bg-[var(--bg-card)] text-[var(--muted-foreground)] border border-[var(--card-border)]/90">
                {filterSummary}
              </span>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">Manage entities, roles, approvals, and reporting in one place.</p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2 text-sm text-[var(--muted-foreground)] w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <span>Active:</span>
              <span className="px-2 py-1 rounded-lg bg-[var(--panel)] border border-[var(--card-border)] text-xs">
                {activeCompany?.name || 'None selected'}
              </span>
              {activeCompany?.role && <Badge color={roleColor(activeCompany.role)}>{activeCompany.role}</Badge>}
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="px-2 py-1 rounded-full bg-emerald-500/12 text-emerald-700 border border-emerald-500/20">Active {stats.active}</span>
              <span className="px-2 py-1 rounded-full bg-amber-500/12 text-amber-700 border border-amber-500/20">Pending {stats.pending}</span>
              <span className="px-2 py-1 rounded-full bg-rose-500/12 text-rose-700 border border-rose-500/20">Archived {stats.archived}</span>
            </div>
          </div>
        </div>
      </div>

      {friendlyError && <InlineAlert tone="danger" message={friendlyError} />}

      <div className="bg-[var(--panel)] border border-[var(--card-border)]/70 rounded-2xl p-4 md:p-5 shadow-[0_20px_70px_-45px_rgba(0,0,0,0.6)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="px-3.5 py-2 bg-gradient-to-r from-[var(--brand-primary)] to-cyan-500 text-white rounded-xl text-sm shadow-[0_16px_34px_-18px_rgba(59,130,246,0.55)] hover:shadow-[0_18px_36px_-18px_rgba(59,130,246,0.6)] disabled:opacity-50"
              onClick={() => openForm()}
              type="button"
              disabled={!hasAdminAccess}
            >
              + Add Company
            </button>
            <button className="px-3.5 py-2 border border-[var(--card-border)] rounded-xl text-sm bg-[var(--bg-card)] hover:bg-[var(--panel-strong)] hover:shadow-[0_10px_28px_-20px_rgba(15,23,42,0.24)] transition-all" type="button" onClick={handleImportClick}>Import</button>
            <button className="px-3.5 py-2 border border-[var(--card-border)] rounded-xl text-sm bg-[var(--bg-card)] hover:bg-[var(--panel-strong)] hover:shadow-[0_10px_28px_-20px_rgba(15,23,42,0.24)] transition-all" type="button" onClick={handleExportCsv}>CSV</button>
            <button className="px-3.5 py-2 border border-[var(--card-border)] rounded-xl text-sm bg-[var(--bg-card)] hover:bg-[var(--panel-strong)] hover:shadow-[0_10px_28px_-20px_rgba(15,23,42,0.24)] transition-all" type="button" onClick={handleExportPdf}>PDF</button>
            <input type="file" accept=".csv" ref={importRef} className="hidden" onChange={handleImport} />
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenColumnsMenu((v) => !v)
                }}
                className="px-3 py-1.5 rounded-xl text-xs border border-[var(--card-border)] bg-[var(--bg-card)] hover:bg-[var(--panel-strong)] transition-all"
              >
                Columns
              </button>
              {openColumnsMenu && (
                <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-9 z-20 w-44 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-card)] p-2 shadow-[0_22px_45px_-24px_rgba(0,0,0,0.42)]">
                  {Object.keys(columns).map((key) => (
                    <label key={key} className="flex items-center gap-2 px-2 py-1 text-xs capitalize text-[var(--text-primary)]">
                      <input
                        type="checkbox"
                        checked={columns[key]}
                        onChange={(ev) => setColumns((prev) => ({ ...prev, [key]: ev.target.checked }))}
                      />
                      {key === 'lastActive' ? 'last active' : key}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="inline-flex rounded-xl border border-[var(--card-border)] p-1 bg-[var(--bg-card)] shadow-[0_10px_26px_-22px_rgba(15,23,42,0.22)]">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${effectiveView === 'table' ? 'bg-[var(--brand-primary)] text-white shadow-[0_10px_24px_-14px_rgba(59,130,246,0.55)]' : 'text-[var(--muted-foreground)] hover:text-[var(--text-primary)]'}`}
                onClick={() => setViewMode('table')}
                disabled={isMobile}
              >
                Table
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${effectiveView === 'cards' ? 'bg-[var(--brand-primary)] text-white shadow-[0_10px_24px_-14px_rgba(59,130,246,0.55)]' : 'text-[var(--muted-foreground)] hover:text-[var(--text-primary)]'}`}
                onClick={() => setViewMode('cards')}
              >
                Cards
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3">
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-[var(--muted-foreground)] text-sm">🔍</span>
            <input
              ref={searchRef}
              type="text"
              className="w-full border border-[var(--card-border)] rounded-xl pl-9 pr-14 py-2 text-sm bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
              placeholder="Search companies..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
            <span className="hidden sm:inline absolute right-3 top-2 text-[10px] text-[var(--muted-foreground)] border border-[var(--card-border)] rounded px-1.5 py-1">Ctrl/Cmd+K</span>
          </div>
          <select className="border border-[var(--card-border)] rounded-xl px-2.5 py-2 text-sm bg-[var(--bg-card)]" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}>
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="viewer">Viewer</option>
          </select>
          <select className="border border-[var(--card-border)] rounded-xl px-2.5 py-2 text-sm bg-[var(--bg-card)]" value={dateRange} onChange={(e) => { setDateRange(e.target.value); setPage(1) }}>
            <option value="last30">Last 30 days</option>
            <option value="last90">Last 90 days</option>
            <option value="ytd">YTD</option>
            <option value="all">All time</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {[
            { label: `All (${stats.total})`, value: '' },
            { label: `Active (${stats.active})`, value: 'active' },
            { label: `Pending (${stats.pending})`, value: 'pending' },
            { label: `Archived (${stats.archived})`, value: 'archived' }
          ].map((opt) => (
            <PillButton key={opt.value || 'all'} active={statusFilter === opt.value} onClick={() => { setStatusFilter(opt.value); setPage(1) }}>
              {opt.label}
            </PillButton>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard icon="🏢" label="Visible companies" value={filtered.length} detail={filterSummary} tone="primary" />
        <StatCard icon="✅" label="Active" value={stats.active} detail="Currently live" tone="emerald" />
        <StatCard icon="⏳" label="Pending" value={stats.pending} detail="Awaiting review" tone="amber" />
        <StatCard icon="🗂️" label="Archived" value={stats.archived} detail="Inactive records" tone="rose" />
      </div>

      {selectedIds.length > 0 && (
        <div className="rounded-2xl border border-[var(--brand-primary)]/30 bg-[var(--brand-primary)]/8 px-4 py-3 flex flex-wrap items-center gap-2 text-sm animate-[fadeIn_.2s_ease-out]">
          <span className="font-medium">{selectedIds.length} selected</span>
          <button type="button" className="px-3 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)]" onClick={() => handleBulkArchive('archived')} disabled={archiveBusy}>Archive selected</button>
          <button type="button" className="px-3 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)]" onClick={() => handleBulkArchive('active')} disabled={archiveBusy}>Activate selected</button>
          <button type="button" className="ml-auto text-xs text-[var(--muted-foreground)]" onClick={() => setSelectedIds([])}>Clear</button>
        </div>
      )}

      <div className="relative overflow-hidden rounded-[24px] border border-[var(--card-border)]/70 bg-[var(--panel)] shadow-[0_22px_70px_-46px_rgba(0,0,0,0.62)]">
        <div className="pointer-events-none absolute inset-0 opacity-45" style={{ background: 'radial-gradient(circle at 12% 10%, rgba(59,130,246,0.14), transparent 36%), radial-gradient(circle at 86% 14%, rgba(16,185,129,0.11), transparent 30%)' }} />
        <div className="relative flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)]/70 bg-[var(--bg-card)]/85 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Company Directory</h3>
            <span className="text-[11px] px-2 py-1 rounded-full bg-[var(--bg-card)] text-[var(--muted-foreground)] border border-[var(--card-border)]/80">{filterSummary}</span>
          </div>
          {status === 'loading' && <span className="text-xs text-[var(--muted-foreground)]">Syncing...</span>}
        </div>

        {status === 'loading' && !list.length ? (
          <DirectorySkeleton mode={effectiveView} />
        ) : filtered.length === 0 ? (
          <EmptyCompaniesState onCreate={() => openForm()} onClear={() => { setSearch(''); setStatusFilter(''); setRoleFilter(''); setDateRange('last30') }} />
        ) : effectiveView === 'table' ? (
          <>
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full min-w-[720px] text-sm text-[var(--text-primary)]">
                <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)] bg-[var(--panel-strong)]/70">
                  <tr>
                    <th className="py-3 px-4 font-semibold">
                      <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAllPage} />
                    </th>
                    <th className="py-3 px-4 font-semibold">#</th>
                    {columns.company && <th className="px-4 font-semibold">Company</th>}
                    {columns.status && <th className="px-4 font-semibold">Status</th>}
                    {columns.role && <th className="px-4 font-semibold">Role</th>}
                    {columns.lastActive && <th className="px-4 font-semibold">Last Active</th>}
                    {columns.actions && <th className="px-4 font-semibold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((c, idx) => {
                    const isActiveRow = c.id === active
                    return (
                      <tr
                        key={c.id}
                        className={`transition-all duration-200 border-b border-[var(--card-border)]/40 last:border-b-0 ${isActiveRow ? 'bg-[var(--bg-card)]/70 ring-1 ring-[var(--brand-primary)]/20' : idx % 2 === 0 ? 'bg-[var(--panel)]' : 'bg-[var(--panel-strong)]/55'} hover:bg-[var(--bg-card)]`}
                      >
                        <td className="py-3 px-4"><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelectOne(c.id)} /></td>
                        <td className="py-3 px-4 text-[var(--muted-foreground)]">{(page - 1) * pageSize + idx + 1}</td>
                        {columns.company && (
                          <td className="px-4 py-3">
                            <div className="font-semibold flex items-center gap-2">
                              <span>{resolveCompanyName(c)}</span>
                              {isActiveRow && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] border border-[var(--brand-primary)]/30">Current</span>}
                            </div>
                            <div className="text-xs text-[var(--muted-foreground)] mt-0.5 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                title={c.id || ''}
                                className="hover:text-[var(--text-primary)]"
                                onClick={() => copyId(c.id, pushToast)}
                              >
                                ID: {compactId(c.id)}
                              </button>
                              <span>•</span>
                              <span>{truncate(c.description || '-', 48)}</span>
                            </div>
                          </td>
                        )}
                        {columns.status && <td className="px-4"><StatusPill status={c.status} /></td>}
                        {columns.role && <td className="px-4"><Badge color={roleColor(c.role)}>{c.role || 'viewer'}</Badge></td>}
                        {columns.lastActive && <td className="px-4 text-[var(--muted-foreground)]">{formatLastActive(c)}</td>}
                        {columns.actions && (
                          <td className="px-4 text-right">
                            <div className="inline-flex items-center gap-1.5 mr-2">
                              <ActionGhost onClick={() => openCompanyProfile(c.id)}>View</ActionGhost>
                              <ActionGhost onClick={() => openForm(c.id)}>Edit</ActionGhost>
                              <ActionGhost muted={!isActiveRow} onClick={() => handleView(c.id)}>Switch</ActionGhost>
                            </div>
                            <RowMenu
                              open={openMenuId === c.id}
                              onToggle={(e) => {
                                e.stopPropagation()
                                setOpenMenuId((prev) => prev === c.id ? null : c.id)
                              }}
                              onArchive={() => { setOpenMenuId(null); handleArchive(c.id, c.status) }}
                              archiveLabel={c.status === 'archived' ? 'Activate' : 'Archive'}
                              disableArchive={!hasAdminAccess || archiveBusy}
                            />
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <PaginationFooter
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalRows={filtered.length}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              onPageSize={(val) => { setPageSize(val); setPage(1) }}
            />
          </>
        ) : (
          <>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {paged.map((c) => {
                const isActiveRow = c.id === active
                return (
                  <div key={c.id} className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4 min-h-[200px] shadow-[0_14px_34px_-28px_rgba(15,23,42,0.3)] hover:scale-[1.012] hover:border-[var(--brand-primary)]/25 hover:shadow-[0_20px_50px_-30px_rgba(15,23,42,0.34)] transition-all duration-200">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelectOne(c.id)} className="mt-1" />
                        <div>
                          <div className="font-semibold text-[var(--text-primary)]">{resolveCompanyName(c)}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <StatusPill status={c.status} />
                            <Badge color={roleColor(c.role)}>{c.role || 'viewer'}</Badge>
                          </div>
                        </div>
                      </div>
                      <RowMenu
                        open={openMenuId === c.id}
                        onToggle={(e) => {
                          e.stopPropagation()
                          setOpenMenuId((prev) => prev === c.id ? null : c.id)
                        }}
                        onArchive={() => { setOpenMenuId(null); handleArchive(c.id, c.status) }}
                        archiveLabel={c.status === 'archived' ? 'Activate' : 'Archive'}
                        disableArchive={!hasAdminAccess || archiveBusy}
                        compact
                      />
                    </div>
                    <div className="mt-3 text-xs text-[var(--muted-foreground)] space-y-1 border-y border-[var(--card-border)]/65 py-2">
                      <button
                        type="button"
                        title={c.id || ''}
                        className="hover:text-[var(--text-primary)]"
                        onClick={() => copyId(c.id, pushToast)}
                      >
                        📋 ID: {compactId(c.id)}
                      </button>
                      <div>📝 {truncate(c.description || 'No description provided.', 84)}</div>
                      <div>🕐 Last active: {formatLastActive(c)}</div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <ActionGhost onClick={() => openCompanyProfile(c.id)}>View</ActionGhost>
                      <ActionGhost onClick={() => openForm(c.id)}>Edit</ActionGhost>
                      <ActionGhost muted={!isActiveRow} onClick={() => handleView(c.id)}>Switch</ActionGhost>
                    </div>
                  </div>
                )
              })}
            </div>
            <PaginationFooter
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalRows={filtered.length}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              onPageSize={(val) => { setPageSize(val); setPage(1) }}
            />
          </>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/55 backdrop-blur-sm p-3 md:p-6 animate-[fadeIn_.2s_ease-out]">
          <div className="absolute inset-0" onClick={() => closeForm()} />
          <div className="relative z-10 w-full max-w-5xl rounded-2xl sm:rounded-3xl border border-[var(--card-border)]/70 shadow-[0_26px_90px_-32px_rgba(0,0,0,0.72)] overflow-hidden bg-[var(--bg-card)] animate-[slideUp_.24s_ease-out]">
            <div className="sticky top-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--card-border)]/70 bg-[var(--bg-card)]/96 backdrop-blur-md">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">Companies</p>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">{editingId ? 'Edit Company' : 'Create Company'}</h2>
              </div>
              <button className="text-sm text-[var(--muted-foreground)] hover:text-[var(--text-primary)]" onClick={() => closeForm()}>Close</button>
            </div>
            <div className="p-3 sm:p-5 max-h-[85vh] overflow-y-auto bg-[var(--panel)]">
              <CompanyFormPage companyIdProp={editingId} onClose={closeForm} layout="overlay" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const ToastStack = ({ toasts, onClose }) => (
  <div className="fixed top-4 right-4 z-[70] space-y-2 w-[280px] max-w-[90vw]">
    {toasts.map((t) => (
      <div key={t.id} className={`rounded-xl border px-3 py-2 text-sm shadow-[0_16px_35px_-20px_rgba(0,0,0,0.5)] animate-[slideInRight_.2s_ease-out] ${toastTone(t.tone)}`}>
        <div className="flex items-center gap-2">
          <span className="flex-1">{t.message}</span>
          <button type="button" className="text-xs opacity-70" onClick={() => onClose(t.id)}>x</button>
        </div>
      </div>
    ))}
  </div>
)

const toastTone = (tone) => {
  if (tone === 'success') return 'bg-emerald-500/12 border-emerald-500/35 text-emerald-800 dark:text-emerald-300'
  if (tone === 'danger') return 'bg-rose-500/12 border-rose-500/35 text-rose-800 dark:text-rose-300'
  if (tone === 'warning') return 'bg-amber-500/12 border-amber-500/35 text-amber-800 dark:text-amber-300'
  return 'bg-sky-500/12 border-sky-500/35 text-sky-800 dark:text-sky-300'
}

const StatCard = ({ icon, label, value, detail, tone = 'primary' }) => {
  const palette = {
    primary: 'from-[var(--brand-primary)]/18 via-[var(--brand-primary)]/10 to-transparent text-[var(--text-primary)]',
    emerald: 'from-emerald-500/18 via-emerald-500/10 to-transparent text-emerald-700 dark:text-emerald-100',
    amber: 'from-amber-500/18 via-amber-500/10 to-transparent text-amber-700 dark:text-amber-100',
    rose: 'from-rose-500/18 via-rose-500/10 to-transparent text-rose-700 dark:text-rose-100'
  }
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-[var(--card-border)]/70 bg-[var(--panel)] p-4 shadow-[0_18px_60px_-46px_rgba(0,0,0,0.55)] hover:-translate-y-0.5 hover:shadow-[0_22px_64px_-44px_rgba(0,0,0,0.58)] transition-all duration-200">
      <div className={`absolute inset-0 bg-gradient-to-br ${palette[tone] || palette.primary}`} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--muted-foreground)] mb-1">{label}</p>
          <div className="text-2xl font-semibold">{value}</div>
        </div>
        <div className="h-10 w-10 rounded-2xl bg-[var(--bg-card)]/85 border border-[var(--card-border)]/80 flex items-center justify-center text-lg shadow-[0_12px_26px_-18px_rgba(15,23,42,0.35)]">
          {icon || '•'}
        </div>
      </div>
      <div className="relative mt-3 text-xs text-[var(--muted-foreground)]">
        {detail}
      </div>
    </div>
  )
}

const PillButton = ({ children, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
      active
        ? 'bg-[var(--brand-primary)]/12 text-[var(--brand-primary)] border-[var(--brand-primary)]/30'
        : 'bg-[var(--bg-card)] border-[var(--card-border)] text-[var(--muted-foreground)] hover:text-[var(--text-primary)]'
    }`}
  >
    {children}
  </button>
)

const ActionGhost = ({ children, onClick, muted, tone, disabled }) => {
  const base = 'text-xs px-2.5 py-1.5 rounded-xl border transition-all font-medium'
  const palette = {
    default: 'text-[var(--text-primary)] border-[var(--card-border)] bg-[var(--bg-card)] hover:bg-[var(--panel-strong)]',
    muted: 'text-[var(--muted-foreground)] border-[var(--card-border)]/60 bg-[var(--bg-card)] hover:bg-[var(--panel-strong)]',
    danger: 'text-rose-500 border-rose-400/40 hover:bg-rose-500/10'
  }
  const cls = tone === 'danger' ? palette.danger : muted ? palette.muted : palette.default
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${cls} disabled:opacity-50 hover:shadow-[0_10px_26px_-18px_rgba(15,23,42,0.22)]`}>
      {children}
    </button>
  )
}

const InlineAlert = ({ tone = 'info', message }) => {
  const map = {
    info: {
      bg: 'bg-sky-500/10 border-sky-500/25 text-sky-700 dark:text-sky-200',
      dot: 'bg-sky-400'
    },
    danger: {
      bg: 'bg-rose-500/12 border-rose-500/35 text-rose-700 dark:text-rose-200',
      dot: 'bg-rose-400'
    },
    warning: {
      bg: 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-200',
      dot: 'bg-amber-400'
    }
  }
  const meta = map[tone] || map.info
  return (
    <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${meta.bg}`}>
      <span className={`inline-block w-2 h-2 rounded-full ${meta.dot}`} />
      <span>{message}</span>
    </div>
  )
}

const Badge = ({ children, color }) => {
  const colors = {
    green: 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/25',
    blue: 'bg-sky-500/15 text-sky-600 border border-sky-500/25',
    slate: 'bg-[var(--panel-strong)] text-[var(--text-secondary)] border border-[var(--card-border)]',
    amber: 'bg-amber-500/15 text-amber-600 border border-amber-500/25'
  }
  return <span className={`px-2 py-1 text-xs rounded capitalize ${colors[color] || colors.slate}`}>{children}</span>
}

const RowMenu = ({ open, onToggle, onArchive, archiveLabel, disableArchive, compact = false }) => (
  <div className="relative inline-flex">
    <button
      type="button"
      onClick={onToggle}
      className={`h-8 ${compact ? 'w-8' : 'w-9'} rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] text-[var(--muted-foreground)] hover:text-[var(--text-primary)]`}
      aria-label="Open actions"
    >
      ⋮
    </button>
    {open && (
      <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-9 z-20 w-40 rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] p-1.5 shadow-[0_22px_45px_-24px_rgba(0,0,0,0.55)] animate-[fadeIn_.15s_ease-out]">
        <div className="px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Actions</div>
        <MenuItem onClick={onArchive} disabled={disableArchive} danger>{archiveLabel}</MenuItem>
      </div>
    )}
  </div>
)

const MenuItem = ({ children, onClick, disabled, danger }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors disabled:opacity-50 ${danger ? 'text-rose-600 hover:bg-rose-500/10' : 'text-[var(--text-primary)] hover:bg-[var(--panel-strong)]'}`}
  >
    {children}
  </button>
)

const PaginationFooter = ({ page, totalPages, pageSize, totalRows, onPrev, onNext, onPageSize }) => {
  const start = totalRows === 0 ? 0 : (page - 1) * pageSize + 1
  const end = totalRows === 0 ? 0 : Math.min(page * pageSize, totalRows)
  return (
    <div className="flex flex-wrap items-center justify-between text-xs text-[var(--muted-foreground)] px-4 py-3 border-t border-[var(--card-border)]/70 bg-[var(--panel-strong)]/50 gap-3">
      <div className="flex items-center gap-2">
        <button className="border border-[var(--card-border)] rounded-xl px-2.5 py-1.5 bg-[var(--panel)] text-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--panel-strong)] transition-all" onClick={onPrev} disabled={page === 1}>Prev</button>
        <span>Page {page} of {totalPages}</span>
        <button className="border border-[var(--card-border)] rounded-xl px-2.5 py-1.5 bg-[var(--panel)] text-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--panel-strong)] transition-all" onClick={onNext} disabled={page === totalPages}>Next</button>
      </div>
      <div className="flex items-center gap-2">
        <span>{totalRows === 0 ? 'Showing 0 of 0' : `Showing ${start}-${end} of ${totalRows}`}</span>
        <span className="text-[var(--muted-foreground)]">Per page</span>
        <select className="border border-[var(--card-border)] rounded-xl px-2 py-1.5 bg-[var(--panel)] text-[var(--text-primary)]" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value) || 10)}>
          {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    </div>
  )
}

const DirectorySkeleton = ({ mode }) => (
  <div className="p-4">
    {mode === 'cards' ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, idx) => <SkeletonCard key={`card-${idx}`} />)}
      </div>
    ) : (
      <div className="space-y-2">
        {Array.from({ length: 7 }).map((_, idx) => <SkeletonRow key={`row-${idx}`} />)}
      </div>
    )}
  </div>
)

const SkeletonRow = () => (
  <div className="h-12 rounded-xl border border-[var(--card-border)] bg-[var(--panel-strong)]/50 animate-pulse" />
)

const SkeletonCard = () => (
  <div className="h-36 rounded-2xl border border-[var(--card-border)] bg-[var(--panel-strong)]/50 animate-pulse" />
)

const EmptyCompaniesState = ({ onCreate, onClear }) => (
  <div className="px-6 py-10 text-center space-y-3 animate-[fadeIn_.2s_ease-out]">
    <div className="text-4xl">🏢</div>
    <h4 className="text-lg font-semibold">No companies match your filters</h4>
    <p className="text-sm text-[var(--muted-foreground)]">Try clearing filters or create a new company to get started.</p>
    <div className="flex justify-center gap-2">
      <button type="button" className="px-3 py-2 rounded-xl border border-[var(--card-border)] text-sm bg-[var(--bg-card)] hover:bg-[var(--panel-strong)] transition-all" onClick={onClear}>Clear filters</button>
      <button type="button" className="px-3 py-2 rounded-xl bg-gradient-to-r from-[var(--brand-primary)] to-cyan-500 text-white text-sm shadow-[0_14px_30px_-18px_rgba(59,130,246,0.55)] hover:shadow-[0_16px_34px_-18px_rgba(59,130,246,0.6)] transition-all" onClick={onCreate}>Create company</button>
    </div>
  </div>
)

const compactId = (id) => {
  if (!id) return '-'
  if (id.length <= 12) return id
  return `${id.slice(0, 4)}...${id.slice(-4)}`
}

const formatLastActive = (company) => {
  const stamp = company?.updatedAt || company?.createdAt
  if (!stamp) return 'Never'
  const value = new Date(stamp).getTime()
  if (Number.isNaN(value)) return '-'
  const diffMin = Math.floor((Date.now() - value) / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} mins ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} hours ago`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay === 1) return 'Yesterday'
  if (diffDay < 7) return `${diffDay} days ago`
  return dayjs(stamp).format('MMM D, YYYY')
}

const isDateLikeName = (name) => {
  if (!name) return false
  const value = String(name).trim()
  if (!value) return false
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return true
  const parsed = Date.parse(value)
  return !Number.isNaN(parsed) && value.replace(/[^a-zA-Z]/g, '').length < 3
}

const normalizeCompanyName = (name) => {
  const value = String(name || '').trim()
  if (!value) return null
  if (isDateLikeName(value)) return null
  return value
}

const resolveCompanyName = (company) => {
  const value = String(company?.name || '').trim()
  if (!value || isDateLikeName(value)) return 'Unnamed Company'
  return value
}

const copyId = async (id, pushToast) => {
  if (!id) return
  try {
    await navigator.clipboard.writeText(id)
    pushToast('Company ID copied', 'success')
  } catch {
    pushToast('Could not copy ID', 'warning')
  }
}

const roleColor = (role) => {
  if (role === 'admin') return 'blue'
  if (role === 'manager') return 'amber'
  return 'slate'
}

const toTitle = (val) => (val ? val.charAt(0).toUpperCase() + val.slice(1) : '-')

const truncate = (val, len) => {
  if (!val) return ''
  return val.length > len ? `${val.slice(0, len)}...` : val
}

const StatusPill = ({ status }) => {
  const map = {
    active: { label: 'Active', cls: 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/25' },
    pending: { label: 'Pending', cls: 'bg-amber-500/15 text-amber-600 border border-amber-500/25' },
    archived: { label: 'Archived', cls: 'bg-rose-500/15 text-rose-600 border border-rose-500/25' }
  }
  const meta = map[status] || { label: status || 'Active', cls: 'bg-[var(--panel-strong)] text-[var(--text-secondary)] border border-[var(--card-border)]' }
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 text-xs rounded-full font-medium ${meta.cls}`}>
      <span className="inline-block w-2 h-2 rounded-full bg-current opacity-70" />
      {meta.label}
    </span>
  )
}

export default CompaniesPage
