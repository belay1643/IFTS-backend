import { isSuperAdminEmail } from '../utils/superAdmin.js'

const requireRole = (roles = []) => {
  const allowed = Array.isArray(roles) ? roles : [roles]
  return async (req, res, next) => {
    // Super admin always passes role checks
    if (isSuperAdminEmail(req.user?.email)) return next()

    const ctx = req.companyContext
    if (!ctx) return res.status(400).json({ message: 'Company context required' })

    if (allowed.length === 0 || allowed.includes(ctx.role)) return next()
    return res.status(403).json({ message: 'Insufficient role' })
  }
}

export default requireRole
