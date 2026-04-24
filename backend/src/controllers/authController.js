import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { body, query } from 'express-validator'
import { Op } from 'sequelize'
import {
  User,
  EmailVerification,
  PasswordReset,
  RefreshToken,
  UserCompanyRole,
  LoginAttempt
} from '../models/index.js'
import { signAccessToken } from '../utils/token.js'
import { isSuperAdminEmail } from '../utils/superAdmin.js'
import { isEmailProviderConfigured, sendResetEmail, sendVerificationEmail } from '../services/emailService.js'

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

const normalizeEmail = (email) => email.trim().toLowerCase()

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

const generateToken = (ttlMinutes) => {
  const token = crypto.randomBytes(48).toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000)
  return { token, tokenHash, expiresAt }
}

const ACCESS_TTL_MINUTES = 15
const REFRESH_TTL_DAYS = 7
const VERIFY_TTL_HOURS = 24
const RESET_TTL_MINUTES = 30
const MAX_FAILED = 5
const LOCK_MINUTES = 15

export const registerValidators = [
  body('name').trim().isLength({ min: 2 }),
  body('email').isEmail().normalizeEmail(),
  body('password').matches(PASSWORD_POLICY).withMessage('Password must be 8+ chars with upper, lower, number')
]

export const loginValidators = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  body('companyId').optional().isString()
]

export const forgotValidators = [body('email').isEmail().normalizeEmail()]

export const resetValidators = [
  body('token').isString().notEmpty(),
  body('password').matches(PASSWORD_POLICY).withMessage('Password must be 8+ chars with upper, lower, number')
]

export const verifyValidators = [query('token').isString().notEmpty()]

export const register = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email)
    const { name, password } = req.body
    const exists = await User.findOne({ where: { email } })
    if (exists) return res.status(409).json({ message: 'Email already registered' })

    const hash = await bcrypt.hash(password, 12)
    const user = await User.create({ name, email, password: hash, role: 'viewer', isVerified: false })

    const shouldAutoVerify = process.env.NODE_ENV !== 'production' || !isEmailProviderConfigured

    if (shouldAutoVerify) {
      await user.update({ isVerified: true })
      return res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        message: 'Registered and auto-verified (dev mode)'
      })
    }

    const emailEnabled = isEmailProviderConfigured

    if (emailEnabled) {
      const { token, tokenHash, expiresAt } = generateToken(VERIFY_TTL_HOURS * 60)
      await EmailVerification.create({ userId: user.id, tokenHash, expiresAt })
      sendVerificationEmail({ email, token })
        .then((result) => {
          if (result?.status === 'sent') {
            console.log('Verification email delivered', { email, provider: result.provider || 'brevo' })
          } else {
            console.warn('Verification email not delivered', { email, reason: result?.reason || 'unknown' })
          }
        })
        .catch((e) => console.error('Verify email send failed', e))
      return res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        message: 'Registered. Check email to verify.'
      })
    }

    await user.update({ isVerified: true })
    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      message: 'Registered and auto-verified (dev mode)'
    })
  } catch (err) {
    next(err)
  }
}

export const verifyEmail = async (req, res, next) => {
  try {
    const rawToken = req.query.token
    const tokenHash = hashToken(rawToken)
    const record = await EmailVerification.findOne({ where: { tokenHash, usedAt: null, expiresAt: { [Op.gt]: new Date() } } })
    if (!record) return res.status(400).json({ message: 'Invalid or expired token' })
    await record.update({ usedAt: new Date() })
    await User.update({ isVerified: true }, { where: { id: record.userId } })
    res.json({ message: 'Email verified' })
  } catch (err) {
    next(err)
  }
}

export const login = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email)
    const { password } = req.body
    const genericError = () => res.status(401).json({ message: 'Invalid credentials' })

    const user = await User.findOne({ where: { email } })
    if (!user) {
      await LoginAttempt.create({ email, success: false, ip: req.ip, reason: 'not_found' })
      return genericError()
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await LoginAttempt.create({ userId: user.id, email, success: false, ip: req.ip, reason: 'locked' })
      return genericError()
    }

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) {
      const nextFailed = user.failedLogins + 1
      const lockedUntil = nextFailed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null
      await User.mongooseModel.updateOne({ _id: user.id }, { $set: { failedLogins: nextFailed, lockedUntil } }).exec()
      await LoginAttempt.create({ userId: user.id, email, success: false, ip: req.ip, reason: 'bad_password' })
      return genericError()
    }

    if (!user.isVerified) return res.status(403).json({ message: 'Email not verified' })

    await User.mongooseModel.updateOne({ _id: user.id }, { $set: { failedLogins: 0, lockedUntil: null } }).exec()

    const memberships = await UserCompanyRole.findAll({ where: { userId: user.id }, attributes: ['companyId', 'role'] })
    const effectiveRole = isSuperAdminEmail(user.email) ? 'admin' : user.role
    const companies = memberships.map((m) => m.companyId)
    const payload = { sub: user.id, role: effectiveRole, companyIds: companies }
    const accessToken = signAccessToken(payload, { jwtid: crypto.randomUUID() })

    const { token: refreshTokenPlain, tokenHash, expiresAt } = generateToken(REFRESH_TTL_DAYS * 24 * 60)
    await RefreshToken.create({ userId: user.id, tokenHash, expiresAt })

    res.cookie('refreshToken', refreshTokenPlain, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
      path: '/api/auth/refresh'
    })

    await LoginAttempt.create({ userId: user.id, email, success: true, ip: req.ip })

    res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: effectiveRole, companies }
    })
  } catch (err) {
    next(err)
  }
}

export const refresh = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken || req.body.token
    if (!token) return res.status(401).json({ message: 'Missing refresh token' })
    const tokenHash = hashToken(token)
    const stored = await RefreshToken.findOne({ where: { tokenHash, revokedAt: null, expiresAt: { [Op.gt]: new Date() } } })
    if (!stored) return res.status(401).json({ message: 'Invalid refresh token' })

    // rotate
    const { token: newPlain, tokenHash: newHash, expiresAt } = generateToken(REFRESH_TTL_DAYS * 24 * 60)
    await RefreshToken.update({ revokedAt: new Date(), replacedBy: null }, { where: { id: stored.id } })
    await RefreshToken.create({ userId: stored.userId, tokenHash: newHash, expiresAt })

    const user = await User.findByPk(stored.userId)
    const memberships = await UserCompanyRole.findAll({ where: { userId: user.id }, attributes: ['companyId'] })
    const effectiveRole = isSuperAdminEmail(user.email) ? 'admin' : user.role
    const companies = memberships.map((m) => m.companyId)
    const accessToken = signAccessToken({ sub: user.id, role: effectiveRole, companyIds: companies }, { jwtid: crypto.randomUUID() })

    res.cookie('refreshToken', newPlain, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
      path: '/api/auth/refresh'
    })

    res.json({ accessToken })
  } catch (err) {
    err.status = 401
    next(err)
  }
}

export const forgotPassword = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email)
    const user = await User.findOne({ where: { email } })
    if (user) {
      const { token, tokenHash, expiresAt } = generateToken(RESET_TTL_MINUTES)
      await PasswordReset.create({ userId: user.id, tokenHash, expiresAt })
      if (isEmailProviderConfigured) {
        try {
          const result = await sendResetEmail({ email, token })
          if (result?.status === 'sent') {
            console.log('Reset email delivered', { email, provider: result.provider || 'brevo' })
          } else {
            console.warn('Reset email not delivered', { email, reason: result?.reason || 'unknown' })
          }
        } catch (e) {
          console.error('Reset email send failed', e)
        }
      } else {
        console.warn('Reset email skipped: no email provider configured', { email })
      }
    } else {
      console.info('Forgot password requested for unknown email')
    }
    res.json({ message: 'If this email exists, a reset link has been sent.' })
  } catch (err) {
    next(err)
  }
}

export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body
    const tokenHash = hashToken(token)
    const reset = await PasswordReset.findOne({ where: { tokenHash, usedAt: null, expiresAt: { [Op.gt]: new Date() } } })
    if (!reset) return res.status(400).json({ message: 'Invalid or expired token' })

    const hash = await bcrypt.hash(password, 12)
    await User.update({ password: hash, failedLogins: 0, lockedUntil: null }, { where: { id: reset.userId } })
    await PasswordReset.update({ usedAt: new Date() }, { where: { id: reset.id } })
    await RefreshToken.update({ revokedAt: new Date() }, { where: { userId: reset.userId, revokedAt: null } })

    res.json({ message: 'Password reset successful' })
  } catch (err) {
    next(err)
  }
}
