const DEFAULT_SUPER_ADMIN_EMAIL = 'belaynehgetachew272@gmail.com'

export const getSuperAdminEmail = () =>
  String(process.env.SUPER_ADMIN_EMAIL || DEFAULT_SUPER_ADMIN_EMAIL)
    .trim()
    .toLowerCase()

export const isSuperAdminEmail = (email) =>
  String(email || '')
    .trim()
    .toLowerCase() === getSuperAdminEmail()
