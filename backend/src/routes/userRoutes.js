import { Router } from 'express'
import auth from '../middleware/auth.js'
import companyGuard from '../middleware/companyGuard.js'
import requireRole from '../middleware/role.js'
import validate from '../middleware/validate.js'
import {
  assignRole,
  assignRoleValidators,
  inviteUser,
  inviteUserValidators,
  listUsers,
  listUsersValidators
} from '../controllers/userController.js'

const router = Router()

router.use(auth)
router.use(companyGuard)

router.get('/', requireRole(['admin', 'manager']), listUsersValidators, validate, listUsers)
router.post('/invite', requireRole(['admin']), inviteUserValidators, validate, inviteUser)
router.post('/assign-role', requireRole(['admin']), assignRoleValidators, validate, assignRole)

export default router
