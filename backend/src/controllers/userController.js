import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { body, query } from 'express-validator'
import { User, UserCompanyRole } from '../models/index.js'

export const listUsersValidators = [query('companyId').isString()]

export const inviteUserValidators = [
  body('name').trim().isLength({ min: 2 }),
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['admin', 'manager', 'viewer']),
  body('companyId').isString(),
  body('password').optional().isLength({ min: 8 })
]

export const assignRoleValidators = [
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['admin', 'manager', 'viewer']),
  body('companyId').isString()
]

const hashPassword = async (password) => bcrypt.hash(password, 12)

export const listUsers = async (req, res, next) => {
  try {
    const companyId = req.query.companyId
    const memberships = await UserCompanyRole.findAll({ where: { companyId }, include: [{ model: User }] })
    const users = memberships.map((m) => ({
      id: m.User.id,
      name: m.User.name,
      email: m.User.email,
      role: m.role,
      companyId: m.companyId,
      status: m.User.isVerified ? 'Active' : 'Pending'
    }))
    res.json(users)
  } catch (err) {
    next(err)
  }
}

export const inviteUser = async (req, res, next) => {
  try {
    const { name, email, role, companyId } = req.body
    const password = req.body.password || crypto.randomBytes(8).toString('hex')

    let user = await User.findOne({ where: { email } })
    if (!user) {
      const hash = await hashPassword(password)
      user = await User.create({ name, email, password: hash, role: 'viewer', isVerified: true })
    }

    const [membership, created] = await UserCompanyRole.findOrCreate({
      where: { userId: user.id, companyId },
      defaults: { role, assignedBy: req.user.id }
    })

    if (!created && membership.role !== role) {
      await membership.update({ role, assignedBy: req.user.id })
    }

    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email },
      role: membership.role,
      companyId,
      tempPassword: created ? password : undefined
    })
  } catch (err) {
    next(err)
  }
}

export const assignRole = async (req, res, next) => {
  try {
    const { email, role, companyId } = req.body
    const user = await User.findOne({ where: { email } })
    if (!user) return res.status(404).json({ message: 'User not found' })

    const [membership] = await UserCompanyRole.findOrCreate({
      where: { userId: user.id, companyId },
      defaults: { role, assignedBy: req.user.id }
    })

    if (membership.role !== role) {
      await membership.update({ role, assignedBy: req.user.id })
    }

    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      role: role,
      companyId
    })
  } catch (err) {
    next(err)
  }
}
