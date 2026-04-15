import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import {
	login,
	loginValidators,
	refresh,
	register,
	registerValidators,
	forgotPassword,
	forgotValidators,
	resetPassword,
	resetValidators,
	verifyEmail,
	verifyValidators
} from '../controllers/authController.js'
import validate from '../middleware/validate.js'

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 })
const forgotLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 3 })
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 })
const refreshLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60 })

const router = Router()

router.post('/register', registerLimiter, registerValidators, validate, register)
router.post('/login', loginLimiter, loginValidators, validate, login)
router.post('/refresh', refreshLimiter, refresh)
router.post('/forgot', forgotLimiter, forgotValidators, validate, forgotPassword)
router.post('/reset', resetValidators, validate, resetPassword)
router.get('/verify', verifyValidators, validate, verifyEmail)

export default router
