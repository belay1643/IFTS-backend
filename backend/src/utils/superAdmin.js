const DEFAULT_SUPER_ADMIN_EMAIL = 'belaynehgetachew272@gmail.com'
const EXTRA_ADMIN_EMAILS = ['belaynehgetachew11@gmail.com']

export const getSuperAdminEmail = () =>
  String(process.env.SUPER_ADMIN_EMAIL || DEFAULT_SUPER_ADMIN_EMAIL).trim().toLowerCase()

export const isSuperAdminEmail = (email) => {
  const normalized = String(email || '').trim().toLowerCase()
  return normalized === getSuperAdminEmail() || EXTRA_ADMIN_EMAILS.includes(normalized)
}
