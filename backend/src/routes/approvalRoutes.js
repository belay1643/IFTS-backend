import { Router } from 'express'
import auth from '../middleware/auth.js'
import companyGuard from '../middleware/companyGuard.js'
import requireRole from '../middleware/role.js'
import validate from '../middleware/validate.js'
import audit from '../middleware/audit.js'
import { decide, decisionValidators, listApprovals } from '../controllers/approvalController.js'

const router = Router()

router.use(auth, companyGuard)
router.get('/', requireRole(['admin', 'manager']), listApprovals)
router.post('/:transactionId/decision', requireRole(['admin', 'manager']), decisionValidators, validate, audit('UPDATE', 'approvals'), decide)

export default router
