import { UserCompanyRole } from '../models/index.js'
import { isSuperAdminEmail } from '../utils/superAdmin.js'

// Requires company context and validates membership
const companyGuard = async (req, res, next) => {
  try {
    const companyId = req.headers['x-company-id'] || req.body.companyId || req.query.companyId || req.params.companyId
    if (!companyId) return res.status(400).json({ message: 'Company context required' })
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })

    // Super admin bypasses membership check
    if (isSuperAdminEmail(req.user.email)) {
      req.companyContext = { companyId, role: 'admin' }
      return next()
    }

    const membership = await UserCompanyRole.findOne({ where: { userId: req.user.id, companyId } })
    if (!membership) return res.status(403).json({ message: 'No access to company' })

    req.companyContext = { companyId, role: membership.role }
    return next()
  } catch (err) {
    err.status = 401
    return next(err)
  }
}

export default companyGuard
