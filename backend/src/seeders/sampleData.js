import bcrypt from 'bcrypt'
import { sequelize, User, Company, UserCompanyRole, Investment, Transaction } from '../models/index.js'
import { recalcInvestment } from '../services/calculationService.js'

const seed = async () => {
  await sequelize.sync({ force: true })
  const password = await bcrypt.hash('Password123!', 10)
  const admin = await User.create({ name: 'Admin User', email: 'admin@ifts.test', password })
  const manager = await User.create({ name: 'Manager User', email: 'manager@ifts.test', password })

  const company = await Company.create({
    name: 'Addis Capital',
    description: 'Sample investment company',
    approvalThreshold: 50000,
    reportingPreferences: 'detailed',
    createdBy: admin.id
  })

  await UserCompanyRole.bulkCreate([
    { userId: admin.id, companyId: company.id, role: 'admin', assignedBy: admin.id },
    { userId: manager.id, companyId: company.id, role: 'manager', assignedBy: admin.id }
  ])

  const invPayload = {
    companyId: company.id,
    assetType: 'bonds',
    principal: 100000,
    interestRate: 0.08,
    duration: 12,
    startDate: new Date('2025-01-01'),
    status: 'active',
    createdBy: admin.id
  }
  const { maturityDate } = recalcInvestment(invPayload)
  const investment = await Investment.create({ ...invPayload, maturityDate })

  await Transaction.bulkCreate([
    { companyId: company.id, investmentId: investment.id, transactionType: 'buy', amount: 100000, date: new Date('2025-01-05'), status: 'posted', requiresApproval: false },
    { companyId: company.id, investmentId: investment.id, transactionType: 'interest', amount: 8000, date: new Date('2025-06-30'), status: 'posted', requiresApproval: false }
  ])

  console.log('Seed complete')
  process.exit(0)
}

seed().catch(err => { console.error(err); process.exit(1) })
