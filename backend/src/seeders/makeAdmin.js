import { sequelize, User } from '../models/index.js'

const email = 'zeradawit23@gmail.com'

const run = async () => {
  await sequelize.authenticate()
  const user = await User.findOne({ where: { email } })
  if (!user) {
    console.error(`User with email "${email}" not found`)
    process.exit(1)
  }
  await user.update({ role: 'admin' })
  console.log(`Updated ${user.name} (${email}) to admin`)
  process.exit(0)
}

run().catch((err) => { console.error(err); process.exit(1) })
