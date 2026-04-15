import { verifyToken } from '../utils/token.js'
import { User, UserCompanyRole } from '../models/index.js'

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization
    if (!header) return res.status(401).json({ message: 'Missing authorization header' })
    const token = header.replace('Bearer ', '')
    const payload = verifyToken(token)
    const user = await User.findByPk(payload.sub)
    if (!user) return res.status(401).json({ message: 'Invalid token subject' })
    req.user = { id: user.id, email: user.email, name: user.name, role: payload.role }

    const companyId = req.headers['x-company-id'] || req.body.companyId || req.query.companyId || payload.companyId
    if (companyId) {
      const link = await UserCompanyRole.findOne({ where: { userId: user.id, companyId } })
      if (!link) return res.status(403).json({ message: 'No access to company' })
      req.companyContext = { companyId, role: link.role }
    }
    next()
  } catch (err) {
    err.status = 401
    next(err)
  }
}

export default auth
