import { Router } from 'express'
import auth from '../middleware/auth.js'
import requireRole from '../middleware/role.js'
import validate from '../middleware/validate.js'
import {
	createCompany,
	createCompanyValidators,
	listCompanies,
	updateCompany,
	updateCompanyValidators,
	listCompanyValidators
} from '../controllers/companyController.js'
import audit from '../middleware/audit.js'

const router = Router()

router.use(auth)
router.get('/', listCompanyValidators, validate, listCompanies)
router.post('/', createCompanyValidators, validate, audit('INSERT', 'companies'), createCompany)
router.put('/:id', updateCompanyValidators, validate, audit('UPDATE', 'companies'), updateCompany)

export default router
