import { Router } from 'express'
import auth from '../middleware/auth.js'
import requireRole from '../middleware/role.js'
import validate from '../middleware/validate.js'
import { auditValidators, listAuditLogs, verifyAuditChain, verifyChainValidators } from '../controllers/auditController.js'

const router = Router()

router.use(auth)
router.get('/verify-chain', requireRole(['admin']), verifyChainValidators, validate, verifyAuditChain)
router.get('/', requireRole(['admin']), auditValidators, validate, listAuditLogs)

export default router
