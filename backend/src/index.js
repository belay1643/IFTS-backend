import dotenv from 'dotenv'
import app from './app.js'
import { sequelize, syncDb } from './models/index.js'
import { getEmailProviderStatus } from './services/emailService.js'

dotenv.config()

const PORT = process.env.PORT || 4000

const start = async () => {
  try {
    await sequelize.authenticate()
    await syncDb()
    const emailStatus = getEmailProviderStatus()
    console.log('Email provider status', emailStatus)
    app.listen(PORT, () => console.log(`API listening on port ${PORT}`))
  } catch (err) {
    console.error('Unable to start server', err)
    process.exit(1)
  }
}

start()
