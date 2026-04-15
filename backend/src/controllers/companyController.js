import { body, param, query } from 'express-validator'
import { Company, UserCompanyRole } from '../models/index.js'

export const createCompanyValidators = [
  body('name').notEmpty(),
  body('approvalThreshold').isNumeric(),
  body('reportingPreferences').optional().isString()
]

export const updateCompanyValidators = [
  param('id').isUUID(),
  body('name').optional().notEmpty(),
  body('description').optional(),
  body('approvalThreshold').optional().isNumeric(),
  body('reportingPreferences').optional().isString(),
  body('status').optional().isIn(['active', 'archived'])
]

export const listCompanyValidators = [
  query('search').optional().isString(),
  query('status').optional().isIn(['active', 'archived']),
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 })
]

export const listCompanies = async (req, res, next) => {
  try {
    const memberships = await UserCompanyRole.findAll({ where: { userId: req.user.id }, include: Company })
    let companies = memberships.map((m) => ({ ...m.Company.toJSON(), role: m.role }))

    const { search, status } = req.query
    if (search) {
      const term = search.toLowerCase()
      companies = companies.filter((c) => c.name.toLowerCase().includes(term))
    }
    if (status) {
      companies = companies.filter((c) => c.status === status)
    }

    const page = Number(req.query.page) || 1
    const pageSize = Number(req.query.pageSize) || 10
    const total = companies.length
    const start = (page - 1) * pageSize
    const paged = companies.slice(start, start + pageSize)

    res.json({ data: paged, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 } })
  } catch (err) {
    next(err)
  }
}

export const createCompany = async (req, res, next) => {
  try {
    const { name, description, approvalThreshold, reportingPreferences } = req.body
    const company = await Company.create({ name, description, approvalThreshold, reportingPreferences, createdBy: req.user.id })
    await UserCompanyRole.create({ userId: req.user.id, companyId: company.id, role: 'admin', assignedBy: req.user.id })
    res.status(201).json(company)
  } catch (err) {
    next(err)
  }
}

export const updateCompany = async (req, res, next) => {
  try {
    const company = await Company.findByPk(req.params.id)
    if (!company) return res.status(404).json({ message: 'Company not found' })
    const membership = await UserCompanyRole.findOne({ where: { userId: req.user.id, companyId: company.id } })
    if (!membership || membership.role !== 'admin') return res.status(403).json({ message: 'Admin role required' })
    res.locals.oldValue = company.toJSON()
    await company.update(req.body)
    res.locals.newValue = company.toJSON()
    res.locals.recordId = company.id
    res.json(company)
  } catch (err) {
    next(err)
  }
}
