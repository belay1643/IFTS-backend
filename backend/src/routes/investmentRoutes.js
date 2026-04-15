import { Router } from 'express'
import auth from '../middleware/auth.js'
import companyGuard from '../middleware/companyGuard.js'
import validate from '../middleware/validate.js'
import requireRole from '../middleware/role.js'
import audit from '../middleware/audit.js'
import {
	createInvestment,
	createInvestmentValidators,
	listInvestments,
	updateInvestment,
	updateInvestmentValidators,
	listInvestmentsValidators,
	investmentMetrics,
	metricsValidators,
	deleteInvestment,
	deleteInvestmentValidators
} from '../controllers/investmentController.js'

const router = Router()

router.use(auth, companyGuard)
router.get('/', listInvestmentsValidators, validate, listInvestments)
router.get('/metrics', metricsValidators, validate, investmentMetrics)
router.post('/', requireRole(['admin', 'manager']), createInvestmentValidators, validate, audit('INSERT', 'investments'), createInvestment)
router.put('/:id', requireRole(['admin', 'manager']), updateInvestmentValidators, validate, audit('UPDATE', 'investments'), updateInvestment)
router.delete('/:id', requireRole(['admin', 'manager']), deleteInvestmentValidators, validate, audit('DELETE', 'investments'), deleteInvestment)

export default router
