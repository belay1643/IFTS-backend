const SETTINGS_STORAGE_PREFIX = 'ifts.settings.'

const safeParse = (value, fallback = null) => {
  try {
    const parsed = JSON.parse(value)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

const parseReportingPreferences = (rawValue) => {
  if (!rawValue) return null
  if (typeof rawValue === 'object') return rawValue
  if (typeof rawValue === 'string') return safeParse(rawValue, null)
  return null
}

const loadLocalCompanySettings = (companyId) => {
  if (!companyId || typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(`${SETTINGS_STORAGE_PREFIX}${companyId}`)
  if (!raw) return null
  return safeParse(raw, null)
}

export const loadCompanySettings = (companyId, reportingPreferences) => {
  const local = loadLocalCompanySettings(companyId)
  if (local && typeof local === 'object') return local
  const remote = parseReportingPreferences(reportingPreferences)
  if (remote && typeof remote === 'object') return remote
  return null
}

export const loadCompanySystemSettings = (companyId, reportingPreferences) => {
  const settings = loadCompanySettings(companyId, reportingPreferences)
  return settings?.system || null
}

export const loadCompanyNotificationSettings = (companyId, reportingPreferences) => {
  const settings = loadCompanySettings(companyId, reportingPreferences)
  return {
    approvals: settings?.notifications?.approvals !== false,
    maturity: settings?.notifications?.maturity !== false,
    system: settings?.notifications?.system !== false
  }
}

export const loadCompanyProfileSettings = (companyId, reportingPreferences) => {
  const settings = loadCompanySettings(companyId, reportingPreferences)
  return settings?.profile || null
}
