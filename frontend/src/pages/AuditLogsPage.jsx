import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import api from '../utils/api.js'

dayjs.extend(relativeTime)

const PAGE_SIZE_OPTIONS = [12, 24, 48, 100]
const EXPORT_FORMATS = ['csv', 'pdf', 'json']
const CATEGORY_OPTIONS = ['all', 'approval', 'transaction', 'company', 'login', 'role', 'report', 'other']
const RESULT_OPTIONS = ['all', 'success', 'failure', 'pending']

const toTitle = (value) =>
  String(value || '')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())

const toEventId = (log) => {
  const stamp = dayjs(log.createdAt || new Date()).format('YYYYMMDD-HHmmss')
  const tail = String(log.id || '').replace(/-/g, '').slice(0, 8) || '00000000'
  return `EVT-${stamp}-${tail.toUpperCase()}`
}

const buildPresetKey = (user) => `ifts.audit.presets.${user?.id || user?.email || 'anonymous'}`

const loadPresets = (key) => {
  if (typeof localStorage === 'undefined') return []
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

const savePresets = (key, presets) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, JSON.stringify(presets.slice(0, 20)))
}

const sanitizeCsv = (value) => `"${String(value || '').replace(/"/g, '""')}"`

const formatDateTime = (value) => dayjs(value).format('MMM D, YYYY HH:mm:ss')
const formatRelative = (value) => dayjs(value).fromNow()

const normalizeActionLabel = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (raw.includes('update') || raw.includes('edit') || raw === 'updave') return 'UPDATE'
  if (raw.includes('insert') || raw.includes('create')) return 'INSERT'
  if (raw.includes('delete') || raw.includes('remove')) return 'DELETE'
  return raw ? toTitle(raw) : 'N/A'
}

const shortTechnicalId = (value) => {
  const text = String(value || '')
  if (!text) return 'N/A'
  if (text.length <= 14) return text
  return `${text.slice(0, 8)}...${text.slice(-4)}`
}

const resolveActor = (log) => ({
  id: log.User?.id || log.userId || 'system',
  email: log.User?.email || log.userId || 'system@ethiovest',
  name: log.User?.name || 'System User',
  role: log.User?.role || 'system'
})

const resolveCompany = (log) => ({
  id: log.Company?.id || log.companyId || 'global',
  name: log.Company?.name || 'N/A'
})

const parseJson = (value) => {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const extractRationale = (log) => {
  const next = parseJson(log.newValue) || {}
  const prev = parseJson(log.oldValue) || {}
  return next.rationale || next.description || prev.rationale || prev.description || 'No decision rationale recorded for this event.'
}

const actionChipClass = {
  approval: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  transaction: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  company: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  login: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  role: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300',
  report: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  other: 'bg-slate-500/15 text-slate-700 dark:text-slate-300'
}

const resultChipClass = {
  success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  failure: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
}

const actionTypeClass = {
  insert: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  update: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  delete: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  other: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30'
}

const getActionType = (value) => {
  const raw = String(value || '').toLowerCase()
  if (raw.includes('insert') || raw.includes('create')) return 'insert'
  if (raw.includes('update') || raw.includes('edit')) return 'update'
  if (raw.includes('delete') || raw.includes('remove')) return 'delete'
  return 'other'
}

const getTrend = (current, previous) => {
  if (!previous && !current) return { direction: 'flat', text: 'No activity' }
  if (!previous) return { direction: 'up', text: '+100% vs previous period' }
  const diff = current - previous
  const percent = Math.round((Math.abs(diff) / previous) * 100)
  if (diff > 0) return { direction: 'up', text: `+${percent}% vs previous period` }
  if (diff < 0) return { direction: 'down', text: `-${percent}% vs previous period` }
  return { direction: 'flat', text: '0% vs previous period' }
}

export default function AuditLogsPage() {
  const navigate = useNavigate()
  const { list: companies } = useSelector((state) => state.company)
  const { user } = useSelector((state) => state.auth)

  const presetKey = useMemo(() => buildPresetKey(user), [user])

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusMsg, setStatusMsg] = useState('')

  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [userFilter, setUserFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [resultFilter, setResultFilter] = useState('all')

  const [draftDateFrom, setDraftDateFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'))
  const [draftDateTo, setDraftDateTo] = useState(dayjs().format('YYYY-MM-DD'))
  const [dateFrom, setDateFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'))
  const [dateTo, setDateTo] = useState(dayjs().format('YYYY-MM-DD'))

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0])
  const [jumpPage, setJumpPage] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE_OPTIONS[0], total: 0, totalPages: 1, hasPrev: false, hasNext: false })
  const [selectedEventId, setSelectedEventId] = useState('')

  const [showColumnsMenu, setShowColumnsMenu] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState({ timestamp: true, user: true, action: true, target: true, status: true })
  const [exportFormat, setExportFormat] = useState('csv')
  const [exportOptions, setExportOptions] = useState({ fullDetails: true, ipAddress: true, deviceInfo: true, rationale: true, signatures: true })

  const [savedPresets, setSavedPresets] = useState([])
  const [presetName, setPresetName] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [timeRangeQuick, setTimeRangeQuick] = useState('month')
  const [showAllAudits, setShowAllAudits] = useState(false)

  useEffect(() => {
    setSavedPresets(loadPresets(presetKey))
  }, [presetKey])

  useEffect(() => {
    savePresets(presetKey, savedPresets)
  }, [presetKey, savedPresets])

  useEffect(() => {
    setPage(1)
  }, [search, companyFilter, userFilter, categoryFilter, resultFilter, dateFrom, dateTo, pageSize])

  useEffect(() => {
    let cancelled = false

    const fetchAuditLogs = async () => {
      setLoading(true)
      setError('')

      try {
        const params = {
          page,
          pageSize,
          dateFrom,
          dateTo,
          q: search.trim() || undefined,
          companyId: companyFilter === 'all' ? undefined : companyFilter,
          userId: userFilter === 'all' ? undefined : userFilter,
          category: categoryFilter === 'all' ? undefined : categoryFilter,
          result: resultFilter === 'all' ? undefined : resultFilter,
          verifySignatures: 'true'
        }

        const { data } = await api.get('/audit', { params })
        if (cancelled) return

        const records = Array.isArray(data?.data) ? data.data : []
        setItems(records)
        setPagination(data?.pagination || { page, pageSize, total: records.length, totalPages: 1, hasPrev: false, hasNext: false })
        setLastUpdatedAt(new Date().toISOString())
      } catch (requestError) {
        if (cancelled) return
        setItems([])
        setPagination({ page: 1, pageSize, total: 0, totalPages: 1, hasPrev: false, hasNext: false })
        setError(requestError.response?.data?.message || requestError.message || 'Failed to load audit logs')
        setLastUpdatedAt(new Date().toISOString())
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAuditLogs()

    return () => {
      cancelled = true
    }
  }, [page, pageSize, dateFrom, dateTo, search, companyFilter, userFilter, categoryFilter, resultFilter, refreshTick])

  const rows = useMemo(() => {
    const companyLookup = new Map((companies || []).map((company) => [String(company.id), company.name]))

    return items.map((log) => {
      const actor = resolveActor(log)
      const resolvedCompany = resolveCompany(log)
      const mappedCompanyName = companyLookup.get(String(resolvedCompany.id))
      const safeCompanyName = resolvedCompany.name && resolvedCompany.name !== 'Company' ? resolvedCompany.name : mappedCompanyName || 'N/A'
      const company = { ...resolvedCompany, name: safeCompanyName }
      const parsedNew = parseJson(log.newValue)
      const parsedOld = parseJson(log.oldValue)
      const target = log.recordId || parsedNew?.transactionId || parsedOld?.transactionId || parsedNew?.id || parsedOld?.id || 'N/A'
      const safeSessionId = log.metadata?.sessionId && log.metadata?.sessionId !== log.ipAddress ? log.metadata?.sessionId : 'N/A'
      const actionLabel = normalizeActionLabel(log.action)

      return {
        ...log,
        actor,
        company,
        target,
        sourceId: log.id || '',
        shortSourceId: shortTechnicalId(log.id),
        eventId: toEventId(log),
        shortEventId: shortTechnicalId(toEventId(log)),
        actionLabel,
        resultLabel: toTitle(log.result || 'success'),
        actionType: getActionType(log.action),
        rationale: extractRationale(log),
        safeSessionId
      }
    })
  }, [items, companies])

  useEffect(() => {
    const exists = rows.some((row) => row.eventId === selectedEventId)
    if (!exists) setSelectedEventId('')
  }, [rows, selectedEventId])

  const selected = rows.find((row) => row.eventId === selectedEventId) || null

  const userOptions = useMemo(() => {
    const map = new Map()
    rows.forEach((row) => {
      const key = row.actor.id
      if (!map.has(key)) map.set(key, { id: key, email: row.actor.email, count: 0 })
      map.get(key).count += 1
    })
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [rows])

  const stats = useMemo(() => {
    const sorted = [...rows].sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf())
    const splitAt = Math.ceil(sorted.length / 2)
    const currentPeriod = sorted.slice(0, splitAt)
    const previousPeriod = sorted.slice(splitAt)

    const countByCategory = (list, category) => list.filter((row) => row.category === category).length

    const approvalCurrent = countByCategory(currentPeriod, 'approval')
    const approvalPrevious = countByCategory(previousPeriod, 'approval')
    const loginCurrent = countByCategory(currentPeriod, 'login')
    const loginPrevious = countByCategory(previousPeriod, 'login')
    const reportCurrent = countByCategory(currentPeriod, 'report')
    const reportPrevious = countByCategory(previousPeriod, 'report')

    const approvals = rows.filter((row) => row.category === 'approval')
    const logins = rows.filter((row) => row.category === 'login')
    const reports = rows.filter((row) => row.category === 'report')

    return [
      {
        icon: '📜',
        title: 'Total Events',
        value: pagination.total.toLocaleString(),
        subtitle: `${pagination.pageSize} rows per request`,
        trend: getTrend(currentPeriod.length, previousPeriod.length),
        tone: 'from-slate-500/10 to-slate-500/0'
      },
      {
        icon: '✅',
        title: 'Approval Decisions',
        value: approvals.length.toLocaleString(),
        subtitle: `${approvals.filter((row) => row.result === 'success').length} success / ${approvals.filter((row) => row.result === 'failure').length} failure`,
        trend: getTrend(approvalCurrent, approvalPrevious),
        tone: 'from-emerald-500/12 to-emerald-500/0'
      },
      {
        icon: '🔐',
        title: 'Login Attempts',
        value: logins.length.toLocaleString(),
        subtitle: `${logins.filter((row) => row.result === 'success').length} success / ${logins.filter((row) => row.result === 'failure').length} failure`,
        trend: getTrend(loginCurrent, loginPrevious),
        tone: 'from-amber-500/12 to-amber-500/0'
      },
      {
        icon: '📊',
        title: 'Reports Generated',
        value: reports.length.toLocaleString(),
        subtitle: `${reports.filter((row) => dayjs(row.createdAt).isSame(dayjs(), 'month')).length} this month`,
        trend: getTrend(reportCurrent, reportPrevious),
        tone: 'from-sky-500/12 to-sky-500/0'
      }
    ]
  }, [pagination.total, pagination.pageSize, rows])

  const starterPresets = useMemo(
    () => [
      {
        id: 'starter-24h',
        name: 'Last 24 hours',
        filters: {
          search: '',
          companyFilter: 'all',
          userFilter: 'all',
          categoryFilter: 'all',
          resultFilter: 'all',
          dateFrom: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
          dateTo: dayjs().format('YYYY-MM-DD'),
          pageSize
        }
      },
      {
        id: 'starter-failures',
        name: 'Failed events',
        filters: {
          search: '',
          companyFilter: 'all',
          userFilter: 'all',
          categoryFilter: 'all',
          resultFilter: 'failure',
          dateFrom: dayjs().startOf('month').format('YYYY-MM-DD'),
          dateTo: dayjs().format('YYYY-MM-DD'),
          pageSize
        }
      },
      {
        id: 'starter-mine',
        name: 'My actions',
        filters: {
          search: '',
          companyFilter: 'all',
          userFilter: user?.id || user?.email || 'all',
          categoryFilter: 'all',
          resultFilter: 'all',
          dateFrom: dayjs().startOf('month').format('YYYY-MM-DD'),
          dateTo: dayjs().format('YYYY-MM-DD'),
          pageSize
        }
      }
    ],
    [pageSize, user]
  )

  const summaryText = `${pagination.total.toLocaleString()} events • ${dayjs(dateFrom).format('MMM D, YYYY')} to ${dayjs(dateTo).format('MMM D, YYYY')} • Server pagination enabled`
  const hasActiveFilters = search || companyFilter !== 'all' || userFilter !== 'all' || categoryFilter !== 'all' || resultFilter !== 'all' || dateFrom !== dayjs().startOf('month').format('YYYY-MM-DD') || dateTo !== dayjs().format('YYYY-MM-DD')

  const showingStart = pagination.total > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0
  const showingEnd = Math.min(pagination.total, pagination.page * pagination.pageSize)

  const toggleColumn = (column) => {
    setVisibleColumns((current) => ({ ...current, [column]: !current[column] }))
  }

  const applyDateRange = () => {
    if (dayjs(draftDateFrom).valueOf() > dayjs(draftDateTo).valueOf()) {
      setStatusMsg('Invalid date range. Start date must be before end date.')
      return
    }
    setDateFrom(draftDateFrom)
    setDateTo(draftDateTo)
    setTimeRangeQuick('custom')
    setStatusMsg('Date range applied.')
  }

  const resetFilters = () => {
    const from = dayjs().startOf('month').format('YYYY-MM-DD')
    const to = dayjs().format('YYYY-MM-DD')
    setSearch('')
    setCompanyFilter('all')
    setUserFilter('all')
    setCategoryFilter('all')
    setResultFilter('all')
    setDraftDateFrom(from)
    setDraftDateTo(to)
    setDateFrom(from)
    setDateTo(to)
    setPageSize(PAGE_SIZE_OPTIONS[0])
    setPage(1)
    setStatusMsg('Filters reset.')
  }

  const refresh = () => {
    setRefreshTick((value) => value + 1)
    setStatusMsg('Reloaded from server.')
  }

  const applyQuickFilter = (type) => {
    if (type === 'last24h') {
      const from = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
      const to = dayjs().format('YYYY-MM-DD')
      setDraftDateFrom(from)
      setDraftDateTo(to)
      setDateFrom(from)
      setDateTo(to)
      setTimeRangeQuick(type)
      setPage(1)
      setStatusMsg('Applied quick filter: Last 24 hours.')
      return
    }
    if (type === 'last7d') {
      const from = dayjs().subtract(7, 'day').format('YYYY-MM-DD')
      const to = dayjs().format('YYYY-MM-DD')
      setDraftDateFrom(from)
      setDraftDateTo(to)
      setDateFrom(from)
      setDateTo(to)
      setTimeRangeQuick(type)
      setPage(1)
      setStatusMsg('Applied quick filter: Last 7 days.')
      return
    }
    if (type === 'month') {
      const from = dayjs().startOf('month').format('YYYY-MM-DD')
      const to = dayjs().format('YYYY-MM-DD')
      setDraftDateFrom(from)
      setDraftDateTo(to)
      setDateFrom(from)
      setDateTo(to)
      setTimeRangeQuick(type)
      setPage(1)
      setStatusMsg('Applied quick filter: This month.')
      return
    }
    if (type === 'critical') {
      setResultFilter('failure')
      setCategoryFilter('approval')
      setTimeRangeQuick('month')
      setPage(1)
      setStatusMsg('Applied quick filter: Critical changes only.')
      return
    }
    setUserFilter(user?.id || user?.email || 'all')
    setTimeRangeQuick('month')
    setPage(1)
    setStatusMsg('Applied quick filter: My actions.')
  }

  const clearAllFilters = () => {
    const from = dayjs().startOf('month').format('YYYY-MM-DD')
    const to = dayjs().format('YYYY-MM-DD')
    setSearch('')
    setCompanyFilter('all')
    setUserFilter('all')
    setCategoryFilter('all')
    setResultFilter('all')
    setDraftDateFrom(from)
    setDraftDateTo(to)
    setDateFrom(from)
    setDateTo(to)
    setTimeRangeQuick('month')
    setPage(1)
    setStatusMsg('All filters cleared.')
  }

  const saveCurrentPreset = () => {
    const name = presetName.trim()
    if (!name) {
      setStatusMsg('Enter a preset name first.')
      return
    }

    const preset = {
      id: `${Date.now()}`,
      name,
      filters: {
        search,
        companyFilter,
        userFilter,
        categoryFilter,
        resultFilter,
        dateFrom,
        dateTo,
        pageSize
      }
    }

    setSavedPresets((current) => [preset, ...current.filter((item) => item.name.toLowerCase() !== name.toLowerCase())].slice(0, 20))
    setPresetName('')
    setStatusMsg(`Preset ${name} saved.`)
  }

  const applyPreset = (preset) => {
    const filters = preset.filters || {}
    setSearch(filters.search || '')
    setCompanyFilter(filters.companyFilter || 'all')
    setUserFilter(filters.userFilter || 'all')
    setCategoryFilter(filters.categoryFilter || 'all')
    setResultFilter(filters.resultFilter || 'all')
    setDateFrom(filters.dateFrom || dayjs().startOf('month').format('YYYY-MM-DD'))
    setDateTo(filters.dateTo || dayjs().format('YYYY-MM-DD'))
    setDraftDateFrom(filters.dateFrom || dayjs().startOf('month').format('YYYY-MM-DD'))
    setDraftDateTo(filters.dateTo || dayjs().format('YYYY-MM-DD'))
    setPageSize(Number(filters.pageSize || PAGE_SIZE_OPTIONS[0]))
    setPage(1)
    setStatusMsg(`● Preset ${preset.name} applied.`)
  }

  const deletePreset = (presetId) => {
    setSavedPresets((current) => current.filter((item) => item.id !== presetId))
    setStatusMsg('Preset removed.')
  }

  const toggleExportOption = (option) => {
    setExportOptions((current) => ({ ...current, [option]: !current[option] }))
  }

  const copyEventId = async (rowArg = null) => {
    const row = rowArg || selected
    if (!row) return
    try {
      await navigator.clipboard.writeText(row.eventId)
      setStatusMsg('Event ID copied.')
    } catch {
      setStatusMsg(row.eventId)
    }
  }

  const copyDetails = async (rowArg = null) => {
    const row = rowArg || selected
    if (!row) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(row, null, 2))
      setStatusMsg('Event details copied.')
    } catch {
      setStatusMsg('Unable to copy event details.')
    }
  }

  const goToTarget = (rowArg = null) => {
    const row = rowArg || selected
    if (!row || !row.target || row.target === 'N/A') {
      setStatusMsg('No linked transaction target for this event.')
      return
    }
    navigate(`/transactions?transactionId=${encodeURIComponent(row.target)}`)
  }

  const exportRowsData = (rowsToExport, fileLabel = 'audit-logs') => {
    if (!rowsToExport.length) {
      setStatusMsg('No rows to export.')
      return
    }

    const baseName = `${fileLabel}-${dayjs().format('YYYYMMDD-HHmmss')}`
    if (exportFormat === 'csv') {
      const header = ['Event ID', 'Timestamp', 'User Email', 'User Name', 'Company', 'Action', 'Category', 'Reference ID', 'Status']
      if (exportOptions.ipAddress) header.push('IP Address')
      if (exportOptions.fullDetails) header.push('Table Name', 'Record ID')
      if (exportOptions.deviceInfo) header.push('Device Info')
      if (exportOptions.rationale) header.push('Rationale')
      if (exportOptions.signatures) header.push('Event Hash', 'Signature', 'Previous Hash')

      const lines = [header.join(',')]
      rowsToExport.forEach((row) => {
        const cols = [
          sanitizeCsv(row.eventId),
          sanitizeCsv(formatDateTime(row.createdAt)),
          sanitizeCsv(row.actor.email),
          sanitizeCsv(row.actor.name),
          sanitizeCsv(row.company.name),
          sanitizeCsv(row.actionLabel),
          sanitizeCsv(toTitle(row.category || 'other')),
          sanitizeCsv(row.target),
          sanitizeCsv(row.resultLabel)
        ]

        if (exportOptions.ipAddress) cols.push(sanitizeCsv(row.ipAddress || ''))
        if (exportOptions.fullDetails) cols.push(sanitizeCsv(row.tableName || ''), sanitizeCsv(row.recordId || ''))
        if (exportOptions.deviceInfo) cols.push(sanitizeCsv(row.metadata?.userAgent || ''))
        if (exportOptions.rationale) cols.push(sanitizeCsv(row.rationale || ''))
        if (exportOptions.signatures) cols.push(sanitizeCsv(row.eventHash || ''), sanitizeCsv(row.signature || ''), sanitizeCsv(row.previousHash || ''))

        lines.push(cols.join(','))
      })

      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${baseName}.csv`
      link.click()
      URL.revokeObjectURL(url)
      setStatusMsg('CSV export generated.')
      return
    }

    if (exportFormat === 'json') {
      const payload = {
        generatedAt: new Date().toISOString(),
        pagination,
        filters: { search, companyFilter, userFilter, categoryFilter, resultFilter, dateFrom, dateTo },
        include: exportOptions,
        data: rowsToExport.map((row) => ({
          eventId: row.eventId,
          timestamp: row.createdAt,
          user: row.actor,
          company: row.company,
          action: row.actionLabel,
          category: row.category,
          target: row.target,
          status: row.result,
          ...(exportOptions.fullDetails ? { tableName: row.tableName || null, recordId: row.recordId || null } : {}),
          ...(exportOptions.ipAddress ? { ipAddress: row.ipAddress || null } : {}),
          ...(exportOptions.deviceInfo ? { deviceInfo: row.metadata?.userAgent || null } : {}),
          ...(exportOptions.rationale ? { rationale: row.rationale || null } : {}),
          ...(exportOptions.signatures ? { eventHash: row.eventHash || null, signature: row.signature || null, previousHash: row.previousHash || null } : {})
        }))
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${baseName}.json`
      link.click()
      URL.revokeObjectURL(url)
      setStatusMsg('JSON export generated.')
      return
    }

    window.print()
    setStatusMsg('PDF export opened via print dialog.')
  }

  const exportCurrentPage = () => {
    exportRowsData(rows, 'audit-logs')
  }

  const exportSingleAudit = (row) => {
    exportRowsData([row], `audit-${String(row?.eventId || 'event').toLowerCase()}`)
  }

  const scheduleExport = (rowArg = null) => {
    const row = rowArg || null
    if (typeof localStorage !== 'undefined') {
      const key = `${presetKey}.scheduled`
      const current = JSON.parse(localStorage.getItem(key) || '[]')
      current.unshift({
        createdAt: new Date().toISOString(),
        format: exportFormat,
        scope: row ? 'single' : 'current-page',
        eventId: row?.eventId || null,
        filters: { search, companyFilter, userFilter, categoryFilter, resultFilter, dateFrom, dateTo },
        include: exportOptions
      })
      localStorage.setItem(key, JSON.stringify(current.slice(0, 20)))
    }
    if (row) {
      setStatusMsg(`Scheduled ${exportFormat.toUpperCase()} export for ${row.eventId}.`)
      return
    }
    setStatusMsg(`Scheduled ${exportFormat.toUpperCase()} export for current filters.`)
  }

  const emailRegulator = (rowArg = null) => {
    const row = rowArg || null
    const subject = encodeURIComponent('Ethio Vest Audit Export Summary')
    const body = row
      ? encodeURIComponent(`Audit export ready.\nEvent: ${row.eventId}\nAction: ${row.actionLabel}\nReference: ${row.target}\nFormat: ${exportFormat.toUpperCase()}`)
      : encodeURIComponent(`Audit export ready.\nRange: ${dateFrom} to ${dateTo}\nEvents: ${pagination.total}\nFormat: ${exportFormat.toUpperCase()}`)
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
    setStatusMsg(row ? `Prepared regulator email draft for ${row.eventId}.` : 'Prepared regulator email draft.')
  }

  const handleJumpPage = () => {
    const value = Number(jumpPage)
    if (!Number.isFinite(value) || value < 1 || value > pagination.totalPages) {
      setStatusMsg('Enter a valid page number.')
      return
    }
    setPage(value)
    setJumpPage('')
  }

  const renderTimelineSkeleton = () => (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={`timeline-skel-${index}`} className="flex items-start gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--panel)] px-3 py-3 animate-pulse">
          <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--brand-primary)]/50" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/5 rounded-full bg-[var(--card-border)]/70" />
            <div className="h-3 w-4/5 rounded-full bg-[var(--card-border)]/55" />
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div
      className="space-y-5 text-[var(--text-primary)]"
      style={{
        '--audit-accent': '#f97316',
        '--audit-accent-2': '#14b8a6',
        '--audit-accent-soft': 'rgba(249, 115, 22, 0.12)',
        '--audit-accent-soft-2': 'rgba(20, 184, 166, 0.12)'
      }}
    >
      <div className="relative rounded-[28px] border border-[color:var(--audit-accent)]/20 bg-gradient-to-br from-[color:var(--audit-accent)]/10 via-[var(--panel)] to-[color:var(--audit-accent-2)]/8 p-4 shadow-[0_22px_60px_-38px_rgba(15,23,42,0.55)] sm:p-6">
        <div className="absolute inset-0 opacity-45" style={{ background: 'radial-gradient(circle at 16% 22%, var(--audit-accent-soft), transparent 34%), radial-gradient(circle at 84% 14%, var(--audit-accent-soft-2), transparent 28%), radial-gradient(circle at 58% 92%, rgba(99,102,241,0.08), transparent 26%)' }} />
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-[color:var(--audit-accent)] via-[color:var(--audit-accent-2)] to-transparent" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(290px,0.65fr)] lg:items-end">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[var(--muted-foreground)]">
              <span className="rounded-full border border-[color:var(--audit-accent)]/30 bg-[color:var(--audit-accent)]/10 px-3 py-1 text-[color:var(--audit-accent)]">Audit Console</span>
              <span>Compliance-grade timeline</span>
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.03em] text-[var(--text-primary)] sm:text-5xl">
              <span className="text-[color:var(--audit-accent)]">Audit</span> history built for clear review and confident compliance checks
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">{summaryText}</p>
            <div className="flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">
              <span className="rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1">Last refresh: {lastUpdatedAt ? formatRelative(lastUpdatedAt) : 'waiting for first fetch'}</span>
              <span className="rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1">Live event stream</span>
              <span className="rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1">Compliance review</span>
            </div>
          </div>
          <div className="relative rounded-[22px] border border-[var(--card-border)] bg-[var(--bg-card)]/80 p-4 shadow-[0_18px_38px_-24px_rgba(15,23,42,0.38)] backdrop-blur-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">Audit at a Glance</div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[var(--panel)] px-3 py-3">
                <div className="text-[11px] text-[var(--muted-foreground)]">Events</div>
                <div className="text-2xl font-semibold text-[var(--text-primary)]">{pagination.total.toLocaleString()}</div>
              </div>
              <div className="rounded-2xl bg-[var(--panel)] px-3 py-3">
                <div className="text-[11px] text-[var(--muted-foreground)]">Selected</div>
                <div className="text-2xl font-semibold text-[var(--text-primary)]">{selected ? '1' : '0'}</div>
              </div>
              <div className="rounded-2xl bg-[var(--panel)] px-3 py-3">
                <div className="text-[11px] text-[var(--muted-foreground)]">Preview</div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">{showAllAudits ? 'All audits' : 'Top items'}</div>
              </div>
              <div className="rounded-2xl bg-[var(--panel)] px-3 py-3">
                <div className="text-[11px] text-[var(--muted-foreground)]">Range</div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">{toTitle(timeRangeQuick)}</div>
              </div>
            </div>
          </div>
          <div className="relative flex flex-wrap items-start gap-2 lg:justify-end">
            <button type="button" onClick={refresh} className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-primary)] transition hover:bg-[var(--panel-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]">Refresh</button>
            <button type="button" title="Show or hide table columns" onClick={() => setShowColumnsMenu((value) => !value)} className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-primary)] transition hover:bg-[var(--panel-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]">Show/Hide Columns</button>
            {showColumnsMenu ? (
              <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-full rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] p-3 shadow-xl sm:left-auto sm:right-0 sm:w-[280px]">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Visible Columns</div>
                {Object.keys(visibleColumns).map((column) => (
                  <label key={column} className="mb-2 flex cursor-pointer items-center gap-2 text-sm text-[var(--text-primary)] last:mb-0">
                    <input type="checkbox" checked={visibleColumns[column]} onChange={() => toggleColumn(column)} />
                    {toTitle(column)}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4 shadow-[0_16px_42px_-34px_rgba(15,23,42,0.34)]">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Search Audit Events</div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search action, event id, reference id, user email, or target"
          className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--brand-primary)]"
        />
        <div className="mt-2 text-xs text-[var(--muted-foreground)]">Shortcut: Ctrl+K focuses search in most browsers.</div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.title} className={`rounded-[20px] border border-[var(--card-border)] bg-gradient-to-br ${stat.tone} bg-[var(--bg-card)] p-4 shadow-[0_16px_42px_-34px_rgba(15,23,42,0.34)]`}>
            <div className="text-2xl">{stat.icon}</div>
            <div className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{stat.title}</div>
            <div className="mt-1 text-3xl font-semibold text-[var(--text-primary)]">{stat.value}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--muted-foreground)]">{stat.subtitle}</span>
              <TrendPill trend={stat.trend} />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4 shadow-[0_16px_42px_-34px_rgba(15,23,42,0.34)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Quick Filters</div>
            <div className="text-sm text-[var(--muted-foreground)]">Use preset ranges or refine with dropdown filters.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => applyQuickFilter('last24h')} className="rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--panel-strong)]">24h</button>
            <button type="button" onClick={() => applyQuickFilter('last7d')} className="rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--panel-strong)]">7d</button>
            <button type="button" onClick={() => applyQuickFilter('month')} className="rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--panel-strong)]">Month</button>
            <button type="button" onClick={() => applyQuickFilter('critical')} className="rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--panel-strong)]">Critical</button>
            <button type="button" onClick={() => applyQuickFilter('mine')} className="rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--panel-strong)]">Mine</button>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--panel)] p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1 text-sm text-[var(--muted-foreground)]">
              <div>Company</div>
              <select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)} className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)]">
                <option value="all">All companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-[var(--muted-foreground)]">
              <div>User</div>
              <select value={userFilter} onChange={(event) => setUserFilter(event.target.value)} className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)]">
                <option value="all">All users</option>
                {userOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.email} ({item.count})</option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-[var(--muted-foreground)]">
              <div>Action</div>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)]">
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{toTitle(option)}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-[var(--muted-foreground)]">
              <div>Status</div>
              <select value={resultFilter} onChange={(event) => setResultFilter(event.target.value)} className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)]">
                {RESULT_OPTIONS.map((option) => (
                  <option key={option} value={option}>{toTitle(option)}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {hasActiveFilters ? (
              <button type="button" onClick={clearAllFilters} className="rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--panel-strong)]">Clear all filters</button>
            ) : null}
            <button type="button" onClick={() => setShowAdvancedFilters((value) => !value)} className="rounded-lg border border-[var(--brand-primary)]/30 bg-[var(--brand-primary)]/10 px-3 py-2 text-xs text-[var(--brand-primary)]">
              {showAdvancedFilters ? 'Hide preset manager' : 'Show preset manager'}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--card-border)] bg-[var(--panel)] p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Date Range</div>
            <div className="text-[11px] text-[var(--muted-foreground)]">Quick range: {toTitle(timeRangeQuick)}</div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1 text-sm text-[var(--muted-foreground)]">
              <div>From</div>
              <input type="date" value={draftDateFrom} onChange={(event) => setDraftDateFrom(event.target.value)} className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)]" />
            </label>
            <label className="space-y-1 text-sm text-[var(--muted-foreground)]">
              <div>To</div>
              <input type="date" value={draftDateTo} onChange={(event) => setDraftDateTo(event.target.value)} className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)]" />
            </label>
            <button type="button" onClick={applyDateRange} className="self-end rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-sm text-white">Apply</button>
            <button type="button" onClick={resetFilters} className="self-end rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--panel-strong)]">Reset</button>
          </div>
        </div>

        <details className="mt-4 rounded-xl border border-[var(--card-border)] bg-[var(--panel)] p-4" open={showAdvancedFilters}>
          <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Saved Filter Presets</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            <input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Preset name" className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]" />
            <button type="button" onClick={saveCurrentPreset} className="rounded-xl bg-[var(--brand-primary)] px-3 py-2 text-sm text-white">Save Preset</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(savedPresets.length ? savedPresets : starterPresets).map((preset) => (
              <div key={preset.id} className="flex items-center gap-1 rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)]">
                <button type="button" onClick={() => applyPreset(preset)} className="px-2 py-0.5">{preset.name}</button>
                {savedPresets.some((item) => item.id === preset.id) ? (
                  <button type="button" onClick={() => deletePreset(preset.id)} className="px-2 py-0.5 text-rose-600 dark:text-rose-300">x</button>
                ) : null}
              </div>
            ))}
          </div>
        </details>
      </div>

      <div className="rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] p-4 shadow-[0_16px_42px_-34px_rgba(15,23,42,0.34)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Editorial Audit Cards</div>
            <div className="text-sm text-[var(--muted-foreground)]">A preview of the latest audits. Open the full list only when needed.</div>
          </div>
          <button type="button" onClick={() => setShowAllAudits((value) => !value)} className="rounded-full border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--panel-strong)]">
            {showAllAudits ? 'Show fewer' : 'View all audits'}
          </button>
        </div>

        {loading && !rows.length ? renderTimelineSkeleton() : (
          <div className="grid gap-3">
            {(showAllAudits ? rows : rows.slice(0, 5)).map((row) => (
              <div key={`audit-card-${row.eventId}`} className={`group rounded-[18px] border border-[var(--card-border)] bg-[var(--panel)] p-4 text-left transition hover:-translate-y-0.5 hover:border-[color:var(--audit-accent)]/30 hover:bg-[var(--panel-strong)] ${selectedEventId === row.eventId ? 'border-[color:var(--audit-accent)]/45 shadow-[0_16px_34px_-22px_rgba(249,115,22,0.35)]' : 'shadow-[0_12px_26px_-24px_rgba(15,23,42,0.22)]'}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[color:var(--audit-accent)]/25 bg-[color:var(--audit-accent)]/10 px-2.5 py-1 text-[11px] font-semibold text-[color:var(--audit-accent)]">{row.actionLabel}</span>
                      <StatusBadge status={row.result} label={row.resultLabel} />
                      <span className="text-xs text-[var(--muted-foreground)]">{formatDateTime(row.createdAt)}</span>
                    </div>
                    <div className="mt-2 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">User</div>
                        <div className="mt-1 font-medium text-[var(--text-primary)]">{row.actor.email}</div>
                        <div className="text-xs text-[var(--muted-foreground)]">{row.company.name}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Reference</div>
                        <div className="mt-1 font-mono text-sm text-[var(--text-primary)]">{shortTechnicalId(row.target)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Action Type</div>
                        <div className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${actionTypeClass[row.actionType] || actionTypeClass.other}`}>{row.actionType.toUpperCase()}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Time Ago</div>
                        <div className="mt-1 text-sm text-[var(--text-primary)]">{formatRelative(row.createdAt)}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-[var(--muted-foreground)]">{toTitle(row.tableName || 'Audit record')} • {row.recordId || 'No record ID'}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setSelectedEventId((value) => (value === row.eventId ? '' : row.eventId))} className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--panel-strong)]">
                      {selectedEventId === row.eventId ? 'Hide details' : 'Show details'}
                    </button>
                  </div>
                </div>

                {selectedEventId === row.eventId ? (
                  <div className="mt-4 rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] p-4">
                    <div className="grid gap-3 lg:grid-cols-2">
                      <DetailSection title="Event Summary">
                        <DetailField label="Event ID" value={row.shortEventId} mono />
                        <DetailField label="Timestamp" value={`${formatDateTime(row.createdAt)} (${formatRelative(row.createdAt)})`} />
                        <DetailField label="User" value={`${row.actor.name} (${row.actor.email})`} />
                        <DetailField label="Company" value={row.company.name} />
                      </DetailSection>

                      <DetailSection title="Change Summary">
                        <DetailField label="Action" value={row.actionLabel} />
                        <DetailField label="Reference" value={row.target} mono />
                        <DetailField label="Status" value={row.resultLabel} />
                        <DetailField label="Table" value={row.tableName || 'N/A'} />
                      </DetailSection>

                      <details className="rounded-xl border border-[var(--card-border)] bg-[var(--panel)] p-3 lg:col-span-2">
                        <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Review notes</summary>
                        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          <DetailField label="Rationale" value={row.rationale} />
                          <DetailField label="Device" value={row.metadata?.userAgent || 'Unknown device'} />
                          <DetailField label="IP Address" value={row.ipAddress || 'Unknown'} mono />
                          <DetailField label="Session ID" value={row.safeSessionId} mono />
                        </div>
                      </details>

                      <details className="rounded-xl border border-[var(--card-border)] bg-[var(--panel)] p-3 lg:col-span-2">
                        <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Technical trace</summary>
                        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          <DetailField label="Signature" value={row.signature || 'N/A'} mono />
                          <DetailField label="Hash" value={row.eventHash || 'N/A'} mono />
                          <DetailField label="Previous Hash" value={row.previousHash || 'N/A'} mono />
                        </div>
                      </details>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--card-border)] pt-4">
                      <button type="button" onClick={() => goToTarget(row)} title="Open this record in Transactions" className="rounded-xl bg-gradient-to-r from-[var(--brand-primary)] to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_34px_-18px_rgba(59,130,246,0.58)]">View transaction</button>
                      <button type="button" onClick={() => copyEventId(row)} className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--panel-strong)]">Copy event ID</button>
                      <button type="button" onClick={() => copyDetails(row)} className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--panel-strong)]">Copy details</button>
                    </div>

                    <div className="mt-3 rounded-xl border border-[var(--card-border)] bg-[var(--panel)] p-3">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Export this audit</div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => exportSingleAudit(row)} className="rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-sm text-white">Export now</button>
                        <button type="button" onClick={() => scheduleExport(row)} className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--panel-strong)]">Schedule export</button>
                        <button type="button" onClick={() => emailRegulator(row)} className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--panel-strong)]">Email regulator</button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
            {!rows.length ? <div className="rounded-xl border border-dashed border-[var(--card-border)] p-6 text-sm text-[var(--muted-foreground)]">No audit records found for current filters.</div> : null}
          </div>
        )}
      </div>

      <div className="hidden rounded-[20px] border border-[var(--card-border)] bg-[var(--bg-card)] shadow-[0_16px_42px_-34px_rgba(15,23,42,0.34)] lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--card-border)] bg-[var(--panel)]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">#</th>
                {visibleColumns.timestamp ? <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Timestamp</th> : null}
                {visibleColumns.user ? <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">User</th> : null}
                {visibleColumns.action ? <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Action</th> : null}
                {visibleColumns.target ? <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Target</th> : null}
                {visibleColumns.status ? <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Status</th> : null}
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <Fragment key={row.eventId}>
                  <tr className={`border-b border-[var(--card-border)] transition ${selectedEventId === row.eventId ? 'bg-[var(--brand-primary)]/8' : ''}`}>
                    <td className="px-4 py-3 text-sm text-[var(--muted-foreground)]">{(pagination.page - 1) * pagination.pageSize + index + 1}</td>
                    {visibleColumns.timestamp ? (
                      <td className="px-4 py-3 text-sm">
                        <div className="font-mono text-[var(--text-primary)]">{formatDateTime(row.createdAt)}</div>
                        <div className="text-xs text-[var(--muted-foreground)]">{formatRelative(row.createdAt)}</div>
                      </td>
                    ) : null}
                    {visibleColumns.user ? (
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-[var(--text-primary)]">{row.actor.email}</div>
                        <div className="text-xs text-[var(--muted-foreground)]">{row.actor.name}</div>
                        <div className="mt-1 inline-flex rounded-full bg-[var(--panel)] px-2 py-0.5 text-[11px] text-[var(--muted-foreground)]">{row.company.name}</div>
                      </td>
                    ) : null}
                    {visibleColumns.action ? (
                      <td className="px-4 py-3 text-sm">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${actionTypeClass[row.actionType] || actionTypeClass.other}`}>{row.actionType.toUpperCase()}</span>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${actionChipClass[row.category] || actionChipClass.other}`}>{toTitle(row.category || 'other')}</span>
                        </div>
                        <div className="text-xs font-medium text-[var(--text-primary)]">{row.actionLabel}</div>
                        <div className="mt-1 text-xs text-[var(--muted-foreground)]">{toTitle(row.tableName || 'Unknown table')}</div>
                      </td>
                    ) : null}
                    {visibleColumns.target ? (
                      <td className="px-4 py-3 text-sm">
                        <div className="inline-flex rounded-lg border border-[var(--card-border)] bg-[var(--panel)] px-2 py-1 font-mono text-[var(--text-primary)]">{shortTechnicalId(row.target)}</div>
                        <div className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">{row.recordId || 'No record ID'}</div>
                      </td>
                    ) : null}
                    {visibleColumns.status ? (
                      <td className="px-4 py-3 text-sm">
                        <StatusBadge status={row.result} label={row.resultLabel} />
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-sm">
                      <button
                        type="button"
                        onClick={() => setSelectedEventId((value) => (value === row.eventId ? '' : row.eventId))}
                        className="rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] transition hover:bg-[var(--panel-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
                      >
                        {selectedEventId === row.eventId ? 'Hide details' : 'Show details'}
                      </button>
                    </td>
                  </tr>

                  {selectedEventId === row.eventId ? (
                    <tr>
                      <td colSpan={6} className="px-4 pb-4">
                        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--panel)] p-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <DetailSection title="Event Summary">
                              <DetailField label="Event ID" value={row.shortEventId} mono />
                              <DetailField label="Timestamp" value={`${formatDateTime(row.createdAt)} (${formatRelative(row.createdAt)})`} />
                              <DetailField label="User" value={`${row.actor.name} (${row.actor.email})`} />
                              <DetailField label="Company" value={row.company.name} />
                            </DetailSection>

                            <DetailSection title="Change Summary">
                              <DetailField label="Action" value={row.actionLabel} />
                              <DetailField label="Reference" value={row.target} mono />
                              <DetailField label="Status" value={row.resultLabel} />
                              <DetailField label="Table" value={row.tableName || 'N/A'} />
                            </DetailSection>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--card-border)] pt-3">
                            <button type="button" onClick={() => goToTarget(row)} className="rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-xs text-white">View transaction</button>
                            <button type="button" onClick={() => copyEventId(row)} className="rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-primary)]">Copy event ID</button>
                            <button type="button" onClick={() => exportSingleAudit(row)} className="rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-primary)]">Export now</button>
                            <button type="button" onClick={() => scheduleExport(row)} className="rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-primary)]">Schedule export</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
                    <div>No audit records found for current filters.</div>
                    <div className="mt-1 text-xs">Try setting Company to All and widening the date range.</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--card-border)] px-4 py-4 text-sm text-[var(--muted-foreground)] sm:flex-row sm:items-center sm:justify-between">
          <div>Showing {showingStart}-{showingEnd} of {pagination.total.toLocaleString()} events</div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={!pagination.hasPrev} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] disabled:opacity-50">Prev</button>
            <span className="text-xs">Page {pagination.page} of {pagination.totalPages}</span>
            <button type="button" disabled={!pagination.hasNext} onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))} className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] disabled:opacity-50">Next</button>
            <label className="flex items-center gap-2 text-xs">
              Rows
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] px-2 py-1 text-[var(--text-primary)]">
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2 text-xs">
              Jump to
              <input value={jumpPage} onChange={(event) => setJumpPage(event.target.value)} className="w-16 rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] px-2 py-1 text-[var(--text-primary)]" />
              <button type="button" onClick={handleJumpPage} className="rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] px-2 py-1 text-[var(--text-primary)]">Go</button>
            </div>
          </div>
        </div>
      </div>

      <details className="relative overflow-hidden rounded-[22px] border border-[color:var(--audit-accent)]/25 bg-gradient-to-br from-[color:var(--audit-accent)]/10 via-[var(--bg-card)] to-[color:var(--audit-accent-2)]/8 p-4 shadow-[0_24px_50px_-34px_rgba(15,23,42,0.45)] sm:p-5">
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Export Center</div>
              <div className="text-sm text-[var(--text-primary)]">Create compliance-ready exports with structured fields.</div>
            </div>
            <span className="rounded-full border border-[color:var(--audit-accent)]/30 bg-[color:var(--audit-accent)]/12 px-3 py-1 text-[11px] font-semibold text-[color:var(--audit-accent)]">{exportFormat.toUpperCase()} selected</span>
          </div>
        </summary>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--panel)] p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Format</div>
            <div className="flex flex-wrap gap-2">
              {EXPORT_FORMATS.map((format) => (
                <button key={format} type="button" onClick={() => setExportFormat(format)} className={`rounded-xl px-4 py-2 text-sm ${exportFormat === format ? 'bg-[var(--brand-primary)] text-white shadow-[0_12px_28px_-18px_rgba(59,130,246,0.6)]' : 'border border-[var(--card-border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--panel-strong)]'}`}>
                  {format === 'csv' ? 'CSV' : format === 'pdf' ? 'PDF' : 'JSON'}
                </button>
              ))}
            </div>

            <div className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Included fields</div>
            <div className="mt-2 grid gap-2 text-sm text-[var(--text-primary)] md:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2"><input type="checkbox" checked={exportOptions.fullDetails} onChange={() => toggleExportOption('fullDetails')} />Table and record IDs</label>
              <label className="flex items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2"><input type="checkbox" checked={exportOptions.ipAddress} onChange={() => toggleExportOption('ipAddress')} />IP addresses</label>
              <label className="flex items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2"><input type="checkbox" checked={exportOptions.deviceInfo} onChange={() => toggleExportOption('deviceInfo')} />Device information</label>
              <label className="flex items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2"><input type="checkbox" checked={exportOptions.rationale} onChange={() => toggleExportOption('rationale')} />Rationale notes</label>
              <label className="flex items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2 md:col-span-2"><input type="checkbox" checked={exportOptions.signatures} onChange={() => toggleExportOption('signatures')} />Hash and signature data</label>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--panel)] p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Actions</div>
            <div className="space-y-2">
              <button type="button" onClick={exportCurrentPage} className="w-full rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-sm text-white shadow-[0_14px_32px_-18px_rgba(59,130,246,0.55)]">Export current page</button>
              <button type="button" onClick={scheduleExport} className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--panel-strong)]">Schedule export</button>
              <button type="button" onClick={emailRegulator} className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--panel-strong)]">Email regulator</button>
            </div>
            <div className="mt-3 rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--muted-foreground)]">Exports follow active filters, selected range, and visible result scope.</div>
          </div>
        </div>
      </details>

      {(statusMsg || error || loading) ? (
        <div className="rounded-[16px] border border-[var(--card-border)] bg-[var(--bg-card)] px-4 py-3 text-sm">
          {loading ? <div className="text-[var(--muted-foreground)]">Loading audit events...</div> : null}
          {statusMsg ? <div className="text-emerald-700 dark:text-emerald-300">{statusMsg}</div> : null}
          {error ? <div className="text-rose-700 dark:text-rose-300">{error}</div> : null}
        </div>
      ) : null}
    </div>
  )
}

const FilterChipRow = ({ label, items, activeKey, onChange }) => (
  <div className="mb-3">
    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</div>
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button key={item.key} type="button" onClick={() => onChange(item.key)} className={`rounded-full border px-3 py-1.5 text-xs transition ${activeKey === item.key ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/12 text-[var(--brand-primary)]' : 'border-[var(--card-border)] bg-[var(--bg-card)] text-[var(--muted-foreground)] hover:text-[var(--text-primary)]'}`}>
          {item.label} <span className="opacity-70">({item.count})</span>
        </button>
      ))}
    </div>
  </div>
)

const TrendPill = ({ trend }) => {
  const styles = {
    up: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    down: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    flat: 'bg-slate-500/15 text-slate-700 dark:text-slate-300'
  }
  const symbols = { up: '↑', down: '↓', flat: '→' }
  const direction = trend?.direction || 'flat'
  if (direction === 'flat') return null
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[direction]}`}>{symbols[direction]} {trend?.text || 'No change'}</span>
}

const StatusBadge = ({ status, label }) => {
  const iconByStatus = {
    success: '✔',
    failure: '✕',
    pending: '◷'
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${resultChipClass[status] || resultChipClass.success}`}>
      <span>{iconByStatus[status] || '•'}</span>
      <span>{label}</span>
    </span>
  )
}

const DetailSection = ({ title, children }) => (
  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--panel)] p-3">
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{title}</div>
    <div className="grid gap-2">{children}</div>
  </div>
)

const DetailField = ({ label, value, mono }) => (
  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--panel)] p-3">
    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</div>
    <div className={`mt-1 text-sm text-[var(--text-primary)] ${mono ? 'font-mono break-all' : ''}`}>{value}</div>
  </div>
)
