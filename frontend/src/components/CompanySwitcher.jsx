import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setActiveCompany } from '../store/slices/companySlice.js'
import { fetchSummary, setDashboardMode } from '../store/slices/dashboardSlice.js'

const CompanySwitcher = () => {
  const dispatch = useDispatch()
  const { list, active } = useSelector((s) => s.company)
  const activeCompany = list.find((c) => c.id === active)

  useEffect(() => {
    if (!active && list.length) {
      const firstId = list[0].id
      dispatch(setActiveCompany(firstId))
      dispatch(fetchSummary({ mode: 'single', companyIds: [firstId] }))
    }
  }, [active, list, dispatch])

  const handleChange = (companyId) => {
    dispatch(setDashboardMode('single'))
    dispatch(setActiveCompany(companyId))
    if (companyId) dispatch(fetchSummary({ mode: 'single', companyIds: [companyId] }))
  }

  const hasCompanies = list.length > 0

  return (
    <div className="flex items-center gap-2">
      <select
        className="h-9 min-w-[170px] rounded-md border border-[color:var(--panel-border)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[color:var(--text-primary)] outline-none [color-scheme:light] focus:outline-none dark:[color-scheme:dark]"
        value={active || ''}
        onChange={(e) => handleChange(e.target.value)}
        disabled={!hasCompanies}
      >
        {!hasCompanies && <option value="">No companies</option>}
        {list.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {activeCompany && (
        <span className="px-2 py-1 text-[11px] rounded-md bg-[var(--bg-hover)] text-[color:var(--text-secondary)] border border-[color:var(--panel-border)] capitalize">
          {activeCompany.role || 'member'}
        </span>
      )}
    </div>
  )
}

export default CompanySwitcher
