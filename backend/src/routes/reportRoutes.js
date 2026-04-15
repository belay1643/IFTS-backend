import { Router } from 'express'
import auth from '../middleware/auth.js'
import validate from '../middleware/validate.js'
import { reportValidators, summary } from '../controllers/reportController.js'

const router = Router()

router.use(auth)
router.get('/summary', reportValidators, validate, summary)

export default router
