import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { body, query } from 'express-validator'
import { User, UserCompanyRole } from '../models/index.js'
import { sendUserInviteEmail } from '../services/emailService.js'

export const listUsersValidators = [query('companyId').isString()]

export const inviteUserValidators = [
  body('name').trim().isLength({ min: 2 }),
  body('email').isEmail().normalizeEmail(),
  body('phone').optional({ nullable: true }).trim().isLength({ min: 7 }),
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
    const memberships = await UserCompanyRole.findAll({ where: { companyId } })
    const userIds = memberships.map((m) => m.userId)
    const users = userIds.length > 0 ? await User.findAll({ where: { id: userIds } }) : []
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]))
    const result = memberships
      .filter((m) => userMap[m.userId])
      .map((m) => ({
        id: userMap[m.userId].id,
        name: userMap[m.userId].name,
        email: userMap[m.userId].email,
        phone: userMap[m.userId].phone || '',
        role: m.role,
        companyId: m.companyId,
        status: userMap[m.userId].isVerified ? 'Active' : 'Pending'
      }))
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export const inviteUser = async (req, res, next) => {
  try {
    const { name, email, role, companyId, phone } = req.body
    const password = req.body.password || crypto.randomBytes(8).toString('hex')

    // Enforce one manager per company
    if (role === 'manager') {
      const existingManager = await UserCompanyRole.findOne({ where: { companyId, role: 'manager' } })
      if (existingManager) {
        const existingUser = await User.findByPk(existingManager.userId)
        if (existingUser && existingUser.email !== email) {
          return res.status(409).json({ message: `This company already has a manager (${existingUser.email}). Remove them first.` })
        }
      }
    }

    let user = await User.findOne({ where: { email } })
    if (!user) {
      const hash = await hashPassword(password)
      user = await User.create({ name, email, phone, password: hash, role: 'viewer', isVerified: true })
    } else {
      const updatePatch = {}
      if (name && name !== user.name) updatePatch.name = name
      if (phone && phone !== user.phone) updatePatch.phone = phone
      if (Object.keys(updatePatch).length > 0) await user.update(updatePatch)
    }

    const [membership, created] = await UserCompanyRole.findOrCreate({
      where: { userId: user.id, companyId },
      defaults: { role, assignedBy: req.user.id }
    })

    if (!created && membership.role !== role) {
      await membership.update({ role, assignedBy: req.user.id })
    }

    const inviteEmailStatus = await sendUserInviteEmail({
      email, name, role, companyId,
      tempPassword: created ? password : undefined
    })

    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone || phone || '' },
      role: membership.role,
      companyId,
      tempPassword: created ? password : undefined,
      inviteEmailStatus
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
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone || '' },
      role: role,
      companyId
    })
  } catch (err) {
    next(err)
  }
}
