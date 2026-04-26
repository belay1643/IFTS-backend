import 'dotenv/config'
import { createServer } from 'node:http'
import app from './app.js'
import { sequelize, syncDb } from './models/index.js'
import { getEmailProviderStatus } from './services/emailService.js'

const BASE_PORT = Number(process.env.PORT) || 5000
const MAX_PORT_RETRIES = 10

const getMongoLogTarget = () => {
  const fallback = 'mongodb://127.0.0.1:27017'
  const rawUri = process.env.MONGO_URI

  if (!rawUri) return fallback

  try {
    const parsed = new URL(rawUri)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return rawUri
  }
}

const listenWithPortFallback = (startPort, retries = MAX_PORT_RETRIES) => new Promise((resolve, reject) => {
  let settled = false

  const tryListen = (port, attemptsLeft) => {
    const server = createServer(app)

    const onListening = () => {
      if (settled) return
      settled = true
      resolve({ server, port })
    }

    const onError = (err) => {
      if (settled) return
      if (err?.code === 'EADDRINUSE' && attemptsLeft > 0) {
        const nextPort = port + 1
        console.warn(`Port ${port} is in use, trying ${nextPort}...`)
        tryListen(nextPort, attemptsLeft - 1)
        return
      }
      settled = true
      reject(err)
    }

    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port)
  }

  tryListen(startPort, retries)
})

const registerShutdownHandlers = (server) => {
  const gracefulShutdown = (signal) => {
    console.log(`${signal} received, shutting down server...`)
    server.close((err) => {
      if (err) {
        console.error('Error during server shutdown', err)
        process.exit(1)
      }
      process.exit(0)
    })
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'))
}

const start = async () => {
  try {
    console.log(`Connecting to PostgreSQL at ${process.env.DATABASE_URL}`)
    await sequelize.authenticate()
    await sequelize.sync()
    if ((process.env.NODE_ENV || 'development') === 'development') {
      const emailStatus = getEmailProviderStatus()
      console.log('Email provider status', emailStatus)
    }
    const { server, port } = await listenWithPortFallback(BASE_PORT)
    registerShutdownHandlers(server)
    console.log(`Server running on port ${port}`)
  } catch (err) {
    console.error('Unable to start server', err)
    process.exit(1)
  }
}

start()
