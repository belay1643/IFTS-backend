import { Router } from 'express'
import authRoutes from './authRoutes.js'
import companyRoutes from './companyRoutes.js'
import investmentRoutes from './investmentRoutes.js'
import transactionRoutes from './transactionRoutes.js'
import approvalRoutes from './approvalRoutes.js'
import reportRoutes from './reportRoutes.js'
import dashboardRoutes from './dashboardRoutes.js'
import auditRoutes from './auditRoutes.js'
import notificationRoutes from './notificationRoutes.js'
import userRoutes from './userRoutes.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/companies', companyRoutes)
router.use('/investments', investmentRoutes)
router.use('/transactions', transactionRoutes)
router.use('/approvals', approvalRoutes)
router.use('/reports', reportRoutes)
router.use('/dashboard', dashboardRoutes)
router.use('/audit', auditRoutes)
router.use('/notifications', notificationRoutes)
router.use('/users', userRoutes)
router.get('/health', (req, res) => res.json({ status: 'ok' }))

export default router
