import { Router } from 'express'
import auth from '../middleware/auth.js'
import companyGuard from '../middleware/companyGuard.js'
import requireRole from '../middleware/role.js'
import validate from '../middleware/validate.js'
import audit from '../middleware/audit.js'
import {
	createTransaction,
	createTransactionValidators,
	listTransactions,
	updateTransaction,
	updateTransactionValidators,
	listTransactionsValidators,
	transactionMetrics,
	metricsValidators
} from '../controllers/transactionController.js'

const router = Router()

router.use(auth)
router.get('/', listTransactionsValidators, validate, listTransactions)
router.get('/metrics', metricsValidators, validate, transactionMetrics)
router.post('/', companyGuard, requireRole(['admin', 'manager']), createTransactionValidators, validate, audit('INSERT', 'transactions'), createTransaction)
router.put('/:id', companyGuard, requireRole(['admin', 'manager']), updateTransactionValidators, validate, audit('UPDATE', 'transactions'), updateTransaction)

export default router
