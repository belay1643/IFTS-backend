import { Router } from 'express'
import auth from '../middleware/auth.js'
import validate from '../middleware/validate.js'
import { assetAllocation, dashboardValidators, growth, summary, transactions } from '../controllers/dashboardController.js'

const router = Router()

router.use(auth)
router.get('/summary', dashboardValidators, validate, summary)
router.get('/growth', dashboardValidators, validate, growth)
router.get('/assets', dashboardValidators, validate, assetAllocation)
router.get('/transactions', dashboardValidators, validate, transactions)

export default router
